import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  ArrowLeft, 
  Download, 
  Eye, 
  Heart, 
  Bookmark, 
  Flag, 
  Calendar, 
  User, 
  Sparkles, 
  Loader2, 
  ExternalLink,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Printer,
  Copy,
  AlertCircle
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  arrayUnion, 
  arrayRemove,
  collection,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { QuestionPaper, ExamType } from '../types';

interface QuestionDetailProps {
  questionId: string;
  currentUser: any;
  onBack: () => void;
  onNavigateToQuestion: (id: string) => void;
  onTriggerAuth: () => void;
}

export default function QuestionDetail({ 
  questionId, 
  currentUser, 
  onBack, 
  onNavigateToQuestion,
  onTriggerAuth
}: QuestionDetailProps) {
  
  const [question, setQuestion] = useState<QuestionPaper | null>(null);
  const [relatedQuestions, setRelatedQuestions] = useState<QuestionPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // AI Analysis (Summary + Predictions)
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  
  // Flag action dialog
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [reportReason, setReportReason] = useState<'Wrong paper' | 'Spam' | 'Duplicate' | 'Broken Link' | 'Other'>('Wrong paper');
  const [reportDesc, setReportDesc] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // General Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Zoom on hover state
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({
    transform: 'scale(1)',
    transformOrigin: 'center center'
  });
  const [isZoomed, setIsZoomed] = useState(false);

  // Academic metadata states
  const [department, setDepartment] = useState<{ name: string; code: string } | null>(null);
  const [batch, setBatch] = useState<{ name: string } | null>(null);
  const [semester, setSemester] = useState<{ name: string } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

  // Load question details and increment view
  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      setActiveImageIndex(0);
      setDepartment(null);
      setBatch(null);
      setSemester(null);
      try {
        const docRef = doc(db, 'questions', questionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const qData = { id: docSnap.id, ...docSnap.data() } as QuestionPaper;
          setQuestion(qData);

          // Increment view count in firestore
          await updateDoc(docRef, { views: increment(1) });

          // Load Department
          if (qData.departmentId) {
            getDoc(doc(db, 'departments', qData.departmentId)).then((snap) => {
              if (snap.exists()) setDepartment({ name: snap.data().name, code: snap.data().code });
            }).catch(e => console.error("Error loading department", e));
          }

          // Load Batch
          if (qData.batchId) {
            getDoc(doc(db, 'batches', qData.batchId)).then((snap) => {
              if (snap.exists()) setBatch({ name: snap.data().name });
            }).catch(e => console.error("Error loading batch", e));
          }

          // Load Semester
          if (qData.semesterId) {
            getDoc(doc(db, 'semesters', qData.semesterId)).then((snap) => {
              if (snap.exists()) setSemester({ name: snap.data().name });
            }).catch(e => console.error("Error loading semester", e));
          }

          // Load related questions in same department
          const allSnap = await getDocs(collection(db, 'questions'));
          const related: QuestionPaper[] = [];
          allSnap.forEach((d) => {
            const paper = { id: d.id, ...d.data() } as QuestionPaper;
            if (paper.departmentId === qData.departmentId && paper.id !== qData.id) {
              related.push(paper);
            }
          });
          setRelatedQuestions(related.slice(0, 3)); // show top 3 related papers
        }
      } catch (err) {
        console.error('Error loading question detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [questionId]);

  function showNotif(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }

  // Handle Liking
  async function handleLike() {
    if (!question) return;
    if (!currentUser) {
      showNotif('error', 'Please login to rate question papers.');
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
        setQuestion(prev => prev ? {
          ...prev,
          likes: prev.likes - 1,
          likedBy: likedArray.filter(id => id !== currentUser.uid)
        } : null);
        showNotif('success', 'Rating removed.');
      } else {
        await updateDoc(qDocRef, {
          likes: increment(1),
          likedBy: arrayUnion(currentUser.uid)
        });
        setQuestion(prev => prev ? {
          ...prev,
          likes: prev.likes + 1,
          likedBy: [...likedArray, currentUser.uid]
        } : null);
        showNotif('success', 'Thanks for the feedback!');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Bookmarking
  async function handleBookmark() {
    if (!question) return;
    if (!currentUser) {
      showNotif('error', 'Please login to bookmark.');
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
        setQuestion(prev => prev ? {
          ...prev,
          bookmarks: bookmarkArray.filter(id => id !== currentUser.uid)
        } : null);
        showNotif('success', 'Removed from bookmarks.');
      } else {
        await updateDoc(qDocRef, {
          bookmarks: arrayUnion(currentUser.uid)
        });
        setQuestion(prev => prev ? {
          ...prev,
          bookmarks: [...bookmarkArray, currentUser.uid]
        } : null);
        showNotif('success', 'Bookmarked!');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Helper to sanitize filename
  function sanitizeFilename(name: string) {
    return name.replace(/[/\\?%*:|"<>\s]+/g, '_');
  }

  // Handle Download (Direct client-side fetching + multi-page ZIP bundle)
  async function handleDownload() {
    if (!question) return;
    try {
      setDownloadProgress('Starting...');
      
      const qDocRef = doc(db, 'questions', question.id);
      await updateDoc(qDocRef, { downloads: increment(1) });
      setQuestion(prev => prev ? { ...prev, downloads: prev.downloads + 1 } : null);

      const displaySemester = semester?.name || 'Semester';
      const baseFilename = sanitizeFilename(`${question.courseCode}_${question.courseName}_${question.examType}_${displaySemester}`);

      // Handle PDF format
      if (question.pdfUrl) {
        setDownloadProgress('Fetching PDF...');
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
          showNotif('success', 'PDF downloaded successfully!');
        } catch (err) {
          console.warn('Direct PDF download failed, opening in a new tab', err);
          window.open(question.pdfUrl, '_blank');
        } finally {
          setDownloadProgress(null);
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
        setDownloadProgress('Downloading...');
        const imageUrl = activePages[0];
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) throw new Error('CORS or network error');
          const blob = await response.blob();
          // Extract appropriate extension from mime type
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
          showNotif('success', 'Paper downloaded successfully!');
        } catch (err) {
          console.warn('Direct download failed, opening in a new tab', err);
          window.open(imageUrl, '_blank');
        }
      } else {
        setDownloadProgress('Preparing ZIP...');
        const zip = new JSZip();

        for (let i = 0; i < activePages.length; i++) {
          setDownloadProgress(`Fetching page ${i + 1}/${activePages.length}...`);
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

        setDownloadProgress('Packaging ZIP...');
        const zipContent = await zip.generateAsync({ type: 'blob' });
        const blobUrl = URL.createObjectURL(zipContent);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${baseFilename}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showNotif('success', `All ${activePages.length} pages bundled in ZIP!`);
      }

    } catch (err) {
      console.error(err);
      showNotif('error', 'Download encountered an error, opening paper instead.');
      if (question.imageUrl) {
        window.open(question.imageUrl, '_blank');
      }
    } finally {
      setDownloadProgress(null);
    }
  }

  // Call server-side API to generate pattern analysis and syllabus predictive mapping using Gemini API (Bonus AI Feature!)
  async function handleAISummarize() {
    if (!question) return;
    setIsSummarizing(true);
    setAiSummary('');

    try {
      const questionsText = `Exam Paper metadata: ${question.courseCode} ${question.courseName}, Exam Type: ${question.examType}, Instructor: ${question.teacher || 'Not Specified'}. This is a university grade exam paper.`;
      
      const response = await fetch('/api/ai/summarize-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionsText,
          courseCode: question.courseCode,
          courseName: question.courseName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate pattern summary.');
      }

      if (data.success && data.summary) {
        setAiSummary(data.summary);
      }
    } catch (error: any) {
      console.error(error);
      showNotif('error', 'AI analysis model is busy. Please try again in a moment.');
    } finally {
      setIsSummarizing(false);
    }
  }

  // Submit report flag
  async function handleFlagSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !question) return;

    setSubmittingReport(true);
    try {
      await addDoc(collection(db, 'reports'), {
        questionId: question.id,
        courseCode: question.courseCode,
        courseName: question.courseName,
        reportedByUID: currentUser.uid,
        reportedByUsername: currentUser.username || 'Student',
        reason: reportReason,
        description: reportDesc.trim(),
        reportedAt: new Date().toISOString()
      });

      // Update report count on the question paper
      await updateDoc(doc(db, 'questions', question.id), {
        reportCount: increment(1)
      });

      showNotif('success', 'Report submitted successfully. Administrators will review.');
      setShowFlagModal(false);
      setReportDesc('');
    } catch (err) {
      console.error('Error reporting:', err);
      showNotif('error', 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 mt-2">Opening question folder...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 font-semibold">Question paper not found or has been deleted by administration.</p>
        <button onClick={onBack} className="text-indigo-600 dark:text-indigo-400 mt-4 hover:underline">Go Back</button>
      </div>
    );
  }

  const isLiked = question.likedBy?.includes(currentUser?.uid || '');
  const isBookmarked = question.bookmarks?.includes(currentUser?.uid || '');

  const pages = question.imageUrls && question.imageUrls.length > 0 
    ? question.imageUrls 
    : [question.imageUrl];
  
  const currentImgUrl = pages[activeImageIndex] || question.imageUrl;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { left, top, width, height } = container.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    
    setZoomStyle({
      transform: 'scale(2.2)', // 2.2x zoom factor
      transformOrigin: `${x}% ${y}%`,
      cursor: 'zoom-in'
    });
  };

  const handleMouseEnter = () => {
    setIsZoomed(true);
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
    setZoomStyle({
      transform: 'scale(1)',
      transformOrigin: 'center center',
      transition: 'transform 0.15s ease-out'
    });
  };

  return (
    <div id="question-detail-root" className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-100 dark:border-red-800'
        }`}>
          {notification.type === 'success' ? (
            <AlertCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Back Button & Navigation context header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Question Bank
        </button>

        <div className="flex items-center gap-2">
          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            className={`p-2.5 rounded-xl border transition-all ${
              isBookmarked 
                ? 'bg-indigo-600 text-white border-indigo-700' 
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
            title="Bookmark paper"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>

          {/* Like */}
          <button
            onClick={handleLike}
            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-semibold ${
              isLiked 
                ? 'bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/30' 
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>{question.likes} Likes</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: High Quality Image Preview Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-900 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Question Paper Document {pages.length > 1 && `(Page ${activeImageIndex + 1} of ${pages.length})`}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open(currentImgUrl, '_blank')}
                  className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded text-slate-400 hover:text-slate-600 transition-colors"
                  title="Open current page image in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Page navigation controls if multiple pages exist */}
            {pages.length > 1 && (
              <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <button
                  onClick={() => setActiveImageIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeImageIndex === 0}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev Page
                </button>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">
                  Page {activeImageIndex + 1} of {pages.length}
                </span>
                <button
                  onClick={() => setActiveImageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                  disabled={activeImageIndex === pages.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
                >
                  Next Page <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main view container */}
            <div 
              id="question-paper-zoom-container"
              className="relative flex items-center justify-center bg-slate-50 dark:bg-slate-900/40 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50 min-h-[400px] cursor-zoom-in group"
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <img 
                src={currentImgUrl} 
                alt={`${question.courseCode} Question Paper`} 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm transition-transform duration-75 ease-out select-none pointer-events-none"
                style={zoomStyle}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/800x1200/1e293b/ffffff?text=Unable+to+Load+Question+Paper';
                }}
              />
              
              {/* Overlay auto-zoom indicator badge */}
              <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-slate-300 rounded-lg pointer-events-none select-none transition-opacity duration-200 opacity-85 group-hover:opacity-0 shadow-md border border-white/5">
                🔍 Hover paper to auto zoom
              </div>
            </div>

            {/* Beautiful Page Thumbnails Strip */}
            {pages.length > 1 && (
              <div className="flex items-center justify-center gap-2.5 mt-4 overflow-x-auto py-1">
                {pages.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-14 h-18 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      activeImageIndex === idx 
                        ? 'border-indigo-600 ring-2 ring-indigo-600/20' 
                        : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={url} 
                      alt={`Page ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/100x150/1e293b/ffffff?text=Page';
                      }}
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-[8px] text-white font-mono font-bold text-center py-0.5">
                      P.{idx + 1}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Helper Panel (Bonus feature: Pattern Summarizer + Predictions mapped by Gemini API) */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-slate-950 text-white rounded-2xl border border-slate-200/10 dark:border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 border border-indigo-400/20">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold font-display text-base">Gemini Paper Analyst</h3>
                  <p className="text-[10px] text-slate-400">Summarize exam patterns & predict topics instantly</p>
                </div>
              </div>
              
              <button
                onClick={handleAISummarize}
                disabled={isSummarizing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing Paper...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyze Patterns
                  </>
                )}
              </button>
            </div>

            {aiSummary && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 text-sm leading-relaxed text-slate-200">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-display">AI Analysis Report</p>
                <div className="whitespace-pre-wrap font-sans space-y-3">
                  {aiSummary}
                </div>
              </div>
            )}

            {!aiSummary && !isSummarizing && (
              <p className="text-xs text-slate-400 leading-relaxed">
                Click "Analyze Patterns" above to let our custom server-side Gemini intelligence parse this question, map marks distribution, summarize key recurring concepts, and predict topics likely to appear on future Uttara University exams.
              </p>
            )}
          </div>
        </div>

        {/* Right Col: Paper Metadata, Stats, and Related Questions */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-6">
            <div className="space-y-1">
              <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/40 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                {question.courseCode}
              </span>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white pt-2">{question.courseName}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Teacher: {question.teacher || 'Not specified'}
              </p>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-900/85 pt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {department ? `${department.name} (${department.code})` : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Batch</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {batch ? batch.name : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Exam Semester</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {semester ? semester.name : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Exam Type</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-600 dark:bg-amber-950/30">
                  {question.examType} Exam
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Uploader Student</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">@{question.uploadedByUsername}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Upload Date</span>
                <span className="font-mono text-xs text-slate-500">{new Date(question.uploadedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Quick stats counter (Views, Downloads) */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-900/85 pt-4 text-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Views</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center justify-center gap-1">
                  <Eye className="w-4 h-4 text-slate-400" />
                  {question.views}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Downloads</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center justify-center gap-1">
                  <Download className="w-4 h-4 text-slate-400" />
                  {question.downloads}
                </p>
              </div>
            </div>

            {/* Download/Open Original button */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleDownload}
                disabled={!!downloadProgress}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/15 transition-all"
              >
                {downloadProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{downloadProgress}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Question Paper {pages.length > 1 ? `(${pages.length} Pages)` : ''}</span>
                  </>
                )}
              </button>

              {question.pdfUrl && (
                <a 
                  href={question.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Original PDF Version
                </a>
              )}

              {/* Report inaccurate flag */}
              <button
                onClick={() => {
                  if (!currentUser) {
                    showNotif('error', 'Please login to flag papers.');
                    onTriggerAuth();
                    return;
                  }
                  setShowFlagModal(true);
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1.5 py-2 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Report incorrect / inaccurate file
              </button>
            </div>
          </div>

          {/* Related Question Papers card (same dept) */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              Related Question Papers
            </h4>

            <div className="space-y-3">
              {relatedQuestions.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => onNavigateToQuestion(q.id)}
                  className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl hover:bg-slate-100/55 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-mono text-slate-500">{q.courseCode}</p>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-1">{q.courseName}</h5>
                    <p className="text-[10px] text-slate-400">{q.examType} Exam</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}

              {relatedQuestions.length === 0 && (
                <p className="text-xs text-slate-500 italic text-center py-4">No related question papers in this section yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Flag Dialog */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Report Paper Issue</h3>
              </div>
              <button 
                onClick={() => setShowFlagModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFlagSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Reason *</label>
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Brief description *</label>
                <textarea
                  placeholder="Specify what needs correction..."
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  {submittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Inline placeholder X component for simplicity
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
