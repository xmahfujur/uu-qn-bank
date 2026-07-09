import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon,
  FileText,
  Plus
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, Batch, Semester, ExamType } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUploadSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, currentUser, onUploadSuccess }: UploadModalProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  // Form State
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [examType, setExamType] = useState<ExamType>('Mid');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [pdfUrl, setPdfUrl] = useState('');

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ImgBB Direct Upload State
  const imgbbKey = 'c66284ea8683ede65e71e14d201bec19';
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop Event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFilesToImgBB(e.dataTransfer.files);
    }
  };

  // Handle File Change Event
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFilesToImgBB(e.target.files);
    }
  };

  // Upload files sequentially to ImgBB
  async function uploadFilesToImgBB(files: FileList) {
    if (!imgbbKey.trim()) {
      setNotification({ 
        type: 'error', 
        message: 'System Upload API key is not configured. Please contact the administrator.' 
      });
      return;
    }

    setIsUploadingFiles(true);
    setNotification(null);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatusText(`Uploading page ${i + 1}/${files.length}: ${file.name}...`);

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey.trim()}`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for file ${file.name}`);
        }

        const resData = await response.json();
        if (resData && resData.success && resData.data && resData.data.url) {
          newUrls.push(resData.data.url);
        } else {
          throw new Error(resData.error?.message || `Upload failed for file ${file.name}`);
        }
      }

      // Add the uploaded URLs to imageUrls
      setImageUrls(prev => {
        const cleaned = prev.filter(url => url.trim() !== '');
        return [...cleaned, ...newUrls];
      });

      setNotification({ 
        type: 'success', 
        message: `Successfully uploaded ${newUrls.length} page(s) to ImgBB and added them automatically!` 
      });
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: err.message || 'Direct upload to ImgBB failed.' });
    } finally {
      setIsUploadingFiles(false);
      setUploadStatusText('');
    }
  }

  // Load Departments
  useEffect(() => {
    async function loadDepts() {
      try {
        const querySnapshot = await getDocs(collection(db, 'departments'));
        const depts: Department[] = [];
        querySnapshot.forEach((doc) => {
          depts.push({ id: doc.id, ...doc.data() } as Department);
        });
        setDepartments(depts);
      } catch (err) {
        console.error('Error loading departments:', err);
      }
    }
    if (isOpen) {
      loadDepts();
    }
  }, [isOpen]);

  // Load Batches when Department changes
  useEffect(() => {
    async function loadBatches() {
      if (!selectedDept) {
        setBatches([]);
        return;
      }
      try {
        const q = query(collection(db, 'batches'), where('departmentId', '==', selectedDept));
        const querySnapshot = await getDocs(q);
        const bList: Batch[] = [];
        querySnapshot.forEach((doc) => {
          bList.push({ id: doc.id, ...doc.data() } as Batch);
        });
        setBatches(bList);
        setSelectedBatch('');
        setSelectedSemester('');
      } catch (err) {
        console.error('Error loading batches:', err);
      }
    }
    loadBatches();
  }, [selectedDept]);

  // Load Semesters when Batch changes
  useEffect(() => {
    async function loadSemesters() {
      if (!selectedBatch) {
        setSemesters([]);
        return;
      }
      try {
        const q = query(collection(db, 'semesters'), where('batchId', '==', selectedBatch));
        const querySnapshot = await getDocs(q);
        const sList: Semester[] = [];
        querySnapshot.forEach((doc) => {
          sList.push({ id: doc.id, ...doc.data() } as Semester);
        });
        setSemesters(sList);
        setSelectedSemester('');
      } catch (err) {
        console.error('Error loading semesters:', err);
      }
    }
    loadSemesters();
  }, [selectedBatch]);

  // Handle AI Auto-Extract (Bonus AI feature)
  async function handleAIExtract() {
    const firstUrl = imageUrls[0]?.trim();
    if (!firstUrl) {
      setNotification({ type: 'error', message: 'Please provide a valid Question Image URL in the first field first.' });
      return;
    }
    
    setIsAnalyzing(true);
    setNotification(null);

    try {
      const response = await fetch('/api/ai/analyze-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: firstUrl }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze question paper.');
      }

      if (data.success && data.analysis) {
        const analysis = data.analysis;
        if (analysis.courseCode) setCourseCode(analysis.courseCode);
        if (analysis.courseName) setCourseName(analysis.courseName);
        if (analysis.examType) {
          if (analysis.examType === 'Mid' || analysis.examType === 'Final') {
            setExamType(analysis.examType);
          }
        }
        
        // Find matching department if suggested
        if (analysis.department) {
          const matchedDept = departments.find(
            d => d.code.toLowerCase() === analysis.department.toLowerCase() || 
            d.name.toLowerCase().includes(analysis.department.toLowerCase())
          );
          if (matchedDept) {
            setSelectedDept(matchedDept.id);
          }
        }

        setNotification({ 
          type: 'success', 
          message: 'AI OCR Extraction completed! Course code, name, and exam type automatically populated.' 
        });
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      setNotification({ 
        type: 'error', 
        message: error.message || 'AI analysis failed. Please verify the image URL is accessible.' 
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      setNotification({ type: 'error', message: 'You must be signed in to upload.' });
      return;
    }

    const filteredImageUrls = imageUrls.map(url => url.trim()).filter(Boolean);

    if (!selectedDept || !selectedBatch || !selectedSemester || !courseName || filteredImageUrls.length === 0) {
      setNotification({ type: 'error', message: 'Please fill in all required fields and provide at least one Question Image URL.' });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const isPrivileged = currentUser.role === 'super_admin' || currentUser.role === 'moderator';
      const initialStatus = isPrivileged ? 'published' : 'pending';

      const questionData = {
        courseCode: courseCode.trim() ? courseCode.trim().toUpperCase() : 'N/A',
        courseName: courseName.trim(),
        teacher: teacher.trim() || 'Not Specified',
        imageUrl: filteredImageUrls[0],
        imageUrls: filteredImageUrls,
        pdfUrl: pdfUrl.trim() || null,
        departmentId: selectedDept,
        batchId: selectedBatch,
        semesterId: selectedSemester,
        examType: examType,
        uploadedByUID: currentUser.uid,
        uploadedByUsername: currentUser.username || 'Anonymous',
        uploadedAt: new Date().toISOString(),
        reportCount: 0,
        downloads: 0,
        views: 0,
        likes: 0,
        likedBy: [],
        bookmarks: [],
        status: initialStatus
      };

      await addDoc(collection(db, 'questions'), questionData);
      
      // Update upload count on user profile
      const userRef = collection(db, 'users');
      // Incremented client-side or on login, or we can also trigger user upload count updates
      
      const successMsg = isPrivileged 
        ? 'Question paper uploaded and published successfully!' 
        : 'Question paper submitted! It will be published after verification by a moderator or admin.';
      
      setNotification({ type: 'success', message: successMsg });
      setTimeout(() => {
        onUploadSuccess();
        resetForm();
        onClose();
      }, 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to submit question paper.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedDept('');
    setSelectedBatch('');
    setSelectedSemester('');
    setExamType('Mid');
    setCourseCode('');
    setCourseName('');
    setTeacher('');
    setImageUrls(['']);
    setPdfUrl('');
    setNotification(null);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="upload-modal-container"
        className="w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold font-display text-slate-900 dark:text-white">Upload Question Paper</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Contribute to UU Qn Bank</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {notification && (
            <div className={`p-4 rounded-xl flex items-start gap-3 border ${
              notification.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900' 
                : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-100 dark:border-red-900'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          )}

          {/* Academic Selectors Group */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Department *</label>
              <select
                id="upload-dept-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Batch *</label>
              <select
                id="upload-batch-select"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                disabled={!selectedDept}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                required
              >
                <option value="">Select Batch</option>
                {batches
                  .filter((b) => b.departmentId === selectedDept)
                  .sort((a, b) => {
                    const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                    return numB - numA;
                  })
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Semester *</label>
              <select
                id="upload-semester-select"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                disabled={!selectedBatch}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                required
              >
                <option value="">Select Semester</option>
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>{sem.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Exam Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Exam Type *</label>
            <div className="flex gap-4">
              <label className="flex-1 flex items-center justify-center py-2.5 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                <input 
                  type="radio" 
                  name="examType" 
                  value="Mid" 
                  checked={examType === 'Mid'}
                  onChange={() => setExamType('Mid')}
                  className="mr-2 text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Mid-Term Exam</span>
              </label>
              <label className="flex-1 flex items-center justify-center py-2.5 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                <input 
                  type="radio" 
                  name="examType" 
                  value="Final" 
                  checked={examType === 'Final'}
                  onChange={() => setExamType('Final')}
                  className="mr-2 text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Semester Final</span>
              </label>
            </div>
          </div>

          {/* ImgBB Direct Upload Section */}
          <div id="imgbb-direct-upload" className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">⚡ Direct Image Upload</h3>
              <p className="text-[10px] text-slate-500">Upload pages directly without copy-pasting links (Powered by UU Qn Bank Cloud)</p>
            </div>

            {/* Drag & Drop File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' 
                  : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30'
              } ${isUploadingFiles ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploadingFiles}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                {isUploadingFiles ? (
                  <>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{uploadStatusText}</p>
                    <p className="text-[11px] text-slate-400">Please wait while files are uploaded...</p>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-500 flex justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Drag & drop your question pages here
                    </p>
                    <p className="text-xs text-slate-400">
                      or <span className="text-indigo-600 dark:text-indigo-400 font-medium">browse files</span> (supports multiple images)
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Multiple Image URLs Section with Dynamic Adding/Removing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Question Image URL(s) *</label>
              <span className="text-[10px] text-slate-500">Auto-populated by upload above, or paste direct links</span>
            </div>

            <div className="space-y-3">
              {imageUrls.map((url, index) => (
                <div key={index} className="space-y-2 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Page {index + 1}</span>
                    {imageUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...imageUrls];
                          next.splice(index, 1);
                          setImageUrls(next);
                        }}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                      >
                        Remove Page
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="url"
                        placeholder={`https://i.ibb.co/.../page-${index + 1}.jpg`}
                        value={url}
                        onChange={(e) => {
                          const next = [...imageUrls];
                          next[index] = e.target.value;
                          setImageUrls(next);
                        }}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    {index === 0 && (
                      <button
                        type="button"
                        onClick={handleAIExtract}
                        disabled={isAnalyzing || !url}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0"
                        title="AI Scan works on Page 1"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        AI Scan
                      </button>
                    )}
                  </div>

                  {/* Instant Live Preview for this page */}
                  {url && (
                    <div className="mt-2 p-2 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-lg flex flex-col items-center justify-center">
                      <p className="text-[10px] text-slate-400 mb-1 font-semibold">Page {index + 1} Preview</p>
                      <img 
                        src={url} 
                        alt={`Page ${index + 1} Preview`} 
                        className="max-h-32 object-contain rounded border border-slate-200 dark:border-slate-800 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/ffffff?text=Invalid+Image+URL';
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setImageUrls([...imageUrls, ''])}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add One More Image Page
            </button>
          </div>

          {/* Course Metadata (Code, Name, Teacher) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Course Code (Optional)</label>
              <input
                id="course-code-input"
                type="text"
                placeholder="e.g. CSE 112"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Course Name *</label>
              <input
                id="course-name-input"
                type="text"
                placeholder="e.g. Structured Programming"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Teacher Name (Optional)</label>
              <input
                id="teacher-input"
                type="text"
                placeholder="e.g. Prof. Dr. M. R. Rahman"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Optional PDF URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">PDF Document URL (Optional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <input
                id="pdf-url-input"
                type="url"
                placeholder="https://github.com/.../question.pdf"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/15 flex items-center gap-1.5 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Submit Question
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
