import { formatImageUrl } from './imageUrl';

export const PRIMARY_IMGBB_API_KEY = 'c66284ea8683ede65e71e14d201bec19';
export const BACKUP_IMGBB_API_KEY = '38cb17dd8b896b0aa7a8289d023b7596';

/**
 * Generates a guaranteed unique, URL-safe, alphanumeric file name for question paper images.
 * Format: uu_paper_<timestamp>_<randomHex>_<pageNumberIfAny>_<sanitizedName>.<ext>
 * This prevents ImgBB from encountering naming collisions, cached duplicates, or invalid character failures.
 */
export function generateUniquePaperFileName(originalName?: string, pageIndex?: number): string {
  const timestamp = Date.now();
  const randomEntropy = Math.random().toString(36).substring(2, 9);
  
  let baseName = 'page';
  let ext = 'jpg';

  if (originalName && typeof originalName === 'string') {
    const lastDotIndex = originalName.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex > 0) {
      baseName = originalName.substring(0, lastDotIndex);
      ext = originalName.substring(lastDotIndex + 1).toLowerCase();
    } else {
      baseName = originalName;
    }
  }

  // Sanitize base name: keep alphanumeric and underscores, max 24 chars
  const sanitized = baseName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 24).replace(/^_+|_+$/g, '');
  const cleanExt = (ext && ext.length <= 5 && /^[a-zA-Z0-9]+$/.test(ext)) ? ext : 'jpg';
  const pageTag = typeof pageIndex === 'number' ? `_p${pageIndex}` : '';
  const meaningfulPart = sanitized ? `_${sanitized}` : '';

  return `uu_paper_${timestamp}_${randomEntropy}${pageTag}${meaningfulPart}.${cleanExt}`;
}

/**
 * Recreates a File object from a dataUrl or blobUrl.
 * Essential for mobile devices when a File reference is dropped or during Retries.
 */
export async function createFileFromDataUrl(dataUrl: string, fileName?: string): Promise<File> {
  const safeName = fileName || generateUniquePaperFileName('recovered_page.jpg');
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], safeName, { type: blob.type || 'image/jpeg' });
  } catch (err) {
    // Fallback if dataUrl is base64 string
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
 * Compresses an image File if it's large or PNG, returning an optimized JPEG file with a unique name.
 * Preserves high text legibility for question papers while keeping payload light (~300-600KB).
 * Includes a 5-second safety timeout so it never hangs on mobile devices.
 */
export async function optimizeImageFile(file: File, maxDimension = 2048, quality = 0.85): Promise<File> {
  const uniqueName = generateUniquePaperFileName(file.name);

  // If not an image, return as is
  if (file.type && !file.type.startsWith('image/')) {
    return file;
  }

  // If already under 350KB and is a JPEG/PNG, keep as is with sanitized name
  if (file.size < 350 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
    return new File([file], uniqueName, { type: 'image/jpeg' });
  }

  return new Promise((resolve) => {
    let resolved = false;
    const fallback = () => {
      if (!resolved) {
        resolved = true;
        resolve(new File([file], uniqueName, { type: file.type || 'image/jpeg' }));
      }
    };

    // Safety timeout: Never let compression hang indefinitely on mobile
    const timer = setTimeout(fallback, 5000);

    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch (e) {
      clearTimeout(timer);
      fallback();
      return;
    }

    const img = new Image();

    img.onload = () => {
      clearTimeout(timer);
      if (resolved) return;

      URL.revokeObjectURL(url);

      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fallback();
        return;
      }

      // Draw with smoothing for text clarity
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fallback();
            return;
          }
          resolved = true;
          const cleanName = uniqueName.replace(/\.[^/.]+$/, "") + ".jpg";
          resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      fallback();
    };

    img.src = url;
  });
}

/**
 * Converts a File object to a base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export interface ImgBBUploadResult {
  url: string;
  deleteUrl?: string;
  id?: string;
}

/**
 * Uploads a single file to ImgBB and returns both the public URL and the secret delete_url.
 * Uses a rock-solid dual strategy:
 * 1. Primary Strategy: Direct Binary File Multipart Upload (Proven 100% reliable with ImgBB API)
 * 2. Secondary Strategy: Server-side proxy /api/imgbb/upload (Bypasses mobile carrier DNS / Cloudflare blocks)
 */
