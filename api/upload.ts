import type { IncomingMessage, ServerResponse } from 'http';
import multer from 'multer';

export const config = {
  api: {
    bodyParser: false,
  },
};

type VercelLikeRequest = IncomingMessage & {
  method?: string;
  body?: Record<string, any>;
  file?: Express.Multer.File;
};

type VercelLikeResponse = ServerResponse & {
  status: (code: number) => VercelLikeResponse;
  json: (data: any) => void;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max after client compression
  },
});

function runMulterMiddleware(req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function sendJson(res: VercelLikeResponse, statusCode: number, payload: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(payload);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { success: false, error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.IMGBB_KEY;
  if (!apiKey || !apiKey.trim()) {
    return sendJson(res, 500, {
      success: false,
      error: 'Server upload configuration missing: IMGBB_KEY environment variable is not set.',
    });
  }

  try {
    await runMulterMiddleware(req, res);
  } catch (err: any) {
    const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return sendJson(res, status, {
      success: false,
      error:
        err?.code === 'LIMIT_FILE_SIZE'
          ? 'Compressed image exceeds 15MB server limit.'
          : err?.message || 'Failed to parse multipart image upload.',
    });
  }

  const file = req.file;
  if (!file || !file.buffer || file.buffer.length === 0) {
    return sendJson(res, 400, {
      success: false,
      error: 'No image file provided in "image" field.',
    });
  }

  const mimeType = file.mimetype || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    return sendJson(res, 400, {
      success: false,
      error: `Invalid file type (${mimeType}). Only image uploads are allowed.`,
    });
  }

  const requestedName =
    typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : file.originalname || `uu_paper_${Date.now()}`;

  const safeName =
    requestedName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 64) || `uu_paper_${Date.now()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const formData = new FormData();
    formData.append('key', apiKey.trim());
    formData.append('name', safeName);
    const blob = new Blob([new Uint8Array(file.buffer)], { type: mimeType });
    formData.append('image', blob, `${safeName}.jpg`);

    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      signal: controller.signal,
      body: formData,
    });

    const rawText = await imgbbResponse.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!imgbbResponse.ok || !parsed?.success || !parsed?.data?.url) {
      const upstreamStatus = imgbbResponse.status;
      // Preserve 429 and 5xx statuses so client exponential backoff retries properly
      const responseStatus =
        upstreamStatus === 429 || (upstreamStatus >= 500 && upstreamStatus < 600)
          ? upstreamStatus
          : upstreamStatus >= 400 && upstreamStatus < 500
          ? 400
          : 502;

      return sendJson(res, responseStatus, {
        success: false,
        error:
          parsed?.error?.message ||
          `ImgBB upload failed (HTTP ${upstreamStatus || 502}).`,
      });
    }

    const uploadedUrl: string = parsed.data.url;
    const displayUrl: string = parsed.data.display_url || uploadedUrl;
    const deleteUrl: string | undefined = parsed.data.delete_url;
    const id: string | undefined = parsed.data.id;

    return sendJson(res, 200, {
      success: true,
      url: uploadedUrl,
      data: {
        url: uploadedUrl,
        display_url: displayUrl,
        deleteUrl,
        id,
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    console.error('[api/upload] ImgBB proxy error:', err?.message || err);
    return sendJson(res, isTimeout ? 504 : 502, {
      success: false,
      error: isTimeout
        ? 'ImgBB upload timed out. Please retry.'
        : 'Network error communicating with ImgBB.',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
