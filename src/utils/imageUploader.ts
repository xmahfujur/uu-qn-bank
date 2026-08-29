import { formatImageUrl } from './imageUrl';

const IMGBB_API_KEY = 'c66284ea8683ede65e71e14d201bec19';

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
 * Compresses an image File if it's large or PNG, returning an optimized JPEG file with a unique name.
 * Preserves visual clarity while dramatically reducing upload payload size.
 */
export async function optimizeImageFile(file: File, maxDimension = 2400, quality = 0.88): Promise<File> {
  // If it's not an image, return as is
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const uniqueName = generateUniquePaperFileName(file.name);

  // If very small (< 300KB), return as JPEG file with unique name
  if (file.size < 300 * 1024) {
    return new File([file], uniqueName, { type: file.type || 'image/jpeg' });
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
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
        resolve(new File([file], uniqueName, { type: 'image/jpeg' }));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(new File([file], uniqueName, { type: 'image/jpeg' }));
            return;
          }
          const cleanName = uniqueName.replace(/\.[^/.]+$/, "") + ".jpg";
          const optimizedFile = new File([blob], cleanName, { type: 'image/jpeg' });
          resolve(optimizedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(new File([file], uniqueName, { type: file.type || 'image/jpeg' }));
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
 * Ensures the file has a guaranteed unique name before uploading to prevent ImgBB name collisions.
 */
export async function uploadSingleImageToImgBBWithDetails(file: File, key = IMGBB_API_KEY): Promise<ImgBBUploadResult> {
  // Generate a distinct unique file name for ImgBB
  const uniqueName = generateUniquePaperFileName(file.name);
  const renamedFile = new File([file], uniqueName, { type: file.type || 'image/jpeg' });
  const optimizedFile = await optimizeImageFile(renamedFile);

  // Strategy 1: Upload via Base64 string in FormData (Recommended by ImgBB for JS)
  try {
    const base64 = await fileToBase64(optimizedFile);
    const formData = new FormData();
    formData.append('image', base64);
    
    // ImgBB 'name' parameter - alphanumeric and underscore only, unique
    const apiSafeName = optimizedFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, '_');
    formData.append('name', apiSafeName);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${key.trim()}`, {
      method: 'POST',
      body: formData,
    });

    const resData = await response.json().catch(() => null);

    if (response.ok && resData?.success && resData?.data) {
      const rawUrl = resData.data.url || resData.data.display_url || resData.data.image?.url;
      const deleteUrl = resData.data.delete_url || undefined;
      const id = resData.data.id || undefined;
      if (rawUrl) {
        return {
          url: formatImageUrl(rawUrl),
          deleteUrl,
          id
        };
      }
    }

    const base64Error = resData?.error?.message || resData?.message;

    // Strategy 2: Direct Binary File Upload
    const binFormData = new FormData();
    binFormData.append('image', optimizedFile, optimizedFile.name);

    const binResponse = await fetch(`https://api.imgbb.com/1/upload?key=${key.trim()}`, {
      method: 'POST',
      body: binFormData,
    });

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

    const finalErrMsg = binResData?.error?.message || base64Error || `Upload failed for file ${file.name}`;
    throw new Error(finalErrMsg);
  } catch (err: any) {
    throw new Error(err.message || `Upload failed for file ${file.name}`);
  }
}

/**
 * Uploads a single file to ImgBB with robust fallback strategies:
 * 1. Base64 FormData string (ImgBB standard for JS API)
 * 2. Binary File FormData
 * 3. Detailed error messages if ImgBB fails
 */
export async function uploadSingleImageToImgBB(file: File, key = IMGBB_API_KEY): Promise<string> {
  const res = await uploadSingleImageToImgBBWithDetails(file, key);
  return res.url;
}

/**
 * Automatically deletes images from ImgBB using their delete_urls or image URLs
 */
export async function deleteImagesFromImgBB(
  deleteUrls: string[] = [], 
  imageUrls: string[] = [], 
  apiKey: string = IMGBB_API_KEY
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
