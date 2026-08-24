import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';
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
  Trash2,
  Camera,
  RotateCcw,
  RotateCw,
  Eye,
  Maximize2,
  Crop,
  Sliders,
  Heart,
  PartyPopper,
  Trophy,
  Award,
  Share2
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
import { formatImageUrl, handleImageError } from '../utils/imageUrl';
import { uploadSingleImageToImgBBWithDetails, deleteImagesFromImgBB } from '../utils/imageUploader';
import FreeCropEditor from './FreeCropEditor';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUploadSuccess: () => void;
}

interface CapturedPage {
  id: string;
  file: File;
  dataUrl: string;
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
  const [deleteUrls, setDeleteUrls] = useState<string[]>(() => {
    const raw = getDraftValue('deleteUrls', []);
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
      deleteUrls,
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
    deleteUrls,
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

  // Success Celebration Popup State
  const [successModalData, setSuccessModalData] = useState<{
    isOpen: boolean;
    totalUploads: number;
    totalLoves: number;
    cheerMessage: string;
    isPrivileged: boolean;
  } | null>(null);

  const CHEER_MESSAGES = [
    "You're a true superhero for Uttara University students!",
    "Thank you for contributing to our student community archive!",
    "Every paper you upload saves a classmate's exam preparation!",
    "Your contribution makes learning easier for everyone at UU!",
    "Awesome job! Keep sharing and inspiring fellow students!"
  ];

  // ImgBB Direct Upload State
  const imgbbKey = 'c66284ea8683ede65e71e14d201bec19';
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Mobile Direct Camera & Browse Pre-Upload Review State
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const retakeInputRef = useRef<HTMLInputElement>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [expandedPreviewUrl, setExpandedPreviewUrl] = useState<string | null>(null);

  // Image Cropping & Editing State (Free size & Preset aspect ratio boxes)
  const [croppingPageIndex, setCroppingPageIndex] = useState<number | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined); // undefined = Free aspect ratio
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, pixels: any) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleStartCrop = (index: number) => {
    setCroppingPageIndex(index);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(undefined); // default free crop
  };

  const handleApplyCrop = async () => {
    if (croppingPageIndex === null || !croppedAreaPixels) return;
    const targetPage = capturedPages[croppingPageIndex];
    if (!targetPage) return;

    setIsApplyingCrop(true);
    try {
      const { file, dataUrl } = await getCroppedImg(
        targetPage.dataUrl,
        croppedAreaPixels,
        rotation,
        targetPage.file.name || `cropped-page-${croppingPageIndex + 1}.jpg`
      );

      setCapturedPages(prev => {
        const updated = [...prev];
        updated[croppingPageIndex] = {
          id: targetPage.id,
          file,
          dataUrl
        };
        return updated;
      });

      setCroppingPageIndex(null);
      setCroppedAreaPixels(null);
    } catch (err) {
      console.error('Error cropping image:', err);
    } finally {
      setIsApplyingCrop(false);
    }
  };

