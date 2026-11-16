import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

type VercelReq = IncomingMessage & {
  query?: Record<string, string | string[]>;
  url?: string;
};

function getFallbackFirestore() {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const existing = getApps().find((a) => a.name === 'vercel-upload-fallback');
  const app = existing || initializeApp(firebaseConfig, 'vercel-upload-fallback');
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  try {
    const rawName = req.query?.name;
    let fileName = Array.isArray(rawName) ? rawName[0] : rawName;
    if (!fileName && req.url) {
      fileName = path.basename(req.url.split('?')[0]);
    }
    if (!fileName) {
      res.statusCode = 400;
      res.end('Missing image name');
      return;
    }

    const cleanName = path.basename(fileName);
    const db = getFallbackFirestore();
    const snap = await getDoc(doc(db, 'paper_images', cleanName));

    if (!snap.exists()) {
      res.statusCode = 404;
      res.end('Image not found');
      return;
    }

    const data = snap.data();
    if (!data?.dataUrl) {
      res.statusCode = 404;
      res.end('Image payload missing');
      return;
    }

    const base64Data = data.dataUrl.includes(',') ? data.dataUrl.split(',')[1] : data.dataUrl;
    const buffer = Buffer.from(base64Data, 'base64');

    res.statusCode = 200;
    res.setHeader('Content-Type', data.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buffer);
  } catch (err) {
    console.error('[api/image] Retrieval error:', err);
    res.statusCode = 500;
    res.end('Error retrieving image');
  }
}
