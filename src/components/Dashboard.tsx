import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Folder, 
  Search, 
  Filter, 
  ArrowRight, 
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
import { Department, Batch, Semester, QuestionPaper, ExamType } from '../types';

interface DashboardProps {
  currentUser: any;
  onNavigateToQuestion: (questionId: string) => void;
  departments: Department[];
  batches: Batch[];
  semesters: Semester[];
  onTriggerAuth: () => void;
}

export default function Dashboard({ 
  currentUser, 
  onNavigateToQuestion,
  departments,
  batches,
  semesters,
  onTriggerAuth
}: DashboardProps) {
  
  // Navigation State in hierarchy
  const [currentDept, setCurrentDept] = useState<Department | null>(null);
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [currentExamType, setCurrentExamType] = useState<ExamType | null>(null);

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

  return (
    <div id="dashboard-root" className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
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

      {/* Breadcrumb Path Navigation */}
      <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-8 px-1">
        <button 
          onClick={() => {
            setCurrentDept(null);
            setCurrentBatch(null);
            setCurrentSemester(null);
            setCurrentExamType(null);
          }}
          className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
        >
          <Home className="w-4 h-4" />
          Departments
        </button>
        
        {currentDept && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
            <button 
              onClick={() => {
                setCurrentBatch(null);
                setCurrentSemester(null);
                setCurrentExamType(null);
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {currentDept.code}
            </button>
          </>
        )}

        {currentBatch && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
            <button 
              onClick={() => {
                setCurrentSemester(null);
                setCurrentExamType(null);
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {currentBatch.name}
            </button>
          </>
        )}

        {currentSemester && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
            <button 
              onClick={() => {
                setCurrentExamType(null);
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {currentSemester.name}
            </button>
          </>
        )}

        {currentExamType && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {currentExamType === 'Mid' ? 'Mid-Term' : 'Semester Final'} Exams
            </span>
          </>
        )}
      </div>

      {/* ----------------- SELECTION LEVELS ----------------- */}

      {/* LEVEL 1: ALL DEPARTMENTS */}
      {!currentDept && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100">Select Academic Department</h3>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{departments.length} Departments found</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => {
              const deptPapersCount = questions.filter(q => q.departmentId === dept.id).length;
              return (
                <div 
                  id={`dept-card-${dept.id}`}
                  key={dept.id}
                  onClick={() => setCurrentDept(dept)}
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
                </div>
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
              onClick={() => setCurrentDept(null)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
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
              .map((batch) => {
                const batchPapersCount = questions.filter(q => q.batchId === batch.id).length;
                return (
                  <div 
                    id={`batch-card-${batch.id}`}
                    key={batch.id}
                    onClick={() => setCurrentBatch(batch)}
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
                  </div>
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
              onClick={() => setCurrentBatch(null)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Back to Batches
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {semesters
              .filter(s => s.batchId === currentBatch.id)
              .map((sem) => {
                const semPapersCount = questions.filter(q => q.semesterId === sem.id).length;
                return (
                  <div 
                    id={`sem-card-${sem.id}`}
                    key={sem.id}
                    onClick={() => setCurrentSemester(sem)}
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
                  </div>
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
              onClick={() => setCurrentSemester(null)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
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
                  onClick={() => setCurrentExamType(type as ExamType)}
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

      {/* ----------------- QUESTION PAPERS DISPLAY GRID ----------------- */}
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
                  onClick={() => setCurrentExamType(null)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
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
                {filtered.map((q) => {
                  const isLiked = q.likedBy?.includes(currentUser?.uid || '');
                  const isBookmarked = q.bookmarks?.includes(currentUser?.uid || '');
                  
                  return (
                    <div 
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
                        <img 
                          src={q.imageUrl} 
                          alt={q.courseName} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/ffffff?text=UU+Question+Paper';
                          }}
                        />
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
                    </div>
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
