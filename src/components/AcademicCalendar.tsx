import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Filter, 
  Search, 
  Plus, 
  GraduationCap, 
  Sparkles, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  CalendarPlus, 
  Tag, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  X,
  FileText,
  Bell,
  ArrowRight
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { AcademicEvent, Department, UserProfile } from '../types';
import { recordAuditLog } from '../utils/auditLogger';

interface AcademicCalendarProps {
  currentUser: UserProfile | null;
  departments: Department[];
  onNavigateToDashboardWithFilter?: (deptId?: string, examType?: string) => void;
  onTriggerAuth: () => void;
}

export default function AcademicCalendar({
  currentUser,
  departments,
  onNavigateToDashboardWithFilter,
  onTriggerAuth
}: AcademicCalendarProps) {
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards');

  // Calendar month state for grid view
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal for adding new event (Admin / Moderator)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<AcademicEvent['type']>('Mid');
  const [newDeptId, setNewDeptId] = useState('all');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notif, setNotif] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Time ticker state (forces re-render every second for real-time countdown)
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load events from Firestore & auto-seed if empty
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const q = query(collection(db, 'academic_events'), orderBy('startDate', 'asc'));
      const snap = await getDocs(q);
      const list: AcademicEvent[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as AcademicEvent);
      });
      setEvents(list);
    } catch (err) {
      console.error('Error loading academic events:', err);
    } finally {
      setLoading(false);
    }
  }

  const isAdminOrSemiAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'moderator';

  // Handle Add Event (Only Admin / Semi-Admin)
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdminOrSemiAdmin) {
      setNotif({ type: 'error', message: 'Unauthorized. Only Admins or Semi-Admins (Moderators) can publish events.' });
      return;
    }
    if (!newTitle.trim() || !newStartDate) {
      setNotif({ type: 'error', message: 'Title and Start Date are required.' });
      return;
    }

    setSubmitting(true);
    setNotif(null);
    try {
      const payload: Record<string, any> = {
        title: newTitle.trim(),
        type: newType,
        departmentId: newDeptId,
        startDate: newStartDate,
        createdAt: new Date().toISOString(),
        createdByUsername: currentUser?.username || 'Admin'
      };

      if (newEndDate.trim()) {
        payload.endDate = newEndDate.trim();
      }
      if (newDescription.trim()) {
        payload.description = newDescription.trim();
      }
      if (currentUser?.uid) {
        payload.createdByUID = currentUser.uid;
      }

      const docRef = await addDoc(collection(db, 'academic_events'), payload);
      setEvents((prev) => [...prev, { id: docRef.id, ...(payload as Omit<AcademicEvent, 'id'>) }]);
      setAddModalOpen(false);
      
      if (currentUser) {
        await recordAuditLog({
          action: 'CREATE_EVENT',
          category: 'Events',
          user: currentUser,
          details: `Created academic event "${newTitle.trim()}" (${newType}, starting ${newStartDate.trim()}).`,
          targetId: docRef.id,
          targetName: newTitle.trim(),
          metadata: { type: newType, startDate: newStartDate, endDate: newEndDate, departmentId: newDeptId }
        });
      }
      
      // Reset form
      setNewTitle('');
      setNewType('Mid');
      setNewDeptId('all');
      setNewStartDate('');
      setNewEndDate('');
      setNewDescription('');
    } catch (err: any) {
      console.error('Error adding academic event:', err);
      setNotif({ type: 'error', message: err.message || 'Failed to create academic event.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Clear All Events (Admin / Semi-Admin)
  async function handleClearAllEvents() {
    if (!isAdminOrSemiAdmin) return;
    if (!window.confirm('Are you sure you want to delete ALL events from the academic calendar?')) return;
    try {
      const snap = await getDocs(collection(db, 'academic_events'));
      const count = snap.docs.length;
      const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, 'academic_events', docSnap.id)));
      await Promise.all(deletePromises);
      setEvents([]);
      if (currentUser) {
        await recordAuditLog({
          action: 'CLEAR_ALL_EVENTS',
          category: 'Events',
          user: currentUser,
          details: `Cleared all ${count} academic events from the academic calendar.`,
          metadata: { totalCleared: count }
        });
      }
    } catch (err: any) {
      console.error('Error clearing events:', err);
      alert('Failed to clear events: ' + err.message);
    }
  }

  // Handle Delete Event
  async function handleDeleteEvent(eventId: string, title: string) {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'academic_events', eventId));
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      if (currentUser) {
        await recordAuditLog({
          action: 'DELETE_EVENT',
          category: 'Events',
          user: currentUser,
          details: `Deleted academic event "${title}".`,
          targetId: eventId,
          targetName: title
        });
      }
    } catch (err: any) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event: ' + err.message);
    }
  }

  // Calculate live countdown timer
  function getTimeRemaining(targetDateStr: string) {
    const target = new Date(targetDateStr + 'T00:00:00');
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isPast: false };
  }

  // Filter events
  const filteredEvents = events.filter((ev) => {
    // Dept filter
    if (selectedDeptId !== 'all' && ev.departmentId !== 'all' && ev.departmentId !== selectedDeptId) {
      return false;
    }
    // Type filter
    if (selectedType !== 'all' && ev.type !== selectedType) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchDesc = ev.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Find primary upcoming featured exam (first exam in future)
  const featuredExam = events
    .filter((e) => !getTimeRemaining(e.startDate).isPast)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] || events[0];

  const featuredTime = featuredExam ? getTimeRemaining(featuredExam.startDate) : null;

  // ICS Download Helper for Google / Outlook / Apple Calendar
  function downloadICS(event: AcademicEvent) {
    const startDateFormatted = event.startDate.replace(/-/g, '') + 'T090000Z';
    const endDateFormatted = (event.endDate || event.startDate).replace(/-/g, '') + 'T170000Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Uttara University//Qn Bank Academic Calendar//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || 'Uttara University Academic Event'}`,
      `DTSTART:${startDateFormatted}`,
      `DTEND:${endDateFormatted}`,
      'LOCATION:Uttara University Campus',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Calendar Grid helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl border border-indigo-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Uttara University Academic Hub
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-white">
              Academic Calendar & Exam Countdown
            </h1>
            <p className="text-sm text-indigo-200/90 leading-relaxed">
              Track upcoming Mid-Term & Final examination schedules, registration deadlines, and departmental quizzes with real-time countdown timers.
            </p>
          </div>

          {/* Admin / Moderator Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isAdminOrSemiAdmin && events.length > 0 && (
              <button
                onClick={handleClearAllEvents}
                className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Events
              </button>
            )}
            {isAdminOrSemiAdmin && (
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Add Academic Event
              </button>
            )}
          </div>
        </div>

        {/* Featured Live Countdown Widget */}
        {featuredExam && featuredTime && (
          <div className="mt-8 pt-8 border-t border-indigo-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-indigo-950/40 backdrop-blur-md p-6 rounded-2xl border border-indigo-500/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
                <Clock className="w-4 h-4 animate-spin text-amber-400" style={{ animationDuration: '8s' }} />
                Next Major Exam Alert
              </div>
              <h3 className="text-xl font-bold text-white font-display">
                {featuredExam.title}
              </h3>
              <p className="text-xs text-indigo-300">
                Scheduled for: <span className="font-semibold text-white">{featuredExam.startDate}</span> {featuredExam.endDate ? `to ${featuredExam.endDate}` : ''}
              </p>
            </div>

            {/* Live Ticker Blocks */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="flex flex-col items-center justify-center w-16 sm:w-20 h-16 sm:h-20 bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-inner">
                <span className="text-xl sm:text-2xl font-black font-mono text-white">
                  {String(featuredTime.days).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-300 uppercase">Days</span>
              </div>
              <span className="text-xl font-bold text-indigo-500">:</span>
              <div className="flex flex-col items-center justify-center w-16 sm:w-20 h-16 sm:h-20 bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-inner">
                <span className="text-xl sm:text-2xl font-black font-mono text-white">
                  {String(featuredTime.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-300 uppercase">Hours</span>
              </div>
              <span className="text-xl font-bold text-indigo-500">:</span>
              <div className="flex flex-col items-center justify-center w-16 sm:w-20 h-16 sm:h-20 bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-inner">
                <span className="text-xl sm:text-2xl font-black font-mono text-white">
                  {String(featuredTime.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-300 uppercase">Mins</span>
              </div>
              <span className="text-xl font-bold text-indigo-500">:</span>
              <div className="flex flex-col items-center justify-center w-16 sm:w-20 h-16 sm:h-20 bg-indigo-600 border border-indigo-400/40 rounded-2xl shadow-lg">
                <span className="text-xl sm:text-2xl font-black font-mono text-white animate-pulse">
                  {String(featuredTime.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-100 uppercase">Secs</span>
              </div>
            </div>

            {/* Quick Action Button for Featured Exam */}
            {onNavigateToDashboardWithFilter && (
              <button
                onClick={() => onNavigateToDashboardWithFilter(featuredExam.departmentId, featuredExam.type)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 border border-white/20"
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                Practice Past Papers
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Control Toolbar: Search, Filters, & View Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Search & Dept Dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exam or event..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Department Filter */}
          <div className="relative w-full sm:w-56">
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Category Type Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto py-1">
            {['all', 'Mid', 'Final', 'Class Test', 'Registration'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedType === type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {type === 'all' ? 'All Events' : type}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle Switch */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 self-end lg:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Countdown Cards
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Month Grid
          </button>
        </div>
      </div>

      {/* CARDS VIEW MODE */}
      {viewMode === 'cards' && (
        <>
          {filteredEvents.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                <CalendarIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Academic Events Scheduled</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {isAdminOrSemiAdmin 
                    ? 'Click "Add Academic Event" above to publish upcoming Mid-Term, Final, or Class Test dates.'
                    : 'Check back later for updated exam schedules published by the university administration.'}
                </p>
              </div>
              {isAdminOrSemiAdmin && (
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md"
                >
                  Publish New Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => {
                const time = getTimeRemaining(event.startDate);
                const dept = departments.find((d) => d.id === event.departmentId);

                return (
                  <div
                    key={event.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 relative group"
                  >
                    {/* Header Badge */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            event.type === 'Mid'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40'
                              : event.type === 'Final'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300/40'
                              : event.type === 'Class Test'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300/40'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40'
                          }`}
                        >
                          {event.type} Examination
                        </span>

                        {/* Admin Delete Action */}
                        {isAdminOrSemiAdmin && (
                          <button
                            onClick={() => handleDeleteEvent(event.id, event.title)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display leading-snug">
                        {event.title}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {event.description || 'Uttara University Academic Event.'}
                      </p>
                    </div>

                    {/* Countdown Box */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                          {event.startDate} {event.endDate ? `to ${event.endDate}` : ''}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {dept ? dept.code : 'All Departments'}
                        </span>
                      </div>

                      {/* Countdown Ticker */}
                      {time.isPast ? (
                        <div className="py-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Event in Progress or Completed
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-1 text-center pt-1">
                          <div className="p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="block text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                              {time.days}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Days</span>
                          </div>
                          <div className="p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="block text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                              {time.hours}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Hrs</span>
                          </div>
                          <div className="p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="block text-sm font-extrabold font-mono text-slate-900 dark:text-white">
                              {time.minutes}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Min</span>
                          </div>
                          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl">
                            <span className="block text-sm font-extrabold font-mono text-indigo-600 dark:text-indigo-400 animate-pulse">
                              {time.seconds}
                            </span>
                            <span className="text-[9px] text-indigo-500 uppercase font-bold">Sec</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => downloadICS(event)}
                        className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Add to Calendar
                      </button>

                      {onNavigateToDashboardWithFilter && (
                        <button
                          onClick={() => onNavigateToDashboardWithFilter(event.departmentId, event.type)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1"
                        >
                          Browse Qn Bank
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CALENDAR GRID VIEW MODE */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Blank leading cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} className="h-24 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-transparent"></div>
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              // Find events on this date
              const dayEvents = filteredEvents.filter((ev) => ev.startDate === dateStr || (ev.endDate && ev.startDate <= dateStr && ev.endDate >= dateStr));

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-24 p-2 rounded-2xl border flex flex-col justify-between transition-all overflow-hidden ${
                    isToday
                      ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/30'
                      : 'border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-950/50'
                  }`}
                >
                  <span className={`text-xs font-extrabold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {dayNum}
                  </span>

                  <div className="space-y-1 overflow-y-auto max-h-16">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => downloadICS(ev)}
                        className={`p-1 rounded-lg text-[9px] font-bold leading-tight truncate cursor-pointer hover:opacity-80 ${
                          ev.type === 'Mid'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                            : ev.type === 'Final'
                            ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300'
                            : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300'
                        }`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Academic Event Modal (Admin Only) */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                    Add Academic Exam / Event
                  </h3>
                  <p className="text-xs text-slate-500">Publish upcoming exam dates to all students.</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {notif && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${notif.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-emerald-50 text-emerald-600'}`}>
                {notif.message}
              </div>
            )}

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Spring 2026 Mid-Term Examinations"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Event Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as AcademicEvent['type'])}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Mid">Mid-Term Exam</option>
                    <option value="Final">Final Exam</option>
                    <option value="Class Test">Class Test / Quiz</option>
                    <option value="Assignment">Assignment Deadline</option>
                    <option value="Registration">Pre-Registration</option>
                    <option value="Holiday">University Holiday</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Department
                  </label>
                  <select
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide details, clearance instructions, or syllabus coverage..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
