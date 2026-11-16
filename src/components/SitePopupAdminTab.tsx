import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Save,
  Eye,
  RotateCcw,
  Upload,
  Loader2,
  X,
  CheckCircle2,
  Sparkles,
  CalendarClock,
  Palette
} from 'lucide-react';
import { SitePopupConfig, SitePopupCtaAction, SitePopupTheme } from '../types';
import {
  DEFAULT_SITE_POPUP_CONFIG,
  SITE_POPUP_PRESETS,
  loadSitePopupConfig,
  saveSitePopupConfig,
  resetSitePopupSeenToday
} from '../utils/sitePopup';
import { uploadSingleImageToImgBB } from '../utils/imageUploader';
import { recordAuditLog } from '../utils/auditLogger';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';
import { SitePopupCard } from './SiteAnnouncementPopup';

interface SitePopupAdminTabProps {
  currentUser: any;
  showNotif: (type: 'success' | 'error', message: string) => void;
}

const THEME_OPTIONS: { id: SitePopupTheme; label: string; swatch: string }[] = [
  { id: 'indigo', label: 'Indigo Academic', swatch: 'bg-indigo-600' },
  { id: 'amber', label: 'Amber Alert', swatch: 'bg-amber-500' },
  { id: 'emerald', label: 'Emerald Drive', swatch: 'bg-emerald-600' },
  { id: 'rose', label: 'Rose Urgent', swatch: 'bg-rose-600' }
];

const CTA_ACTIONS: { id: SitePopupCtaAction; label: string; hint: string }[] = [
  { id: 'upload', label: 'Open Upload Paper Modal', hint: 'Best for encouraging students to upload papers' },
  { id: 'calendar', label: 'Go to Academic Calendar', hint: 'Great for exam dates & routine reminders' },
  { id: 'dashboard', label: 'Browse Question Bank', hint: 'Closes pop-up and opens main feed' },
  { id: 'link', label: 'Open External URL', hint: 'Links to a Google Form, notice PDF, or post' },
  { id: 'none', label: 'No Primary Button (Notice Only)', hint: 'Only displays the dismiss/close button' }
];

