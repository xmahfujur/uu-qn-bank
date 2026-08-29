import React, { useState, useMemo } from 'react';
import { 
  ScrollText, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  Trash2, 
  RefreshCw, 
  Shield, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FolderTree, 
  GraduationCap, 
  Users, 
  FileText, 
  Flag, 
  Calendar,
  Layers,
  ChevronDown,
  UserCheck,
  UserX,
  ExternalLink,
  Activity
} from 'lucide-react';
import { AuditLog, AuditLogCategory } from '../types';

interface AuditLogsViewProps {
  logs: AuditLog[];
  currentUser: any;
  onClearLogs: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function AuditLogsView({
  logs,
  currentUser,
  onClearLogs,
  onRefresh,
  loading
}: AuditLogsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | AuditLogCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Categories config
  const categories: { id: 'all' | AuditLogCategory; label: string; icon: any }[] = [
    { id: 'all', label: 'All Activities', icon: Layers },
    { id: 'Papers', label: 'Papers', icon: FileText },
    { id: 'Reports', label: 'Reports', icon: Flag },
    { id: 'Users', label: 'Users & Roles', icon: Users },
    { id: 'Hierarchy', label: 'Hierarchy', icon: FolderTree },
    { id: 'Faculty', label: 'Faculty', icon: GraduationCap },
    { id: 'Events', label: 'Events', icon: Calendar }
  ];

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }

      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      // Time filter
      if (timeFilter !== 'all') {
        const logDate = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === 'today') {
          const oneDayAgo = now - 24 * 60 * 60 * 1000;
          if (logDate < oneDayAgo) return false;
        } else if (timeFilter === '7days') {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          if (logDate < sevenDaysAgo) return false;
        } else if (timeFilter === '30days') {
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = (log.performedByName || '').toLowerCase().includes(q) ||
          (log.performedByEmail || '').toLowerCase().includes(q) ||
          (log.performedByRole || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchTarget = (log.targetName || '').toLowerCase().includes(q) ||
          (log.targetId || '').toLowerCase().includes(q);
        
        return matchActor || matchDetails || matchAction || matchTarget;
      }

      return true;
    });
  }, [logs, selectedCategory, actionFilter, timeFilter, searchQuery]);

  // Unique actions list for dropdown
  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    logs.forEach(l => {
      if (l.action) actions.add(l.action);
    });
    return Array.from(actions).sort();
  }, [logs]);

  // Stats computation
  const stats = useMemo(() => {
    const papersCount = logs.filter(l => l.category === 'Papers' || l.category === 'Reports').length;
    const usersCount = logs.filter(l => l.category === 'Users').length;
    const hierarchyCount = logs.filter(l => l.category === 'Hierarchy' || l.category === 'Faculty').length;
    return {
      total: logs.length,
      papers: papersCount,
      users: usersCount,
      hierarchy: hierarchyCount
    };
  }, [logs]);

  // Export to CSV
  function handleExportCSV() {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Category', 'Action', 'Actor Name', 'Actor Email', 'Actor Role', 'Details', 'Target Name', 'Target ID'];
    const rows = filteredLogs.map(log => [
      `"${new Date(log.timestamp).toISOString()}"`,
      `"${log.category}"`,
      `"${log.action}"`,
      `"${(log.performedByName || '').replace(/"/g, '""')}"`,
      `"${(log.performedByEmail || '').replace(/"/g, '""')}"`,
      `"${(log.performedByRole || '').replace(/"/g, '""')}"`,
      `"${(log.details || '').replace(/"/g, '""')}"`,
      `"${(log.targetName || '').replace(/"/g, '""')}"`,
      `"${(log.targetId || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `uu_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export to JSON
  function handleExportJSON() {
    if (filteredLogs.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `uu_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper for formatting time
  function formatLogTime(isoStr: string) {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let relative = '';
      if (diffMins < 1) relative = 'Just now';
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffHours < 24) relative = `${diffHours}h ago`;
      else if (diffDays === 1) relative = 'Yesterday';
      else if (diffDays < 30) relative = `${diffDays}d ago`;
      else relative = d.toLocaleDateString();

      const exact = d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return { exact, relative };
    } catch {
      return { exact: isoStr, relative: '' };
    }
  }

  // Category styles
  function getCategoryMeta(category: AuditLogCategory) {
    switch (category) {
      case 'Papers':
        return {
          badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          icon: FileText
        };
      case 'Reports':
        return {
          badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          icon: Flag
        };
      case 'Users':
        return {
          badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: Users
        };
      case 'Hierarchy':
        return {
          badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: FolderTree
        };
      case 'Faculty':
        return {
          badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          icon: GraduationCap
        };
      case 'Events':
        return {
          badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          icon: Calendar
        };
      default:
        return {
          badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
          icon: Activity
        };
    }
  }

  // Action badge color
  function getActionBadge(action: string) {
    const act = action.toUpperCase();
    if (act.includes('APPROVE') || act.includes('PUBLISH') || act.includes('CREATE') || act.includes('ASSIGN')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (act.includes('DELETE') || act.includes('BAN') || act.includes('REJECT') || act.includes('CLEAR')) {
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    }
    if (act.includes('UPDATE') || act.includes('CHANGE') || act.includes('ROLE')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  }

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div id="audit-logs-tab-content" className="space-y-6 animate-fade-in">
      {/* Header Info & Actions Bar */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ScrollText className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              Automated Audit Trail & Logs
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Automatically logs every moderation, approval, deletion, user role change, and hierarchy edit performed across the platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="refresh-audit-logs-btn"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="export-csv-audit-logs-btn"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Download CSV report"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            id="export-json-audit-logs-btn"
            onClick={handleExportJSON}
            disabled={filteredLogs.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Download JSON report"
          >
            <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Export JSON</span>
          </button>

          {isSuperAdmin && (
            <button
              id="clear-all-audit-logs-btn"
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Prune all audit logs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 border-l-4 border-indigo-500 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Audit Logs</p>
          <p className="text-2xl font-bold font-display mt-1 text-slate-900 dark:text-white">{stats.total}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 border-l-4 border-blue-500 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Paper & Moderation</p>
          <p className="text-2xl font-bold font-display mt-1 text-slate-900 dark:text-white">{stats.papers}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 border-l-4 border-amber-500 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">User & Role Actions</p>
          <p className="text-2xl font-bold font-display mt-1 text-slate-900 dark:text-white">{stats.users}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 border-l-4 border-emerald-500 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hierarchy & Faculty</p>
          <p className="text-2xl font-bold font-display mt-1 text-slate-900 dark:text-white">{stats.hierarchy}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                {cat.id !== 'all' && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {logs.filter(l => l.category === cat.id).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search, Time & Action Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs by staff name, email, action, target or details..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Time: All History</option>
              <option value="today">Past 24 Hours</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Action: All Types</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Entries List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <ScrollText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-display">No Audit Logs Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery || selectedCategory !== 'all' || actionFilter !== 'all' || timeFilter !== 'all'
                ? 'No activity entries match your current search and filter criteria. Try resetting filters.'
                : 'Administrative changes (paper approvals, deletions, user role updates, hierarchy edits) will automatically appear here.'}
            </p>
            {(searchQuery || selectedCategory !== 'all' || actionFilter !== 'all' || timeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setTimeFilter('all');
                  setActionFilter('all');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const time = formatLogTime(log.timestamp);
            const catMeta = getCategoryMeta(log.category);
            const CatIcon = catMeta.icon;
            const isExpanded = expandedLogId === log.id;
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

            return (
              <div
                key={log.id}
                id={`audit-log-item-${log.id}`}
                className="p-4 sm:p-5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800 shadow-sm transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                  {/* Category & Action Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catMeta.badge}`}>
                      <CatIcon className="w-3 h-3" />
                      <span>{log.category}</span>
                    </span>

                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wide border ${getActionBadge(log.action)}`}>
                      {log.action}
                    </span>

                    {log.targetName && (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg truncate max-w-[220px]">
                        Target: {log.targetName}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{time.relative}</span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-[11px]">{time.exact}</span>
                  </div>
                </div>

                {/* Details Text */}
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  {log.details}
                </p>

                {/* Actor & Metadata Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-900/80 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] uppercase">
                      {(log.performedByName || 'A').charAt(0)}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">{log.performedByName || 'Staff Member'}</span>
                      {log.performedByEmail && (
                        <span className="text-slate-400 text-[11px]">({log.performedByEmail})</span>
                      )}
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                        {log.performedByRole || 'Staff'}
                      </span>
                    </div>
                  </div>

                  {hasMetadata && (
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Hide Payload' : 'View Payload Details'}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Expanded JSON payload if any */}
                {isExpanded && hasMetadata && (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                    <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