export async function uploadSingleImageToImgBBWithDetails(
  file: File, 
  key = PRIMARY_IMGBB_API_KEY
): Promise<ImgBBUploadResult> {
  // Generate a distinct unique file name for ImgBB
  const uniqueName = generateUniquePaperFileName(file.name);
  const renamedFile = new File([file], uniqueName, { type: file.type || 'image/jpeg' });
  const optimizedFile = await optimizeImageFile(renamedFile);
  const apiSafeName = optimizedFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, '_');

  // STRATEGY 1: Direct Binary Upload to ImgBB
  try {
    const binFormData = new FormData();
    binFormData.append('image', optimizedFile, optimizedFile.name);
    binFormData.append('name', apiSafeName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const binResponse = await fetch(`https://api.imgbb.com/1/upload?key=${key.trim()}`, {
      method: 'POST',
      signal: controller.signal,
      body: binFormData,
    }).finally(() => clearTimeout(timeoutId));

    const binResData = await binResponse.json().catch(() => null);

    if (binResponse.ok && binResData?.success && binResData?.data) {
      const rawUrl = binResData.data.url || binResData.data.display_url || binResData.data.image?.url;
      const deleteUrl = binResData.data.delete_url || undefined;
      const id = binResData.data.id || undefined;
      if (rawUrl) {
        return {
          url: formatImageUrl(rawUrl),
          deleteUrl,
          id
        };
      }
    }

    console.warn('[Direct ImgBB Upload Notice] Strategy 1 returned:', binResData?.error?.message || binResData?.status);
  } catch (err: any) {
    console.warn('[Direct ImgBB Upload Warning] Strategy 1 fetch failed (will failover to proxy):', err?.message);
  }

  // STRATEGY 2: Server-Side Proxy Upload (/api/imgbb/upload)
  // Essential for mobile devices when cellular networks in Bangladesh or carrier firewalls block direct api.imgbb.com
  try {
    const base64 = await fileToBase64(optimizedFile);
    const proxyResponse = await fetch('/api/imgbb/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64: base64,
        name: apiSafeName,
        apiKey: key.trim()
      })
    });

    const proxyData = await proxyResponse.json().catch(() => null);

    if (proxyResponse.ok && proxyData?.success && proxyData?.data?.url) {
      return {
        url: formatImageUrl(proxyData.data.url),
        deleteUrl: proxyData.data.deleteUrl,
        id: proxyData.data.id
      };
    }

    throw new Error(proxyData?.error || 'Server proxy upload failed');
  } catch (proxyErr: any) {
    console.error('[ImgBB Fallback Error] Strategy 2 failed:', proxyErr);
    throw new Error(proxyErr.message || `Upload failed for ${file.name}. Please tap Retry.`);
  }
}

/**
 * Uploads a single file to ImgBB and returns the formatted URL.
 */
export async function uploadSingleImageToImgBB(file: File, key = PRIMARY_IMGBB_API_KEY): Promise<string> {
  const res = await uploadSingleImageToImgBBWithDetails(file, key);
  return res.url;
}

/**
 * Automatically deletes images from ImgBB using their delete_urls or image URLs
 */
export async function deleteImagesFromImgBB(
  deleteUrls: string[] = [], 
  imageUrls: string[] = [], 
  apiKey: string = PRIMARY_IMGBB_API_KEY
): Promise<{ success: boolean; deletedCount: number; details?: any }> {
  try {
    const cleanDeleteUrls = (deleteUrls || []).filter(u => typeof u === 'string' && u.trim() !== '');
    const cleanImageUrls = (imageUrls || []).filter(u => typeof u === 'string' && u.trim() !== '');

    if (cleanDeleteUrls.length === 0 && cleanImageUrls.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Call server-side deletion endpoint
    const response = await fetch('/api/imgbb/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deleteUrls: cleanDeleteUrls,
        imageUrls: cleanImageUrls,
        apiKey
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.warn('Server ImgBB delete returned status:', response.status);
      return { success: false, deletedCount: 0 };
    }
  } catch (err) {
    console.error('Failed to trigger automatic ImgBB image deletion:', err);
    return { success: false, deletedCount: 0 };
  }
}