export default function SitePopupAdminTab({ currentUser, showNotif }: SitePopupAdminTabProps) {
  const [config, setConfig] = useState<SitePopupConfig>(DEFAULT_SITE_POPUP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadSitePopupConfig()
      .then((loaded) => {
        if (mounted) {
          setConfig(loaded);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load site popup settings:', err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateField = <K extends keyof SitePopupConfig>(key: K, value: SitePopupConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const applyPreset = (presetConfig: Partial<SitePopupConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...presetConfig
    }));
    setHasUnsavedChanges(true);
    showNotif('success', 'Template loaded. Click Save & Publish when ready.');
  };

  const handleBannerUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotif('error', 'Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotif('error', 'Image size must be under 10MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadSingleImageToImgBB(file);
      updateField('imageUrl', url);
      showNotif('success', 'Pop-up banner image uploaded!');
    } catch (err: any) {
      console.error('Pop-up image upload failed:', err);
      showNotif('error', err?.message || 'Failed to upload image. You can also paste an image URL.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!config.title.trim()) {
      showNotif('error', 'Please enter a pop-up headline before saving.');
      return;
    }
    if (config.ctaAction === 'link' && !config.ctaUrl?.trim()) {
      showNotif('error', 'Please provide an external URL for the button link.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveSitePopupConfig(config, currentUser?.username || 'Admin');
      setConfig(saved);
      setHasUnsavedChanges(false);

      recordAuditLog({
        category: 'Settings',
        action: saved.enabled ? 'ENABLE_SITE_POPUP' : 'UPDATE_SITE_POPUP',
        details: `${saved.enabled ? 'Published active' : 'Saved disabled'} daily visitor pop-up: "${saved.title}"`,
        targetId: 'sitePopup',
        targetName: saved.title,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Admin',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Admin'
      }).catch(console.warn);

      showNotif(
        'success',
        saved.enabled
          ? 'Daily visitor pop-up published! Everyone will see it once per day on first visit.'
          : 'Pop-up settings saved (currently turned OFF).'
      );
    } catch (err: any) {
      console.error('Failed to save site popup config:', err);
      showNotif('error', 'Failed to save pop-up settings. Check your admin permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenModalPreview = () => {
    window.dispatchEvent(new CustomEvent('open-site-popup-preview', { detail: config }));
  };

  const handleResetDailyFlag = () => {
    resetSitePopupSeenToday();
    showNotif('success', 'Daily limit reset for this browser. Reload to test first-visit trigger.');
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        <p className="text-xs font-semibold text-slate-500">Loading daily pop-up configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <CalendarClock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Once-Per-Day Visitor Announcement</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">
              Custom Daily Pop-Up Manager
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Create an announcement or reminder pop-up (in Bangla or English) shown to every visitor on their first visit once per day — ideal for exam reminders and encouraging question paper uploads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenModalPreview}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>Preview Pop-Up</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/25 whitespace-nowrap"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Publishing...' : 'Save & Publish'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Configuration Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Master Enable/Disable Switch */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  Visitor Pop-Up Status
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    config.enabled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {config.enabled ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Active (1x / Day)
                    </>
                  ) : (
                    'Disabled'
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When active, all visitors see this pop-up once per calendar day on their first visit.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateField('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {/* Quick Templates */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Quick Ready Templates</span>
              </h3>
              <span className="text-[11px] text-slate-400">1-click fill</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SITE_POPUP_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.config)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Headline, Badge & Message */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-500" />
              <span>Pop-Up Content</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Badge Label (Optional)
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={config.badgeText}
                  onChange={(e) => updateField('badgeText', e.target.value)}
                  placeholder="e.g. Exam Notice"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Close Button Label
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={config.dismissText}
                  onChange={(e) => updateField('dismissText', e.target.value)}
                  placeholder="e.g. Later"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Headline * (Bangla or English)
              </label>
              <input
                type="text"
                maxLength={220}
                value={config.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g. সামনে পরীক্ষা! আপনার কাছে থাকা প্রশ্নপত্র কি আপলোড করেছেন?"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Message Body
              </label>
              <textarea
                rows={4}
                maxLength={1200}
                value={config.message}
                onChange={(e) => updateField('message', e.target.value)}
                placeholder="Write a helpful announcement or exam reminder..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Optional Banner Image */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Optional Poster / Banner Image
                </label>
                {config.imageUrl && (
                  <button
                    type="button"
                    onClick={() => updateField('imageUrl', '')}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Remove Image
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={config.imageUrl || ''}
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                  placeholder="Paste image URL (https://...) or upload ->"
                  className="flex-1 px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                  {uploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBannerUpload(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {config.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 w-36 h-20 bg-slate-100 dark:bg-slate-950">
                  <img
                    src={formatImageUrl(config.imageUrl)}
                    alt="Banner thumbnail"
                    referrerPolicy="no-referrer"
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Theme & Action Button */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-500" />
                <span>Color Theme</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {THEME_OPTIONS.map((t) => {
                  const active = config.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateField('theme', t.id)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        active
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-600/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${t.swatch} shrink-0`} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Primary Action Button
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Button Action
                  </label>
                  <select
                    value={config.ctaAction}
                    onChange={(e) => updateField('ctaAction', e.target.value as SitePopupCtaAction)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CTA_ACTIONS.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.label}
                      </option>
                    ))}
                  </select>
                </div>

                {config.ctaAction !== 'none' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Button Label
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={config.ctaText}
                      onChange={(e) => updateField('ctaText', e.target.value)}
                      placeholder="e.g. Upload Question Paper"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {config.ctaAction === 'link' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Destination URL *
                  </label>
                  <input
                    type="url"
                    value={config.ctaUrl || ''}
                    onChange={(e) => updateField('ctaUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Save Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleResetDailyFlag}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Daily Limit (Test in Browser)</span>
            </button>

            <div className="flex items-center gap-2.5">
              {hasUnsavedChanges && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save & Publish Pop-Up'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Pop-Up Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              <span>Live Visitor Preview</span>
            </span>
            <button
              type="button"
              onClick={handleOpenModalPreview}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Open Full Modal
            </button>
          </div>

          <div className="p-4 sm:p-6 rounded-3xl bg-slate-100/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <SitePopupCard
              config={config}
              isPreview
              onClose={handleOpenModalPreview}
              onAction={handleOpenModalPreview}
            />
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">How Display Frequency Works</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Every visitor (guest or logged-in student) sees this pop-up once per calendar day on their first visit when enabled. Subsequent refreshes on the same day keep it hidden until tomorrow.
            </p>
            {config.updatedAt && (
              <p className="text-[11px] font-mono text-slate-400 pt-1">
                Last updated: {new Date(config.updatedAt).toLocaleString()}
                {config.updatedByUsername ? ` by @${config.updatedByUsername}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
