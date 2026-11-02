import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Smartphone, 
  Zap, 
  CheckCircle2, 
  Share, 
  MoreVertical, 
  PlusSquare, 
  BookOpen,
  Sparkles
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../utils/usePWAInstall';

const SESSION_DISMISS_KEY = 'uu_qn_bank_pwa_popup_dismissed';

export const PWAInstallEntryPopup: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      setIsOpen(false);
      return;
    }

    // Check if user already dismissed the entry popup in this session
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
    } catch {}

    if (!dismissed) {
      // Show popup shortly after entering the website
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isInstalled]);

  // Allow any button in the app (e.g. Navbar Install button) to open this modal on demand
  useEffect(() => {
    const handleOpenRequest = () => {
      setShowManualGuide(false);
      setIsOpen(true);
    };
    window.addEventListener('open-pwa-install-modal', handleOpenRequest);
    return () => window.removeEventListener('open-pwa-install-modal', handleOpenRequest);
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    setShowManualGuide(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {}
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      const outcome = await install();
      setInstalling(false);
      if (outcome === 'accepted') {
        setIsOpen(false);
        return;
      }
      if (outcome === 'dismissed') {
        return;
      }
    }
    // If native prompt is unavailable (iOS Safari, in-app webview, or already prompted), show quick step-by-step guide
    setShowManualGuide(true);
  };

  if (isInstalled || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-6 pt-6 pb-8 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            aria-label="Close install notification"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-lg shrink-0 border-2 border-white/40">
              <BookOpen className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" /> Official Web App
              </div>
              <h3 className="text-lg font-extrabold tracking-tight leading-snug">
                Install UU Qn Bank App
              </h3>
              <p className="text-xs text-indigo-100 font-medium">
                Uttara University Question Repository
              </p>
            </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 -mt-4 bg-white dark:bg-slate-900 rounded-t-3xl relative">
          {!showManualGuide ? (
            <>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Install our lightweight <strong>Web View App</strong> directly on your device for instant 1-tap access to previous exam question papers anytime.
              </p>

              <div className="space-y-2.5 mb-6">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Full-Screen App Experience</p>
                    <p className="text-slate-500 dark:text-slate-400">Launches straight from your home screen like a native app</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Faster Loading & Zero Extra Storage</p>
                    <p className="text-slate-500 dark:text-slate-400">Instant paper browsing, camera upload & exam calendar</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="flex-[1.6] py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{installing ? 'Installing...' : 'Install Web App'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {isIOS
                    ? 'How to Install on iPhone / iPad'
                    : isAndroid
                    ? 'How to Install on Android'
                    : 'How to Install on Your Device'}
                </h4>

                {isIOS ? (
                  <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>
                        Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600 dark:text-indigo-400" /> in your Safari toolbar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>
                        Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600 dark:text-indigo-400" />.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>
                        Tap <strong>Add</strong> in the top-right corner to launch UU Qn Bank from your home screen.
                      </span>
                    </li>
                  </ol>
                ) : (
                  <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>
                        Tap the browser menu icon <MoreVertical className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600 dark:text-indigo-400" /> (top-right corner in Chrome) or the address bar install icon.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>
                        Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>
                        Confirm <strong>Install</strong> to add the UU Qn Bank app to your home screen!
                      </span>
                    </li>
                  </ol>
                )}
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    window.dispatchEvent(new CustomEvent('open-pwa-install-modal'));
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/70 text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
        title="Install UU Qn Bank Web App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
      title="Install UU Qn Bank App"
    >
      <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
      <span>Install App</span>
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg">
      <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
      Offline Mode — Viewing cached data
    </div>
  );
};
