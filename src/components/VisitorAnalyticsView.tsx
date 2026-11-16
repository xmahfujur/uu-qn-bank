import React, { useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  CalendarDays,
  CalendarRange,
  Download,
  Globe,
  Monitor,
  Search,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import { DailyVisitorStat } from '../types';
import {
  aggregateStats,
  buildVisitorReportSummary,
  formatReadableDateKey,
  formatShortDateKey,
  shiftDateKey
} from '../utils/visitorAnalytics';

type TimeframeFilter = 'today' | 'yesterday' | '7d' | '30d' | 'overall';
type ChartMetric = 'uniqueVisitors' | 'totalVisits';

interface VisitorAnalyticsViewProps {
  visitorStats: DailyVisitorStat[];
  loading: boolean;
  error: string | null;
}

export default function VisitorAnalyticsView({
  visitorStats,
  loading,
  error
}: VisitorAnalyticsViewProps) {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('30d');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('uniqueVisitors');
  const [tableSearch, setTableSearch] = useState('');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const summary = useMemo(() => buildVisitorReportSummary(visitorStats), [visitorStats]);

  // Rows matching selected timeframe filter for both the device breakdown & ledger
  const timeframeStats = useMemo(() => {
    const { todayKey, yesterdayKey } = summary;
    if (timeframe === 'today') {
      return visitorStats.filter((s) => s.date === todayKey);
    }
    if (timeframe === 'yesterday') {
      return visitorStats.filter((s) => s.date === yesterdayKey);
    }
    if (timeframe === '7d') {
      const start = shiftDateKey(todayKey, -6);
      return visitorStats.filter((s) => s.date >= start && s.date <= todayKey);
    }
    if (timeframe === '30d') {
      const start = shiftDateKey(todayKey, -29);
      return visitorStats.filter((s) => s.date >= start && s.date <= todayKey);
    }
    return visitorStats;
  }, [visitorStats, timeframe, summary]);

  const activeAggregate = useMemo(() => aggregateStats(timeframeStats), [timeframeStats]);

  // Continuous chart series matching timeframe
  const chartSeries = useMemo(() => {
    if (timeframe === 'today') {
      return [summary.yesterday, summary.today];
    }
    if (timeframe === 'yesterday') {
      const dayBeforeKey = shiftDateKey(summary.yesterdayKey, -1);
      const dayBefore = summary.byDateMap[dayBeforeKey] || {
        date: dayBeforeKey,
        uniqueVisitors: 0,
        totalVisits: 0,
        mobileVisits: 0,
        desktopVisits: 0,
        pwaVisits: 0,
        updatedAt: ''
      };
      return [dayBefore, summary.yesterday, summary.today];
    }
    if (timeframe === '7d') {
      return summary.last7Series;
    }
    if (timeframe === '30d') {
      return summary.last30Series;
    }
    // Overall: show up to all recorded days chronologically (minimum last 30 days if sparse)
    if (visitorStats.length <= 30) {
      return summary.last30Series;
    }
    return [...visitorStats].sort((a, b) => a.date.localeCompare(b.date));
  }, [timeframe, summary, visitorStats]);

  const maxChartValue = useMemo(() => {
    const vals = chartSeries.map((d) =>
      chartMetric === 'uniqueVisitors' ? d.uniqueVisitors : d.totalVisits
    );
    return Math.max(1, ...vals);
  }, [chartSeries, chartMetric]);

  const activePoint = useMemo(() => {
    if (hoveredDate) {
      const found = chartSeries.find((d) => d.date === hoveredDate);
      if (found) return found;
    }
    if (timeframe === 'yesterday') return summary.yesterday;
    return summary.today;
  }, [hoveredDate, chartSeries, timeframe, summary]);

  const filteredLedgerRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const base = timeframeStats;
    if (!q) return base;
    return base.filter((row) => {
      const readable = formatReadableDateKey(row.date).toLowerCase();
      return row.date.includes(q) || readable.includes(q);
    });
  }, [timeframeStats, tableSearch]);

  const handleExportCsv = () => {
    const rows = [
      ['Date', 'Unique Visitors', 'Total Visits', 'Mobile Visits', 'Desktop Visits', 'PWA App Visits'],
      ...filteredLedgerRows.map((r) => [
        r.date,
        String(r.uniqueVisitors),
        String(r.totalVisits),
        String(r.mobileVisits || 0),
        String(r.desktopVisits || 0),
        String(r.pwaVisits || 0)
      ])
    ];
    const csv = rows.map((line) => line.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `uu-qnbank-visitors-${timeframe}-${summary.todayKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalDeviceVisits =
    activeAggregate.mobileVisits + activeAggregate.desktopVisits || 0;
  const mobilePct =
    totalDeviceVisits > 0
      ? Math.round((activeAggregate.mobileVisits / totalDeviceVisits) * 100)
      : 0;
  const desktopPct = totalDeviceVisits > 0 ? 100 - mobilePct : 0;
  const pwaPct =
    activeAggregate.totalVisits > 0
      ? Math.round((activeAggregate.pwaVisits / activeAggregate.totalVisits) * 100)
      : 0;

  const avgDailyUnique =
    summary.last30.daysCount > 0
      ? Math.round(summary.last30.uniqueVisitors / summary.last30.daysCount)
      : 0;
  const sessionsPerVisitor =
    activeAggregate.uniqueVisitors > 0
      ? (activeAggregate.totalVisits / activeAggregate.uniqueVisitors).toFixed(2)
      : '0.00';

  const timeframeLabel: Record<TimeframeFilter, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    overall: 'Overall (All-Time)'
  };

  if (loading && visitorStats.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80"
            />
          ))}
        </div>
        <div className="h-72 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
          Could not load live visitor records: {error}
        </div>
      )}

      {/* Timeframe Filter Bar & Export Control */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-950 p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'overall', label: 'Overall' }
            ] as const
          ).map((item) => {
            const active = timeframe === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTimeframe(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="whitespace-nowrap">
            Campus TZ: <strong className="text-slate-700 dark:text-slate-200">Asia/Dhaka</strong>
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLedgerRows.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-opacity cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4-Card KPI Strip: Today / Yesterday / Last 30 Days / Overall */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* 1. Today */}
        <button
          type="button"
          onClick={() => setTimeframe('today')}
          className={`text-left p-5 sm:p-6 rounded-3xl border bg-white dark:bg-slate-950 transition-all cursor-pointer ${
            timeframe === 'today'
              ? 'border-indigo-500 ring-2 ring-indigo-500/15'
              : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Today&apos;s Visitors
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-950 dark:text-white font-mono tabular-nums">
              {summary.today.uniqueVisitors.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">unique</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              {summary.today.totalVisits.toLocaleString()} sessions
            </span>
            {summary.todayVsYesterdayPct !== null ? (
              <span
                className={`inline-flex items-center gap-1 font-bold font-mono tabular-nums ${
                  summary.todayVsYesterdayPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {summary.todayVsYesterdayPct >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {summary.todayVsYesterdayPct >= 0 ? '+' : ''}
                {summary.todayVsYesterdayPct}%
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">{formatShortDateKey(summary.todayKey)}</span>
            )}
          </div>
        </button>

        {/* 2. Yesterday */}
        <button
          type="button"
          onClick={() => setTimeframe('yesterday')}
          className={`text-left p-5 sm:p-6 rounded-3xl border bg-white dark:bg-slate-950 transition-all cursor-pointer ${
            timeframe === 'yesterday'
              ? 'border-indigo-500 ring-2 ring-indigo-500/15'
              : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Yesterday&apos;s Visitors
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-950 dark:text-white font-mono tabular-nums">
              {summary.yesterday.uniqueVisitors.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">unique</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {summary.yesterday.totalVisits.toLocaleString()} sessions
            </span>
            <span>{formatShortDateKey(summary.yesterdayKey)}</span>
          </div>
        </button>

        {/* 3. Last 30 Days */}
        <button
          type="button"
          onClick={() => setTimeframe('30d')}
          className={`text-left p-5 sm:p-6 rounded-3xl border bg-white dark:bg-slate-950 transition-all cursor-pointer ${
            timeframe === '30d'
              ? 'border-indigo-500 ring-2 ring-indigo-500/15'
              : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Last 30 Days
            </span>
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <CalendarRange className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-950 dark:text-white font-mono tabular-nums">
              {summary.last30.uniqueVisitors.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">visitor-days</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {summary.last30.totalVisits.toLocaleString()} sessions
            </span>
            <span className="font-mono tabular-nums">~{avgDailyUnique}/day</span>
          </div>
        </button>

        {/* 4. Overall All-Time */}
        <button
          type="button"
          onClick={() => setTimeframe('overall')}
          className={`text-left p-5 sm:p-6 rounded-3xl border bg-white dark:bg-slate-950 transition-all cursor-pointer ${
            timeframe === 'overall'
              ? 'border-indigo-500 ring-2 ring-indigo-500/15'
              : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Overall Visitors
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-950 dark:text-white font-mono tabular-nums">
              {summary.overall.uniqueVisitors.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">total</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {summary.overall.totalVisits.toLocaleString()} sessions
            </span>
            <span className="font-mono tabular-nums">
              {summary.overall.daysCount} active day{summary.overall.daysCount === 1 ? '' : 's'}
            </span>
          </div>
        </button>
      </div>

      {/* Main Split: Daily Trend Chart + Period Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Daily Visitor Trend Chart (2 cols on xl) */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-950 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Daily Visitor Traffic · {timeframeLabel[timeframe]}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hover or tap any day bar to inspect daily visitor and session figures.
              </p>
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric('uniqueVisitors')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  chartMetric === 'uniqueVisitors'
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Unique Visitors
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('totalVisits')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                  chartMetric === 'totalVisits'
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Total Sessions
              </button>
            </div>
          </div>

          {/* Selected / Hovered Day Readout Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                {formatReadableDateKey(activePoint.date)}
                {activePoint.date === summary.todayKey
                  ? ' (Today)'
                  : activePoint.date === summary.yesterdayKey
                  ? ' (Yesterday)'
                  : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
              <span>
                <strong className="text-indigo-600 dark:text-indigo-400">
                  {activePoint.uniqueVisitors.toLocaleString()}
                </strong>{' '}
                unique
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white">
                  {activePoint.totalVisits.toLocaleString()}
                </strong>{' '}
                sessions
              </span>
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
                {(activePoint.mobileVisits || 0).toLocaleString()} mobile ·{' '}
                {(activePoint.desktopVisits || 0).toLocaleString()} desktop
              </span>
            </div>
          </div>

          {/* Interactive Column Chart */}
          <div className="pt-2">
            <div className="h-52 flex items-end gap-1 sm:gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
              {chartSeries.map((day) => {
                const val =
                  chartMetric === 'uniqueVisitors' ? day.uniqueVisitors : day.totalVisits;
                const heightPct = val > 0 ? Math.max(8, Math.round((val / maxChartValue) * 100)) : 3;
                const isToday = day.date === summary.todayKey;
                const isYesterday = day.date === summary.yesterdayKey;
                const isSelected = activePoint.date === day.date;

                return (
                  <button
                    key={day.date}
                    type="button"
                    onMouseEnter={() => setHoveredDate(day.date)}
                    onFocus={() => setHoveredDate(day.date)}
                    onClick={() => setHoveredDate(day.date)}
                    aria-label={`${formatReadableDateKey(day.date)}: ${val} ${
                      chartMetric === 'uniqueVisitors' ? 'unique visitors' : 'sessions'
                    }`}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer focus:outline-none"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-200 ${
                        val === 0
                          ? 'bg-slate-100 dark:bg-slate-800/60'
                          : isToday
                          ? 'bg-indigo-600 dark:bg-indigo-500'
                          : isYesterday
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : isSelected
                          ? 'bg-indigo-500 dark:bg-indigo-400'
                          : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500'
                      } ${isSelected && val > 0 ? 'ring-2 ring-indigo-500/30' : ''}`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 text-[11px] font-mono tabular-nums text-slate-400">
              <span>{chartSeries[0] ? formatShortDateKey(chartSeries[0].date) : ''}</span>
              {chartSeries.length > 4 && (
                <span>
                  {formatShortDateKey(chartSeries[Math.floor(chartSeries.length / 2)].date)}
                </span>
              )}
              <span>
                {chartSeries[chartSeries.length - 1]
                  ? formatShortDateKey(chartSeries[chartSeries.length - 1].date)
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Period Insights & Device Split */}
        <div className="bg-white dark:bg-slate-950 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              {timeframeLabel[timeframe]} Insights
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Device mix, engagement intensity & peak day
            </p>
          </div>

          <div className="space-y-4">
            {/* Mobile vs Desktop */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                  Mobile ({mobilePct}%)
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                  Desktop ({desktopPct}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex">
                <div
                  style={{ width: `${mobilePct}%` }}
                  className="bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                />
                <div
                  style={{ width: `${desktopPct}%` }}
                  className="bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>{activeAggregate.mobileVisits.toLocaleString()} mobile sessions</span>
                <span>{activeAggregate.desktopVisits.toLocaleString()} desktop sessions</span>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-900 pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                  Installed PWA App Visits
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {activeAggregate.pwaVisits.toLocaleString()} ({pwaPct}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  Sessions per Visitor
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {sessionsPerVisitor}x
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-500" />
                  This Month Total
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {summary.thisMonth.uniqueVisitors.toLocaleString()} unique ·{' '}
                  {summary.thisMonth.totalVisits.toLocaleString()} visits
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                  Peak Traffic Day
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-right">
                  {summary.peakDay
                    ? `${summary.peakDay.uniqueVisitors.toLocaleString()} on ${formatShortDateKey(
                        summary.peakDay.date
                      )}`
                    : 'No data yet'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Visitor Ledger Table */}
      <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800/80 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Daily Visitor Report Ledger
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing {filteredLedgerRows.length} recorded day
              {filteredLedgerRows.length === 1 ? '' : 's'} for {timeframeLabel[timeframe]}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Filter date (e.g. 2026-11)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {filteredLedgerRows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No visitor records found for this filter
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Visitor statistics record automatically each day as students visit UU Qn Bank. Switch to Today or Overall to inspect all recorded traffic.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4 text-right">Unique Visitors</th>
                  <th className="py-3 px-4 text-right">Total Visits</th>
                  <th className="py-3 px-4 text-right">Mobile</th>
                  <th className="py-3 px-4 text-right">Desktop</th>
                  <th className="py-3 px-5 text-right">PWA App</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-xs">
                {filteredLedgerRows.map((row) => {
                  const isToday = row.date === summary.todayKey;
                  const isYesterday = row.date === summary.yesterdayKey;
                  return (
                    <tr
                      key={row.date}
                      onMouseEnter={() => setHoveredDate(row.date)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="py-3 px-5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <span>{formatReadableDateKey(row.date)}</span>
                        <span className="text-slate-400 font-mono text-[11px] ml-2">
                          {row.date}
                        </span>
                        {isToday && (
                          <span className="ml-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            · Today
                          </span>
                        )}
                        {isYesterday && (
                          <span className="ml-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            · Yesterday
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                        {row.uniqueVisitors.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {row.totalVisits.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {(row.mobileVisits || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {(row.desktopVisits || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {(row.pwaVisits || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
