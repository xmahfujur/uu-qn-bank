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
  Share2,
  ArrowUp,
  ArrowDown,
  FolderPlus,
  Layers
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  doc,
  getDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, Batch, Semester, ExamType } from '../types';
import { sortSemestersDescending } from '../utils/semesterSort';
import { sortDepartmentsAlphabetically } from '../utils/departmentSort';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';
import {
  uploadSingleImageToImgBBWithDetails,
  deleteImagesFromImgBB,
  generateUniquePaperFileName,
  createFileFromDataUrl,
  validateImageFile,
  runWithConcurrency,
  UPLOAD_CONCURRENCY_LIMIT
} from '../utils/imageUploader';
import FreeCropEditor from './FreeCropEditor';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUploadSuccess: () => void;
}

export type PageUploadStatus = 'pending' | 'uploading' | 'done' | 'failed';

interface CapturedPage {
  id: string;
  file?: File | null;
  dataUrl: string;
  originalName?: string;
  originalSize?: number;
  originalLastModified?: number;
  status: PageUploadStatus;
  attemptText?: string;
  uploadedUrl?: string;
  deleteUrl?: string;
  isUploading?: boolean;
  uploadError?: string;
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

  // Upload Queue & Status Configuration
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showPartialConfirm, setShowPartialConfirm] = useState(false);

  // Mobile Direct Camera & Browse Pre-Upload Review State
  const [uploadSourceMode, setUploadSourceMode] = useState<'browse' | 'camera'>('browse');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const reviewBrowseInputRef = useRef<HTMLInputElement>(null);
  const retakeCameraInputRef = useRef<HTMLInputElement>(null);
  const retakeBrowseInputRef = useRef<HTMLInputElement>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>(() => {
    const raw = getDraftValue('imageUrls', []);
    const rawDelete = getDraftValue('deleteUrls', []);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .filter((u: string) => typeof u === 'string' && u.trim() !== '')
        .map((url: string, idx: number) => ({
          id: `draft_${idx}_${Date.now()}`,
          dataUrl: formatImageUrl(url),
          originalName: `Draft Page ${idx + 1}`,
          status: 'done' as PageUploadStatus,
          uploadedUrl: formatImageUrl(url),
          deleteUrl: rawDelete[idx] || undefined,
          isUploading: false
        }));
    }
    return [];
  });
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [expandedPreviewUrl, setExpandedPreviewUrl] = useState<string | null>(null);

  const isUploadingFiles = capturedPages.some(
    (p) => p.status === 'pending' || p.status === 'uploading' || p.isUploading
  );
  const failedPagesCount = capturedPages.filter((p) => p.status === 'failed').length;
  const donePagesCount = capturedPages.filter((p) => p.status === 'done' && Boolean(p.uploadedUrl)).length;

  // Warn before closing/reloading page while an upload or Firestore submission is in progress
  useEffect(() => {
    if (!isUploadingFiles && !isSubmitting) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploadingFiles, isSubmitting]);

  // Sync imageUrls and deleteUrls automatically with capturedPages
  useEffect(() => {
    const validUploaded = capturedPages
      .map(p => p.uploadedUrl ? formatImageUrl(p.uploadedUrl.trim()) : '')
      .filter(Boolean);
    setImageUrls(validUploaded);

    const validDeletes = capturedPages
      .map(p => p.deleteUrl || '')
      .filter(Boolean);
    setDeleteUrls(validDeletes);
  }, [capturedPages]);

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
        targetPage.file?.name || `cropped-page-${croppingPageIndex + 1}.jpg`
      );

      const targetId = targetPage.id;
      setCroppingPageIndex(null);
      setCroppedAreaPixels(null);

      // Instantly update UI with cropped image
      setCapturedPages(prev => prev.map(p => p.id === targetId ? {
        ...p,
        file,
        dataUrl,
        status: 'uploading',
        isUploading: true,
        uploadError: undefined
      } : p));

      // Re-upload cropped version via /api/upload
      try {
        const res = await uploadSingleImageToImgBBWithDetails(file);
        setCapturedPages(prev => prev.map(p => p.id === targetId ? {
          ...p,
          uploadedUrl: res.url,
          deleteUrl: res.deleteUrl,
          status: 'done',
          isUploading: false,
          uploadError: undefined
        } : p));
      } catch (err: any) {
        console.error('Failed to upload cropped image:', err);
        setCapturedPages(prev => prev.map(p => p.id === targetId ? {
          ...p,
          status: 'failed',
          isUploading: false,
          uploadError: err?.message || 'Crop upload failed'
        } : p));
      }
    } catch (err) {
      console.error('Error cropping image:', err);
    } finally {
      setIsApplyingCrop(false);
    }
  };

  // Reorder page up
  const handleMovePageUp = (index: number) => {
    if (index <= 0) return;
    setCapturedPages(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  // Reorder page down
  const handleMovePageDown = (index: number) => {
    if (index >= capturedPages.length - 1) return;
    setCapturedPages(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  // Upload a single CapturedPage entry updating status strictly by page.id (preserving order)
  const uploadPageItem = async (pageId: string, fileToUpload: File) => {
    setCapturedPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              file: fileToUpload,
              status: 'uploading',
              isUploading: true,
              uploadError: undefined,
              attemptText: undefined
            }
          : p
      )
    );

    try {
      const result = await uploadSingleImageToImgBBWithDetails(fileToUpload, ({ attempt, maxAttempts }) => {
        if (attempt > 1) {
          setCapturedPages((prev) =>
            prev.map((p) =>
              p.id === pageId ? { ...p, attemptText: `Retrying (${attempt}/${maxAttempts})...` } : p
            )
          );
        }
      });

      setCapturedPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                uploadedUrl: result.url,
                deleteUrl: result.deleteUrl,
                status: 'done',
                isUploading: false,
                uploadError: undefined,
                attemptText: undefined
              }
            : p
        )
      );
      return result;
    } catch (err: any) {
      console.error('Error uploading page:', err);
      const errMsg = err?.message || 'Upload failed';
      setCapturedPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                status: 'failed',
                isUploading: false,
                uploadError: errMsg,
                attemptText: undefined
              }
            : p
        )
      );
      throw err;
    }
  };

  // Process files incoming from browse/drag-and-drop OR camera
  const processIncomingFiles = async (files: FileList | File[], source: 'browse' | 'camera' = 'browse') => {
    setUploadSourceMode(source);
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const invalidMessages: string[] = [];
    const validImageFiles: File[] = [];

    for (const rawFile of fileArray) {
      const check = validateImageFile(rawFile);
      if (!check.valid) {
        invalidMessages.push(check.error || `"${rawFile.name}" is invalid.`);
      } else {
        validImageFiles.push(rawFile);
      }
    }

    if (validImageFiles.length === 0) {
      setNotification({
        type: 'error',
        message: invalidMessages[0] || 'No valid image found. Please select JPG, PNG, WEBP, GIF, or HEIC images.'
      });
      return;
    }

    // Deduplicate against BOTH existing capturedPages AND duplicates within current selection
    const seenSignatures = new Set(
      capturedPages
        .filter((p) => p.originalName && typeof p.originalSize === 'number')
        .map((p) => `${p.originalName}_${p.originalSize}_${p.originalLastModified || 0}`)
    );

    const deduplicatedFiles: File[] = [];
    let duplicateCount = 0;

    for (const rawFile of validImageFiles) {
      const sig = `${rawFile.name}_${rawFile.size}_${rawFile.lastModified || 0}`;
      if (seenSignatures.has(sig)) {
        duplicateCount += 1;
        continue;
      }
      seenSignatures.add(sig);
      deduplicatedFiles.push(rawFile);
    }

    if (deduplicatedFiles.length === 0) {
      setNotification({
        type: 'error',
        message:
          invalidMessages[0] ||
          'Selected image(s) are already added. Duplicate selection prevented.'
      });
      return;
    }

    if (invalidMessages.length > 0) {
      setNotification({
        type: 'error',
        message: `${invalidMessages[0]}${duplicateCount > 0 ? ` (${duplicateCount} duplicate skipped.)` : ''}`
      });
    } else if (duplicateCount > 0) {
      setNotification({
        type: 'error',
        message: `${duplicateCount} duplicate file${duplicateCount > 1 ? 's' : ''} skipped.`
      });
    } else {
      setNotification(null);
    }

    // 1. Instantly create CapturedPage entries in exact original selection order with 'pending' status
    const startIndex = capturedPages.length;
    const newPages: CapturedPage[] = deduplicatedFiles.map((rawFile, i) => {
      const uniqueName = generateUniquePaperFileName(rawFile.name, startIndex + i + 1);
      const file = new File([rawFile], uniqueName, { type: rawFile.type || 'image/jpeg' });

      let localUrl = '';
      try {
        localUrl = URL.createObjectURL(file);
      } catch {
        localUrl = '';
      }

      return {
        id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`,
        file,
        dataUrl: localUrl,
        originalName: rawFile.name,
        originalSize: rawFile.size,
        originalLastModified: rawFile.lastModified,
        status: 'pending' as PageUploadStatus,
        isUploading: true
      };
    });

    setCapturedPages((prev) => [...prev, ...newPages]);

    // 2. Upload with max 2 concurrent workers preserving original selection index order
    let finishedCount = 0;
    setUploadStatusText(`Uploading 0 of ${newPages.length} pages (max ${UPLOAD_CONCURRENCY_LIMIT} at a time)...`);

    const results = await runWithConcurrency(
      newPages,
      async (page) => {
        if (!page.file) {
          throw new Error('Missing file reference');
        }
        try {
          return await uploadPageItem(page.id, page.file);
        } finally {
          finishedCount += 1;
          setUploadStatusText(`Processed ${finishedCount} of ${newPages.length} pages...`);
        }
      },
      UPLOAD_CONCURRENCY_LIMIT
    );

    const failedInBatch = results.filter((r) => r.status === 'rejected').length;
    setUploadStatusText('');

    if (failedInBatch > 0) {
      setNotification({
        type: 'error',
        message: `${failedInBatch} of ${newPages.length} page(s) failed to upload. Tap "Retry failed only" to re-upload without restarting the batch.`
      });
    }
  };

  // Retry upload for a single failed page
  const handleRetryUpload = async (pageId: string) => {
    const page = capturedPages.find((p) => p.id === pageId);
    if (!page) return;

    let targetFile = page.file;
    if (!targetFile && page.dataUrl) {
      try {
        targetFile = await createFileFromDataUrl(page.dataUrl, `page_${page.id}.jpg`);
      } catch (e) {
        console.warn('Could not reconstruct file from dataUrl:', e);
      }
    }

    if (!targetFile) {
      setNotification({
        type: 'error',
        message: 'Could not access image data to retry. Please remove this page and re-select the image.'
      });
      return;
    }

    try {
      await uploadPageItem(pageId, targetFile);
      setNotification({
        type: 'success',
        message: 'Page re-uploaded successfully!'
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Retry failed: ${err?.message || 'Network error'}`
      });
    }
  };

  // Retry ONLY failed pages in batches of max 2, keeping already uploaded pages intact
  const handleRetryFailedOnly = async () => {
    const failedList = capturedPages.filter((p) => p.status === 'failed');
    if (failedList.length === 0) return;

    setNotification(null);
    const failedIds = new Set(failedList.map((p) => p.id));
    setCapturedPages((prev) =>
      prev.map((p) =>
        failedIds.has(p.id)
          ? { ...p, status: 'pending', isUploading: true, uploadError: undefined }
          : p
      )
    );

    let finished = 0;
    setUploadStatusText(`Retrying 0 of ${failedList.length} failed pages...`);

    const results = await runWithConcurrency(
      failedList,
      async (page) => {
        let targetFile = page.file;
        if (!targetFile && page.dataUrl) {
          targetFile = await createFileFromDataUrl(page.dataUrl, `page_${page.id}.jpg`);
        }
        if (!targetFile) {
          throw new Error('Could not access image data to retry');
        }
        try {
          return await uploadPageItem(page.id, targetFile);
        } finally {
          finished += 1;
          setUploadStatusText(`Retried ${finished} of ${failedList.length} failed pages...`);
        }
      },
      UPLOAD_CONCURRENCY_LIMIT
    );

    setUploadStatusText('');
    const stillFailed = results.filter((r) => r.status === 'rejected').length;
    if (stillFailed === 0) {
      setNotification({
        type: 'success',
        message: `All ${failedList.length} failed page(s) uploaded successfully!`
      });
    } else {
      setNotification({
        type: 'error',
        message: `${stillFailed} page(s) still failed. Tap "Retry failed only" again or remove those pages.`
      });
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
      processIncomingFiles(e.dataTransfer.files, 'browse');
    }
  };

  // Handle File Change Event from main browse zone
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files, 'browse');
      e.target.value = '';
    }
  };

  // Handle Mobile Camera Photo Capture
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files, 'camera');
      e.target.value = '';
    }
  };

  // Remove a captured page
  const handleRemoveCapturedPage = (index: number) => {
    const target = capturedPages[index];
    if (target?.deleteUrl || target?.uploadedUrl) {
      deleteImagesFromImgBB(
        target.deleteUrl ? [target.deleteUrl] : [],
        target.uploadedUrl ? [target.uploadedUrl] : []
      ).catch(() => null);
    }
    setCapturedPages(prev => prev.filter((_, i) => i !== index));
  };

  // Triggers for retaking or replacing a specific page
  const handleTriggerRetakeBrowse = (index: number) => {
    setRetakeIndex(index);
    retakeBrowseInputRef.current?.click();
  };

  const handleTriggerRetakeCamera = (index: number) => {
    setRetakeIndex(index);
    retakeCameraInputRef.current?.click();
  };

  const handleRetakeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (retakeIndex === null || !e.target.files || !e.target.files[0]) return;
    const rawFile = e.target.files[0];
    e.target.value = '';
    const idx = retakeIndex;
    setRetakeIndex(null);

    const validation = validateImageFile(rawFile);
    if (!validation.valid) {
      setNotification({
        type: 'error',
        message: validation.error || 'Invalid replacement image.'
      });
      return;
    }

    const uniqueName = generateUniquePaperFileName(rawFile.name, idx + 1);
    const file = new File([rawFile], uniqueName, { type: rawFile.type || 'image/jpeg' });
    let localUrl = '';
    try {
      localUrl = URL.createObjectURL(file);
    } catch {
      localUrl = '';
    }

    const oldPage = capturedPages[idx];
    if (!oldPage) return;

    if (oldPage.deleteUrl || oldPage.uploadedUrl) {
      deleteImagesFromImgBB(
        oldPage.deleteUrl ? [oldPage.deleteUrl] : [],
        oldPage.uploadedUrl ? [oldPage.uploadedUrl] : []
      ).catch(() => null);
    }

    setCapturedPages((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              file,
              dataUrl: localUrl,
              originalName: rawFile.name,
              originalSize: rawFile.size,
              originalLastModified: rawFile.lastModified,
              status: 'uploading',
              uploadedUrl: undefined,
              deleteUrl: undefined,
              isUploading: true,
              uploadError: undefined
            }
          : p
      )
    );

    try {
      await uploadPageItem(oldPage.id, file);
    } catch {
      // uploadPageItem updates status to 'failed' with error message
    }
  };

  const handleConfirmAndUploadCaptured = () => {
    setIsCameraModalOpen(false);
  };

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

  // Handle form submission (blocks until all pages succeed OR user confirms partial upload)
  async function handleSubmit(e?: React.FormEvent, allowPartialConfirm = false) {
    if (e) e.preventDefault();
    if (!currentUser) {
      setNotification({ type: 'error', message: 'You must be signed in to upload.' });
      return;
    }

    // Block saving while any upload is pending or active
    if (capturedPages.some((p) => p.status === 'pending' || p.status === 'uploading' || p.isUploading)) {
      setNotification({
        type: 'error',
        message: 'Images are still uploading. Please wait for all pages to finish before submitting.'
      });
      return;
    }

    const failedPages = capturedPages.filter((p) => p.status === 'failed' || (!p.uploadedUrl && p.uploadError));
    const filteredImageUrls = capturedPages
      .filter((p) => p.status === 'done' || (!p.uploadError && Boolean(p.uploadedUrl)))
      .map((p) => (p.uploadedUrl ? formatImageUrl(p.uploadedUrl.trim()) : ''))
      .filter((u) => u && !u.startsWith('blob:'));

    if (!selectedDept || !selectedBatch || !selectedSemester || !courseName) {
      setNotification({
        type: 'error',
        message: 'Please select Department, Batch, Semester, and enter Course Name before submitting.'
      });
      return;
    }

    if (filteredImageUrls.length === 0) {
      setNotification({
        type: 'error',
        message:
          failedPages.length > 0
            ? 'All selected pages failed to upload. Please tap "Retry failed only" before saving.'
            : 'Please upload at least one valid question page image.'
      });
      return;
    }

    // Require explicit user confirmation before saving if some pages failed
    if (failedPages.length > 0 && !allowPartialConfirm) {
      setShowPartialConfirm(true);
      return;
    }

    setShowPartialConfirm(false);
    setIsSubmitting(true);
    setNotification(null);

    try {
      const isPrivileged = currentUser.role === 'super_admin' || currentUser.role === 'moderator';
      const initialStatus = isPrivileged ? 'published' : 'pending';

      // Guarantee freshest authoritative username from Firestore to eliminate any chance of stale session state
      let resolvedUsername = currentUser.username || 'Anonymous';
      if (currentUser.email?.toLowerCase() === 'mr074770@gmail.com') {
        resolvedUsername = 'mahfujur';
      }
      try {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (uData?.username) {
            resolvedUsername = uData.username;
          }
        }
      } catch (err) {
        console.warn('Could not re-fetch username from Firestore before upload, using current user state:', err);
      }

      const questionData = {
        courseCode: courseCode.trim() ? courseCode.trim().toUpperCase() : 'N/A',
        courseName: courseName.trim(),
        teacher: teacher.trim() || 'Not Specified',
        imageUrl: filteredImageUrls[0],
        imageUrls: filteredImageUrls,
        deleteUrls: Array.from(new Set([
          ...deleteUrls,
          ...capturedPages.map(p => p.deleteUrl || '')
        ])).filter(Boolean),
        pdfUrl: pdfUrl.trim() || null,
        departmentId: selectedDept,
        batchId: selectedBatch,
        semesterId: selectedSemester,
        examType: examType,
        uploadedByUID: currentUser.uid,
        uploadedByUsername: resolvedUsername,
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
    setCapturedPages([]);
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
              {capturedPages.length > 0 && (
                <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-extrabold rounded-full">
                  {capturedPages.length} {capturedPages.length === 1 ? 'Page' : 'Pages'} Selected
                </span>
              )}
            </div>

            {/* Hidden Permanent Native Inputs (Accessible via <label htmlFor="..."> on iOS/Android/Desktop) */}
            <input
              id="mobile-camera-capture-input"
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="sr-only"
            />
            <input
              id="main-paper-file-input"
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp"
              onChange={handleFileChange}
              className="sr-only"
            />
            <input
              id="retake-camera-input"
              ref={retakeCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleRetakeCapture}
              className="sr-only"
            />
            <input
              id="retake-browse-input"
              ref={retakeBrowseInputRef}
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp"
              onChange={handleRetakeCapture}
              className="sr-only"
            />
            <input
              ref={reviewBrowseInputRef}
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processIncomingFiles(e.target.files, 'browse');
                  e.target.value = '';
                }
              }}
              className="sr-only"
            />

            {/* Mobile Scanner Banner (Direct Camera & Gallery access) */}
            <div className="block sm:hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl p-3.5 shadow-md border border-indigo-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-400 text-slate-950 rounded-xl shrink-0 shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-300">Exam Paper Scanner</h4>
                    <p className="text-[10px] text-indigo-200">Snap clear photos of question pages</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label
                  htmlFor="mobile-camera-capture-input"
                  className="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98] cursor-pointer text-center"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Take Photo</span>
                </label>

                <label
                  htmlFor="main-paper-file-input"
                  className="py-2.5 px-3 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer text-center border border-white/20"
                >
                  <FolderPlus className="w-4 h-4 shrink-0 text-amber-300" />
                  <span>Select Images</span>
                </label>
              </div>

              {capturedPages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCameraModalOpen(true)}
                  className="w-full mt-2.5 py-2 px-3 bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-300" />
                  <span>Open Full Organizer ({capturedPages.length} Page{capturedPages.length > 1 ? 's' : ''})</span>
                </button>
              )}
            </div>

            {/* Desktop Drag & Drop / Mobile Tap Dropzone */}
            <label
              htmlFor="main-paper-file-input"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer block ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' 
                  : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 hover:border-indigo-400'
              } ${isUploadingFiles ? 'opacity-80' : ''}`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                {isUploadingFiles ? (
                  <>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{uploadStatusText || 'Uploading pages...'}</p>
                    <p className="text-[11px] text-slate-400">Previews are ready below! Uploading in background...</p>
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
                        or <span className="text-indigo-600 dark:text-indigo-400 font-bold underline">tap to browse images</span> (select one or multiple images)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </label>

            {/* Immediate Paper Pages Preview Grid */}
            {capturedPages.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Page Previews ({capturedPages.length} {capturedPages.length === 1 ? 'Page' : 'Pages'})
                    </label>
                    <p className="text-[10px] text-slate-500">Live preview of your pages. You can crop, reorder, or scan with AI.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Organizer</span>
                  </button>
                </div>

                {/* Per-file Progress Queue (Pending / Uploading / Done / Failed + Retry Failed Only) */}
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Upload Progress ({donePagesCount}/{capturedPages.length} ready{failedPagesCount > 0 ? `, ${failedPagesCount} failed` : ''})
                    </span>
                    {failedPagesCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRetryFailedOnly}
                        disabled={isUploadingFiles}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry failed only ({failedPagesCount})</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900 text-[11px]">
                    {capturedPages.map((page, index) => (
                      <div key={page.id} className="py-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            P{index + 1}
                          </span>
                          <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                            {page.originalName || page.file?.name || `Page ${index + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {page.status === 'pending' && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded">
                              pending
                            </span>
                          )}
                          {page.status === 'uploading' && (
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold rounded flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              {page.attemptText || 'uploading'}
                            </span>
                          )}
                          {page.status === 'done' && (
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              done
                            </span>
                          )}
                          {page.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetryUpload(page.id)}
                              className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold rounded flex items-center gap-1 cursor-pointer"
                              title={page.uploadError || 'Retry this page'}
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>failed · retry</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {capturedPages.map((page, index) => {
                    const previewSrc = page.dataUrl || (page.uploadedUrl ? formatImageUrl(page.uploadedUrl) : '');
                    return (
                      <div 
                        key={page.id || index} 
                        className="group relative bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 transition-all hover:border-indigo-500/50"
                      >
                        {/* Header: Page Badge & Controls */}
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-[11px] font-bold rounded-md">
                            Page {index + 1}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            {/* AI Scan button for page 1 */}
                            {index === 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAIExtract();
                                }}
                                disabled={isAnalyzing || (!page.uploadedUrl && !page.dataUrl)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
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

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCapturedPage(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Delete page"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* High-Res Thumbnail Preview with Instant Local Rendering & Overlay Status */}
                        <div 
                          onClick={() => previewSrc && setExpandedPreviewUrl(previewSrc)}
                          className="relative h-44 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1 cursor-pointer group-hover:border-indigo-500/40 transition-colors"
                        >
                          {previewSrc ? (
                            <img 
                              src={previewSrc} 
                              alt={`Page ${index + 1} Preview`} 
                              className="w-full h-full object-contain rounded"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (page.file) {
                                  try {
                                    e.currentTarget.src = URL.createObjectURL(page.file);
                                    return;
                                  } catch {}
                                }
                                if (page.uploadedUrl && e.currentTarget.src !== formatImageUrl(page.uploadedUrl)) {
                                  e.currentTarget.src = formatImageUrl(page.uploadedUrl);
                                  return;
                                }
                                handleImageError(e, `Page ${index + 1}`);
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
                              <ImageIcon className="w-8 h-8 opacity-40 mb-1" />
                              <span>Loading preview...</span>
                            </div>
                          )}

                          {/* Status Badge Overlay */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                            {page.status === 'pending' ? (
                              <span className="px-2 py-1 bg-slate-950/80 backdrop-blur-md text-slate-200 border border-slate-600/40 text-[10px] font-bold rounded-md flex items-center gap-1.5 shadow-sm">
                                Pending...
                              </span>
                            ) : page.status === 'uploading' || page.isUploading ? (
                              <span className="px-2 py-1 bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-400/30 text-[10px] font-bold rounded-md flex items-center gap-1.5 shadow-sm">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {page.attemptText || 'Uploading...'}
                              </span>
                            ) : page.status === 'failed' || page.uploadError ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleRetryUpload(page.id);
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleRetryUpload(page.id);
                                }}
                                className="pointer-events-auto px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-rose-400/50"
                                title="Tap to retry upload"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Failed · Tap to Retry</span>
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-950/80 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-md flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Ready
                              </span>
                            )}

                            <span className="pointer-events-auto px-1.5 py-0.5 bg-slate-950/80 hover:bg-slate-900 text-white/80 text-[9px] rounded font-medium flex items-center gap-1 border border-slate-700/60 shadow-sm backdrop-blur-sm">
                              <Maximize2 className="w-2.5 h-2.5" /> Tap to view
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dual Add More Pages Buttons right below previews */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <label
                    htmlFor="mobile-camera-capture-input"
                    className="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>+ Snap Next Page (Camera)</span>
                  </label>
                  <label
                    htmlFor="main-paper-file-input"
                    className="py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>+ Add More Pages (Browse)</span>
                  </label>
                </div>
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
            onClick={() => handleSubmit()}
            disabled={isSubmitting || isUploadingFiles}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/15 flex items-center gap-1.5 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Paper...
              </>
            ) : isUploadingFiles ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading Pages...
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

      {/* Question Pages Review & Reorder Overlay Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl shadow-sm">
                  {uploadSourceMode === 'camera' ? <Camera className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Review Question Pages</h3>
                  <p className="text-[11px] text-indigo-200">
                    {capturedPages.length} Page{capturedPages.length !== 1 ? 's' : ''} selected • Check order & crop before uploading
                  </p>
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
              <span>Use arrows to re-align page order, adjust crops, or add more pages.</span>
            </div>

            {/* Captured Pages List */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {capturedPages.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <ImageIcon className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No pages selected yet</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => reviewBrowseInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>Browse Files</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap with Camera</span>
                    </button>
                  </div>
                </div>
              ) : (
                capturedPages.map((item, idx) => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs rounded-md uppercase">
                          Page {idx + 1}
                        </span>
                        
                        {/* Page Order Re-alignment Controls */}
                        <div className="flex items-center gap-0.5 ml-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleMovePageUp(idx)}
                            disabled={idx === 0}
                            className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Move Page Up (Earlier)"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePageDown(idx)}
                            disabled={idx === capturedPages.length - 1}
                            className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Move Page Down (Later)"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartCrop(idx)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>Crop</span>
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
                        alt={`Question Page ${idx + 1}`} 
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Action Buttons: Crop, Replace File, Retake Camera */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartCrop(idx)}
                        className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>Crop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerRetakeBrowse(idx)}
                        className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Replace File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerRetakeCamera(idx)}
                        className="py-1.5 px-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Retake</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
              {/* Dual Next Page Triggers: Mode-aware */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => reviewBrowseInputRef.current?.click()}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    uploadSourceMode === 'browse'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm ring-2 ring-indigo-500/20'
                      : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <FolderPlus className="w-4 h-4 text-indigo-400" />
                  <span>Browse Next Page (Page {capturedPages.length + 1})</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    uploadSourceMode === 'camera'
                      ? 'bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black shadow-sm ring-2 ring-amber-400/30'
                      : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <Camera className="w-4 h-4 text-amber-500" />
                  <span>Snap Next Page Photo (Page {capturedPages.length + 1})</span>
                </button>
              </div>

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
                  className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
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
          onApplyCrop={async ({ file, dataUrl }) => {
            if (croppingPageIndex === null) return;
            const target = capturedPages[croppingPageIndex];
            if (!target) return;
            setCroppingPageIndex(null);

            setCapturedPages((prev) =>
              prev.map((p) =>
                p.id === target.id
                  ? {
                      ...p,
                      file,
                      dataUrl,
                      status: 'uploading',
                      uploadedUrl: undefined,
                      deleteUrl: undefined,
                      isUploading: true,
                      uploadError: undefined
                    }
                  : p
              )
            );

            try {
              await uploadPageItem(target.id, file);
            } catch {
              // Status marked failed inside uploadPageItem
            }
          }}
        />
      )}

      {/* Partial Upload Confirmation Modal (never silently save half-uploaded paper) */}
      {showPartialConfirm && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Some Pages Failed to Upload
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {failedPagesCount} of {capturedPages.length} page(s) failed to upload. Do you want to save only the {donePagesCount} uploaded page(s), or go back and retry the failed pages first?
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPartialConfirm(false)}
                className="w-full sm:flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Go Back & Retry Failed
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(undefined, true)}
                className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Save {donePagesCount} Page(s) Anyway
              </button>
            </div>
          </div>
        </div>
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
