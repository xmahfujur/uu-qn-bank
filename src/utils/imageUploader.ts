import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatImageUrl } from './imageUrl';

export const PRIMARY_IMGBB_API_KEY = '559a1db9c9b114ebf42f3a39489be200';
export const BACKUP_IMGBB_API_KEY = 'c66284ea8683ede65e71e14d201bec19';
export const IMGBB_API_KEYS = [
  '559a1db9c9b114ebf42f3a39489be200',
  'c66284ea8683ede65e71e14d201bec19'
];

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
 */
export async function optimizeImageFile(
  file: File, 
  maxDimension = 1400, 
  quality = 0.78
): Promise<File> {
  const uniqueName = generateUniquePaperFileName(file.name);

  // If not an image, return as is
  if (file.type && !file.type.startsWith('image/')) {
    return file;
  }

  // If already under 180KB JPEG, keep as is
  if (file.size < 180 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
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

    // Safety timeout: 8 seconds
    const timer = setTimeout(fallback, 8000);

    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {
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
 * Converts a File object to a base64 string safely without DOM locking
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  try {
    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
  } catch (abErr) {
    console.warn('[imageUploader] arrayBuffer notice:', abErr);
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64 || '');
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    } catch {
      resolve('');
    }
  });
}

export interface ImgBBUploadResult {
  url: string;
  deleteUrl?: string;
  id?: string;
}

/**
 * Asynchronously backs up an uploaded image to the server and Firestore
 */
async function asyncBackupToServer(file: File, fileName: string) {
  try {
    const formData = new FormData();
    formData.append('image', file, fileName);
    formData.append('name', fileName.replace(/\.[^/.]+$/, ''));
    await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
  } catch {
    // Non-blocking background backup
  }
}

/**
 * Direct ImgBB API v1 upload handler.
 * Implements the official ImgBB API v1 specification:
 * POST https://api.imgbb.com/1/upload
 * Parameters: key (required), image (required - binary or base64), name (optional).
 */
async function uploadToImgBBDirect(
  file: File,
  apiKey: string,
  apiSafeName: string
): Promise<ImgBBUploadResult | null> {
  // Attempt 1: Binary multipart upload
  try {
    const formData = new FormData();
    formData.append('image', file, `${apiSafeName}.jpg`);
    formData.append('name', apiSafeName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      signal: controller.signal,
      body: formData
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.success && data?.data?.url) {
        return {
          url: formatImageUrl(data.data.url),
          deleteUrl: data.data.delete_url || data.data.deleteUrl,
          id: data.data.id || apiSafeName
        };
      }
    }
  } catch (err: any) {
    console.warn(`[ImgBB Binary Upload Notice with key ...${apiKey.slice(-6)}]:`, err?.message);
  }

  // Attempt 2: Base64 data payload
  try {
    const base64 = await fileToBase64(file);
    if (base64) {
      const formData = new FormData();
      formData.append('image', base64);
      formData.append('name', apiSafeName);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        signal: controller.signal,
        body: formData
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data?.data?.url) {
          return {
            url: formatImageUrl(data.data.url),
            deleteUrl: data.data.delete_url || data.data.deleteUrl,
            id: data.data.id || apiSafeName
          };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[ImgBB Base64 Upload Notice with key ...${apiKey.slice(-6)}]:`, err?.message);
  }

  return null;
}

/**
 * Uploads a single file using a multi-tier resilient pipeline:
 * Tier 1: Direct Client-Side ImgBB API v1 upload using official keys (primary & backup)
 * Tier 2: Resilient Self-Hosted server binary upload (/api/upload with Multer)
 * Tier 3: Direct Client-Side Firestore paper_images storage
 */
export async function uploadSingleImageToImgBBWithDetails(
  file: File, 
  providedKey?: string,
  _ignoredMetadata?: any
): Promise<ImgBBUploadResult> {
  const uniqueName = generateUniquePaperFileName(file.name);
  const renamedFile = new File([file], uniqueName, { type: file.type || 'image/jpeg' });
  const optimizedFile = await optimizeImageFile(renamedFile, 1400, 0.78);
  const apiSafeName = optimizedFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanId = `${apiSafeName}.jpg`;

  // Candidate API keys: prioritize providedKey (if passed), then PRIMARY, then BACKUP
  const candidateKeys = Array.from(new Set([
    providedKey,
    PRIMARY_IMGBB_API_KEY,
    BACKUP_IMGBB_API_KEY,
    ...IMGBB_API_KEYS
  ])).filter((k): k is string => typeof k === 'string' && k.trim().length > 15);

  // TIER 1: Direct ImgBB API v1 upload from client browser
  for (const key of candidateKeys) {
    const result = await uploadToImgBBDirect(optimizedFile, key, apiSafeName);
    if (result && result.url) {
      console.log(`[ImgBB Upload Success] Paper page hosted at ${result.url}`);
      // Asynchronously backup to server/Firestore in background
      asyncBackupToServer(optimizedFile, cleanId);
      return result;
    }
  }

  console.warn('[imageUploader] Direct ImgBB upload attempts exhausted, falling back to server storage.');

  // TIER 2: Direct Binary Multipart Upload to local /api/upload
  try {
    const formData = new FormData();
    formData.append('image', optimizedFile, cleanId);
    formData.append('name', apiSafeName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('/api/upload', {
      method: 'POST',
      signal: controller.signal,
      body: formData
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.success && data?.data?.url) {
        return {
          url: formatImageUrl(data.data.url),
          deleteUrl: data.data.deleteUrl,
          id: cleanId
        };
      }
    }
  } catch (err: any) {
    console.warn('[Direct Multipart Upload Notice] Failed, attempting Firestore fallback:', err?.message);
  }

  // TIER 3: Save to Firestore collection 'paper_images' using base64
  let base64 = '';
  try {
    base64 = await fileToBase64(optimizedFile);
    if (!base64) {
      base64 = await fileToBase64(file);
    }
  } catch (e) {
    console.warn('Base64 conversion notice:', e);
  }

  if (base64) {
    try {
      const fullDataUrl = `data:image/jpeg;base64,${base64}`;
      if (fullDataUrl.length < 950 * 1024) {
        await setDoc(doc(db, 'paper_images', cleanId), {
          fileName: cleanId,
          dataUrl: fullDataUrl,
          contentType: 'image/jpeg',
          createdAt: new Date().toISOString()
        }, { merge: true });
        console.log(`[Firestore Direct Storage] Paper page saved permanently: ${cleanId}`);
      }
      return {
        url: `/api/image/${cleanId}`,
        id: cleanId
      };
    } catch (fsErr: any) {
      console.warn('[Firestore Storage Notice]:', fsErr.message);
    }
  }

  // If even Tier 3 failed, throw an error so the UI prompts the user to Retry
  throw new Error(`Upload failed for ${file.name}. Please tap Retry.`);
}

/**
 * Uploads a single file and returns the formatted URL.
 */
export async function uploadSingleImageToImgBB(
  file: File, 
  key = PRIMARY_IMGBB_API_KEY
): Promise<string> {
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
