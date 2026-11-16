import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { SitePopupConfig } from '../types';

export const SITE_POPUP_DOC_ID = 'sitePopup';
const DAILY_SEEN_KEY = 'uu_qn_bank_site_popup_last_seen_date';

let memorySeenDate: string | null = null;

export const DEFAULT_SITE_POPUP_CONFIG: SitePopupConfig = {
  enabled: false,
  badgeText: 'Exam Notice',
  title: 'সামনে পরীক্ষা! আপনার কাছে থাকা প্রশ্নপত্র কি আপলোড করেছেন?',
  message:
    'আপনার ডিপার্টমেন্ট ও ব্যাচের পূর্ববর্তী প্রশ্নপত্রগুলো আপলোড করে সহপাঠী ও জুনিয়রদের পরীক্ষার প্রস্তুতিতে সাহায্য করুন। মাত্র ৩০ সেকেন্ডেই ছবি তুলে আপলোড করতে পারবেন!',
  theme: 'indigo',
  imageUrl: '',
  ctaText: 'Upload Question Paper',
  ctaAction: 'upload',
  ctaUrl: '',
  dismissText: 'Later',
  updatedAt: ''
};

export interface SitePopupPreset {
  id: string;
  label: string;
  config: Partial<SitePopupConfig>;
}

export const SITE_POPUP_PRESETS: SitePopupPreset[] = [
  {
    id: 'exam_upload_bn',
    label: 'Exam Upload Drive (Bangla)',
    config: {
      badgeText: 'Exam Reminder',
      title: 'সামনে পরীক্ষা! আপনার কাছে থাকা প্রশ্নপত্র কি আপলোড করেছেন?',
      message:
        'আপনার ডিপার্টমেন্ট ও ব্যাচের পূর্ববর্তী প্রশ্নপত্রগুলো আপলোড করে সহপাঠী ও জুনিয়রদের পরীক্ষার প্রস্তুতিতে সাহায্য করুন।',
      theme: 'indigo',
      ctaText: 'Upload Question Paper',
      ctaAction: 'upload',
      dismissText: 'Later'
    }
  },
  {
    id: 'exam_upload_en',
    label: 'Exam Upload Drive (English)',
    config: {
      badgeText: 'Community Drive',
      title: 'Exams Ahead! Have You Uploaded Your Question Papers?',
      message:
        'Help fellow Uttara University students prepare smarter. Upload clear photos of your Mid-Term or Final exam question papers in seconds.',
      theme: 'emerald',
      ctaText: 'Upload Paper Now',
      ctaAction: 'upload',
      dismissText: 'Maybe Later'
    }
  },
  {
    id: 'exam_calendar_notice',
    label: 'Exam Schedule & Calendar',
    config: {
      badgeText: 'Important Notice',
      title: 'Check the Upcoming Exam Dates & Academic Calendar',
      message:
        'Stay ahead of deadlines! View upcoming Mid-Term and Final exam schedules, countdowns, and university milestones.',
      theme: 'amber',
      ctaText: 'View Academic Calendar',
      ctaAction: 'calendar',
      dismissText: 'Close'
    }
  }
];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Returns local calendar date in YYYY-MM-DD format so "once per day" aligns
 * with the visitor's local midnight.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hasSeenSitePopupToday(): boolean {
  const today = getLocalDateKey();
  if (memorySeenDate === today) return true;
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DAILY_SEEN_KEY) === today;
  } catch {
    return false;
  }
}

export function markSitePopupSeenToday(): void {
  const today = getLocalDateKey();
  memorySeenDate = today;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_SEEN_KEY, today);
  } catch {
    // Ignore storage restriction in strict private browsers
  }
}

export function resetSitePopupSeenToday(): void {
  memorySeenDate = null;
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DAILY_SEEN_KEY);
  } catch {}
}

function normalizeSitePopupData(raw: unknown): SitePopupConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SITE_POPUP_CONFIG;
  }
  const obj = raw as Partial<SitePopupConfig>;
  return {
    ...DEFAULT_SITE_POPUP_CONFIG,
    ...obj,
    enabled: Boolean(obj.enabled),
    badgeText: typeof obj.badgeText === 'string' ? obj.badgeText : '',
    title: typeof obj.title === 'string' ? obj.title : '',
    message: typeof obj.message === 'string' ? obj.message : '',
    theme:
      obj.theme === 'amber' || obj.theme === 'emerald' || obj.theme === 'rose' || obj.theme === 'indigo'
        ? obj.theme
        : 'indigo',
    imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : '',
    ctaText: typeof obj.ctaText === 'string' ? obj.ctaText : '',
    ctaAction:
      obj.ctaAction === 'upload' ||
      obj.ctaAction === 'calendar' ||
      obj.ctaAction === 'dashboard' ||
      obj.ctaAction === 'link' ||
      obj.ctaAction === 'none'
        ? obj.ctaAction
        : 'upload',
    ctaUrl: typeof obj.ctaUrl === 'string' ? obj.ctaUrl : '',
    dismissText: typeof obj.dismissText === 'string' && obj.dismissText.trim() ? obj.dismissText : 'Close',
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
    updatedByUsername: typeof obj.updatedByUsername === 'string' ? obj.updatedByUsername : undefined
  };
}

export async function loadSitePopupConfig(): Promise<SitePopupConfig> {
  const path = `systemSettings/${SITE_POPUP_DOC_ID}`;
  try {
    const snap = await getDoc(doc(db, 'systemSettings', SITE_POPUP_DOC_ID));
    if (!snap.exists()) {
      return DEFAULT_SITE_POPUP_CONFIG;
    }
    const data = snap.data();
    return normalizeSitePopupData(data?.sitePopup ?? data);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return DEFAULT_SITE_POPUP_CONFIG;
  }
}

export function subscribeToSitePopupConfig(
  onUpdate: (config: SitePopupConfig) => void
): () => void {
  const path = `systemSettings/${SITE_POPUP_DOC_ID}`;
  return onSnapshot(
    doc(db, 'systemSettings', SITE_POPUP_DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_SITE_POPUP_CONFIG);
        return;
      }
      const data = snap.data();
      onUpdate(normalizeSitePopupData(data?.sitePopup ?? data));
    },
    (error) => {
      console.warn(`Site popup subscription warning (${path}):`, error);
      onUpdate(DEFAULT_SITE_POPUP_CONFIG);
    }
  );
}

export async function saveSitePopupConfig(
  config: SitePopupConfig,
  updatedByUsername?: string
): Promise<SitePopupConfig> {
  const path = `systemSettings/${SITE_POPUP_DOC_ID}`;
  const payload: SitePopupConfig = {
    enabled: Boolean(config.enabled),
    badgeText: config.badgeText.trim().slice(0, 60),
    title: config.title.trim().slice(0, 220),
    message: config.message.trim().slice(0, 1200),
    theme: config.theme,
    imageUrl: (config.imageUrl || '').trim().slice(0, 1000),
    ctaText: config.ctaText.trim().slice(0, 60),
    ctaAction: config.ctaAction,
    ctaUrl: (config.ctaUrl || '').trim().slice(0, 1000),
    dismissText: (config.dismissText || 'Close').trim().slice(0, 40),
    updatedAt: new Date().toISOString(),
    updatedByUsername: updatedByUsername || ''
  };

  try {
    await setDoc(
      doc(db, 'systemSettings', SITE_POPUP_DOC_ID),
      {
        sitePopup: payload,
        updatedAt: payload.updatedAt
      },
      { merge: true }
    );
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return payload;
  }
}
