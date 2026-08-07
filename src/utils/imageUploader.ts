import { formatImageUrl } from './imageUrl';

const IMGBB_API_KEY = 'c66284ea8683ede65e71e14d201bec19';

/**
 * Compresses an image File if it's large or PNG, returning an optimized JPEG file.
 * Preserves visual clarity while dramatically reducing upload payload size.
 */
export async function optimizeImageFile(file: File, maxDimension = 2400, quality = 0.88): Promise<File> {
  // If it's not an image or very small (< 300KB), return as is
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) {
    return file;
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
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          const optimizedFile = new File([blob], cleanName, { type: 'image/jpeg' });
          resolve(optimizedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
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

/**
 * Uploads a single file to ImgBB with robust fallback strategies:
 * 1. Base64 FormData string (ImgBB standard for JS API)
 * 2. Binary File FormData
 * 3. Detailed error messages if ImgBB fails
 */
export async function uploadSingleImageToImgBB(file: File, key = IMGBB_API_KEY): Promise<string> {
  const optimizedFile = await optimizeImageFile(file);

  // Strategy 1: Upload via Base64 string in FormData (Recommended by ImgBB for JS)
  try {
    const base64 = await fileToBase64(optimizedFile);
    const formData = new FormData();
    formData.append('image', base64);
    formData.append('name', optimizedFile.name.replace(/[^a-zA-Z0-9_-]/g, '_'));

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${key.trim()}`, {
      method: 'POST',
      body: formData,
    });

    const resData = await response.json().catch(() => null);

    if (response.ok && resData?.success && resData?.data) {
      const rawUrl = resData.data.url || resData.data.display_url || resData.data.image?.url;
      if (rawUrl) return formatImageUrl(rawUrl);
    }

    const base64Error = resData?.error?.message || resData?.message;

    // Strategy 2: Direct Binary File Upload
    const binFormData = new FormData();
    binFormData.append('image', optimizedFile);

    const binResponse = await fetch(`https://api.imgbb.com/1/upload?key=${key.trim()}`, {
      method: 'POST',
      body: binFormData,
    });

    const binResData = await binResponse.json().catch(() => null);

    if (binResponse.ok && binResData?.success && binResData?.data) {
      const rawUrl = binResData.data.url || binResData.data.display_url || binResData.data.image?.url;
      if (rawUrl) return formatImageUrl(rawUrl);
    }

    const finalErrMsg = binResData?.error?.message || base64Error || `Upload failed for file ${file.name}`;
    throw new Error(finalErrMsg);
  } catch (err: any) {
    throw new Error(err.message || `Upload failed for file ${file.name}`);
  }
}
