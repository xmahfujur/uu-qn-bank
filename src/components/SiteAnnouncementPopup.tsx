import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  X,
  Megaphone,
  Upload,
  Calendar,
  ArrowRight,
  ExternalLink,
  Home
} from 'lucide-react';
import { SitePopupConfig, SitePopupTheme, UserProfile } from '../types';
import {
  DEFAULT_SITE_POPUP_CONFIG,
  hasSeenSitePopupToday,
  markSitePopupSeenToday,
  subscribeToSitePopupConfig
} from '../utils/sitePopup';
import { formatImageUrl } from '../utils/imageUrl';

interface ThemePalette {
  bannerGradient: string;
  badgeBg: string;
  iconBg: string;
  ctaButton: string;
  ring: string;
}

const THEME_PALETTES: Record<SitePopupTheme, ThemePalette> = {
  indigo: {
    bannerGradient: 'from-indigo-600 via-indigo-500 to-violet-600',
    badgeBg: 'bg-white/20 text-white',
    iconBg: 'bg-white text-indigo-600',
    ctaButton: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25',
    ring: 'focus-visible:ring-indigo-500'
  },
  amber: {
    bannerGradient: 'from-amber-500 via-orange-500 to-rose-500',
    badgeBg: 'bg-white/20 text-white',
    iconBg: 'bg-white text-amber-600',
    ctaButton: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/25',
    ring: 'focus-visible:ring-amber-500'
  },
  emerald: {
    bannerGradient: 'from-emerald-600 via-teal-500 to-cyan-600',
    badgeBg: 'bg-white/20 text-white',
    iconBg: 'bg-white text-emerald-600',
    ctaButton: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25',
    ring: 'focus-visible:ring-emerald-500'
  },
  rose: {
    bannerGradient: 'from-rose-600 via-pink-600 to-fuchsia-600',
    badgeBg: 'bg-white/20 text-white',
    iconBg: 'bg-white text-rose-600',
    ctaButton: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25',
    ring: 'focus-visible:ring-rose-500'
  }
};

function sanitizeExternalUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

interface SitePopupCardProps {
  config: SitePopupConfig;
  isPreview?: boolean;
  onClose?: () => void;
  onAction?: () => void;
}

