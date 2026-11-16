import { collection, doc, increment, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { DailyVisitorStat } from '../types';

const DAILY_UNIQUE_VISITOR_KEY = 'uu_qn_bank_unique_visitor_date';
const SESSION_VISIT_KEY = 'uu_qn_bank_session_visit_date';
const CAMPUS_TIMEZONE = 'Asia/Dhaka';

let inFlightSessionDate: string | null = null;

/**
 * Returns the canonical calendar date string (YYYY-MM-DD) in Uttara University's
 * campus timezone (Asia/Dhaka) so "Today" and "Yesterday" roll over consistently
 * for all visitors and administrators.
 */
export function getCampusDateKey(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CAMPUS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Shifts a YYYY-MM-DD key cleanly by `deltaDays` without local timezone / DST skew.
 */
export function shiftDateKey(baseDateKey: string, deltaDays: number): string {
  const [year, month, day] = baseDateKey.split('-').map(Number);
  if (!year || !month || !day) return baseDateKey;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function formatReadableDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  const dt = new Date(Date.UTC(year, month - 1, day));
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(dt);
  } catch {
    return dateKey;
  }
}

export function formatShortDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  const dt = new Date(Date.UTC(year, month - 1, day));
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric'
    }).format(dt);
  } catch {
    return dateKey.slice(5);
  }
}

