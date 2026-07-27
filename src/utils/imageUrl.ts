/**
 * Formats image URLs to ensure cross-origin mobile compatibility,
 * HTTPS security, and automatic Google Drive direct link conversion.
 */
export function formatImageUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return 'https://placehold.co/800x1200/1e293b/ffffff?text=No+Image+Provided';
  }

  let url = rawUrl.trim();
  if (!url) {
    return 'https://placehold.co/800x1200/1e293b/ffffff?text=No+Image+Provided';
  }

  // 1. Convert Google Drive share/view URLs to direct high-res image view endpoints
  // Matches URLs like:
  // - https://drive.google.com/file/d/1ABC123XYZ/view?usp=sharing
  // - https://drive.google.com/open?id=1ABC123XYZ
  // - https://drive.google.com/uc?id=1ABC123XYZ
  const driveFileIdMatch = 
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (driveFileIdMatch && driveFileIdMatch[1]) {
    const fileId = driveFileIdMatch[1];
    // lh3.googleusercontent.com/d/FILE_ID is the most reliable direct image endpoint for Google Drive
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // 2. Convert Dropbox preview links (dl=0 -> raw=1)
  if (url.includes('dropbox.com')) {
    return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
  }

  // 3. Ensure HTTPS protocol (mobile browsers block http mixed content on https Vercel site)
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    url = url.replace('http://', 'https://');
  }

  return url;
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
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
      `https://drive.google.com/uc?export=view&id=${fileId}`
    ];
  }

  return [];
}
