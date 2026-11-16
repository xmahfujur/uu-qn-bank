import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User as FirebaseUser,
  UserCredential,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc
} from 'firebase/firestore';
import { UserProfile } from '../types';

import firebaseConfig from '../../firebase-applet-config.json';

// Use custom domain authDomain so Safari & mobile Chrome third-party cookie /
// storage partitioning doesn't break signInWithRedirect (rewritten via vercel.json).
const effectiveFirebaseConfig = {
  ...firebaseConfig,
  authDomain: 'uuqnbank.vercel.app'
};

const app = initializeApp(effectiveFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Set auth persistence cleanly with cascading fallback:
// browserLocalPersistence -> browserSessionPersistence -> inMemoryPersistence
export const persistenceReady: Promise<void> = (async () => {
  if (typeof window === 'undefined') return;
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (localErr) {
    console.warn('browserLocalPersistence unavailable, falling back to browserSessionPersistence:', localErr);
    try {
      await setPersistence(auth, browserSessionPersistence);
    } catch (sessionErr) {
      console.warn('browserSessionPersistence unavailable, falling back to inMemoryPersistence:', sessionErr);
      try {
        await setPersistence(auth, inMemoryPersistence);
      } catch (memErr) {
        console.error('[Firebase Auth Error]', (memErr as any)?.code || 'persistence-failed', memErr);
      }
    }
  }
})();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export type AuthErrorCategory =
  | 'blocked'
  | 'network'
  | 'unauthorized-domain'
  | 'in-app-browser'
  | 'cookies-disabled'
  | 'generic';

export interface AuthErrorInfo {
  code: string;
  category: AuthErrorCategory;
  title: string;
  message: string;
  hostname?: string;
}

/**
 * Detects embedded / in-app WebView browsers (Facebook, Instagram, Line,
 * Telegram, Messenger, Android `; wv)`, iOS WebView) where Google blocks OAuth.
 */
export function isInAppBrowser(userAgent?: string): boolean {
  if (typeof window === 'undefined' && !userAgent) return false;
  const ua = userAgent || navigator.userAgent || navigator.vendor || (window as any).opera || '';

  const knownInApp = /FBAN|FBAV|FB_IAB|FB4A|FBSS|FBIOS|Instagram|Line\/|Line\b|Telegram|Messenger|Twitter|MicroMessenger|Snapchat|TikTok|Bytedance|musical_ly|WhatsApp|;\s*wv\)|\bwv\b/i;
  if (knownInApp.test(ua)) return true;

  // Android WebView commonly includes Version/X.X
  if (/Android/i.test(ua) && /Version\/[0-9.]+/i.test(ua)) {
    return true;
  }

  // iOS WebView has AppleWebKit without standard Safari / CriOS / FxiOS / EdgiOS
  const isIOS = /(iPhone|iPod|iPad)/i.test(ua);
  if (isIOS && /AppleWebKit/i.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Mobile browsers & iOS Safari use redirect directly; desktop tries popup first.
 */
export function isMobileOrSafariRedirectPreferred(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIPadOSDesktopUA =
    typeof navigator.platform === 'string' &&
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  return isMobileUA || isIPadOSDesktopUA;
}

/**
 * Maps Firebase Auth error codes to user-friendly messages and logs the real code.
 */
export function mapFirebaseAuthError(err: any): AuthErrorInfo | null {
  const code: string = err?.code || 'auth/unknown';
  console.error('[Firebase Auth Error]', code, err?.message || err, err);

  // User intentionally dismissed popup — do nothing
  if (code === 'auth/popup-closed-by-user' || code === 'auth/user-cancelled') {
    return null;
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      category: 'blocked',
      title: 'Sign-In Popup Was Blocked',
      message:
        'Your browser blocked the Google sign-in window. Please allow popups for this site or tap Retry to continue with Google sign-in.'
    };
  }

  if (code === 'auth/network-request-failed' || code === 'auth/timeout') {
    return {
      code,
      category: 'network',
      title: 'Network Connection Issue',
      message:
        'Could not reach Google servers to complete sign-in. Please check your internet connection and tap Retry.'
    };
  }

  if (code === 'auth/unauthorized-domain') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return {
      code,
      category: 'unauthorized-domain',
      title: 'Domain Not Authorized',
      message: `Firebase Authentication does not yet authorize "${hostname}". Add this domain in Firebase Console -> Authentication -> Authorized domains, then tap Retry.`,
      hostname
    };
  }

  if (
    code === 'auth/web-storage-unsupported' ||
    code === 'auth/missing-initial-state' ||
    code === 'auth/cookie-not-found' ||
    code === 'auth/operation-not-supported-in-this-environment'
  ) {
    return {
      code,
      category: 'cookies-disabled',
      title: 'Browser Cookies or Storage Disabled',
      message:
        'Google sign-in requires browser cookies and storage to be enabled (not blocked by strict tracking prevention or private mode). Enable cookies/site data and tap Retry.'
    };
  }

  return {
    code,
    category: 'generic',
    title: 'Google Sign-In Failed',
    message: `Could not complete sign-in (${code}). Please tap Retry.`
  };
}

