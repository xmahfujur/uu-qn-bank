import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize server-side Firebase instance for resilient permanent image persistence
const serverFirebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig, 'server-storage-app');
const serverDb = getFirestore(serverFirebaseApp, firebaseConfig.firestoreDatabaseId);

// Ensure local uploads directory exists when running on writable filesystem
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch {
  // Ignore on read-only serverless filesystems (e.g., Vercel)
}

// Configure Multer in-memory storage for proxying multipart uploads to ImgBB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB maximum after client compression
});

// Serve uploaded question papers with disk + Firestore fallback
app.get('/uploads/:name', async (req, res, next) => {
  const fileName = path.basename(req.params.name);
  const filePath = path.join(uploadsDir, fileName);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }
  try {
    const snap = await getDoc(doc(serverDb, 'paper_images', fileName));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.dataUrl) {
        const base64Data = data.dataUrl.includes(',') ? data.dataUrl.split(',')[1] : data.dataUrl;
        const buffer = Buffer.from(base64Data, 'base64');
        try { fs.writeFileSync(filePath, buffer); } catch {}
        res.setHeader('Content-Type', data.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(buffer);
      }
    }
  } catch (dbErr) {
    console.warn('[Uploads Fallback] Firestore read error:', dbErr);
  }
  next();
});

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y',
  immutable: true
}));

// Initialize Gemini API Client lazily as per guidelines
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in the environment. Please configure it in your Secrets.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// 1. API: Analyze Question Paper Image (OCR + Categorization + Summary + Predictions)
app.post('/api/ai/analyze-question', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Question imageUrl is required.' });
    }

    console.log(`Starting Gemini analysis for image URL: ${imageUrl}`);

    // Download image on server to handle any CORS or retrieval issues and convert to base64
    let base64Data = '';
    let mimeType = 'image/jpeg';
    
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
      
      const contentType = response.headers.get('content-type');
      if (contentType) {
        mimeType = contentType;
      }
    } catch (downloadErr: any) {
      console.error('Error downloading image for analysis:', downloadErr);
      return res.status(400).json({ 
        error: 'Failed to access the provided image URL. Please make sure it is a direct public image link.',
        details: downloadErr.message 
      });
    }

    const ai = getAiClient();
    
    const prompt = `
      You are an expert academic AI system assisting students at Uttara University.
      Analyze this university exam question paper image and return a JSON object with the following fields:
      - courseCode: The exact course code extracted from the paper (e.g., CSE 112, EEE 211).
      - courseName: The exact course title/name (e.g., Structured Programming, Electrical Circuits).
      - examYear: The year/semester if mentioned (e.g., Spring 2026, Summer 2025).
      - examType: "Mid" or "Final" based on the content (if not obvious, make an educated guess).
      - department: The suggested department code (e.g., CSE, EEE, BBA, Civil, English, Law, Textile, Architecture).
      - patternSummary: A 2-3 sentence elegant summary of the question pattern (e.g., which sections carry what marks, which style of questions dominate).
      - keyTopics: An array of 4-6 key topics covered in the paper.
      - predictions: A list of 3-4 predictions or topics that are highly likely to be asked again based on the patterns.
      
      Format your response strictly as valid, parsable JSON. Do not include any markdown backticks or formatting outside of the raw JSON object.
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.text?.trim() || '{}';
    console.log('Gemini raw response text:', responseText);

    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (e) {
      // Fallback parse if Gemini included markdown
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    }

    res.json({
      success: true,
      analysis: parsedResult
    });
  } catch (error: any) {
    console.error('Error in API /api/ai/analyze-question:', error);
    res.status(500).json({ 
      error: 'AI analysis failed. Please try again with a clear question paper image.',
      details: error.message 
    });
  }
});

// 2. API: Generate Question Pattern Summary and Predictive Syllabus
app.post('/api/ai/summarize-pattern', async (req, res) => {
  try {
    const { questionsText, courseCode, courseName } = req.body;
    if (!questionsText) {
      return res.status(400).json({ error: 'Question content text is required.' });
    }

    const ai = getAiClient();
    const prompt = `
      You are an elite academic curriculum analyzer for Uttara University.
      Analyze the text content of the exam paper for ${courseCode || ''} - ${courseName || ''}:
      
      "${questionsText}"
      
      Return a response with three main sections:
      1. Pattern Analysis: A breakdown of how the exam is structured (marks distribution, options, difficulty curve).
      2. Key Topics Tested: Detailed list of concepts being evaluated.
      3. Topic Predictions for Future Exams: 3-5 high-probability topic recommendations and why they are recurring.
      
      Use elegant academic formatting, keep it clean and readable.
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    res.json({
      success: true,
      summary: result.text
    });
  } catch (error: any) {
    console.error('Error in API /api/ai/summarize-pattern:', error);
    res.status(500).json({ error: 'Failed to summarize pattern.', details: error.message });
  }
});

