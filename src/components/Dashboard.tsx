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
  X,
  GraduationCap,
  Building2,
  SlidersHorizontal,
  RotateCcw,
  LayoutGrid,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Flame,
  Layers,
  ListFilter,
  Check,
  Zap,
  Star
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
import { sortSemesterNamesDescending, sortSemestersDescending } from '../utils/semesterSort';

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

  // Smart Filter State
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedSemesterName, setSelectedSemesterName] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'folders'>('cards');
  // Auto-hide (collapse) filter panel by default on mobile devices (< 768px)
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [displayLimit, setDisplayLimit] = useState<number>(12);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'trending' | 'newest' | 'most_liked' | 'most_downloaded'>('all');

  // Selection wrappers that push browser history states
  const selectDept = (dept: Department | null) => {
    setCurrentDept(dept);
    setSelectedDeptId(dept ? dept.id : 'all');
    setCurrentBatch(null);
    setSelectedBatchId('all');
    setCurrentSemester(null);
    setSelectedSemesterName('all');
    setCurrentExamType(null);
    if (dept) {
      window.history.pushState({ type: 'academic_nav', level: 1, deptId: dept.id }, '');
    } else {
      window.history.pushState({ type: 'academic_nav', level: 0 }, '');
    }
  };

  const selectBatch = (batch: Batch | null) => {
    setCurrentBatch(batch);
    setSelectedBatchId(batch ? batch.id : 'all');
    setCurrentSemester(null);
    setSelectedSemesterName('all');
    setCurrentExamType(null);
    if (batch && (currentDept || selectedDeptId !== 'all')) {
      const deptId = currentDept?.id || selectedDeptId;
      window.history.pushState({ type: 'academic_nav', level: 2, deptId, batchId: batch.id }, '');
    } else if (currentDept || selectedDeptId !== 'all') {
      const deptId = currentDept?.id || selectedDeptId;
      window.history.pushState({ type: 'academic_nav', level: 1, deptId }, '');
    }
  };

  const selectSemester = (sem: Semester | null) => {
    setCurrentSemester(sem);
    setSelectedSemesterName(sem ? sem.name : 'all');
    setCurrentExamType(null);
    const deptId = currentDept?.id || selectedDeptId;
    const batchId = currentBatch?.id || selectedBatchId;
    if (sem && deptId !== 'all' && batchId !== 'all') {
      window.history.pushState({ type: 'academic_nav', level: 3, deptId, batchId, semesterId: sem.id }, '');
    } else if (deptId !== 'all' && batchId !== 'all') {
      window.history.pushState({ type: 'academic_nav', level: 2, deptId, batchId }, '');
    }
  };

  const selectExamType = (type: ExamType | null) => {
    setCurrentExamType(type);
    if (type) {
      setFilterExamType(type);
    }
    const deptId = currentDept?.id || selectedDeptId;
    const batchId = currentBatch?.id || selectedBatchId;
    const semId = currentSemester?.id || 'all';
    if (type && deptId !== 'all' && batchId !== 'all' && semId !== 'all') {
      window.history.pushState({ type: 'academic_nav', level: 4, deptId, batchId, semesterId: semId, examType: type }, '');
    } else if (deptId !== 'all' && batchId !== 'all' && semId !== 'all') {
      window.history.pushState({ type: 'academic_nav', level: 3, deptId, batchId, semesterId: semId }, '');
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
        setSelectedDeptId(dept ? dept.id : 'all');
        setCurrentBatch(batch);
        setSelectedBatchId(batch ? batch.id : 'all');
        setCurrentSemester(sem);
        setSelectedSemesterName(sem ? sem.name : 'all');
        setCurrentExamType(examType || null);
        if (examType) setFilterExamType(examType);
      } else if (!state || state.type !== 'question_detail') {
        setCurrentDept(null);
        setSelectedDeptId('all');
        setCurrentBatch(null);
        setSelectedBatchId('all');
        setCurrentSemester(null);
        setSelectedSemesterName('all');
        setCurrentExamType(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [departments, batches, semesters]);

  // Smart Filter Selection Handlers with cascading resets
  const handleSelectDeptFilter = (deptId: string) => {
    setSelectedDeptId(deptId);
    if (deptId === 'all') {
      setCurrentDept(null);
      setCurrentBatch(null);
      setCurrentSemester(null);
      setCurrentExamType(null);
    } else {
      const dept = departments.find(d => d.id === deptId) || null;
      setCurrentDept(dept);
      // If currently selected batch doesn't belong to this new dept, reset batch
      if (selectedBatchId !== 'all') {
        const batchValid = batches.some(b => b.id === selectedBatchId && b.departmentId === deptId);
        if (!batchValid) {
          setSelectedBatchId('all');
          setCurrentBatch(null);
          setCurrentSemester(null);
        }
      }
    }
  };

  const handleSelectBatchFilter = (batchId: string) => {
    setSelectedBatchId(batchId);
    if (batchId === 'all') {
      setCurrentBatch(null);
      setCurrentSemester(null);
      setCurrentExamType(null);
    } else {
      const batchObj = batches.find(b => b.id === batchId);
      if (batchObj) {
        setCurrentBatch(batchObj);
        if (selectedDeptId === 'all') {
          setSelectedDeptId(batchObj.departmentId);
          const dept = departments.find(d => d.id === batchObj.departmentId) || null;
          setCurrentDept(dept);
        }
      }
    }
  };

  const handleSelectSemesterFilter = (semName: string) => {
    setSelectedSemesterName(semName);
    if (semName === 'all') {
      setCurrentSemester(null);
      setCurrentExamType(null);
    }
  };

  const handleResetFilters = () => {
    setSelectedDeptId('all');
    setSelectedBatchId('all');
    setSelectedSemesterName('all');
    setFilterExamType('All');
    setSortBy('newest');
    setSearchQuery('');
    setCurrentDept(null);
    setCurrentBatch(null);
    setCurrentSemester(null);
    setCurrentExamType(null);
  };

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

  // Dynamic batch options based on selected department or current dept
  const availableBatches = (selectedDeptId !== 'all')
    ? batches.filter(b => b.departmentId === selectedDeptId)
    : (currentDept ? batches.filter(b => b.departmentId === currentDept.id) : batches);

  // Raw semester pool based on active department / batch selection
  const rawSemestersPool = (selectedBatchId !== 'all')
    ? semesters.filter(s => s.batchId === selectedBatchId)
    : (currentBatch
        ? semesters.filter(s => s.batchId === currentBatch.id)
        : (selectedDeptId !== 'all' || currentDept
            ? semesters.filter(s => availableBatches.some(b => b.id === s.batchId))
            : semesters));

  // Unique, deduplicated semester names across the university / pool (e.g. Summer 2026, Spring 2026, Fall 2025)
  const uniqueSemesterNames = sortSemesterNamesDescending(
    Array.from(new Set(rawSemestersPool.map(s => s.name.trim()))).filter(Boolean)
  );

  // Helper to count questions matching a specific semester name within current department/batch scope
  const getSemesterQuestionCount = (semName: string) => {
    const semNameLower = semName.trim().toLowerCase();
    return questions.filter(q => {
      const activeDeptId = selectedDeptId !== 'all' ? selectedDeptId : (currentDept ? currentDept.id : null);
      if (activeDeptId && q.departmentId !== activeDeptId) return false;

      const activeBatchId = selectedBatchId !== 'all' ? selectedBatchId : (currentBatch ? currentBatch.id : null);
      if (activeBatchId && q.batchId !== activeBatchId) return false;

      const qSem = semesters.find(s => s.id === q.semesterId);
      return qSem ? qSem.name.trim().toLowerCase() === semNameLower : false;
    }).length;
  };

  // Check if any smart filter or search is active
  const hasActiveFilters = 
    selectedDeptId !== 'all' || 
    selectedBatchId !== 'all' || 
    selectedSemesterName !== 'all' || 
    filterExamType !== 'All' || 
    searchQuery.trim() !== '' ||
    currentDept !== null ||
    currentBatch !== null ||
    currentSemester !== null ||
    currentExamType !== null;

  // Active filters count
  let activeFilterCount = 0;
  if (selectedDeptId !== 'all') activeFilterCount++;
  if (selectedBatchId !== 'all') activeFilterCount++;
  if (selectedSemesterName !== 'all') activeFilterCount++;
  if (filterExamType !== 'All') activeFilterCount++;
  if (searchQuery.trim() !== '') activeFilterCount++;
  if (currentDept !== null) activeFilterCount++;
  if (currentBatch !== null) activeFilterCount++;
  if (currentSemester !== null) activeFilterCount++;
  if (currentExamType !== null) activeFilterCount++;

  // Base list of accessible questions
  const isPrivileged = currentUser?.role === 'super_admin' || currentUser?.role === 'moderator';
  const baseQuestions = isPrivileged 
    ? questions 
    : questions.filter(q => q.status === 'published' || !q.status);

  // Curated Subsets for Homepage & Recommendations
  // Top 5 Trending Question Papers
  const trendingPapers = [...baseQuestions]
    .sort((a, b) => ((b.views * 1.5 + (b.likes || 0) * 3 + (b.downloads || 0) * 2) - (a.views * 1.5 + (a.likes || 0) * 3 + (a.downloads || 0) * 2)))
    .slice(0, 5);

  // Top 5 Recently Added Question Papers
  const recentlyAddedPapers = [...baseQuestions]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  // Filter logic based on hierarchy selectors & smart filters
  let filtered = baseQuestions;

  // Filter by Department
  const activeDeptId = selectedDeptId !== 'all' ? selectedDeptId : (currentDept ? currentDept.id : null);
  if (activeDeptId) {
    filtered = filtered.filter(q => q.departmentId === activeDeptId);
  }

  // Filter by Batch
  const activeBatchId = selectedBatchId !== 'all' ? selectedBatchId : (currentBatch ? currentBatch.id : null);
  if (activeBatchId) {
    filtered = filtered.filter(q => q.batchId === activeBatchId);
  }

  // Filter by Semester (matching semester name across university or specific batch)
  const activeSemesterName = selectedSemesterName !== 'all' 
    ? selectedSemesterName 
    : (currentSemester ? currentSemester.name : null);
  if (activeSemesterName) {
    const targetSemLower = activeSemesterName.trim().toLowerCase();
    filtered = filtered.filter(q => {
      if (currentSemester && q.semesterId === currentSemester.id) {
        return true;
      }
      const qSem = semesters.find(s => s.id === q.semesterId);
      return qSem ? qSem.name.trim().toLowerCase() === targetSemLower : false;
    });
  }

  // Filter by Exam Type
  const activeExamType = filterExamType !== 'All' ? filterExamType : (currentExamType ? currentExamType : null);
  if (activeExamType) {
    filtered = filtered.filter(q => q.examType === activeExamType);
  }

  // Filter by Global Search Bar with multi-token precision matching
  if (searchQuery.trim()) {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    filtered = filtered.filter(q => {
      const dept = departments.find(d => d.id === q.departmentId);
      const deptName = (dept?.name || '').toLowerCase();
      const deptCode = (dept?.code || '').toLowerCase();
      const batch = batches.find(b => b.id === q.batchId);
      const batchName = (batch?.name || '').toLowerCase();
      const sem = semesters.find(s => s.id === q.semesterId);
      const semName = (sem?.name || '').toLowerCase();
      const examTypeTerms = (q.examType === 'Mid' ? 'mid mid-term midterm mid term' : 'final semester final end term').toLowerCase();
      const teacher = (q.teacher || '').toLowerCase();
      const courseName = (q.courseName || '').toLowerCase();
      const courseCode = (q.courseCode || '').toLowerCase();
      const uploader = (q.uploadedByUsername || '').toLowerCase();
      const year = (q as any).year ? String((q as any).year).toLowerCase() : '';
      const session = ((q as any).session || '').toLowerCase();

      const combinedText = `${courseName} ${courseCode} ${teacher} ${uploader} ${deptName} ${deptCode} ${batchName} ${semName} ${examTypeTerms} ${year} ${session}`;

      return tokens.every(token => combinedText.includes(token));
    });
  }

  // Sort Question Papers according to active sort and tab
  filtered = [...filtered].sort((a, b) => {
    if (activeCategoryTab === 'trending') {
      const scoreA = (a.views || 0) * 1.5 + (a.likes || 0) * 3 + (a.downloads || 0) * 2;
      const scoreB = (b.views || 0) * 1.5 + (b.likes || 0) * 3 + (b.downloads || 0) * 2;
      return scoreB - scoreA;
    }
    if (activeCategoryTab === 'newest') {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
    if (activeCategoryTab === 'most_liked') {
      return (b.likes || 0) - (a.likes || 0);
    }
    if (activeCategoryTab === 'most_downloaded') {
      return (b.downloads || 0) - (a.downloads || 0);
    }

    if (sortBy === 'newest') {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    }
    if (sortBy === 'views') {
      return (b.views || 0) - (a.views || 0);
    }
    if (sortBy === 'downloads') {
      return (b.downloads || 0) - (a.downloads || 0);
    }
    if (sortBy === 'likes') {
      return (b.likes || 0) - (a.likes || 0);
    }
    return 0;
  });

  // Reusable Question Card Component
  const renderQuestionCard = (
    q: QuestionPaper, 
    index: number, 
    customBadge?: { label: string; icon?: React.ReactNode; bgClass: string; textClass: string; borderClass: string }
  ) => {
    const isLiked = q.likedBy?.includes(currentUser?.uid || '');
    const isBookmarked = q.bookmarks?.includes(currentUser?.uid || '');
    
    const deptObj = departments.find(d => d.id === q.departmentId);
    const batchObj = batches.find(b => b.id === q.batchId);
    const semObj = semesters.find(s => s.id === q.semesterId);

    const deptLabel = deptObj ? (deptObj.code || deptObj.name) : '';
    const batchLabel = batchObj ? batchObj.name : '';
    const semLabel = semObj ? semObj.name : '';

    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
        id={`question-card-${q.id}`}
        key={q.id}
        className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
      >
        {/* Top Thumbnail Image */}
        <div 
          onClick={() => {
            handleIncrementViews(q.id);
            onNavigateToQuestion(q.id);
          }}
          className="relative aspect-16/10 bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer group"
        >
          {q.imageUrls && q.imageUrls.length > 0 ? (
            <img 
              src={formatImageUrl(q.imageUrls[0])} 
              alt={q.courseName}
              onError={handleImageError}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-radial from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              <BookOpen className="w-8 h-8 opacity-40" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">No Preview</span>
            </div>
          )}

          {/* Floating Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
              {/* Exam type badge */}
              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg backdrop-blur-md shadow-xs ${
                q.examType === 'Mid' 
                  ? 'bg-amber-500/90 text-white' 
                  : 'bg-indigo-600/90 text-white'
              }`}>
                {q.examType === 'Mid' ? 'Mid-Term' : 'Semester Final'}
              </span>

              {/* Department badge */}
              {deptLabel && (
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-900/80 dark:bg-slate-950/80 text-white backdrop-blur-md shadow-xs">
                  {deptLabel}
                </span>
              )}

              {/* Custom Highlight Badge */}
              {customBadge && (
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-lg flex items-center gap-1 backdrop-blur-md shadow-xs border ${customBadge.bgClass} ${customBadge.textClass} ${customBadge.borderClass}`}>
                  {customBadge.icon}
                  <span>{customBadge.label}</span>
                </span>
              )}
            </div>

            {/* Bookmark button */}
            <button
              onClick={(e) => {
                handleBookmark(q, e);
              }}
              className={`p-2 rounded-xl backdrop-blur-md transition-all pointer-events-auto cursor-pointer shadow-xs ${
                isBookmarked 
                  ? 'bg-amber-500 text-white shadow-amber-500/20' 
                  : 'bg-white/85 dark:bg-slate-900/85 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
              }`}
              title={isBookmarked ? "Remove bookmark" : "Save for later"}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Multiple pages indicator */}
          {q.imageUrls && q.imageUrls.length > 1 && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1">
              <span>{q.imageUrls.length} Pages</span>
            </div>
          )}
        </div>

        {/* Card Content Area */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            {/* Header info */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                {q.courseCode || 'GENERAL'}
              </span>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(q.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Course title */}
            <h3 
              onClick={() => {
                handleIncrementViews(q.id);
                onNavigateToQuestion(q.id);
              }}
              className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer"
              title={q.courseName}
            >
              {q.courseName}
            </h3>

            {/* Academic Context Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {semLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{semLabel}</span>
                </span>
              )}
              {batchLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <GraduationCap className="w-3 h-3 text-slate-400" />
                  <span>{batchLabel}</span>
                </span>
              )}
            </div>

            {/* Teacher if present */}
            {q.teacher && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Faculty:</span> {q.teacher}
              </p>
            )}
          </div>

          {/* Engagement Stats */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 truncate max-w-[130px]">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {q.uploadedByUsername.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{q.uploadedByUsername}</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={(e) => {
                  handleLike(q, e);
                }}
                className={`flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer ${
                  isLiked ? 'text-rose-500 font-bold' : ''
                }`}
                title={isLiked ? "Unlike" : "Like"}
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                <span>{q.likes || 0}</span>
              </button>

              <div className="flex items-center gap-1" title={`${q.views || 0} views`}>
                <Eye className="w-3.5 h-3.5" />
                <span>{q.views || 0}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleIncrementViews(q.id);
                onNavigateToQuestion(q.id);
              }}
              className="py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <button
              onClick={(e) => handleDownload(q, e)}
              disabled={downloadingId !== null}
              className="py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-850 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
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

          {/* Report Link */}
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
            className="w-full text-center text-[10px] text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 pt-1 transition-colors cursor-pointer"
          >
            <Flag className="w-3 h-3" /> Report incorrect paper
          </button>
        </div>
      </motion.div>
    );
  };

  // ----------------- SECTIONS JSX VARIABLES / FUNCTIONS -----------------
  const renderSmartFilterPanel = () => {
    // Automatically hide the Smart Filters & Explorer card while actively searching
    if (searchQuery.trim() !== '') {
      return null;
    }

    return (
      <div id="smart-filter-panel" className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm mb-8 transition-all overflow-hidden">
        {/* Header Bar with Toggle Button */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 dark:text-white">Smart Filters & Explorer</h3>
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                    {filtered.length} {filtered.length === 1 ? 'Paper' : 'Papers'}
                  </span>
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 text-[11px] font-extrabold rounded-full border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      {activeFilterCount} Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Filter questions by Department, Batch, Semester, and Exam Category</p>
              </div>
            </div>

            {/* Mobile View Toggle button inside header */}
            <button
              type="button"
              id="mobile-toggle-filter-btn"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="sm:hidden px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
              aria-expanded={isFilterExpanded}
              aria-label={isFilterExpanded ? "Hide filter options" : "Show filter options"}
            >
              <ListFilter className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isFilterExpanded ? 'Hide Filters' : 'Show Filters'}</span>
              {isFilterExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-slate-800/50">
            {/* View Mode Toggle: Cards Grid vs Folder Tree */}
            <div className="bg-white dark:bg-slate-900 p-1 rounded-xl flex items-center border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                id="toggle-view-cards"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Instant Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Cards</span>
              </button>
              <button
                type="button"
                id="toggle-view-folders"
                onClick={() => setViewMode('folders')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'folders'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Hierarchical Folder Explorer"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Folders</span>
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                id="smart-filter-reset-btn"
                onClick={handleResetFilters}
                className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-200/60 dark:border-rose-900/50 cursor-pointer"
                title="Reset all applied filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Desktop Show / Hide Filters Toggle Button */}
            <button
              type="button"
              id="desktop-toggle-filter-btn"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              aria-expanded={isFilterExpanded}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isFilterExpanded ? 'Hide Filters' : 'Show Filters'}</span>
              {isFilterExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Active Filter Chips Bar (Always visible if filters applied) */}
        {hasActiveFilters && (
          <div className="px-4 sm:px-5 py-3 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
              <ListFilter className="w-3.5 h-3.5 text-indigo-500" />
              Active:
            </span>

            {selectedDeptId !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs">
                <span>Dept: {departments.find(d => d.id === selectedDeptId)?.code || selectedDeptId}</span>
                <button 
                  onClick={() => handleSelectDeptFilter('all')}
                  className="p-0.5 hover:bg-indigo-200/50 dark:hover:bg-indigo-900 rounded-md cursor-pointer"
                  title="Remove Department filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedBatchId !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 rounded-lg font-semibold border border-violet-200/60 dark:border-violet-800/60 shadow-2xs">
                <span>Batch: {batches.find(b => b.id === selectedBatchId)?.name || selectedBatchId}</span>
                <button 
                  onClick={() => handleSelectBatchFilter('all')}
                  className="p-0.5 hover:bg-violet-200/50 dark:hover:bg-violet-900 rounded-md cursor-pointer"
                  title="Remove Batch filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedSemesterName !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg font-semibold border border-blue-200/60 dark:border-blue-800/60 shadow-2xs">
                <span>Sem: {selectedSemesterName}</span>
                <button 
                  onClick={() => handleSelectSemesterFilter('all')}
                  className="p-0.5 hover:bg-blue-200/50 dark:hover:bg-blue-900 rounded-md cursor-pointer"
                  title="Remove Semester filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterExamType !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-lg font-semibold border border-amber-200/60 dark:border-amber-800/60 shadow-2xs">
                <span>Exam: {filterExamType === 'Mid' ? 'Mid-Term' : 'Final'}</span>
                <button 
                  onClick={() => setFilterExamType('All')}
                  className="p-0.5 hover:bg-amber-200/50 dark:hover:bg-amber-900 rounded-md cursor-pointer"
                  title="Remove Exam Type filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchQuery.trim() !== '' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg font-semibold border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span>"{searchQuery}"</span>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                  title="Clear search query"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold ml-auto cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Collapsible Filter Body */}
        <AnimatePresence initial={false}>
          {isFilterExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="p-4 sm:p-5 space-y-4">
                {/* 4 Multi-Select Smart Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  
                  {/* 1. Department Selector */}
                  <div className="space-y-1.5">
                    <label htmlFor="smart-filter-dept" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Department</span>
                    </label>
                    <select
                      id="smart-filter-dept"
                      value={selectedDeptId}
                      onChange={(e) => handleSelectDeptFilter(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer truncate"
                    >
                      <option value="all">All Departments ({departments.length})</option>
                      {departments.map((dept) => {
                        const count = questions.filter(q => q.departmentId === dept.id).length;
                        return (
                          <option key={dept.id} value={dept.id}>
                            {dept.code} - {dept.name} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 2. Batch Selector */}
                  <div className="space-y-1.5">
                    <label htmlFor="smart-filter-batch" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-violet-500" />
                      <span>Batch</span>
                    </label>
                    <select
                      id="smart-filter-batch"
                      value={selectedBatchId}
                      onChange={(e) => handleSelectBatchFilter(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer truncate"
                    >
                      <option value="all">
                        {selectedDeptId !== 'all' 
                          ? `All Batches (${availableBatches.length})` 
                          : `All Batches (${batches.length})`}
                      </option>
                      {availableBatches
                        .sort((a, b) => {
                          const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                          const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                          return numB - numA;
                        })
                        .map((batch) => {
                          const count = questions.filter(q => q.batchId === batch.id).length;
                          const dept = departments.find(d => d.id === batch.departmentId);
                          return (
                            <option key={batch.id} value={batch.id}>
                              {batch.name} {selectedDeptId === 'all' && dept ? `(${dept.code})` : ''} ({count})
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {/* 3. Semester Selector */}
                  <div className="space-y-1.5">
                    <label htmlFor="smart-filter-semester" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Semester</span>
                    </label>
                    <select
                      id="smart-filter-semester"
                      value={selectedSemesterName}
                      onChange={(e) => handleSelectSemesterFilter(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer truncate"
                    >
                      <option value="all">All Semesters ({uniqueSemesterNames.length})</option>
                      {uniqueSemesterNames.map((semName) => {
                        const count = getSemesterQuestionCount(semName);
                        return (
                          <option key={semName} value={semName}>
                            {semName} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 4. Exam Type & Sorting Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-amber-500" />
                      <span>Exam & Sorting</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        id="smart-filter-exam"
                        value={filterExamType}
                        onChange={(e) => setFilterExamType(e.target.value)}
                        className="w-full px-2 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="All">All Exams</option>
                        <option value="Mid">Mid-Term</option>
                        <option value="Final">Final</option>
                      </select>

                      <select
                        id="smart-filter-sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full px-2 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="views">Views</option>
                        <option value="downloads">Downloads</option>
                        <option value="likes">Likes</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Quick Presets Bar for rapid 1-click filtering */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Quick Filters:</span>
                  <button
                    type="button"
                    onClick={() => setFilterExamType(filterExamType === 'Mid' ? 'All' : 'Mid')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterExamType === 'Mid'
                        ? 'bg-amber-500 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${filterExamType === 'Mid' ? 'text-white' : 'text-amber-500'}`} />
                    <span>Mid-Term Exams</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterExamType(filterExamType === 'Final' ? 'All' : 'Final')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterExamType === 'Final'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <GraduationCap className={`w-3.5 h-3.5 ${filterExamType === 'Final' ? 'text-white' : 'text-indigo-500'}`} />
                    <span>Final Exams</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('views')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sortBy === 'views'
                        ? 'bg-violet-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Eye className={`w-3.5 h-3.5 ${sortBy === 'views' ? 'text-white' : 'text-violet-500'}`} />
                    <span>Most Viewed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('downloads')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sortBy === 'downloads'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Download className={`w-3.5 h-3.5 ${sortBy === 'downloads' ? 'text-white' : 'text-emerald-500'}`} />
                    <span>Most Downloaded</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

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
              {sortSemestersDescending(semesters.filter(s => s.batchId === currentBatch.id))
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
    if (loadingQuestions) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">Loading question papers...</p>
          <p className="text-xs text-slate-500 mt-1">Retrieving repository archives</p>
        </div>
      );
    }

    const isDefaultHomeView = !hasActiveFilters && !searchQuery && activeCategoryTab === 'all';
    const displayedQuestions = filtered.slice(0, displayLimit);

    return (
      <div className="space-y-12">
        {/* ===================== DEFAULT HOME: CATEGORIZED CURATED SECTIONS ===================== */}
        {isDefaultHomeView && (
          <>
            {/* 1. TOP 5 TRENDING & POPULAR PAPERS */}
            {trendingPapers.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
                          Trending Questions
                        </h3>
                        <span className="px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[10px] rounded-md border border-rose-500/30">
                          Top 5 Popular
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Most viewed, downloaded & highly rated papers</p>
                    </div>
                  </div>

                  <button
                    id="view-all-trending-btn"
                    onClick={() => {
                      setActiveCategoryTab('trending');
                      setDisplayLimit(20);
                    }}
                    className="self-start sm:self-auto text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 group py-1 cursor-pointer transition-colors"
                  >
                    <span>View All Trending</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {trendingPapers.map((q, idx) => 
                    renderQuestionCard(q, idx, {
                      label: 'Trending',
                      icon: <Flame className="w-3 h-3 text-rose-500" />,
                      bgClass: 'bg-rose-500/20 dark:bg-rose-950/60',
                      textClass: 'text-rose-700 dark:text-rose-300',
                      borderClass: 'border-rose-500/30'
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. TOP 5 RECENTLY ADDED PAPERS */}
            {recentlyAddedPapers.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
                          Recently Added Papers
                        </h3>
                        <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded-md border border-indigo-500/30">
                          Latest 5
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Freshly uploaded question papers across all faculties</p>
                    </div>
                  </div>

                  <button
                    id="view-all-newest-btn"
                    onClick={() => {
                      setActiveCategoryTab('newest');
                      setDisplayLimit(20);
                    }}
                    className="self-start sm:self-auto text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 group py-1 cursor-pointer transition-colors"
                  >
                    <span>View All New</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {recentlyAddedPapers.map((q, idx) => 
                    renderQuestionCard(q, idx, {
                      label: 'New',
                      icon: <Sparkles className="w-3 h-3 text-indigo-500" />,
                      bgClass: 'bg-indigo-500/20 dark:bg-indigo-950/60',
                      textClass: 'text-indigo-700 dark:text-indigo-300',
                      borderClass: 'border-indigo-500/30'
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===================== MAIN QUESTION PAPERS EXPLORER / CATALOG ===================== */}
        <div className="space-y-5 pt-2">
          {/* Header & Controls Toolbar */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left Title & Count */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                    <span>
                      {isDefaultHomeView 
                        ? 'All Question Papers' 
                        : (activeCategoryTab === 'trending' ? 'Trending Question Papers'
                          : activeCategoryTab === 'newest' ? 'Recently Added Papers'
                          : activeCategoryTab === 'most_liked' ? 'Most Helpful Papers'
                          : activeCategoryTab === 'most_downloaded' ? 'Most Downloaded Papers'
                          : searchQuery ? `Search Results for "${searchQuery}"`
                          : 'Filtered Question Papers')}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-800">
                      {filtered.length} {filtered.length === 1 ? 'Paper' : 'Papers'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Showing limited curated view ({Math.min(displayLimit, filtered.length)} of {filtered.length})
                  </p>
                </div>
              </div>

              {/* Limit & Sort Dropdown Selector */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Limit Dropdown Pill */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs">
                  <span className="px-2 text-slate-400 font-semibold text-[11px]">Show:</span>
                  {[10, 20, 50].map((limitVal) => (
                    <button
                      key={limitVal}
                      id={`display-limit-${limitVal}-btn`}
                      onClick={() => setDisplayLimit(limitVal)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                        displayLimit === limitVal
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {limitVal}
                    </button>
                  ))}
                  <button
                    id="display-limit-all-btn"
                    onClick={() => setDisplayLimit(Math.max(filtered.length, 100))}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                      displayLimit >= filtered.length && filtered.length > 0
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    View All
                  </button>
                </div>

                {/* Exam type filter dropdown */}
                {!currentExamType && (
                  <select
                    id="filter-exam-type-select"
                    value={filterExamType}
                    onChange={(e) => setFilterExamType(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 cursor-pointer font-semibold"
                  >
                    <option value="All">All Exam Types</option>
                    <option value="Mid">Mid-Term Only</option>
                    <option value="Final">Final Only</option>
                  </select>
                )}

                {/* Sorting Select */}
                <select
                  id="filter-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 cursor-pointer font-semibold"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="views">Most Viewed</option>
                  <option value="downloads">Most Downloaded</option>
                  <option value="likes">Most Liked</option>
                </select>

                {/* Reset Filters Quick Button if active */}
                {(hasActiveFilters || activeCategoryTab !== 'all' || searchQuery) && (
                  <button
                    onClick={handleResetFilters}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors cursor-pointer"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Navigation Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-slate-100 dark:border-slate-900">
              <button
                id="cat-tab-all"
                onClick={() => setActiveCategoryTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeCategoryTab === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Papers ({filtered.length})</span>
              </button>

              <button
                id="cat-tab-trending"
                onClick={() => setActiveCategoryTab('trending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeCategoryTab === 'trending'
                    ? 'bg-rose-500 text-white shadow-xs shadow-rose-500/20'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>Trending</span>
              </button>

              <button
                id="cat-tab-newest"
                onClick={() => setActiveCategoryTab('newest')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeCategoryTab === 'newest'
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Newest Uploads</span>
              </button>

              <button
                id="cat-tab-likes"
                onClick={() => setActiveCategoryTab('most_liked')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeCategoryTab === 'most_liked'
                    ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/20'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Most Helpful</span>
              </button>

              <button
                id="cat-tab-downloads"
                onClick={() => setActiveCategoryTab('most_downloaded')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeCategoryTab === 'most_downloaded'
                    ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Most Downloaded</span>
              </button>
            </div>
          </div>

          {/* Question Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedQuestions.map((q, index) => renderQuestionCard(q, index))}

            {/* Empty State */}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 px-4 text-center bg-white dark:bg-slate-950 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto text-slate-400">
                  <BookOpen className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">No Question Papers Found</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    We couldn't find question papers matching your specific selection or search query. Try adjusting or clearing filters.
                  </p>
                </div>
                {(hasActiveFilters || activeCategoryTab !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset All Filters & View All
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Footer Controls: Load More & View All */}
          {filtered.length > 0 && (
            <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
                Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{displayedQuestions.length}</strong> of{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-bold">{filtered.length}</strong> question papers
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                {/* Load More (+10) button */}
                {filtered.length > displayLimit && (
                  <button
                    id="load-more-questions-btn"
                    onClick={() => setDisplayLimit(prev => Math.min(prev + 10, filtered.length))}
                    className="px-4 py-2 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Load More (+10)</span>
                  </button>
                )}

                {/* View All button */}
                {filtered.length > displayLimit && (
                  <button
                    id="view-all-questions-btn"
                    onClick={() => setDisplayLimit(Math.max(filtered.length, 100))}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>View All ({filtered.length} Papers)</span>
                  </button>
                )}

                {/* Show Less button */}
                {displayLimit > 12 && (
                  <button
                    id="show-fewer-questions-btn"
                    onClick={() => setDisplayLimit(12)}
                    className="px-4 py-2 bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Show Fewer</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="dashboard-root" className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white flex items-center gap-2">
              <Search className="w-6 h-6 text-indigo-400" />
              <span>Find Question Papers</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">Uttara University Previous Exam Repository</p>
          </div>

          {/* Quick Search Suggestion Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-indigo-200/80 mr-1">Popular:</span>
            {['CSE', 'EEE', 'BBA', 'Mid-Term', 'Final', 'Algorithms', 'Physics'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSearchQuery(tag)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                  searchQuery.toLowerCase() === tag.toLowerCase()
                    ? 'bg-indigo-500 text-white border-indigo-400'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        
        {/* Real-time Global Search bar with filters */}
        <div className="relative w-full md:w-[420px]">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5 text-indigo-400" />
          </span>
          <input
            id="global-search-input"
            type="text"
            placeholder="Search course name, code, teacher, dept, batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-white/10 dark:bg-slate-900/60 text-white rounded-2xl border border-white/10 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm placeholder-slate-400 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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

      {/* Top Prominent Back Button & Breadcrumb Navigation Bar (Only shown in folder structure mode or when navigating department/batch/semester hierarchy) */}
      {(viewMode === 'folders' || currentDept !== null || currentBatch !== null || currentSemester !== null || currentExamType !== null) && (
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
      )}

      {/* ----------------- SMART FILTER & EXPLORER PANEL ----------------- */}
      {renderSmartFilterPanel()}

      {/* ----------------- SELECTION LEVELS & RESULTS ----------------- */}
      {viewMode === 'folders' && !searchQuery ? (
        <div className="space-y-10">
          {/* SELECTION HIERARCHY FIRST */}
          {renderSelectionLevels()}

          {/* RESULTS IF AT EXAM TYPE OR FILTERED LEVEL */}
          {currentExamType && (
            <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-8">
              {renderQuestionGrid()}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {/* QUESTION CARDS GRID (PRIMARY FILTER VIEW) */}
          {renderQuestionGrid()}

          {/* OPTIONAL FOLDER ACCORDION EXPLORER AT BOTTOM */}
          {!currentExamType && !searchQuery && selectedDeptId === 'all' && (
            <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">Explore by Department Folders</h3>
                  <p className="text-xs text-slate-500">Or use the hierarchical folder view to browse departments</p>
                </div>
              </div>
              {renderSelectionLevels()}
            </div>
          )}
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
