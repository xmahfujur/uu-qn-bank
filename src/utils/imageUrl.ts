import type { SyntheticEvent } from 'react';

/**
 * Formats image URLs to ensure cross-origin mobile compatibility,
 * HTTPS security, ImgBB TLD normalization, and Google Drive direct link conversion.
 */
export function formatImageUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return 'https://placehold.co/800x1200/1e293b/ffffff?text=No+Image+Provided';
  }

  let url = rawUrl.trim();
  if (!url) {
    return 'https://placehold.co/800x1200/1e293b/ffffff?text=No+Image+Provided';
  }

  // 1. Normalize ImgBB localized/proxy domains (e.g., i.ibb.co.com -> i.ibb.co)
  // Mobile browsers and cellular ISPs often fail to resolve i.ibb.co.com
  if (url.includes('i.ibb.co.com')) {
    url = url.replace('i.ibb.co.com', 'i.ibb.co');
  } else if (url.includes('ibb.co.com')) {
    url = url.replace('ibb.co.com', 'ibb.co');
  }

  // 2. Convert Google Drive share/view URLs to direct high-res image view endpoints
  const driveFileIdMatch = 
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (driveFileIdMatch && driveFileIdMatch[1]) {
    const fileId = driveFileIdMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // 3. Convert Dropbox preview links (dl=0 -> raw=1)
  if (url.includes('dropbox.com')) {
    return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
  }

  // 4. Ensure HTTPS protocol (mobile browsers block http mixed content on https site)
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    url = url.replace('http://', 'https://');
  }

  return url;
}

/**
 * Universal error fallback handler for images across mobile & desktop devices.
 * Uses domain fixes and wsrv.nl proxy cache to bypass mobile cellular hotlink & DNS blocks.
 */
export function handleImageError(
  e: SyntheticEvent<HTMLImageElement, Event>,
  fallbackText: string = 'UU Question Paper'
) {
  const target = e.currentTarget;
  const currentSrc = target.src || '';

  // Prevent infinite retry loops
  if (target.dataset.hasFailedTwice === 'true') {
    target.src = `https://placehold.co/600x400/1e293b/ffffff?text=${encodeURIComponent(fallbackText)}`;
    return;
  }

  // Fallback 1: Fix ImgBB .co.com domain on mobile networks
  if (currentSrc.includes('i.ibb.co.com') || currentSrc.includes('ibb.co.com')) {
    const fixedUrl = currentSrc.replace('i.ibb.co.com', 'i.ibb.co').replace('ibb.co.com', 'ibb.co');
    target.src = fixedUrl;
    target.dataset.hasFailedOnce = 'true';
    return;
  }

  // Fallback 2: Try Google Drive alternative endpoints
  if (currentSrc.includes('lh3.googleusercontent.com/d/')) {
    const fileId = currentSrc.split('/d/')[1]?.split('?')[0];
    if (fileId) {
      target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
      target.dataset.hasFailedOnce = 'true';
      return;
    }
  }

  if (currentSrc.includes('drive.google.com/thumbnail')) {
    const match = currentSrc.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      target.src = `https://drive.google.com/uc?export=view&id=${match[1]}`;
      target.dataset.hasFailedOnce = 'true';
      return;
    }
  }

  // Fallback 3: Proxy via wsrv.nl to bypass mobile cellular ISP blocks & Cloudflare referer/CORS blocks
  if (!currentSrc.includes('wsrv.nl') && !currentSrc.includes('placehold.co')) {
    const cleanUrl = currentSrc.replace(/^https?:\/\//, '');
    target.src = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    target.dataset.hasFailedTwice = 'true';
    return;
  }

  // Final Fallback: Placeholder
  target.dataset.hasFailedTwice = 'true';
  target.src = `https://placehold.co/600x400/1e293b/ffffff?text=${encodeURIComponent(fallbackText)}`;
}

/**
 * Returns alternative fallback URLs for Google Drive or other hosting if primary fails
 */
export function getAlternateImageUrls(rawUrl: string | undefined | null): string[] {
  if (!rawUrl) return [];

  const driveFileIdMatch = 
    rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (driveFileIdMatch && driveFileIdMatch[1]) {
    const fileId = driveFileIdMatch[1];
    return [
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`
    ];
  }

  if (rawUrl.includes('i.ibb.co.com')) {
    return [
      rawUrl.replace('i.ibb.co.com', 'i.ibb.co'),
      rawUrl
    ];
  }

  return [formatImageUrl(rawUrl)];
}