  // Process files incoming from browse/drag-and-drop OR camera
  const processIncomingFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));
    const nonImageFiles = fileArray.filter(f => !f.type.startsWith('image/'));

    if (nonImageFiles.length > 0) {
      uploadFilesToImgBB(nonImageFiles);
    }

    if (imageFiles.length > 0) {
      const newPages: CapturedPage[] = [];
      let count = 0;

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          newPages.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            dataUrl
          });
          count++;
          if (count === imageFiles.length) {
            setCapturedPages(prev => [...prev, ...newPages]);
            setIsCameraModalOpen(true);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

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
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  // Handle File Change Event
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processIncomingFiles(e.target.files);
    }
  };

  // Handle Mobile Camera Photo Capture (New Page)
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processIncomingFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Trigger camera for retaking a specific page
  const handleTriggerRetake = (index: number) => {
    setRetakeIndex(index);
    if (retakeInputRef.current) {
      retakeInputRef.current.click();
    }
  };

  // Handle replacing a specific page image after retaking photo
  const handleRetakeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && retakeIndex !== null) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedPages(prev => {
          const updated = [...prev];
          if (updated[retakeIndex]) {
            updated[retakeIndex] = {
              id: updated[retakeIndex].id,
              file,
              dataUrl
            };
          }
          return updated;
        });
        setRetakeIndex(null);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  // Remove a captured page from temporary RAM state
  const handleRemoveCapturedPage = (index: number) => {
    setCapturedPages(prev => prev.filter((_, i) => i !== index));
  };

  // Confirm captured pages & upload to ImgBB
  const handleConfirmAndUploadCaptured = async () => {
    if (capturedPages.length === 0) return;
    const filesToUpload = capturedPages.map(p => p.file);
    setIsCameraModalOpen(false);
    setCapturedPages([]);
    await uploadFilesToImgBB(filesToUpload);
  };

  // Upload files sequentially to ImgBB
  async function uploadFilesToImgBB(files: FileList | File[]) {
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
    const newDeleteUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatusText(`Optimizing & uploading page ${i + 1}/${files.length}: ${file.name}...`);

        const uploadedResult = await uploadSingleImageToImgBBWithDetails(file, imgbbKey);
        newUrls.push(uploadedResult.url);
        if (uploadedResult.deleteUrl) {
          newDeleteUrls.push(uploadedResult.deleteUrl);
        }
      }

      // Add the uploaded URLs to imageUrls and deleteUrls
      setImageUrls(prev => {
        const cleaned = prev.filter(url => url.trim() !== '');
        return [...cleaned, ...newUrls];
      });

      if (newDeleteUrls.length > 0) {
        setDeleteUrls(prev => [...prev, ...newDeleteUrls]);
      }

      setNotification({ 
        type: 'success', 
        message: 'Image upload success!' 
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
        deleteUrls: deleteUrls.filter(Boolean),
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
      
      // Calculate user's total uploads and total loves
      let totalUploads = 1;
      let totalLoves = 0;
      try {
        const userQQuery = query(collection(db, 'questions'), where('uploadedByUID', '==', currentUser.uid));
        const userQSnap = await getDocs(userQQuery);
        totalUploads = userQSnap.size;
        userQSnap.forEach((docSnap) => {
          const d = docSnap.data();
          totalLoves += (d.likes || d.likedBy?.length || 0);
        });
      } catch (statErr) {
        console.error('Error fetching user stats for success popup:', statErr);
      }

      const randomCheer = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];

      setSuccessModalData({
        isOpen: true,
        totalUploads,
        totalLoves,
        cheerMessage: randomCheer,
        isPrivileged
      });
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
    setImageUrls([]);
    setDeleteUrls([]);
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

            {/* Mobile Direct Camera Capture Banner (Automatically hidden on Desktop, shown on Mobile) */}
            <div className="block sm:hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl p-3.5 shadow-md border border-indigo-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-400 text-slate-950 rounded-xl shrink-0 shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-amber-300">Camera Scanner</h4>
                </div>
              </div>

              {/* Hidden Mobile Camera Trigger Inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
              />
              <input
                ref={retakeInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleRetakeCapture}
                className="hidden"
              />

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo with Camera</span>
                </button>

                {capturedPages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="w-full py-2 px-3 bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-300" />
                    <span>Review & Manage ({capturedPages.length} Page{capturedPages.length > 1 ? 's' : ''} in RAM)</span>
                  </button>
                )}
              </div>
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
                              const removedDeleteUrl = deleteUrls[index];
                              const removedImageUrl = imageUrls[index];
                              if (removedDeleteUrl || removedImageUrl) {
                                deleteImagesFromImgBB(
                                  removedDeleteUrl ? [removedDeleteUrl] : [],
                                  removedImageUrl ? [removedImageUrl] : []
                                ).catch(() => null);
                              }
                              const next = [...imageUrls];
                              next.splice(index, 1);
                              setImageUrls(next);
                              const nextDelete = [...deleteUrls];
                              if (index < nextDelete.length) {
                                nextDelete.splice(index, 1);
                                setDeleteUrls(nextDelete);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Remove this page and delete from ImgBB"
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
                          referrerPolicy="no-referrer-when-downgrade"
                          onError={(e) => handleImageError(e, `Page ${index + 1}`)}
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

      {/* Mobile Camera Multi-Page Review & Retake Overlay Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Review Captured Question Pages</h3>
                  <p className="text-[11px] text-indigo-200">{capturedPages.length} Page(s) stored in device RAM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(false)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Check text clarity, crop margins, or retake photos before confirming upload.</span>
            </div>

            {/* Captured Pages List */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {capturedPages.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <Camera className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No pages captured yet</p>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap First Page</span>
                  </button>
                </div>
              ) : (
                capturedPages.map((item, idx) => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs rounded-md uppercase">
                        Page {idx + 1}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartCrop(idx)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>Crop / Adjust</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedPreviewUrl(item.dataUrl)}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg flex items-center gap-1 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCapturedPage(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete page"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Image Preview Container */}
                    <div className="relative h-52 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-slate-800">
                      <img 
                        src={item.dataUrl} 
                        alt={`Captured Page ${idx + 1}`} 
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Action Buttons: Crop & Retake */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartCrop(idx)}
                        className="py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>Crop Free/Box</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerRetake(idx)}
                        className="py-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake Photo</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-indigo-500" />
                <span>Snap Next Page Photo (Page {capturedPages.length + 1})</span>
              </button>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsCameraModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndUploadCaptured}
                  disabled={capturedPages.length === 0 || isUploadingFiles}
                  className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Upload {capturedPages.length} Page(s)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Free Size & Box Crop Modal Overlay */}
      {croppingPageIndex !== null && capturedPages[croppingPageIndex] && (
        <FreeCropEditor
          imageSrc={capturedPages[croppingPageIndex].dataUrl}
          pageIndex={croppingPageIndex}
          onCancel={() => setCroppingPageIndex(null)}
          onApplyCrop={({ file, dataUrl }) => {
            if (croppingPageIndex === null) return;
            setCapturedPages(prev => {
              const updated = [...prev];
              if (updated[croppingPageIndex]) {
                updated[croppingPageIndex] = {
                  ...updated[croppingPageIndex],
                  file,
                  dataUrl
                };
              }
              return updated;
            });
            setCroppingPageIndex(null);
          }}
        />
      )}

      {/* Full Image Inspection Lightbox Modal */}
      {expandedPreviewUrl && (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setExpandedPreviewUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={expandedPreviewUrl}
              alt="Full Size Inspection"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Success Celebration & Contributor Stats Modal */}
      {successModalData?.isOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-5 relative">
            
            {/* Top Confetti / Celebration Visual */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center border-4 border-emerald-500/20 animate-bounce">
                <PartyPopper className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="absolute -top-1 -right-1 bg-amber-400 p-1.5 rounded-full text-slate-950 shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            {/* Title & Status */}
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Question Uploaded Successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                {successModalData.isPrivileged
                  ? 'Your question paper has been published to the archive.'
                  : 'Submitted for verification! It will be visible to everyone soon.'}
              </p>
            </div>

            {/* Cheerful Encouraging Message Card */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-2xl text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-center gap-2">
              <Award className="w-5 h-5 text-amber-500 shrink-0" />
              <span>{successModalData.cheerMessage}</span>
            </div>

            {/* Contributor Total Stats Card */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-center">
                <div className="flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Uploads</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {successModalData.totalUploads}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Papers Contributed</p>
              </div>

              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-center">
                <div className="flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 mb-1">
                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Loves</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {successModalData.totalLoves}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Loves Received</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  resetForm();
                  onUploadSuccess();
                  onClose();
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
              >
                Done & Return to Archive
              </button>

              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  resetForm();
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Upload Another Question Paper
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