let initialRedirectResultPromise: Promise<UserCredential | null> | null = null;

/**
 * Calls getRedirectResult(auth) strictly once on app start (even in React StrictMode).
 */
export function getInitialRedirectResultOnce(): Promise<UserCredential | null> {
  if (!initialRedirectResultPromise) {
    initialRedirectResultPromise = persistenceReady.then(() => getRedirectResult(auth));
  }
  return initialRedirectResultPromise;
}

export type SignInActionResult =
  | { status: 'in-app-browser' }
  | { status: 'redirecting' }
  | { status: 'signed-in'; user: FirebaseUser }
  | { status: 'cancelled' }
  | { status: 'error'; error: AuthErrorInfo };

/**
 * MUST be invoked directly and synchronously inside a user click handler
 * with NO preceding `await` so desktop popups are never blocked as unprompted.
 */
export function startGoogleSignIn(): Promise<SignInActionResult> {
  if (isInAppBrowser()) {
    return Promise.resolve({ status: 'in-app-browser' });
  }

  // Mobile browsers / iOS Safari -> redirect flow
  if (isMobileOrSafariRedirectPreferred()) {
    return signInWithRedirect(auth, googleProvider)
      .then(() => ({ status: 'redirecting' as const }))
      .catch((err: any) => {
        const mapped = mapFirebaseAuthError(err);
        if (!mapped) return { status: 'cancelled' as const };
        return { status: 'error' as const, error: mapped };
      });
  }

  // Desktop browsers -> signInWithPopup synchronously in click handler
  return signInWithPopup(auth, googleProvider)
    .then((cred) => ({ status: 'signed-in' as const, user: cred.user }))
    .catch((err: any) => {
      const code: string = err?.code || 'auth/unknown';
      console.error('[Firebase Auth Error]', code, err?.message || err, err);

      // User intentionally closed popup -> do nothing
      if (code === 'auth/popup-closed-by-user' || code === 'auth/user-cancelled') {
        return { status: 'cancelled' as const };
      }

      // Popup blocked / cancelled request / unsupported environment -> auto fall back to signInWithRedirect
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        return signInWithRedirect(auth, googleProvider)
          .then(() => ({ status: 'redirecting' as const }))
          .catch((redirectErr: any) => {
            const mapped = mapFirebaseAuthError(redirectErr);
            if (!mapped) return { status: 'cancelled' as const };
            return { status: 'error' as const, error: mapped };
          });
      }

      const mapped = mapFirebaseAuthError(err);
      if (!mapped) return { status: 'cancelled' as const };
      return { status: 'error' as const, error: mapped };
    });
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Safe username generator based on email with non-blocking fallback
export async function generateUniqueUsername(email: string): Promise<string> {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const username = base || 'scholar';

  try {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return username;
    }
    return `${username}_${Math.floor(100 + Math.random() * 900)}`;
  } catch (err) {
    console.warn('Could not query username uniqueness, using random suffix:', err);
    return `${username}_${Math.floor(100 + Math.random() * 900)}`;
  }
}

// Resilient user profile synchronizer that retrieves the true profile from Firestore
export async function syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const email = user.email || '';
  const isSuperAdmin = email.toLowerCase() === 'mr074770@gmail.com';
  const defaultUsername = isSuperAdmin
    ? 'mahfujur'
    : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'scholar';

  const baselineProfile: UserProfile = {
    uid: user.uid,
    email: email,
    username: defaultUsername,
    photoURL:
      user.photoURL ||
      `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(defaultUsername)}`,
    createdAt: new Date().toISOString(),
    role: isSuperAdmin ? 'super_admin' : 'user',
    uploadCount: 0,
    likesReceived: 0
  };

  const userDocRef = doc(db, 'users', user.uid);

  try {
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      const trueUsername = data.username || defaultUsername;

      const merged: UserProfile = {
        ...data,
        email: email || data.email,
        username: trueUsername,
        photoURL: user.photoURL || data.photoURL || baselineProfile.photoURL,
        role: isSuperAdmin ? 'super_admin' : data.role || 'user'
      };

      if (isSuperAdmin && (data.role !== 'super_admin' || data.username !== 'mahfujur')) {
        updateDoc(userDocRef, { role: 'super_admin', username: 'mahfujur' }).catch(() => {});
        merged.username = 'mahfujur';
        merged.role = 'super_admin';
      }
      return merged;
    }

    const username = isSuperAdmin ? 'mahfujur' : await generateUniqueUsername(email);
    const newProfile: UserProfile = {
      ...baselineProfile,
      username
    };

    await setDoc(userDocRef, newProfile).catch((writeErr) => {
      console.warn('Could not write user profile to Firestore:', writeErr);
    });

    addDoc(collection(db, 'notifications'), {
      userId: user.uid,
      title: 'Welcome to UU Qn Bank!',
      message: `Thank you for joining. Your username is @${username}.`,
      createdAt: new Date().toISOString(),
      read: false
    }).catch(() => {});

    return newProfile;
  } catch (err) {
    console.warn('Firestore profile lookup failed, continuing with baseline:', err);
    return baselineProfile;
  }
}