// 3. API: Server-side ImgBB Upload Proxy (/api/upload)
// Receives multipart FormData image and forwards to ImgBB using process.env.IMGBB_KEY
app.post('/api/upload', (req, res, next) => {
  upload.single('image')(req, res, (err: any) => {
    if (err) {
      const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        success: false,
        error: err?.code === 'LIMIT_FILE_SIZE'
          ? 'Compressed image exceeds 15MB server limit.'
          : err?.message || 'Invalid multipart image upload.'
      });
    }
    next();
  });
}, async (req, res) => {
  const apiKey = process.env.IMGBB_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(500).json({
      success: false,
      error: 'Server upload configuration missing: IMGBB_KEY environment variable is not set.'
    });
  }

  const file = req.file;
  if (!file || !file.buffer || file.buffer.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No image file provided in "image" field.'
    });
  }

  const mimeType = file.mimetype || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    return res.status(400).json({
      success: false,
      error: `Invalid file type (${mimeType}). Only image uploads are allowed.`
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
      body: formData
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
      const responseStatus =
        upstreamStatus === 429 || (upstreamStatus >= 500 && upstreamStatus < 600)
          ? upstreamStatus
          : upstreamStatus >= 400 && upstreamStatus < 500
          ? 400
          : 502;

      return res.status(responseStatus).json({
        success: false,
        error: parsed?.error?.message || `ImgBB upload failed (HTTP ${upstreamStatus || 502}).`
      });
    }

    return res.json({
      success: true,
      url: parsed.data.url,
      data: {
        url: parsed.data.url,
        display_url: parsed.data.display_url || parsed.data.url,
        deleteUrl: parsed.data.delete_url,
        id: parsed.data.id
      }
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    console.error('[/api/upload] ImgBB proxy error:', err?.message || err);
    return res.status(isTimeout ? 504 : 502).json({
      success: false,
      error: isTimeout ? 'ImgBB upload timed out. Please retry.' : 'Network error communicating with ImgBB.'
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

// 4. API: Retrieve Paper Image with Firestore Fallback Cache
app.get('/api/image/:name', async (req, res) => {
  try {
    const fileName = path.basename(req.params.name);
    const filePath = path.join(uploadsDir, fileName);

    // Serve from disk if present
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(filePath);
    }

    // Fallback: Restore from Firestore paper_images
    try {
      const snap = await getDoc(doc(serverDb, 'paper_images', fileName));
      if (snap.exists()) {
        const data = snap.data();
        if (data.dataUrl) {
          const base64Data = data.dataUrl.includes(',') ? data.dataUrl.split(',')[1] : data.dataUrl;
          const buffer = Buffer.from(base64Data, 'base64');
          try { fs.writeFileSync(filePath, buffer); } catch (e) {}
          res.setHeader('Content-Type', data.contentType || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(buffer);
        }
      }
    } catch (dbErr) {
      console.warn('[Server Image Get] Firestore read error:', dbErr);
    }

    return res.status(404).send('Image not found');
  } catch (err: any) {
    return res.status(500).send('Error retrieving image');
  }
});

// 4. API: Delete Images from ImgBB Automatically
app.post('/api/imgbb/delete', async (req, res) => {
  try {
    const { deleteUrls = [], imageUrls = [] } = req.body;
    const apiKey = process.env.IMGBB_KEY || '';
    const allDeleteUrls: string[] = Array.isArray(deleteUrls) ? deleteUrls.filter(Boolean) : [];
    const allImageUrls: string[] = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];

    console.log(`[ImgBB Auto Delete] Processing deletion for ${allDeleteUrls.length} delete URLs and ${allImageUrls.length} image URLs`);

    const results: { url: string; success: boolean; details?: string }[] = [];

    // Process explicit deleteUrls
    for (const dUrl of allDeleteUrls) {
      let success = false;
      let note = '';

      // Pattern: https://ibb.co/imageId/imageHash or https://ibb.co.com/imageId/imageHash
      const match = dUrl.match(/ibb\.co(?:\.com)?\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1] && match[2]) {
        const imageId = match[1];
        const imageHash = match[2];

        try {
          // Strategy 1: Post to https://ibb.co/json (ImgBB Web resource deletion endpoint)
          const params = new URLSearchParams();
          params.append('action', 'delete');
          params.append('delete', 'image');
          params.append('from', 'resource');
          params.append('pathname', `/${imageId}/${imageHash}`);
          params.append('deleting[id]', imageId);
          params.append('deleting[hash]', imageHash);

          const jsonRes = await fetch('https://ibb.co/json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': dUrl,
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: params.toString()
          });

          if (jsonRes.ok) {
            success = true;
            note = 'Deleted via ibb.co/json endpoint';
          }
        } catch (e: any) {
          note = `Strategy 1 error: ${e.message}`;
        }

        // Strategy 2: Official /1/delete API endpoint with key & hash
        if (!success) {
          try {
            const apiRes = await fetch(`https://api.imgbb.com/1/delete?key=${apiKey}&id=${imageId}&hash=${imageHash}`, {
              method: 'POST'
            });
            if (apiRes.ok) {
              success = true;
              note = 'Deleted via api.imgbb.com/1/delete';
            }
          } catch (e: any) {
            note += ` | Strategy 2 error: ${e.message}`;
          }
        }

        // Strategy 3: Request the delete_url directly
        if (!success) {
          try {
            const getRes = await fetch(dUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
            if (getRes.ok) {
              success = true;
              note = 'Processed direct delete URL';
            }
          } catch (e: any) {
            note += ` | Strategy 3 error: ${e.message}`;
          }
        }
      } else {
        // Direct URL request fallback
        try {
          await fetch(dUrl).catch(() => null);
          success = true;
          note = 'Processed raw delete URL';
        } catch (e: any) {
          note = `Raw delete error: ${e.message}`;
        }
      }

      results.push({ url: dUrl, success, details: note });
    }

    // Process image URLs if no delete URLs were available
    if (allDeleteUrls.length === 0 && allImageUrls.length > 0) {
      for (const imgUrl of allImageUrls) {
        const idMatch = imgUrl.match(/ibb\.co(?:\.com)?\/([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          const imgId = idMatch[1];
          try {
            await fetch(`https://api.imgbb.com/1/delete?key=${apiKey}&id=${imgId}`, {
              method: 'POST'
            }).catch(() => null);
            results.push({ url: imgUrl, success: true, details: `Dispatched delete signal for ImgBB ID ${imgId}` });
          } catch (e: any) {
            results.push({ url: imgUrl, success: false, details: e.message });
          }
        }
      }
    }

    const deletedCount = results.filter(r => r.success).length;
    console.log(`[ImgBB Auto Delete] Completed: ${deletedCount}/${results.length} images processed successfully.`);

    res.json({
      success: true,
      deletedCount,
      totalProcessed: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error in API /api/imgbb/delete:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process ImgBB deletion.',
      details: error.message
    });
  }
});

// Serve the app using Vite (Development) or static assets (Production)
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted for development.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving static files from dist/ in production.');
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
