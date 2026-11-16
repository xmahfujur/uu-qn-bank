import { useEffect, useState, useCallback } from 'react';
import { isInAppBrowser } from '../firebase/config';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null;
    __sitePopupActive?: boolean;
  }
}

const PWA_INSTALLED_STORAGE_KEY = 'uu_qn_bank_pwa_installed';
const PWA_STATE_EVENT = 'pwa-installed-state-changed';

export function isRunningInInstalledMode(): boolean {
  if (typeof window === 'undefined') return false;

  const displayModes = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)',
    '(display-mode: window-controls-overlay)'
  ];

  const matchesDisplayMode = displayModes.some((query) => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });

  const isIOSStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const isAndroidTWA =
    typeof document !== 'undefined' &&
    document.referrer.startsWith('android-app://');

  return matchesDisplayMode || isIOSStandalone || isAndroidTWA;
}

function getStoredInstalledFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setStoredInstalledFlag(installed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (installed) {
      localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(PWA_INSTALLED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in strict privacy mode
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.__deferredPWAInstallPrompt || null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (isRunningInInstalledMode()) return true;
    // If browser already fired beforeinstallprompt, app is definitively NOT installed
    if (window.__deferredPWAInstallPrompt) return false;
    return getStoredInstalledFlag();
  });

  const [relatedAppChecked, setRelatedAppChecked] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [inAppBrowser, setInAppBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
    setIsAndroid(/android/.test(userAgent));
    setInAppBrowser(isInAppBrowser());

    const syncInstalledState = (installed: boolean) => {
      setIsInstalled(installed);
      setStoredInstalledFlag(installed);
      window.dispatchEvent(
        new CustomEvent(PWA_STATE_EVENT, { detail: { installed } })
      );
    };

    // 1. Check standalone / installed display modes immediately
    if (isRunningInInstalledMode()) {
      syncInstalledState(true);
    } else if (window.__deferredPWAInstallPrompt) {
      // Browser fired beforeinstallprompt -> app was uninstalled or not installed
      setStoredInstalledFlag(false);
      setIsInstalled(false);
      setDeferredPrompt(window.__deferredPWAInstallPrompt);
    } else if (getStoredInstalledFlag()) {
      setIsInstalled(true);
    }

    // 2. Query Chromium getInstalledRelatedApps() API (detects installed PWA even in regular browser tabs!)
    const nav = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string; id?: string }>>;
    };
    if (typeof nav.getInstalledRelatedApps === 'function') {
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0 && !window.__deferredPWAInstallPrompt) {
            syncInstalledState(true);
          }
        })
        .catch(() => {})
        .finally(() => {
          setRelatedAppChecked(true);
        });
    } else {
      setRelatedAppChecked(true);
    }

    // 3. Listen for display-mode changes (e.g., transitioning to standalone window)
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        syncInstalledState(true);
      }
    };
    standaloneMediaQuery.addEventListener?.('change', handleDisplayModeChange);

    // 4. Listen for beforeinstallprompt (authoritative signal app is NOT installed)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPWAInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);

      if (!isRunningInInstalledMode()) {
        setStoredInstalledFlag(false);
        setIsInstalled(false);
        window.dispatchEvent(
          new CustomEvent(PWA_STATE_EVENT, { detail: { installed: false } })
        );
      }
    };

    const handleCustomInstallAvailable = () => {
      if (window.__deferredPWAInstallPrompt) {
        setDeferredPrompt(window.__deferredPWAInstallPrompt);
        if (!isRunningInInstalledMode()) {
          setStoredInstalledFlag(false);
          setIsInstalled(false);
        }
      }
    };

    // 5. Listen for appinstalled event
    const handleAppInstalled = () => {
      window.__deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
      syncInstalledState(true);
    };

    // 6. Keep all mounted hook consumers in sync
    const handleSharedStateEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ installed?: boolean }>).detail;
      if (typeof detail?.installed === 'boolean') {
        setIsInstalled(detail.installed);
        if (detail.installed) {
          setDeferredPrompt(null);
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-install-available', handleCustomInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener(PWA_STATE_EVENT, handleSharedStateEvent);

    return () => {
      standaloneMediaQuery.removeEventListener?.('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', handleCustomInstallAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener(PWA_STATE_EVENT, handleSharedStateEvent);
    };
  }, []);

  const markAsInstalled = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.__deferredPWAInstallPrompt = null;
    setDeferredPrompt(null);
    setIsInstalled(true);
    setStoredInstalledFlag(true);
    window.dispatchEvent(
      new CustomEvent(PWA_STATE_EVENT, { detail: { installed: true } })
    );
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined' ? window.__deferredPWAInstallPrompt : null);

    if (!promptEvent) {
      return 'unavailable';
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        markAsInstalled();
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('PWA install prompt error:', err);
      return 'unavailable';
    }
  }, [deferredPrompt, markAsInstalled]);

  const isInstallable = !!deferredPrompt && !isInstalled && !inAppBrowser;
  // Only show install UI if NOT installed, NOT in an embedded in-app browser,
  // and either browser fired beforeinstallprompt OR user is on iOS Safari (no beforeinstallprompt API)
  const canShowInstallUI =
    !isInstalled && !inAppBrowser && relatedAppChecked && (!!deferredPrompt || isIOS);

  return {
    isInstallable,
    canShowInstallUI,
    isInstalled,
    isIOS,
    isAndroid,
    install,
    markAsInstalled,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
