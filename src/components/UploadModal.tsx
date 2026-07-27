import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon,
  FileText,
  Plus,
  Trash2
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
import { sortSemestersDescending } from '../utils/semesterSort';
import { sortDepartmentsAlphabetically } from '../utils/departmentSort';
import { formatImageUrl } from '../utils/imageUrl';

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

  // Helper to read draft from localStorage
  const getDraftValue = (key: string, defaultValue: any) => {
    try {
      const draftStr = localStorage.getItem('uu_qn_bank_upload_draft');
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft[key] !== undefined) {
          return draft[key];
        }
      }
    } catch (e) {
      console.error('Error reading draft from localStorage:', e);
    }
    return defaultValue;
  };

  // Form State initialized from draft if present
  const [selectedDept, setSelectedDept] = useState<string>(() => getDraftValue('selectedDept', ''));
  const [selectedBatch, setSelectedBatch] = useState<string>(() => getDraftValue('selectedBatch', ''));
  const [selectedSemester, setSelectedSemester] = useState<string>(() => getDraftValue('selectedSemester', ''));
  const [examType, setExamType] = useState<ExamType>(() => getDraftValue('examType', 'Mid'));
  const [courseCode, setCourseCode] = useState<string>(() => getDraftValue('courseCode', ''));
  const [courseName, setCourseName] = useState<string>(() => getDraftValue('courseName', ''));
  const [teacher, setTeacher] = useState<string>(() => getDraftValue('teacher', ''));
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    const raw = getDraftValue('imageUrls', []);
    return Array.isArray(raw) ? raw.filter((u: string) => typeof u === 'string' && u.trim() !== '') : [];
  });
  const [pdfUrl, setPdfUrl] = useState<string>(() => getDraftValue('pdfUrl', ''));

  // File input ref for "Add Image Page" button
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs to track previous department/batch values to avoid destroying draft values during cascade loading
  const prevDeptRef = React.useRef(selectedDept);
  const prevBatchRef = React.useRef(selectedBatch);

  // Save draft whenever any form state changes
  useEffect(() => {
    const draft = {
      selectedDept,
      selectedBatch,
      selectedSemester,
      examType,
      courseCode,
      courseName,
      teacher,
      imageUrls,
      pdfUrl
    };
    try {
      localStorage.setItem('uu_qn_bank_upload_draft', JSON.stringify(draft));
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  }, [
    selectedDept,
    selectedBatch,
    selectedSemester,
    examType,
    courseCode,
    courseName,
    teacher,
    imageUrls,
    pdfUrl
  ]);

  // Determine if a non-empty draft is active
  const hasDraft = 
    selectedDept !== '' || 
    selectedBatch !== '' || 
    selectedSemester !== '' || 
    courseCode !== '' || 
    courseName !== '' || 
    teacher !== '' || 
    imageUrls.length > 0;

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
        if (resData && resData.success && resData.data && (resData.data.display_url || resData.data.url)) {
          const rawUrl = resData.data.display_url || resData.data.url;
          newUrls.push(formatImageUrl(rawUrl));
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
        setDepartments(sortDepartmentsAlphabetically(depts));
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
        if (prevDeptRef.current !== '') {
          setSelectedBatch('');
          setSelectedSemester('');
          prevDeptRef.current = '';
        }
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
        
        // Reset only if the department actually changed from the last known value
        if (prevDeptRef.current !== selectedDept) {
          setSelectedBatch('');
          setSelectedSemester('');
          prevDeptRef.current = selectedDept;
        }
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
        if (prevBatchRef.current !== '') {
          setSelectedSemester('');
          prevBatchRef.current = '';
        }
        return;
      }
      try {
        const q = query(collection(db, 'semesters'), where('batchId', '==', selectedBatch));
        const querySnapshot = await getDocs(q);
        const sList: Semester[] = [];
        querySnapshot.forEach((doc) => {
          sList.push({ id: doc.id, ...doc.data() } as Semester);
        });
        setSemesters(sortSemestersDescending(sList));
        
        // Reset only if the batch actually changed from the last known value
        if (prevBatchRef.current !== selectedBatch) {
          setSelectedSemester('');
          prevBatchRef.current = selectedBatch;
        }
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
      setNotification({ type: 'error', message: 'Please upload at least one question page image first.' });
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

    const filteredImageUrls = imageUrls.map(url => formatImageUrl(url.trim())).filter(Boolean);

    if (!selectedDept || !selectedBatch || !selectedSemester || !courseName || filteredImageUrls.length === 0) {
      setNotification({ type: 'error', message: 'Please fill in all required fields and upload at least one question page image.' });
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
    try {
      localStorage.removeItem('uu_qn_bank_upload_draft');
    } catch (e) {
      console.error('Error clearing draft:', e);
    }
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
          {hasDraft && (
            <div id="draft-banner" className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between text-xs text-indigo-800 dark:text-indigo-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                Unsaved draft restored automatically.
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline font-semibold cursor-pointer"
              >
                Reset Form
              </button>
            </div>
          )}

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

          {/* Image Upload & Page Management Section */}
          <div id="imgbb-direct-upload" className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Question Paper Images *
                </h3>
                <p className="text-[10px] text-slate-500">Upload single or multiple pages of your exam question paper</p>
              </div>
              {imageUrls.length > 0 && (
                <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-extrabold rounded-full">
                  {imageUrls.length} {imageUrls.length === 1 ? 'Page' : 'Pages'} Uploaded
                </span>
              )}
            </div>

            {/* Hidden File Input for trigger button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploadingFiles}
              className="hidden"
            />

            {/* Drag & Drop File Upload Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' 
                  : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 hover:border-indigo-400'
              } ${isUploadingFiles ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                {isUploadingFiles ? (
                  <>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{uploadStatusText}</p>
                    <p className="text-[11px] text-slate-400">Please wait while files are being uploaded...</p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 flex justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Drag & drop question page images here
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        or <span className="text-indigo-600 dark:text-indigo-400 font-bold underline">browse files</span> (select one or multiple images)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Uploaded Question Paper Pages Preview Grid */}
            {imageUrls.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Uploaded Page Previews
                  </label>
                  <span className="text-[10px] text-slate-500">Verify image visibility before submitting</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {imageUrls.map((url, index) => (
                    <div 
                      key={index} 
                      className="group relative bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 transition-all hover:border-indigo-500/50"
                    >
                      {/* Header: Page Badge & Controls */}
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider rounded-md">
                          Page {index + 1}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {index === 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAIExtract();
                              }}
                              disabled={isAnalyzing || !url}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                              title="Scan Page 1 with AI OCR to auto-fill course code and title"
                            >
                              {isAnalyzing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-amber-300" />
                              )}
                              <span>AI Scan</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = [...imageUrls];
                              next.splice(index, 1);
                              setImageUrls(next);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Remove this page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* High-Res Thumbnail Preview */}
                      <div className="relative h-44 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1">
                        <img 
                          src={formatImageUrl(url)} 
                          alt={`Page ${index + 1} Preview`} 
                          className="w-full h-full object-contain rounded"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src.includes('lh3.googleusercontent.com/d/')) {
                              const id = target.src.split('/d/')[1];
                              if (id) {
                                target.src = `https://drive.google.com/uc?export=view&id=${id}`;
                                return;
                              }
                            }
                            target.src = 'https://placehold.co/600x800/1e293b/ffffff?text=Image+Load+Failed';
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Button to Add One More Image Page */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFiles}
                  className="w-full py-3 bg-white dark:bg-slate-950 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-2 border-dashed border-indigo-300 dark:border-indigo-800/60 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add One More Image Page</span>
                </button>
              </div>
            )}
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
