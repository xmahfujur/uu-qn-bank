import { formatImageUrl } from './imageUrl';

export const MAX_RAW_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB raw file limit before compression
export const UPLOAD_CONCURRENCY_LIMIT = 2;
const UPLOAD_TIMEOUT_MS = 30000;
const RETRY_BACKOFF_DELAYS_MS = [1000, 2000, 4000]; // 1s, 2s, 4s exponential backoff

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/tiff'
]);

const ALLOWED_IMAGE_EXTENSIONS_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|jfif|tiff?)$/i;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a selected file is a supported image and within size limits.
 */
export function validateImageFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'Missing file reference.' };
  }

  const hasValidMime =
    file.type && (ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()) || file.type.startsWith('image/'));
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS_RE.test(file.name || '');

  if (!hasValidMime && !hasValidExt) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported image. Please select JPG, PNG, WEBP, GIF, or HEIC files only.`
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: `"${file.name}" is empty (0 bytes) and cannot be uploaded.`
    };
  }

  if (file.size > MAX_RAW_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `"${file.name}" (${sizeMb} MB) exceeds the 25 MB limit per page.`
    };
  }

  return { valid: true };
}

/**
 * Generates a unique, URL-safe alphanumeric file name preserving order metadata.
 */
export function generateUniquePaperFileName(originalName?: string, pageIndex?: number): string {
  const timestamp = Date.now();
  const randomEntropy = Math.random().toString(36).substring(2, 9);

  let baseName = 'page';
  let ext = 'jpg';

  if (originalName && typeof originalName === 'string') {
    const lastDotIndex = originalName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      baseName = originalName.substring(0, lastDotIndex);
      ext = originalName.substring(lastDotIndex + 1).toLowerCase();
    } else {
      baseName = originalName;
    }
  }

  const sanitized = baseName
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 24)
    .replace(/^_+|_+$/g, '');
  const cleanExt = ext && ext.length <= 5 && /^[a-zA-Z0-9]+$/.test(ext) ? ext : 'jpg';
  const pageTag = typeof pageIndex === 'number' ? `_p${pageIndex}` : '';
  const meaningfulPart = sanitized ? `_${sanitized}` : '';

  return `uu_paper_${timestamp}_${randomEntropy}${pageTag}${meaningfulPart}.${cleanExt}`;
}

/**
 * Recreates a File object from a dataUrl or blobUrl (for retries if needed).
 */
export async function createFileFromDataUrl(dataUrl: string, fileName?: string): Promise<File> {
  const safeName = fileName || generateUniquePaperFileName('recovered_page.jpg');
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], safeName, { type: blob.type || 'image/jpeg' });
  } catch (err) {
    if (dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], safeName, { type: mime });
    }
    throw err;
  }
}

/**
 * Compresses an image File on the client using canvas (max width 1600px, JPEG quality ~0.8).
 * Returns a File/Blob ready for FormData upload (never huge base64 strings).
 */
export async function optimizeImageFile(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<File> {
  const uniqueName = generateUniquePaperFileName(file.name);
  const cleanJpgName = uniqueName.replace(/\.[^/.]+$/, '') + '.jpg';

  if (file.type && !file.type.startsWith('image/') && !ALLOWED_IMAGE_EXTENSIONS_RE.test(file.name || '')) {
    return file;
  }

  return new Promise((resolve) => {
    let settled = false;
    const fallback = () => {
      if (!settled) {
        settled = true;
        resolve(new File([file], uniqueName, { type: file.type || 'image/jpeg' }));
      }
    };

    const timer = setTimeout(fallback, 10000);

    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      clearTimeout(timer);
      fallback();
      return;
    }

    const img = new Image();

    img.onload = () => {
      clearTimeout(timer);
      if (settled) return;
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        fallback();
        return;
      }

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fallback();
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fallback();
            return;
          }
          settled = true;
          resolve(new File([blob], cleanJpgName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      fallback();
    };

    img.src = objectUrl;
  });
}

export interface ImgBBUploadResult {
  url: string;
  deleteUrl?: string;
  id?: string;
}

class RetryableUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableUploadError';
  }
}

class FatalUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalUploadError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postFileOnceToApi(
  compressedFile: File,
  safeName: string
): Promise<ImgBBUploadResult> {
  const formData = new FormData();
  formData.append('image', compressedFile, compressedFile.name || `${safeName}.jpg`);
  formData.append('name', safeName);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      signal: controller.signal,
      body: formData
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.success && (data?.url || data?.data?.url)) {
      const rawUrl = data.data?.url || data.url;
      return {
        url: formatImageUrl(rawUrl),
        deleteUrl: data.data?.deleteUrl || data.deleteUrl,
        id: data.data?.id || safeName
      };
    }

    const errorMessage = data?.error || `Upload failed with status ${response.status}`;

    // Retry only on 429 and 5xx
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      throw new RetryableUploadError(errorMessage);
    }

    throw new FatalUploadError(errorMessage);
  } catch (err: any) {
    if (err instanceof RetryableUploadError || err instanceof FatalUploadError) {
      throw err;
    }
    if (err?.name === 'AbortError') {
      throw new RetryableUploadError('Upload timed out after 30 seconds');
    }
    // Network errors (fetch rejection / offline / reset) are retryable
    throw new RetryableUploadError(err?.message || 'Network error during upload');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compresses image on client (max width 1600px, JPEG 0.8), sends as FormData to /api/upload
 * with a 30s AbortController timeout and exponential backoff retries (1s, 2s, 4s).
 */
export async function uploadSingleImageToImgBBWithDetails(
  file: File,
  onProgress?: (status: { attempt: number; maxAttempts: number }) => void
): Promise<ImgBBUploadResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  const compressedFile = await optimizeImageFile(file, 1600, 0.8);
  const safeName = compressedFile.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_') || `uu_paper_${Date.now()}`;

  const maxAttempts = 1 + RETRY_BACKOFF_DELAYS_MS.length; // initial + 3 retries (1s, 2s, 4s)
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress?.({ attempt, maxAttempts });
    try {
      return await postFileOnceToApi(compressedFile, safeName);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error('Upload failed');
      if (err instanceof FatalUploadError) {
        throw lastError;
      }
      if (attempt <= RETRY_BACKOFF_DELAYS_MS.length) {
        const waitMs = RETRY_BACKOFF_DELAYS_MS[attempt - 1];
        await delay(waitMs);
      }
    }
  }

  throw lastError || new Error(`Failed to upload "${file.name}" after ${maxAttempts} attempts.`);
}

/**
 * Runs async upload workers with a strict concurrency limit (default 2)
 * while preserving the exact input item index order in results.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, originalIndex: number) => Promise<R>,
  concurrency = UPLOAD_CONCURRENCY_LIMIT
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      try {
        const value = await worker(items[currentIndex], currentIndex);
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

/**
 * Uploads a single file and returns the formatted URL.
 */
export async function uploadSingleImageToImgBB(file: File): Promise<string> {
  const res = await uploadSingleImageToImgBBWithDetails(file);
  return res.url;
}

/**
 * Automatically deletes images from ImgBB using their delete_urls or image URLs.
 */
export async function deleteImagesFromImgBB(
  deleteUrls: string[] = [],
  imageUrls: string[] = []
): Promise<{ success: boolean; deletedCount: number; details?: any }> {
  try {
    const cleanDeleteUrls = (deleteUrls || []).filter((u) => typeof u === 'string' && u.trim() !== '');
    const cleanImageUrls = (imageUrls || []).filter((u) => typeof u === 'string' && u.trim() !== '');

    if (cleanDeleteUrls.length === 0 && cleanImageUrls.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const response = await fetch('/api/imgbb/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deleteUrls: cleanDeleteUrls,
        imageUrls: cleanImageUrls
      })
    });

    if (response.ok) {
      return await response.json();
    }
    return { success: false, deletedCount: 0 };
  } catch (err) {
    console.error('Failed to trigger automatic ImgBB image deletion:', err);
    return { success: false, deletedCount: 0 };
  }
}
