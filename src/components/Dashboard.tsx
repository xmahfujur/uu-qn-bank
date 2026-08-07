import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';
import { 
  Folder, 
  Search, 
  Filter, 
  ArrowRight, 
  ArrowLeft,
  BookOpen, 
  Download, 
  Eye, 
  Heart, 
  Bookmark, 
  Flag, 
  Calendar, 
  User, 
  ChevronRight,
  Home,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  RefreshCw,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  increment, 
  arrayUnion, 
  arrayRemove, 
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, Batch, Semester, QuestionPaper, ExamType, AcademicEvent } from '../types';

interface DashboardProps {
  currentUser: any;
  onNavigateToQuestion: (questionId: string) => void;
  departments: Department[];
  batches: Batch[];
  semesters: Semester[];
  onTriggerAuth: () => void;
  onNavigateToCalendar?: () => void;
}

export default function Dashboard({ 
  currentUser, 
  onNavigateToQuestion,
  departments,
  batches,
  semesters,
  onTriggerAuth,
  onNavigateToCalendar
}: DashboardProps) {
  
  // Navigation State in hierarchy
  const [currentDept, setCurrentDept] = useState<Department | null>(null);
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [currentExamType, setCurrentExamType] = useState<ExamType | null>(null);

  // Selection wrappers that push browser history states
  const selectDept = (dept: Department | null) => {
    setCurrentDept(dept);
    setCurrentBatch(null);
    setCurrentSemester(null);
    setCurrentExamType(null);
    if (dept) {
      window.history.pushState({ type: 'academic_nav', level: 1, deptId: dept.id }, '');
    } else {
      window.history.pushState({ type: 'academic_nav', level: 0 }, '');
    }
  };

  const selectBatch = (batch: Batch | null) => {
    setCurrentBatch(batch);
    setCurrentSemester(null);
    setCurrentExamType(null);
    if (batch && currentDept) {
      window.history.pushState({ type: 'academic_nav', level: 2, deptId: currentDept.id, batchId: batch.id }, '');
    } else if (currentDept) {
      window.history.pushState({ type: 'academic_nav', level: 1, deptId: currentDept.id }, '');
    }
  };

  const selectSemester = (sem: Semester | null) => {
    setCurrentSemester(sem);
    setCurrentExamType(null);
    if (sem && currentDept && currentBatch) {
      window.history.pushState({ type: 'academic_nav', level: 3, deptId: currentDept.id, batchId: currentBatch.id, semesterId: sem.id }, '');
    } else if (currentDept && currentBatch) {
      window.history.pushState({ type: 'academic_nav', level: 2, deptId: currentDept.id, batchId: currentBatch.id }, '');
    }
  };

  const selectExamType = (type: ExamType | null) => {
    setCurrentExamType(type);
    if (type && currentDept && currentBatch && currentSemester) {
      window.history.pushState({ type: 'academic_nav', level: 4, deptId: currentDept.id, batchId: currentBatch.id, semesterId: currentSemester.id, examType: type }, '');
    } else if (currentDept && currentBatch && currentSemester) {
      window.history.pushState({ type: 'academic_nav', level: 3, deptId: currentDept.id, batchId: currentBatch.id, semesterId: currentSemester.id }, '');
    }
  };

  const handleGoBack = () => {
    if (currentExamType) {
      selectExamType(null);
    } else if (currentSemester) {
      selectSemester(null);
    } else if (currentBatch) {
      selectBatch(null);
    } else if (currentDept) {
      selectDept(null);
    }
  };

  // Popstate effect to support mobile hardware & browser back buttons
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state && state.type === 'academic_nav') {
        const { deptId, batchId, semesterId, examType } = state;
        const dept = departments.find(d => d.id === deptId) || null;
        const batch = batches.find(b => b.id === batchId) || null;
        const sem = semesters.find(s => s.id === semesterId) || null;

        setCurrentDept(dept);
        setCurrentBatch(batch);
        setCurrentSemester(sem);
        setCurrentExamType(examType || null);
      } else if (!state || state.type !== 'question_detail') {
        setCurrentDept(null);
        setCurrentBatch(null);
        setCurrentSemester(null);
        setCurrentExamType(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [departments, batches, semesters]);

  // Data Loading
  const [questions, setQuestions] = useState<QuestionPaper[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExamType, setFilterExamType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('newest'); // newest, oldest, views, downloads, likes

  // Dialog state for Report Action
  const [reportingQuestion, setReportingQuestion] = useState<QuestionPaper | null>(null);
  const [reportReason, setReportReason] = useState<'Wrong paper' | 'Spam' | 'Duplicate' | 'Broken Link' | 'Other'>('Wrong paper');
  const [reportDesc, setReportDesc] = useState('');
  const [reportingInProgress, setReportingInProgress] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Downloading State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Upcoming Exam Event State & Real-time Ticker
  const [upcomingEvent, setUpcomingEvent] = useState<AcademicEvent | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchUpcomingEvent() {
      try {
        const snap = await getDocs(collection(db, 'academic_events'));
        const eventsList: AcademicEvent[] = [];
        snap.forEach((doc) => {
          eventsList.push({ id: doc.id, ...doc.data() } as AcademicEvent);
        });

        const todayIso = new Date().toISOString().split('T')[0];
        const upcoming = eventsList
          .filter(e => e.startDate >= todayIso || (e.endDate && e.endDate >= todayIso))
          .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

        if (upcoming) {
          setUpcomingEvent(upcoming);
        } else if (eventsList.length > 0) {
          setUpcomingEvent(eventsList[0]);
        } else {
          setUpcomingEvent(null);
        }
      } catch (err) {
        console.error('Failed to fetch upcoming event for banner:', err);
        setUpcomingEvent(null);
      }
    }
    fetchUpcomingEvent();
  }, []);

  function getEventCountdown(startDateStr?: string) {
    if (!startDateStr) {
      // Default placeholder offset (14 days)
      const targetTime = now.getTime() + 14 * 24 * 60 * 60 * 1000;
      const diff = targetTime - now.getTime();
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isPast: false
      };
    }
    const target = new Date(startDateStr + 'T00:00:00');
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

  // Load question papers from Firestore
  useEffect(() => {
    async function loadQuestions() {
      setLoadingQuestions(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'questions'));
        const qList: QuestionPaper[] = [];
        querySnapshot.forEach((doc) => {
          qList.push({ id: doc.id, ...doc.data() } as QuestionPaper);
        });
        setQuestions(qList);
      } catch (err) {
        console.error('Error loading question papers:', err);
      } finally {
        setLoadingQuestions(false);
      }
    }
    loadQuestions();
  }, []);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  // Handle Paper actions (Like, Bookmark, View, Download)
  async function handleLike(question: QuestionPaper, e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUser) {
      showToast('error', 'Please login to like this question paper.');
      onTriggerAuth();
      return;
    }

    const likedArray = question.likedBy || [];
    const isLiked = likedArray.includes(currentUser.uid);
    const qDocRef = doc(db, 'questions', question.id);

    try {
      if (isLiked) {
        await updateDoc(qDocRef, {
          likes: increment(-1),
          likedBy: arrayRemove(currentUser.uid)
        });
        // Update local state
        setQuestions(prev => prev.map(q => q.id === question.id ? {
          ...q,
          likes: q.likes - 1,
          likedBy: likedArray.filter(id => id !== currentUser.uid)
        } : q));
        showToast('success', 'Removed from liked question papers.');
      } else {
        await updateDoc(qDocRef, {
          likes: increment(1),
          likedBy: arrayUnion(currentUser.uid)
        });
        // Update local state
        setQuestions(prev => prev.map(q => q.id === question.id ? {
          ...q,
          likes: q.likes + 1,
          likedBy: [...likedArray, currentUser.uid]
        } : q));
        showToast('success', 'Marked as helpful!');
      }
    } catch (err) {
      console.error('Error liking:', err);
    }
  }

  async function handleBookmark(question: QuestionPaper, e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUser) {
      showToast('error', 'Please login to bookmark this paper.');
      onTriggerAuth();
      return;
    }

    const bookmarkArray = question.bookmarks || [];
    const isBookmarked = bookmarkArray.includes(currentUser.uid);
    const qDocRef = doc(db, 'questions', question.id);

    try {
      if (isBookmarked) {
        await updateDoc(qDocRef, {
          bookmarks: arrayRemove(currentUser.uid)
        });
        setQuestions(prev => prev.map(q => q.id === question.id ? {
          ...q,
          bookmarks: bookmarkArray.filter(id => id !== currentUser.uid)
        } : q));
        showToast('success', 'Removed from bookmarks.');
      } else {
        await updateDoc(qDocRef, {
          bookmarks: arrayUnion(currentUser.uid)
        });
        setQuestions(prev => prev.map(q => q.id === question.id ? {
          ...q,
          bookmarks: [...bookmarkArray, currentUser.uid]
        } : q));
        showToast('success', 'Saved to bookmarks!');
      }
    } catch (err) {
      console.error('Error bookmarking:', err);
    }
  }

  async function handleIncrementViews(questionId: string) {
    try {
      const qDocRef = doc(db, 'questions', questionId);
      await updateDoc(qDocRef, {
        views: increment(1)
      });
    } catch (err) {
      console.error('Error incrementing views:', err);
    }
  }

  // Helper to sanitize filename
  function sanitizeFilename(name: string) {
    return name.replace(/[/\\?%*:|"<>\s]+/g, '_');
  }

  async function handleDownload(question: QuestionPaper, e: React.MouseEvent) {
    e.stopPropagation();
    if (downloadingId) return; // Prevent multiple concurrent downloads
    
    try {
      setDownloadingId(question.id);
      
      // Increment download count in Firestore
      const qDocRef = doc(db, 'questions', question.id);
      await updateDoc(qDocRef, {
        downloads: increment(1)
      });
      setQuestions(prev => prev.map(q => q.id === question.id ? { ...q, downloads: q.downloads + 1 } : q));

      // Resolve semester and department name
      const semesterObj = semesters.find(s => s.id === question.semesterId);
      const displaySemester = semesterObj?.name || 'Semester';
      const baseFilename = sanitizeFilename(`${question.courseCode}_${question.courseName}_${question.examType}_${displaySemester}`);

      // Handle PDF format
      if (question.pdfUrl) {
        try {
          const response = await fetch(question.pdfUrl);
          if (!response.ok) throw new Error('CORS or network error');
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${baseFilename}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          showToast('success', 'PDF downloaded successfully!');
        } catch (err) {
          console.warn('Direct PDF download failed, opening in a new tab', err);
          window.open(question.pdfUrl, '_blank');
        } finally {
          setDownloadingId(null);
        }
        return;
      }

      // Handle image/pages
      const activePages = question.imageUrls && question.imageUrls.length > 0 
        ? question.imageUrls 
        : [question.imageUrl].filter(Boolean);

      if (activePages.length === 0) {
        throw new Error('No pages found to download');
      }

      if (activePages.length === 1) {
        const imageUrl = activePages[0];
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) throw new Error('CORS or network error');
          const blob = await response.blob();
          
          let ext = 'jpg';
          if (blob.type.includes('png')) ext = 'png';
          else if (blob.type.includes('jpeg')) ext = 'jpeg';
          else if (blob.type.includes('webp')) ext = 'webp';

          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${baseFilename}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          showToast('success', 'Paper downloaded successfully!');
        } catch (err) {
          console.warn('Direct download failed, opening in a new tab', err);
          window.open(imageUrl, '_blank');
        }
      } else {
        const zip = new JSZip();

        for (let i = 0; i < activePages.length; i++) {
          const imageUrl = activePages[i];
          try {
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error(`Failed page ${i + 1}`);
            const blob = await response.blob();
            let ext = 'jpg';
            if (blob.type.includes('png')) ext = 'png';
            else if (blob.type.includes('jpeg')) ext = 'jpeg';
            else if (blob.type.includes('webp')) ext = 'webp';

            zip.file(`${baseFilename}_page_${i + 1}.${ext}`, blob);
          } catch (err) {
            console.error(`Error fetching page ${i + 1}:`, err);
          }
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });
        const blobUrl = URL.createObjectURL(zipContent);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${baseFilename}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast('success', `All ${activePages.length} pages downloaded in ZIP!`);
      }

    } catch (err) {
      console.error(err);
      showToast('error', 'Download failed, opening paper link instead.');
      if (question.imageUrl) {
        window.open(question.imageUrl, '_blank');
      }
    } finally {
      setDownloadingId(null);
    }
  }

  // Handle reporting question
  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!reportingQuestion) return;

    setReportingInProgress(true);
    try {
      await addDoc(collection(db, 'reports'), {
        questionId: reportingQuestion.id,
        courseCode: reportingQuestion.courseCode,
        courseName: reportingQuestion.courseName,
        reportedByUID: currentUser.uid,
        reportedByUsername: currentUser.username || 'Student',
        reason: reportReason,
        description: reportDesc.trim(),
        reportedAt: new Date().toISOString()
      });

      // Update report count on the question paper
      const qDocRef = doc(db, 'questions', reportingQuestion.id);
      await updateDoc(qDocRef, {
        reportCount: increment(1)
      });

      setQuestions(prev => prev.map(q => q.id === reportingQuestion.id ? { ...q, reportCount: q.reportCount + 1 } : q));

      showToast('success', 'Thank you. Report submitted for admin moderation review.');
      setReportingQuestion(null);
      setReportDesc('');
    } catch (err) {
      console.error('Reporting error:', err);
      showToast('error', 'Failed to submit report. Please try again.');
    } finally {
      setReportingInProgress(false);
    }
  }

  // Filter logic based on hierarchy selectors & filters
  let filtered = questions;

  // Only admins and moderators can see pending or rejected papers
  const isPrivileged = currentUser?.role === 'super_admin' || currentUser?.role === 'moderator';
  if (!isPrivileged) {
    filtered = filtered.filter(q => q.status === 'published' || !q.status);
  }

  // Filter by Hierarchy
  if (currentDept) {
    filtered = filtered.filter(q => q.departmentId === currentDept.id);
  }
  if (currentBatch) {
    filtered = filtered.filter(q => q.batchId === currentBatch.id);
  }
  if (currentSemester) {
    filtered = filtered.filter(q => q.semesterId === currentSemester.id);
  }
  if (currentExamType) {
    filtered = filtered.filter(q => q.examType === currentExamType);
  }

  // Filter by Global Search Bar
  if (searchQuery) {
    const queryLower = searchQuery.toLowerCase();
    filtered = filtered.filter(q => {
      const deptName = departments.find(d => d.id === q.departmentId)?.name.toLowerCase() || '';
      const deptCode = departments.find(d => d.id === q.departmentId)?.code.toLowerCase() || '';
      const semName = semesters.find(s => s.id === q.semesterId)?.name.toLowerCase() || '';
      
      return q.courseName.toLowerCase().includes(queryLower) ||
             q.courseCode.toLowerCase().includes(queryLower) ||
             (q.teacher && q.teacher.toLowerCase().includes(queryLower)) ||
             q.uploadedByUsername.toLowerCase().includes(queryLower) ||
             deptName.includes(queryLower) ||
             deptCode.includes(queryLower) ||
             semName.includes(queryLower);
    });
  }

  // Filter by Exam Type Dropdown
  if (filterExamType !== 'All') {
    filtered = filtered.filter(q => q.examType === filterExamType);
  }

  // Sort Question Papers
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    }
    if (sortBy === 'views') {
      return b.views - a.views;
    }
    if (sortBy === 'downloads') {
      return b.downloads - a.downloads;
    }
    if (sortBy === 'likes') {
      return b.likes - a.likes;
    }
    return 0;
  });

  // ----------------- SECTIONS JSX VARIABLES / FUNCTIONS -----------------
  const renderSelectionLevels = () => {
    return (
      <>
        {/* LEVEL 1: ALL DEPARTMENTS */}
        {!currentDept && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">Select Academic Department</h3>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{departments.length} Departments found</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map((dept, index) => {
                const deptPapersCount = questions.filter(q => q.departmentId === dept.id).length;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: -24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.04 }}
                    id={`dept-card-${dept.id}`}
                    key={dept.id}
                    onClick={() => selectDept(dept)}
                    className="group relative p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm hover:shadow-md dark:hover:border-slate-800 cursor-pointer transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold text-sm tracking-wider font-display border border-indigo-100/40 dark:border-indigo-900/30">
                        {dept.code}
                      </div>
                      <Folder className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-300" />
                    </div>
                    <h4 className="font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{dept.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5 font-medium">
                      <BookOpen className="w-3.5 h-3.5" />
                      {deptPapersCount} Exam Question Papers
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* LEVEL 2: BATCH SELECTION UNDER DEPARTMENT */}
        {currentDept && !currentBatch && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">Select Department Batch</h3>
                <p className="text-xs text-slate-500">Currently exploring {currentDept.name}</p>
              </div>
              <button 
                onClick={() => selectDept(null)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Departments
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {batches
                .filter(b => b.departmentId === currentDept.id)
                .sort((a, b) => {
                  const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                  const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                  return numB - numA;
                })
                .map((batch, index) => {
                  const batchPapersCount = questions.filter(q => q.batchId === batch.id).length;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: -24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.04 }}
                      id={`batch-card-${batch.id}`}
                      key={batch.id}
                      onClick={() => selectBatch(batch)}
                      className="group p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                          {batch.name.replace(/\D/g, '') || '#'}
                        </div>
                        <Folder className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-all duration-300" />
                      </div>
                      <h4 className="font-semibold text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">{batch.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{batchPapersCount} Question Papers</p>
                    </motion.div>
                  );
                })}

              {batches.filter(b => b.departmentId === currentDept.id).length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Folder className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-sm">No Batches Yet</h4>
                  <p className="text-xs text-slate-500 mt-1">Super Admin has not created batches for this department yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEVEL 3: SEMESTER SELECTION UNDER BATCH */}
        {currentDept && currentBatch && !currentSemester && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">Select Academic Semester</h3>
                <p className="text-xs text-slate-500">Currently exploring {currentDept.code} › {currentBatch.name}</p>
              </div>
              <button 
                onClick={() => selectBatch(null)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Batches
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {semesters
                .filter(s => s.batchId === currentBatch.id)
                .map((sem, index) => {
                  const semPapersCount = questions.filter(q => q.semesterId === sem.id).length;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: -24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.04 }}
                      id={`sem-card-${sem.id}`}
                      key={sem.id}
                      onClick={() => selectSemester(sem)}
                      className="group p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-indigo-50/55 dark:bg-indigo-950/20 text-indigo-600 rounded-xl">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <Folder className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-all duration-300" />
                      </div>
                      <h4 className="font-semibold text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">{sem.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{semPapersCount} Question Papers</p>
                    </motion.div>
                  );
                })}

              {semesters.filter(s => s.batchId === currentBatch.id).length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-sm">No Semesters Yet</h4>
                  <p className="text-xs text-slate-500 mt-1">Super Admin has not created semester folders for this batch yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEVEL 4: EXAM TYPE SELECTION UNDER SEMESTER */}
        {currentDept && currentBatch && currentSemester && !currentExamType && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">Select Exam Type</h3>
                <p className="text-xs text-slate-500">{currentDept.code} › {currentBatch.name} › {currentSemester.name}</p>
              </div>
              <button 
                onClick={() => selectSemester(null)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Semesters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {['Mid', 'Final'].map((type) => {
                const count = questions.filter(
                  q => q.departmentId === currentDept.id && 
                       q.batchId === currentBatch.id && 
                       q.semesterId === currentSemester.id && 
                       q.examType === type
                ).length;

                return (
                  <div 
                    id={`exam-type-card-${type}`}
                    key={type}
                    onClick={() => selectExamType(type as ExamType)}
                    className="group relative p-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-1 transition-all duration-300 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold font-display text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors">
                        {type === 'Mid' ? 'Mid-Term Exam' : 'Semester Final'}
                      </h4>
                      <p className="text-sm text-slate-500">{count} Question Papers uploaded</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 text-slate-400 group-hover:text-indigo-500 transition-colors">
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderQuestionGrid = () => {
    return (
      <>
        {(currentExamType || searchQuery) && (
          <div className="space-y-6">
            
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter & Sort</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Exam type override filter */}
                {!currentExamType && (
                  <select
                    id="filter-exam-type-select"
                    value={filterExamType}
                    onChange={(e) => setFilterExamType(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
                  >
                    <option value="All">All Exam Types</option>
                    <option value="Mid">Mid-Term</option>
                    <option value="Final">Semester Final</option>
                  </select>
                )}

                {/* Sorting */}
                <select
                  id="filter-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  <option value="newest">Newest Uploads</option>
                  <option value="oldest">Oldest Uploads</option>
                  <option value="views">Most Viewed</option>
                  <option value="downloads">Most Downloaded</option>
                  <option value="likes">Most Liked</option>
                </select>

                {/* Reset to hierarchy */}
                {currentExamType && (
                  <button
                    onClick={() => selectExamType(null)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Change Exam Category
                  </button>
                )}
              </div>
            </div>

            {loadingQuestions && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-500 mt-2">Loading question library...</p>
              </div>
            )}

            {!loadingQuestions && (
              <>
                {/* Question Papers List View */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((q, index) => {
                    const isLiked = q.likedBy?.includes(currentUser?.uid || '');
                    const isBookmarked = q.bookmarks?.includes(currentUser?.uid || '');
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: -24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: index * 0.04 }}
                        id={`question-card-${q.id}`}
                        key={q.id}
                        onClick={() => {
                          handleIncrementViews(q.id);
                          onNavigateToQuestion(q.id);
                        }}
                        className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-md dark:hover:border-slate-800 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col"
                      >
                        {/* Paper Preview Header */}
                        <div className="relative h-44 bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-900">
                          {(() => {
                            const rawImg = (q.imageUrls && q.imageUrls.length > 0 && q.imageUrls[0]) ? q.imageUrls[0] : q.imageUrl;
                            return (
                              <img 
                                src={formatImageUrl(rawImg)} 
                                alt={q.courseName} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer-when-downgrade"
                                onError={(e) => handleImageError(e, q.courseCode || 'UU Question Paper')}
                              />
                            );
                          })()}
                          <div className="absolute inset-0 bg-slate-950/10 group-hover:bg-slate-950/0 transition-colors"></div>
                          <span className="absolute top-3 left-3 px-2 py-1 bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white rounded-lg uppercase tracking-wider">
                            {q.examType === 'Mid' ? 'Mid-Term' : 'Final'}
                          </span>
                          
                          {q.status === 'pending' && (
                            <span className="absolute top-3 left-24 px-2 py-1 bg-amber-500/95 text-slate-950 text-[10px] font-extrabold rounded-lg uppercase tracking-wider shadow-md border border-amber-600/20">
                              Pending
                            </span>
                          )}
                          {q.status === 'rejected' && (
                            <span className="absolute top-3 left-24 px-2 py-1 bg-rose-600/95 text-white text-[10px] font-extrabold rounded-lg uppercase tracking-wider shadow-md border border-rose-700/20">
                              Rejected
                            </span>
                          )}
                          
                          {/* Bookmark + Like buttons */}
                          <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleBookmark(q, e)}
                              className={`p-2 rounded-xl backdrop-blur-md border shadow-sm transition-all hover:scale-105 ${
                                isBookmarked 
                                  ? 'bg-indigo-600 text-white border-indigo-700' 
                                  : 'bg-slate-900/80 text-slate-300 border-white/10 hover:text-white'
                              }`}
                            >
                              <Bookmark className="w-4 h-4 fill-current" />
                            </button>
                          </div>
                        </div>

                        {/* Paper Metadata */}
                        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              <span>{q.courseCode}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(q.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-base line-clamp-1">
                              {q.courseName}
                            </h4>

                            <p className="text-xs text-slate-500 dark:text-slate-400 italic flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              Teacher: {q.teacher || 'Not specified'}
                            </p>
                          </div>

                          {/* Contributor Profile */}
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-900/85 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <span>By</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">@{q.uploadedByUsername}</span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {/* Likes display */}
                              <button 
                                onClick={(e) => handleLike(q, e)}
                                className={`flex items-center gap-1 hover:text-rose-500 transition-colors ${
                                  isLiked ? 'text-rose-500 font-bold' : ''
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                <span>{q.likes}</span>
                              </button>

                              {/* Views */}
                              <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {q.views}
                              </span>
                            </div>
                          </div>

                          {/* Buttons Footer */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIncrementViews(q.id);
                                onNavigateToQuestion(q.id);
                              }}
                              className="py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> Preview
                            </button>
                            <button
                              onClick={(e) => handleDownload(q, e)}
                              disabled={downloadingId !== null}
                              className="py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-850 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                            >
                              {downloadingId === q.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Downloading...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Report Flag Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!currentUser) {
                                showToast('error', 'Please login to report files.');
                                onTriggerAuth();
                                return;
                              }
                              setReportingQuestion(q);
                            }}
                            className="w-full text-center text-[10px] text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 py-1 transition-colors"
                          >
                            <Flag className="w-3 h-3" /> Report incorrect paper
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}

                  {filtered.length === 0 && (
                    <div className="col-span-full py-16 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <h4 className="font-semibold text-slate-800 dark:text-white">No Question Papers Found</h4>
                      <p className="text-sm text-slate-500 mt-1">Be the first to upload one for this academic section!</p>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </>
    );
  };

  return (
    <div id="dashboard-root" className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white">Find Question Papers</h2>
          <p className="text-xs sm:text-sm text-slate-300">Uttara University Previous Exam Repository</p>
        </div>
        
        {/* Real-time Global Search bar with filters */}
        <div className="relative w-full md:w-[420px]">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            id="global-search-input"
            type="text"
            placeholder="Search by Course, Code, Teacher, Department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/10 dark:bg-slate-900/60 text-white rounded-2xl border border-white/10 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm placeholder-slate-400 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Academic Exam Countdown Alert Banner */}
      {(() => {
        if (!upcomingEvent || searchQuery.trim()) return null;

        const title = upcomingEvent.title;
        const typeLabel = upcomingEvent.type;
        const startDate = upcomingEvent.startDate;
        const endDate = upcomingEvent.endDate;
        const countdown = getEventCountdown(startDate);

        return (
          <>
            {/* Mobile View: Single Line Sleek Banner (< sm) */}
            <div className="sm:hidden overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-xl px-2.5 py-1.5 shadow-md mb-4 text-white flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase rounded shrink-0 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                  {typeLabel}
                </span>
                <span className="font-bold text-white truncate text-[11px]">
                  {title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-bold text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  {countdown.days}d {countdown.hours}h {countdown.minutes}m
                </span>
                {onNavigateToCalendar && (
                  <button
                    onClick={onNavigateToCalendar}
                    className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shrink-0"
                    title="View Calendar"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop / Tablet View (sm+) */}
            <div className="hidden sm:block relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-xl mb-6 text-white">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                
                {/* Left Column: Semester Exam Term Title & Badges */}
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                      EXAM ALERT
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold rounded-md">
                      {typeLabel} Exam
                    </span>
                  </div>

                  <h2 className="text-base sm:text-lg md:text-xl font-extrabold font-display tracking-tight text-white leading-snug">
                    {title}
                  </h2>

                  <p className="text-[11px] sm:text-xs text-indigo-200/90 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>
                      Exam Date: <strong className="text-white font-bold">{startDate}</strong> {endDate ? `to ${endDate}` : ''}
                    </span>
                  </p>
                </div>

                {/* Right Column: Live Countdown Ticker & Action */}
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-indigo-800/50">
                  
                  {/* Live Digital Countdown Display */}
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/80 p-1.5 sm:p-2 rounded-xl border border-indigo-500/30 shadow-inner">
                    <div className="flex flex-col items-center justify-center w-9 sm:w-11 h-9 sm:h-11 bg-slate-900 rounded-lg border border-indigo-500/20">
                      <span className="text-xs sm:text-sm font-black font-mono text-amber-400">
                        {String(countdown.days).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-bold text-indigo-300 uppercase">Days</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-500">:</span>
                    <div className="flex flex-col items-center justify-center w-9 sm:w-11 h-9 sm:h-11 bg-slate-900 rounded-lg border border-indigo-500/20">
                      <span className="text-xs sm:text-sm font-black font-mono text-white">
                        {String(countdown.hours).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-bold text-indigo-300 uppercase">Hrs</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-500">:</span>
                    <div className="flex flex-col items-center justify-center w-9 sm:w-11 h-9 sm:h-11 bg-slate-900 rounded-lg border border-indigo-500/20">
                      <span className="text-xs sm:text-sm font-black font-mono text-white">
                        {String(countdown.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-bold text-indigo-300 uppercase">Min</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-500">:</span>
                    <div className="flex flex-col items-center justify-center w-9 sm:w-11 h-9 sm:h-11 bg-indigo-600 rounded-lg border border-indigo-400/40 shadow">
                      <span className="text-xs sm:text-sm font-black font-mono text-white animate-pulse">
                        {String(countdown.seconds).padStart(2, '0')}
                      </span>
                      <span className="text-[8px] font-bold text-indigo-100 uppercase">Sec</span>
                    </div>
                  </div>

                  {/* Calendar Link Button */}
                  {onNavigateToCalendar && (
                    <button
                      onClick={onNavigateToCalendar}
                      className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 text-[11px] shrink-0"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      <span className="hidden xs:inline">Calendar</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}

                </div>

              </div>
            </div>
          </>
        );
      })()}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-100 dark:border-red-800'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Prominent Back Button & Breadcrumb Navigation Bar */}
      <div className="mb-6 p-3 sm:p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Prominent Back Button (Desktop & Mobile) */}
        {(currentDept || currentBatch || currentSemester || currentExamType) ? (
          <button 
            onClick={handleGoBack}
            id="dashboard-main-back-button"
            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 border border-indigo-200/60 dark:border-indigo-800/50 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Back</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            <Home className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>All Departments</span>
          </div>
        )}

        {/* Interactive Breadcrumb Path */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          <button 
            onClick={() => selectDept(null)}
            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            <Home className="w-3.5 h-3.5" />
            Departments
          </button>
          
          {currentDept && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
              <button 
                onClick={() => selectBatch(null)}
                className={`hover:underline font-semibold transition-colors ${
                  !currentBatch ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {currentDept.code}
              </button>
            </>
          )}

          {currentBatch && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
              <button 
                onClick={() => selectSemester(null)}
                className={`hover:underline font-semibold transition-colors ${
                  !currentSemester ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {currentBatch.name}
              </button>
            </>
          )}

          {currentSemester && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
              <button 
                onClick={() => selectExamType(null)}
                className={`hover:underline font-semibold transition-colors ${
                  !currentExamType ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {currentSemester.name}
              </button>
            </>
          )}

          {currentExamType && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {currentExamType === 'Mid' ? 'Mid-Term' : 'Semester Final'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ----------------- SELECTION LEVELS & RESULTS ----------------- */}
      {searchQuery ? (
        <div className="space-y-12">
          {/* SEARCH RESULTS FIRST */}
          {renderQuestionGrid()}

          {/* DEPARTMENT / SELECTION HIERARCHY SECOND */}
          <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-10">
            {renderSelectionLevels()}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SELECTION HIERARCHY FIRST */}
          {renderSelectionLevels()}

          {/* RESULTS SECOND */}
          {renderQuestionGrid()}
        </div>
      )}

      {/* ----------------- DIALOG: REPORT INACCURATE QUESTION ----------------- */}
      {reportingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Report Inaccurate File</h3>
              </div>
              <button 
                onClick={() => setReportingQuestion(null)}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitReport} className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">You are flagging: {reportingQuestion.courseCode} - {reportingQuestion.courseName}</p>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Reason for flag *</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  required
                >
                  <option value="Wrong paper">Wrong paper (wrong semester/department)</option>
                  <option value="Spam">Spam or abusive content</option>
                  <option value="Duplicate">Duplicate upload</option>
                  <option value="Broken Link">Broken Link / Invalid Preview</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description / Context *</label>
                <textarea
                  placeholder="Please specify why this paper is inaccurate so moderators can evaluate."
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setReportingQuestion(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportingInProgress}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  {reportingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                  Submit Moderation Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