export const SitePopupCard: React.FC<SitePopupCardProps> = ({
  config,
  isPreview = false,
  onClose,
  onAction
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const palette = THEME_PALETTES[config.theme || 'indigo'];
  const hasCta = config.ctaAction !== 'none' && Boolean(config.ctaText?.trim());
  const hasImage = Boolean(config.imageUrl?.trim()) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [config.imageUrl]);

  const CtaIcon =
    config.ctaAction === 'upload'
      ? Upload
      : config.ctaAction === 'calendar'
      ? Calendar
      : config.ctaAction === 'link'
      ? ExternalLink
      : config.ctaAction === 'dashboard'
      ? Home
      : ArrowRight;

  return (
    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      {/* Top Banner */}
      <div className={`bg-gradient-to-r ${palette.bannerGradient} px-6 pt-6 pb-8 text-white relative overflow-hidden`}>
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close announcement"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-start gap-3.5 pr-8">
          <div className={`w-12 h-12 rounded-2xl ${palette.iconBg} flex items-center justify-center shadow-lg shrink-0`}>
            <Megaphone className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            {config.badgeText?.trim() && (
              <span className={`inline-block px-2.5 py-0.5 rounded-md ${palette.badgeBg} text-[10px] font-bold uppercase tracking-wider mb-1.5`}>
                {config.badgeText.trim()}
              </span>
            )}
            <h3 className="text-base sm:text-lg font-extrabold font-display tracking-tight leading-snug text-balance">
              {config.title.trim() || 'Announcement Headline'}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 -mt-4 bg-white dark:bg-slate-900 rounded-t-3xl relative space-y-4">
        {hasImage && (
          <div className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 max-h-48">
            <img
              src={formatImageUrl(config.imageUrl!)}
              alt={config.title || 'Announcement visual'}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full max-h-48 object-cover"
            />
          </div>
        )}

        {config.message?.trim() && (
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {config.message.trim()}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={`${hasCta ? 'sm:flex-1' : 'w-full'} min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap`}
          >
            {config.dismissText?.trim() || 'Close'}
          </button>

          {hasCta && (
            config.ctaAction === 'link' ? (
              <a
                href={isPreview ? undefined : sanitizeExternalUrl(config.ctaUrl)}
                target={isPreview ? undefined : '_blank'}
                rel={isPreview ? undefined : 'noopener noreferrer'}
                onClick={(e) => {
                  if (isPreview) e.preventDefault();
                  onAction?.();
                }}
                className={`sm:flex-[1.6] min-h-[44px] py-2.5 px-5 rounded-xl ${palette.ctaButton} text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 ${palette.ring}`}
              >
                <CtaIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{config.ctaText.trim()}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className={`sm:flex-[1.6] min-h-[44px] py-2.5 px-5 rounded-xl ${palette.ctaButton} active:scale-[0.99] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 ${palette.ring}`}
              >
                <CtaIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{config.ctaText.trim()}</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

interface SiteAnnouncementPopupProps {
  currentUser: UserProfile | null;
  onOpenUpload: () => void;
  onTriggerAuth: () => void;
  onNavigate: (view: 'dashboard' | 'calendar') => void;
}

export const SiteAnnouncementPopup: React.FC<SiteAnnouncementPopupProps> = ({
  currentUser,
  onOpenUpload,
  onTriggerAuth,
  onNavigate
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [liveConfig, setLiveConfig] = useState<SitePopupConfig>(DEFAULT_SITE_POPUP_CONFIG);
  const [previewConfig, setPreviewConfig] = useState<SitePopupConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const closePopup = useCallback(() => {
    setIsOpen(false);
    setPreviewConfig(null);
    if (typeof window !== 'undefined') {
      window.__sitePopupActive = false;
      window.dispatchEvent(new CustomEvent('site-popup-closed'));
    }
  }, []);

  // Subscribe to global admin popup config in Firestore
  useEffect(() => {
    const unsub = subscribeToSitePopupConfig((cfg) => {
      setLiveConfig(cfg);
    });
    return () => unsub();
  }, []);

  // Show automatically once per local calendar day on first visit when enabled
  useEffect(() => {
    if (previewConfig) return;
    if (!liveConfig.enabled || !liveConfig.title?.trim()) return;
    if (hasSeenSitePopupToday()) return;

    if (typeof window !== 'undefined') {
      window.__sitePopupActive = true;
    }

    const timer = setTimeout(() => {
      if (hasSeenSitePopupToday()) {
        if (typeof window !== 'undefined') {
          window.__sitePopupActive = false;
        }
        return;
      }
      markSitePopupSeenToday();
      if (typeof window !== 'undefined') {
        window.__sitePopupActive = true;
        window.dispatchEvent(new CustomEvent('site-popup-opened'));
      }
      setIsOpen(true);
    }, 850);

    return () => {
      clearTimeout(timer);
    };
  }, [liveConfig.enabled, liveConfig.title, previewConfig]);

  // Listen for Admin Panel preview triggers
  useEffect(() => {
    const handlePreview = (e: Event) => {
      const custom = e as CustomEvent<SitePopupConfig>;
      if (custom.detail) {
        if (typeof window !== 'undefined') {
          window.__sitePopupActive = true;
          window.dispatchEvent(new CustomEvent('site-popup-opened'));
        }
        setPreviewConfig(custom.detail);
        setIsOpen(true);
      }
    };
    window.addEventListener('open-site-popup-preview', handlePreview);
    return () => window.removeEventListener('open-site-popup-preview', handlePreview);
  }, []);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePopup]);

  const activeConfig = previewConfig || liveConfig;

  const handleCtaAction = () => {
    if (previewConfig) {
      closePopup();
      return;
    }

    const action = activeConfig.ctaAction;
    if (action === 'upload') {
      if (currentUser) {
        closePopup();
        onOpenUpload();
      } else {
        // Call synchronous login trigger BEFORE closing so browser popup gesture stays intact
        onTriggerAuth();
        closePopup();
      }
      return;
    }

    if (action === 'calendar') {
      closePopup();
      onNavigate('calendar');
      return;
    }

    if (action === 'dashboard') {
      closePopup();
      onNavigate('dashboard');
      return;
    }

    closePopup();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closePopup}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={activeConfig.title || 'Site announcement'}
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <SitePopupCard
              config={activeConfig}
              isPreview={Boolean(previewConfig)}
              onClose={closePopup}
              onAction={handleCtaAction}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
