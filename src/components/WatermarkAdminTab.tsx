import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Check, 
  RotateCcw, 
  Download, 
  Eye, 
  Layers, 
  Sliders, 
  Type, 
  FileText,
  Save,
  CheckCircle2
} from 'lucide-react';
import { 
  WatermarkSettings, 
  DEFAULT_WATERMARK_SETTINGS, 
  getWatermarkSettings, 
  saveWatermarkSettings, 
  loadGlobalWatermarkSettings,
  applyWatermarkToCanvas 
} from '../utils/watermark';
import WatermarkOverlay from './WatermarkOverlay';

interface WatermarkAdminTabProps {
  currentUser: any;
  showNotif: (type: 'success' | 'error', message: string) => void;
}

export default function WatermarkAdminTab({ currentUser, showNotif }: WatermarkAdminTabProps) {
  const [settings, setSettings] = useState<WatermarkSettings>(getWatermarkSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  useEffect(() => {
    loadGlobalWatermarkSettings().then((loaded) => {
      setSettings(loaded);
    });
  }, []);

  const updateSetting = <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveWatermarkSettings(settings, true);
      setHasUnsavedChanges(false);
      showNotif('success', 'Watermark and branding settings updated across the platform!');
    } catch (err: any) {
      console.error('Error saving watermark settings:', err);
      showNotif('error', 'Failed to save watermark settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_WATERMARK_SETTINGS);
    setHasUnsavedChanges(true);
    showNotif('success', 'Reset to recommended default settings.');
  };

  // Test generate a sample watermarked paper and download it
  const handleTestDownload = async () => {
    setIsGeneratingTest(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // 1. Draw sample exam paper background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Paper header
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px serif';
      ctx.textAlign = 'center';
      ctx.fillText('UNIVERSITY EXAMINATION ARCHIVE', canvas.width / 2, 120);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING', canvas.width / 2, 165);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('Course Code: CSE 312 | Course Title: Database Management Systems', canvas.width / 2, 210);
      ctx.fillText('Semester Final Examination • Time: 3 Hours • Full Marks: 70', canvas.width / 2, 240);

      // Divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 270);
      ctx.lineTo(canvas.width - 80, 270);
      ctx.stroke();

      // Sample exam questions text
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = '18px serif';
      const sampleLines = [
        'Q1. (a) Explain the difference between B-Tree and B+ Tree indexing structures. [5]',
        '     (b) Given a relational schema, construct an optimized B+ Tree of order 4. [5]',
        'Q2. (a) Describe ACID properties in transaction processing with practical examples. [6]',
        '     (b) What is conflict serializability? Draw the precedence graph for schedule S1. [4]',
        'Q3. (a) State and explain Boyce-Codd Normal Form (BCNF) versus 3NF. [5]',
        '     (b) Normalize the given relation R(A, B, C, D, E) up to BCNF showing all functional dependencies. [5]',
        'Q4. Write SQL queries for the university database schema including GROUP BY and HAVING clauses. [10]'
      ];

      sampleLines.forEach((line, idx) => {
        ctx.fillText(line, 100, 340 + idx * 55);
      });

      // 2. Apply watermark onto sample paper
      applyWatermarkToCanvas(ctx, canvas.width, canvas.height, {
        courseCode: 'CSE 312',
        courseName: 'Database Management Systems',
        examType: 'Final',
        uploader: currentUser?.username || 'admin'
      }, settings);

      // 3. Trigger download
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Blob conversion failed');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SAMPLE_WATERMARKED_EXAM_PAPER.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotif('success', 'Sample watermarked exam paper downloaded!');
      }, 'image/jpeg', 0.95);
    } catch (err: any) {
      console.error('Test download error:', err);
      showNotif('error', 'Failed to generate test download.');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Universal Academic Protection</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Exam Paper Watermark & Branding
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Protect all uploaded and existing exam papers with university archive branding. Watermarks are applied dynamically across all viewers, full-resolution zoom modals, paper cards, and stamped directly into downloaded files and new uploads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTestDownload}
              disabled={isGeneratingTest}
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Download a test sample paper with the current watermark"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>{isGeneratingTest ? 'Generating...' : 'Download Sample'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/25 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Settings Controls (Left) + Interactive Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Master Toggle Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">Watermark Protection</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  settings.enabled 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {settings.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Display watermark on paper previews, zoom viewers, thumbnails, and stamp on all downloads.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => updateSetting('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Typography & Content */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-500" />
              Watermark Branding Text
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Primary University / Archive Brand
                </label>
                <input
                  type="text"
                  value={settings.primaryText}
                  onChange={(e) => updateSetting('primaryText', e.target.value)}
                  placeholder="e.g. UU QUESTION BANK"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Secondary Subtitle / Seal Line
                </label>
                <input
                  type="text"
                  value={settings.secondaryText}
                  onChange={(e) => updateSetting('secondaryText', e.target.value)}
                  placeholder="e.g. Official Academic Archive • Verified Question Repository"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Pattern Style Selection */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Watermark Style & Layout
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'diagonal_grid',
                  name: 'Diagonal Security Grid',
                  desc: 'Repeated banknote-grade angle grid across whole page (Recommended)',
                  badge: 'Standard'
                },
                {
                  id: 'center_crest',
                  name: 'Centered Seal Crest',
                  desc: 'High-prestige university circular badge centered on document',
                  badge: 'Prestige'
                },
                {
                  id: 'corner_subtle',
                  name: 'Edge & Footer Stamps',
                  desc: 'Minimal unobtrusive header and footer security banners',
                  badge: 'Subtle'
                }
              ].map((pat) => (
                <button
                  key={pat.id}
                  type="button"
                  onClick={() => updateSetting('pattern', pat.id as any)}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    settings.pattern === pat.id
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-600/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {pat.badge}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                      {pat.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {pat.desc}
                    </p>
                  </div>
                  {settings.pattern === pat.id && (
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      <Check className="w-3.5 h-3.5" /> Selected
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity & Appearance Slider */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                Watermark Opacity Level
              </h3>
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl">
                {Math.round(settings.opacity * 100)}%
              </span>
            </div>

            <input
              type="range"
              min="0.08"
              max="0.45"
              step="0.02"
              value={settings.opacity}
              onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Very Subtle (8%)</span>
              <span className="text-indigo-600 font-bold">Recommended (18%)</span>
              <span>Bold Protection (45%)</span>
            </div>
          </div>

          {/* Dynamic Details & Upload Toggles */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Protection Options
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Dynamic Course Metadata
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Embed course code and exam term (e.g. "CSE 312 • Final Term") into watermark
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeCourseInfo}
                  onChange={(e) => updateSetting('includeCourseInfo', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Uploader Attribution Credit
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Include contributor's username (e.g. "@mahfujur") to honor students who upload
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeUploader}
                  onChange={(e) => updateSetting('includeUploader', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 cursor-pointer">
                <div className="pr-4">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Stamp Canvas on New Uploads
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically bake watermark directly into image pixels during file upload
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.stampOnUpload}
                  onChange={(e) => updateSetting('stampOnUpload', e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
              </label>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save & Publish Watermark'}</span>
            </button>
          </div>

        </div>

        {/* Right: Live Realistic Document Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              Live Interactive Preview
            </span>
            <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Real-time Rendering
            </span>
          </div>

          {/* Realistic Exam Paper Card Container with Watermark Layer */}
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8 aspect-[1/1.35] flex flex-col justify-between">
            
            {/* The Live Watermark Overlay Component */}
            <WatermarkOverlay
              metadata={{
                courseCode: 'CSE 312',
                courseName: 'Database Systems',
                examType: 'Final',
                uploader: currentUser?.username || 'mahfujur'
              }}
            />

            {/* Simulated Question Paper Typography (Behind Watermark) */}
            <div className="space-y-4 select-none pointer-events-none opacity-85">
              <div className="text-center border-b border-slate-200 pb-3">
                <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase font-mono">
                  UNIVERSITY EXAMINATION
                </p>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-serif mt-0.5">
                  DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
                </h4>
                <p className="text-[10px] text-slate-600 font-sans mt-0.5">
                  Course Code: CSE 312 • Database Management Systems
                </p>
                <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                  <span>Semester: Final 2026</span>
                  <span>Full Marks: 70</span>
                  <span>Time: 3 Hours</span>
                </div>
              </div>

              <div className="space-y-3 font-serif text-[10px] sm:text-[11px] text-slate-800 leading-relaxed">
                <p>
                  <strong>1. (a)</strong> Differentiate between Logical and Physical Data Independence with architecture diagrams. [5]
                </p>
                <p>
                  <strong>&nbsp;&nbsp;&nbsp;&nbsp;(b)</strong> Explain ACID properties. How does Write-Ahead Logging (WAL) ensure durability? [5]
                </p>
                <p>
                  <strong>2. (a)</strong> Construct a B+ Tree of order 3 for key inserts: [12, 24, 8, 30, 42, 18, 55, 60]. [6]
                </p>
                <p>
                  <strong>&nbsp;&nbsp;&nbsp;&nbsp;(b)</strong> What is serializability? Show why two-phase locking guarantees conflict serializability. [6]
                </p>
                <p>
                  <strong>3.</strong> Write relational algebra expressions for nested queries involving natural joins and projections. [8]
                </p>
              </div>
            </div>

            {/* Mock Paper Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono text-slate-400 select-none">
              <span>Page 1 of 1</span>
              <span>[End of Question Paper]</span>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>How Watermarking Works</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              The watermark protects documents dynamically on screen without damaging readability. When students tap <strong>Download Paper</strong> or <strong>Download ZIP</strong>, the watermark is rendered onto each page, ensuring all exported files carry official university attribution.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
