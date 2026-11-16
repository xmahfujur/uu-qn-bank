import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

function getFallbackFirestore() {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const existing = getApps().find((a) => a.name === 'vercel-upload-fallback');
  const app = existing || initializeApp(firebaseConfig, 'vercel-upload-fallback');
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

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

  const apiKey = process.env.IMGBB_KEY?.trim();
  if (!apiKey) {
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
    formData.append('key', apiKey);
    formData.append('name', safeName);
    const blob = new Blob([new Uint8Array(file.buffer)], { type: mimeType });
    formData.append('image', blob, `${safeName}.jpg`);

    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      body: formData,
    });

    const rawText = await imgbbResponse.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (imgbbResponse.ok && parsed?.success && parsed?.data?.url) {
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
    }

    const upstreamStatus = imgbbResponse.status;
    const errCode = parsed?.error?.code;
    const errMsg: string =
      parsed?.error?.message || `ImgBB upload failed (HTTP ${upstreamStatus || 502}).`;
    const isIpOrWafBlock =
      upstreamStatus === 403 || errCode === 103 || /forbidden/i.test(errMsg);

    if (isIpOrWafBlock && file.buffer.length <= 680 * 1024) {
      const normalizedBase = safeName.startsWith('uu_paper_')
        ? safeName
        : `uu_paper_${Date.now()}_${safeName}`;
      const fileName = `${normalizedBase.substring(0, 80)}.jpg`;
      const db = getFallbackFirestore();
      const dataUrl = `data:${mimeType};base64,${file.buffer.toString('base64')}`;
      await setDoc(doc(db, 'paper_images', fileName), {
        dataUrl,
        contentType: mimeType,
        createdAt: new Date().toISOString(),
      });
      const fallbackUrl = `/api/image/${fileName}`;
      return sendJson(res, 200, {
        success: true,
        url: fallbackUrl,
        data: {
          url: fallbackUrl,
          display_url: fallbackUrl,
          id: fileName,
          storage: 'firestore-fallback',
        },
      });
    }

    // Preserve 429 and 5xx statuses so client exponential backoff retries properly
    const responseStatus =
      upstreamStatus === 429 || (upstreamStatus >= 500 && upstreamStatus < 600)
        ? upstreamStatus
        : upstreamStatus >= 400 && upstreamStatus < 500
        ? 400
        : 502;

    return sendJson(res, responseStatus, {
      success: false,
      error: errMsg,
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