function detectDeviceFlags(): { isMobile: boolean; isPWA: boolean } {
  if (typeof window === 'undefined') {
    return { isMobile: false, isPWA: false };
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isMobileViewport = window.matchMedia?.('(max-width: 1023px)').matches ?? false;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isMobile = isMobileViewport || isMobileUA;

  const isStandaloneDisplay =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (typeof navigator !== 'undefined' && (navigator as any).standalone === true);

  return { isMobile, isPWA: Boolean(isStandaloneDisplay) };
}

/**
 * Records a site visit once per browser session (and unique visitor once per campus day).
 * Safe to invoke on mount; React StrictMode double-invocations are deduplicated.
 */
export async function recordSiteVisit(): Promise<void> {
  if (typeof window === 'undefined') return;

  const todayKey = getCampusDateKey();

  // Prevent duplicate writes within the same runtime or browser session
  if (inFlightSessionDate === todayKey) return;
  try {
    if (sessionStorage.getItem(SESSION_VISIT_KEY) === todayKey) {
      inFlightSessionDate = todayKey;
      return;
    }
  } catch {
    // Continue if sessionStorage is restricted
  }

  let isNewDailyVisitor = true;
  try {
    isNewDailyVisitor = localStorage.getItem(DAILY_UNIQUE_VISITOR_KEY) !== todayKey;
  } catch {
    isNewDailyVisitor = true;
  }

  // Mark immediately in memory + sessionStorage so concurrent calls don't double count
  inFlightSessionDate = todayKey;
  try {
    sessionStorage.setItem(SESSION_VISIT_KEY, todayKey);
  } catch {}

  const { isMobile, isPWA } = detectDeviceFlags();
  const payload: Record<string, any> = {
    date: todayKey,
    uniqueVisitors: increment(isNewDailyVisitor ? 1 : 0),
    totalVisits: increment(1),
    updatedAt: new Date().toISOString()
  };

  if (isMobile) {
    payload.mobileVisits = increment(1);
  } else {
    payload.desktopVisits = increment(1);
  }

  if (isPWA) {
    payload.pwaVisits = increment(1);
  }

  const statPath = `visitor_stats/${todayKey}`;
  try {
    await setDoc(doc(db, 'visitor_stats', todayKey), payload, { merge: true });
    if (isNewDailyVisitor) {
      try {
        localStorage.setItem(DAILY_UNIQUE_VISITOR_KEY, todayKey);
      } catch {}
    }
  } catch (err) {
    // Allow retry later in session if offline/transient failure, while avoiding uncaught rejection
    inFlightSessionDate = null;
    console.warn(`Visitor tracking skipped for ${statPath}:`, err);
  }
}

export function subscribeToVisitorStats(
  onUpdate: (stats: DailyVisitorStat[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'visitor_stats';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const rows: DailyVisitorStat[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const dateKey = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
          ? data.date
          : docSnap.id;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;

        rows.push({
          date: dateKey,
          uniqueVisitors: Number(data.uniqueVisitors) || 0,
          totalVisits: Number(data.totalVisits) || 0,
          mobileVisits: Number(data.mobileVisits) || 0,
          desktopVisits: Number(data.desktopVisits) || 0,
          pwaVisits: Number(data.pwaVisits) || 0,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : ''
        });
      });

      rows.sort((a, b) => b.date.localeCompare(a.date));
      onUpdate(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export interface VisitorAggregate {
  uniqueVisitors: number;
  totalVisits: number;
  mobileVisits: number;
  desktopVisits: number;
  pwaVisits: number;
  daysCount: number;
}

export interface VisitorReportSummary {
  todayKey: string;
  yesterdayKey: string;
  today: DailyVisitorStat;
  yesterday: DailyVisitorStat;
  last7: VisitorAggregate;
  last30: VisitorAggregate;
  thisMonth: VisitorAggregate;
  overall: VisitorAggregate;
  peakDay: DailyVisitorStat | null;
  todayVsYesterdayPct: number | null;
  last7Series: DailyVisitorStat[];
  last30Series: DailyVisitorStat[];
  byDateMap: Record<string, DailyVisitorStat>;
}

function emptyStat(date: string): DailyVisitorStat {
  return {
    date,
    uniqueVisitors: 0,
    totalVisits: 0,
    mobileVisits: 0,
    desktopVisits: 0,
    pwaVisits: 0,
    updatedAt: ''
  };
}

export function aggregateStats(items: DailyVisitorStat[]): VisitorAggregate {
  return items.reduce<VisitorAggregate>(
    (acc, item) => ({
      uniqueVisitors: acc.uniqueVisitors + (item.uniqueVisitors || 0),
      totalVisits: acc.totalVisits + (item.totalVisits || 0),
      mobileVisits: acc.mobileVisits + (item.mobileVisits || 0),
      desktopVisits: acc.desktopVisits + (item.desktopVisits || 0),
      pwaVisits: acc.pwaVisits + (item.pwaVisits || 0),
      daysCount: acc.daysCount + 1
    }),
    {
      uniqueVisitors: 0,
      totalVisits: 0,
      mobileVisits: 0,
      desktopVisits: 0,
      pwaVisits: 0,
      daysCount: 0
    }
  );
}

export function buildVisitorReportSummary(stats: DailyVisitorStat[]): VisitorReportSummary {
  const todayKey = getCampusDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const start7Key = shiftDateKey(todayKey, -6);
  const start30Key = shiftDateKey(todayKey, -29);
  const currentMonthPrefix = todayKey.slice(0, 7);

  const byDateMap: Record<string, DailyVisitorStat> = {};
  for (const row of stats) {
    byDateMap[row.date] = row;
  }

  const today = byDateMap[todayKey] || emptyStat(todayKey);
  const yesterday = byDateMap[yesterdayKey] || emptyStat(yesterdayKey);

  const last7Items = stats.filter((s) => s.date >= start7Key && s.date <= todayKey);
  const last30Items = stats.filter((s) => s.date >= start30Key && s.date <= todayKey);
  const thisMonthItems = stats.filter((s) => s.date.startsWith(currentMonthPrefix));

  // Build continuous calendar-day series (chronological ascending) so chart gaps show accurately as 0
  const last7Series: DailyVisitorStat[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const key = shiftDateKey(todayKey, offset);
    last7Series.push(byDateMap[key] || emptyStat(key));
  }

  const last30Series: DailyVisitorStat[] = [];
  for (let offset = -29; offset <= 0; offset++) {
    const key = shiftDateKey(todayKey, offset);
    last30Series.push(byDateMap[key] || emptyStat(key));
  }

  let peakDay: DailyVisitorStat | null = null;
  for (const row of stats) {
    if (!peakDay || row.uniqueVisitors > peakDay.uniqueVisitors || (row.uniqueVisitors === peakDay.uniqueVisitors && row.totalVisits > peakDay.totalVisits)) {
      peakDay = row;
    }
  }

  const todayVsYesterdayPct =
    yesterday.uniqueVisitors > 0
      ? Math.round(((today.uniqueVisitors - yesterday.uniqueVisitors) / yesterday.uniqueVisitors) * 100)
      : null;

  return {
    todayKey,
    yesterdayKey,
    today,
    yesterday,
    last7: aggregateStats(last7Items),
    last30: aggregateStats(last30Items),
    thisMonth: aggregateStats(thisMonthItems),
    overall: aggregateStats(stats),
    peakDay,
    todayVsYesterdayPct,
    last7Series,
    last30Series,
    byDateMap
  };
}
