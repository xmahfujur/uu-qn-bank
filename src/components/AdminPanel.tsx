import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Users, 
  FileText, 
  Flag, 
  BarChart3, 
  FolderTree, 
  Settings,
  Shield,
  Search,
  Check,
  AlertTriangle,
  Loader2,
  Lock,
  Unlock,
  CheckCircle,
  Eye,
  ArrowRight,
  Pencil,
  Download,
  Heart,
  GraduationCap,
  Mail,
  Phone,
  Star,
  ScrollText,
  History,
  Upload,
  Camera,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, Batch, Semester, QuestionPaper, Report, UserProfile, Faculty, AuditLog } from '../types';
import EditQuestionModal from './EditQuestionModal';
import AuditLogsView from './AuditLogsView';
import { compareSemesterNames, sortSemestersDescending } from '../utils/semesterSort';
import { sortDepartmentsAlphabetically } from '../utils/departmentSort';
import { deleteQuestionWithImages } from '../utils/deleteQuestion';
import { recordAuditLog } from '../utils/auditLogger';
import { uploadSingleImageToImgBB } from '../utils/imageUploader';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';

interface AdminPanelProps {
  currentUser: any;
  onNavigateToQuestion: (questionId: string) => void;
}

export default function AdminPanel({ currentUser, onNavigateToQuestion }: AdminPanelProps) {
  // Navigation inside Admin Panel with session memory so changing items never resets view
  const [activeTab, setActiveTab] = useState<'analytics' | 'hierarchy' | 'questions' | 'users' | 'reports' | 'faculties' | 'logs'>(() => {
    try {
      const saved = sessionStorage.getItem('admin_active_tab');
      if (saved && ['analytics', 'hierarchy', 'questions', 'users', 'reports', 'faculties', 'logs'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return 'analytics';
  });

  const handleTabChange = (tab: 'analytics' | 'hierarchy' | 'questions' | 'users' | 'reports' | 'faculties' | 'logs') => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem('admin_active_tab', tab);
    } catch (e) {}
    setSearchQuery('');
  };

  // Loaders & Async Action State
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAssigningSemesters, setIsAssigningSemesters] = useState(false);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [isUpdatingFaculty, setIsUpdatingFaculty] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingEditPhoto, setIsUploadingEditPhoto] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const [showEditManualUrlInput, setShowEditManualUrlInput] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verifyingPaperId, setVerifyingPaperId] = useState<string | null>(null);

  // Core Data Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [questions, setQuestions] = useState<QuestionPaper[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Form states for adding Faculty
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyDesignation, setNewFacultyDesignation] = useState('');
  const [newFacultyDeptId, setNewFacultyDeptId] = useState('');
  const [newFacultyImgUrl, setNewFacultyImgUrl] = useState('');
  const [newFacultyPhone, setNewFacultyPhone] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');

  // Editing Faculty states
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyDesignation, setEditFacultyDesignation] = useState('');
  const [editFacultyDeptId, setEditFacultyDeptId] = useState('');
  const [editFacultyImgUrl, setEditFacultyImgUrl] = useState('');
  const [editFacultyPhone, setEditFacultyPhone] = useState('');
  const [editFacultyEmail, setEditFacultyEmail] = useState('');

  // Edit Question modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionPaper | null>(null);

  // Selection states for hierarchies
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDeptForSemester, setSelectedDeptForSemester] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Creation/Edit Dialog States
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newBatchName, setNewBatchName] = useState('');
  const [customSemesterName, setCustomSemesterName] = useState('');
  const [customOptionList, setCustomOptionList] = useState<string[]>([]);
  const [checkedSemesterNames, setCheckedSemesterNames] = useState<string[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paperStatusFilter, setPaperStatusFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('pending');
  const [feedbackPaperId, setFeedbackPaperId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Custom confirmation and prompt dialog to bypass iframe restrictions
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: (inputText?: string) => void | Promise<void>;
    requireInput?: boolean;
    inputLabel?: string;
    inputPlaceholder?: string;
    inputValue?: string;
  } | null>(null);
  const [dialogInputText, setDialogInputText] = useState('');

  // Real-time synchronization across all platform collections
  useEffect(() => {
    let initialCount = 0;
    const markLoaded = () => {
      initialCount++;
      if (initialCount >= 4) {
        setInitialLoading(false);
      }
    };

    // 1. Departments Listener
    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      const depts: Department[] = [];
      snap.forEach(doc => depts.push({ id: doc.id, ...doc.data() } as Department));
      setDepartments(sortDepartmentsAlphabetically(depts));
      markLoaded();
    }, (err) => {
      console.error('Error in departments listener:', err);
      markLoaded();
    });

    // 2. Batches Listener
    const unsubBatches = onSnapshot(collection(db, 'batches'), (snap) => {
      const bList: Batch[] = [];
      snap.forEach(doc => bList.push({ id: doc.id, ...doc.data() } as Batch));
      setBatches(bList);
      markLoaded();
    }, (err) => {
      console.error('Error in batches listener:', err);
      markLoaded();
    });

    // 3. Semesters Listener
    const unsubSemesters = onSnapshot(collection(db, 'semesters'), (snap) => {
      const sList: Semester[] = [];
      snap.forEach(doc => sList.push({ id: doc.id, ...doc.data() } as Semester));
      setSemesters(sortSemestersDescending(sList));
      markLoaded();
    }, (err) => {
      console.error('Error in semesters listener:', err);
      markLoaded();
    });

    // 4. Questions Listener
    const unsubQuestions = onSnapshot(collection(db, 'questions'), (snap) => {
      const qList: QuestionPaper[] = [];
      snap.forEach(doc => qList.push({ id: doc.id, ...doc.data() } as QuestionPaper));
      setQuestions(qList);
      markLoaded();
    }, (err) => {
      console.error('Error in questions listener:', err);
      markLoaded();
    });

    // 5. Users Listener
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uList: UserProfile[] = [];
      snap.forEach(doc => uList.push({ uid: doc.id, ...doc.data() } as any as UserProfile));
      setUsers(uList);
    }, (err) => {
      console.error('Error in users listener:', err);
    });

    // 6. Reports Listener
    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      const rList: Report[] = [];
      snap.forEach(doc => rList.push({ id: doc.id, ...doc.data() } as Report));
      setReports(rList);
    }, (err) => {
      console.error('Error in reports listener:', err);
    });

    // 7. Faculties Listener
    const unsubFaculties = onSnapshot(collection(db, 'faculties'), (snap) => {
      const facList: Faculty[] = [];
      snap.forEach(doc => facList.push({ id: doc.id, ...doc.data() } as Faculty));
      setFaculties(facList);
    }, (err) => {
      console.error('Error in faculties listener:', err);
    });

    // 8. Audit Logs Listener
    const unsubAudit = onSnapshot(collection(db, 'audit_logs'), (snap) => {
      const logList: AuditLog[] = [];
      snap.forEach(doc => logList.push({ id: doc.id, ...doc.data() } as AuditLog));
      logList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(logList);
    }, (err) => {
      console.warn('Error in audit logs listener:', err);
    });

    return () => {
      unsubDepts();
      unsubBatches();
      unsubSemesters();
      unsubQuestions();
      unsubUsers();
      unsubReports();
      unsubFaculties();
      unsubAudit();
    };
  }, []);

  function showNotif(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }

  // --- HIERARCHY MANAGEMENT ---

  async function handleCreateDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptCode.trim()) {
      showNotif('error', 'Department name and code are required.');
      return;
    }
    const name = newDeptName.trim();
    const code = newDeptCode.trim().toUpperCase();
    const tempId = `temp_d_${Date.now()}`;
    const newDept: Department = {
      id: tempId,
      name,
      code,
      createdAt: new Date().toISOString()
    };

    // 1. Instant optimistic local state update
    setDepartments(prev => sortDepartmentsAlphabetically([...prev.filter(d => d.id !== tempId), newDept]));
    setNewDeptName('');
    setNewDeptCode('');
    showNotif('success', `Department "${name}" created.`);

    try {
      const docRef = await addDoc(collection(db, 'departments'), {
        name,
        code,
        createdAt: newDept.createdAt
      });

      // Seamlessly map temp ID to Firestore document ID
      setDepartments(prev => prev.map(d => d.id === tempId ? { ...d, id: docRef.id } : d));

      // Asynchronous non-blocking audit logging
      recordAuditLog({
        category: 'Hierarchy',
        action: 'CREATE_DEPARTMENT',
        details: `Created new department "${name}" (${code})`,
        targetId: docRef.id,
        targetName: name,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Admin',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Admin',
        metadata: { code }
      }).catch(console.warn);
    } catch (err: any) {
      setDepartments(prev => prev.filter(d => d.id !== tempId));
      showNotif('error', err.message || 'Failed to create department');
    }
  }

  async function handleDeleteDepartment(deptId: string) {
    const targetDept = departments.find(d => d.id === deptId);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Department',
      message: 'Are you sure you want to delete this department? All associated papers/batches will remain but lose parent context.',
      confirmText: 'Delete Department',
      onConfirm: async () => {
        // Immediately close dialog so UI never freezes
        setConfirmDialog(null);
        // Instant optimistic removal
        setDepartments(prev => prev.filter(d => d.id !== deptId));
        showNotif('success', 'Department deleted.');

        try {
          await deleteDoc(doc(db, 'departments', deptId));
          recordAuditLog({
            category: 'Hierarchy',
            action: 'DELETE_DEPARTMENT',
            details: `Deleted department "${targetDept?.name || deptId}"`,
            targetId: deptId,
            targetName: targetDept?.name || deptId,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetDept) setDepartments(prev => sortDepartmentsAlphabetically([...prev, targetDept]));
          showNotif('error', err.message || 'Failed to delete department');
        }
      }
    });
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeptId || !newBatchName.trim()) {
      showNotif('error', 'Please select a department and enter batch name.');
      return;
    }
    const name = newBatchName.trim();
    const deptId = selectedDeptId;
    const tempId = `temp_b_${Date.now()}`;
    const newBatch: Batch = {
      id: tempId,
      departmentId: deptId,
      name,
      createdAt: new Date().toISOString()
    };

    // Instant optimistic addition
    setBatches(prev => [...prev.filter(b => b.id !== tempId), newBatch]);
    setNewBatchName('');
    showNotif('success', `Batch "${name}" created.`);

    const targetDept = departments.find(d => d.id === deptId);
    try {
      const docRef = await addDoc(collection(db, 'batches'), {
        departmentId: deptId,
        name,
        createdAt: newBatch.createdAt
      });

      setBatches(prev => prev.map(b => b.id === tempId ? { ...b, id: docRef.id } : b));

      recordAuditLog({
        category: 'Hierarchy',
        action: 'CREATE_BATCH',
        details: `Created batch "${name}" for department "${targetDept?.name || deptId}"`,
        targetId: docRef.id,
        targetName: name,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Admin',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Admin',
        metadata: { departmentId: deptId, departmentName: targetDept?.name }
      }).catch(console.warn);
    } catch (err: any) {
      setBatches(prev => prev.filter(b => b.id !== tempId));
      showNotif('error', err.message || 'Failed to create batch');
    }
  }

  async function handleDeleteBatch(batchId: string) {
    const targetBatch = batches.find(b => b.id === batchId);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Batch',
      message: 'Are you sure you want to delete this batch?',
      confirmText: 'Delete Batch',
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setBatches(prev => prev.filter(b => b.id !== batchId));
        showNotif('success', 'Batch deleted.');

        try {
          await deleteDoc(doc(db, 'batches', batchId));
          recordAuditLog({
            category: 'Hierarchy',
            action: 'DELETE_BATCH',
            details: `Deleted batch "${targetBatch?.name || batchId}"`,
            targetId: batchId,
            targetName: targetBatch?.name || batchId,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetBatch) setBatches(prev => [...prev, targetBatch]);
          showNotif('error', err.message || 'Failed to delete batch');
        }
      }
    });
  }

  function handleAddCustomOption() {
    const trimmed = customSemesterName.trim();
    if (!trimmed) return;
    
    // Extract default options & existing unique options
    const uniqueSemesterNames = Array.from(new Set(semesters.map(s => (s?.name || '').trim()))).filter(Boolean);
    const defaultSemesterNames = [
      '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
      '5th Semester', '6th Semester', '7th Semester', '8th Semester',
      'Spring 2025', 'Summer 2025', 'Fall 2025',
      'Spring 2026', 'Summer 2026', 'Fall 2026',
      'Spring 2027', 'Summer 2027', 'Fall 2027'
    ];
    const currentOptions = Array.from(new Set([...uniqueSemesterNames, ...defaultSemesterNames, ...customOptionList]));
    
    // Check if it already exists in option list (case-insensitive)
    const exists = currentOptions.some(opt => opt.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setCustomOptionList(prev => [...prev, trimmed]);
    }
    
    // Automatically check it
    const matchName = currentOptions.find(opt => opt.toLowerCase() === trimmed.toLowerCase()) || trimmed;
    if (!checkedSemesterNames.includes(matchName)) {
      setCheckedSemesterNames(prev => [...prev, matchName]);
    }
    setCustomSemesterName('');
    showNotif('success', `Added custom option "${trimmed}" to the list!`);
  }

  async function handleCreateSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBatchId) {
      showNotif('error', 'Please select a target batch first.');
      return;
    }
    
    if (checkedSemesterNames.length === 0) {
      showNotif('error', 'Please select or add at least one semester checkbox to assign.');
      return;
    }

    const targetBatch = batches.find(b => b.id === selectedBatchId);
    const toAssign = [...checkedSemesterNames];
    setIsAssigningSemesters(true);

    // Instant optimistic update for all checked semesters
    const optimisticSems: Semester[] = toAssign.map((semName, i) => ({
      id: `temp_sem_${Date.now()}_${i}`,
      batchId: selectedBatchId,
      name: semName.trim(),
      createdAt: new Date().toISOString()
    }));

    setSemesters(prev => sortSemestersDescending([...prev, ...optimisticSems]));
    setCheckedSemesterNames([]);
    setCustomSemesterName('');
    showNotif('success', `Assigned ${toAssign.length} semester(s) to ${targetBatch?.name || 'batch'}!`);

    try {
      let addedCount = 0;
      for (const semName of toAssign) {
        const formattedName = semName.trim();
        const exists = semesters.some(s => s.batchId === selectedBatchId && (s?.name || '').toLowerCase() === formattedName.toLowerCase());
        if (!exists) {
          await addDoc(collection(db, 'semesters'), {
            batchId: selectedBatchId,
            name: formattedName,
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }

      recordAuditLog({
        category: 'Hierarchy',
        action: 'ASSIGN_SEMESTERS',
        details: `Assigned ${addedCount} semester(s) [${toAssign.join(', ')}] to batch "${targetBatch?.name || selectedBatchId}"`,
        targetId: selectedBatchId,
        targetName: targetBatch?.name || selectedBatchId,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Admin',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Admin',
        metadata: { addedCount, semesters: toAssign }
      }).catch(console.warn);
    } catch (err: any) {
      // Revert temporary items on failure
      setSemesters(prev => prev.filter(s => !s.id.startsWith('temp_sem_')));
      showNotif('error', err.message || 'Failed to assign semesters');
    } finally {
      setIsAssigningSemesters(false);
    }
  }

  async function handleDeleteSemester(semId: string) {
    const targetSem = semesters.find(s => s.id === semId);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Semester',
      message: 'Are you sure you want to delete this semester folder?',
      confirmText: 'Delete Semester',
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setSemesters(prev => prev.filter(s => s.id !== semId));
        showNotif('success', 'Semester deleted.');

        try {
          await deleteDoc(doc(db, 'semesters', semId));
          recordAuditLog({
            category: 'Hierarchy',
            action: 'DELETE_SEMESTER',
            details: `Deleted semester folder "${targetSem?.name || semId}"`,
            targetId: semId,
            targetName: targetSem?.name || semId,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetSem) setSemesters(prev => sortSemestersDescending([...prev, targetSem]));
          showNotif('error', err.message || 'Failed to delete semester');
        }
      }
    });
  }

  // --- ACTIONS ON QUESTIONS ---

  async function handleDeleteQuestion(id: string) {
    const targetQuestion = questions.find(q => q.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Question Paper',
      message: 'Delete this question paper permanently? All uploaded images will also be automatically removed from ImgBB.',
      confirmText: 'Delete Paper & Images',
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setQuestions(prev => prev.filter(q => q.id !== id));
        showNotif('success', 'Question paper deleted.');

        try {
          const res = await deleteQuestionWithImages(targetQuestion || { id });
          if (!res.success) {
            console.warn('Delete warning:', res.error);
          }

          recordAuditLog({
            category: 'Papers',
            action: 'DELETE_PAPER',
            details: `Permanently deleted question paper "${targetQuestion?.courseName || 'Unknown'}" (${targetQuestion?.courseCode || id}) with ${targetQuestion?.images?.length || 0} images`,
            targetId: id,
            targetName: `${targetQuestion?.courseName || ''} (${targetQuestion?.courseCode || ''})`,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetQuestion) setQuestions(prev => [...prev, targetQuestion]);
          showNotif('error', err.message || 'Failed to delete question paper');
        }
      }
    });
  }

  // --- ACTIONS ON REPORTS ---

  async function handleDismissReport(reportId: string) {
    const targetReport = reports.find(r => r.id === reportId);
    // Instant optimistic update
    setReports(prev => prev.filter(r => r.id !== reportId));
    showNotif('success', 'Report dismissed.');

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      recordAuditLog({
        category: 'Reports',
        action: 'DISMISS_REPORT',
        details: `Dismissed user report on question paper ID: ${targetReport?.questionId || 'Unknown'} (Reason: ${targetReport?.reason || 'N/A'})`,
        targetId: reportId,
        targetName: `Report for Paper: ${targetReport?.questionId}`,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Moderator',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Moderator'
      }).catch(console.warn);
    } catch (err: any) {
      if (targetReport) setReports(prev => [...prev, targetReport]);
      showNotif('error', err.message || 'Failed to dismiss report');
    }
  }

  async function handleResolveReport(questionId: string, reportId: string) {
    const targetQuestion = questions.find(q => q.id === questionId);
    const targetReport = reports.find(r => r.id === reportId);
    setConfirmDialog({
      isOpen: true,
      title: 'Resolve Report',
      message: 'Resolve report by deleting the question paper permanently? All uploaded images will also be deleted from ImgBB.',
      confirmText: 'Resolve & Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        setReports(prev => prev.filter(r => r.id !== reportId));
        showNotif('success', 'Report resolved: Question paper and images deleted.');

        try {
          const res = await deleteQuestionWithImages(targetQuestion || { id: questionId });
          if (!res.success) {
            console.warn('Resolve error:', res.error);
          }
          await deleteDoc(doc(db, 'reports', reportId));

          recordAuditLog({
            category: 'Reports',
            action: 'RESOLVE_REPORT_DELETE',
            details: `Resolved report by permanently deleting question paper "${targetQuestion?.courseName || questionId}" (Reported reason: ${targetReport?.reason || 'N/A'})`,
            targetId: questionId,
            targetName: targetQuestion?.courseName || questionId,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Moderator',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Moderator'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetQuestion) setQuestions(prev => [...prev, targetQuestion]);
          if (targetReport) setReports(prev => [...prev, targetReport]);
          showNotif('error', err.message || 'Failed to resolve report');
        }
      }
    });
  }

  // --- ACTIONS ON USERS ---

  async function handleToggleBanUser(userId: string, isCurrentlyBanned: boolean) {
    const action = isCurrentlyBanned ? 'Unban' : 'Ban';
    const targetUser = users.find(u => u.uid === userId);
    setConfirmDialog({
      isOpen: true,
      title: `${action} User`,
      message: `Are you sure you want to ${action} this user?`,
      confirmText: `${action} User`,
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: isCurrentlyBanned ? 'active' : 'banned' } : u));
        showNotif('success', `User ${isCurrentlyBanned ? 'unbanned' : 'banned'} successfully.`);

        try {
          await updateDoc(doc(db, 'users', userId), {
            status: isCurrentlyBanned ? 'active' : 'banned'
          });

          recordAuditLog({
            category: 'Users',
            action: isCurrentlyBanned ? 'UNBAN_USER' : 'BAN_USER',
            details: `${isCurrentlyBanned ? 'Unbanned' : 'Banned'} user account "${targetUser?.username || 'User'}" (${targetUser?.email || userId})`,
            targetId: userId,
            targetName: targetUser?.username || targetUser?.email || userId,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetUser) setUsers(prev => prev.map(u => u.uid === userId ? targetUser : u));
          showNotif('error', err.message || `Failed to ${action.toLowerCase()} user`);
        }
      }
    });
  }

  async function handleChangeUserRole(userId: string, newRole: 'super_admin' | 'moderator' | 'user') {
    if (userId === currentUser?.uid) {
      showNotif('error', 'You cannot change your own role.');
      return;
    }
    const targetUser = users.find(u => u.uid === userId);
    const roleLabel = newRole === 'super_admin' ? 'Super Admin' : newRole === 'moderator' ? 'Moderator (Semi-Admin)' : 'Student';
    setConfirmDialog({
      isOpen: true,
      title: 'Update User Role',
      message: `Are you sure you want to change this user's role to ${roleLabel}?`,
      confirmText: 'Update Role',
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
        showNotif('success', `User role updated to ${roleLabel} successfully.`);

        try {
          await updateDoc(doc(db, 'users', userId), {
            role: newRole
          });

          recordAuditLog({
            category: 'Users',
            action: 'CHANGE_USER_ROLE',
            details: `Changed role of user "${targetUser?.username || 'User'}" (${targetUser?.email || userId}) to ${roleLabel}`,
            targetId: userId,
            targetName: targetUser?.username || targetUser?.email || userId,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Super Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Super Admin',
            metadata: { previousRole: targetUser?.role, newRole }
          }).catch(console.warn);
        } catch (err: any) {
          if (targetUser) setUsers(prev => prev.map(u => u.uid === userId ? targetUser : u));
          showNotif('error', err.message || 'Failed to update user role');
        }
      }
    });
  }

  async function handleDirectFacultyPhotoUpload(file: File, isEdit: boolean = false) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotif('error', 'Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotif('error', 'Image size must be under 10MB.');
      return;
    }

    if (isEdit) {
      setIsUploadingEditPhoto(true);
    } else {
      setIsUploadingPhoto(true);
    }

    try {
      showNotif('success', 'Uploading faculty photo directly...');
      const uploadedUrl = await uploadSingleImageToImgBB(file);
      if (isEdit) {
        setEditFacultyImgUrl(uploadedUrl);
      } else {
        setNewFacultyImgUrl(uploadedUrl);
      }
      showNotif('success', 'Faculty photo uploaded successfully!');
    } catch (err: any) {
      console.error('Failed to upload faculty photo:', err);
      showNotif('error', err?.message || 'Failed to upload photo. You can also paste an image URL.');
    } finally {
      if (isEdit) {
        setIsUploadingEditPhoto(false);
      } else {
        setIsUploadingPhoto(false);
      }
    }
  }

  async function handleAddFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!newFacultyName.trim() || !newFacultyDesignation.trim() || !newFacultyDeptId) {
      showNotif('error', 'Please fill out all fields.');
      return;
    }
    const tempId = `temp_f_${Date.now()}`;
    const docData: any = {
      name: newFacultyName.trim(),
      designation: newFacultyDesignation.trim(),
      departmentId: newFacultyDeptId,
      createdAt: new Date().toISOString(),
      totalRatingSum: 0,
      totalRatingCount: 0,
      averageRating: 0
    };
    if (newFacultyImgUrl.trim()) docData.imageUrl = newFacultyImgUrl.trim();
    if (newFacultyPhone.trim()) docData.phone = newFacultyPhone.trim();
    if (newFacultyEmail.trim()) docData.email = newFacultyEmail.trim();

    // Instant optimistic addition
    setFaculties(prev => [...prev.filter(f => f.id !== tempId), { id: tempId, ...docData }]);
    const savedName = newFacultyName.trim();
    const savedDesig = newFacultyDesignation.trim();
    setNewFacultyName('');
    setNewFacultyDesignation('');
    setNewFacultyDeptId('');
    setNewFacultyImgUrl('');
    setNewFacultyPhone('');
    setNewFacultyEmail('');
    showNotif('success', `Faculty member "${savedName}" added successfully!`);

    setIsAddingFaculty(true);
    try {
      const docRef = await addDoc(collection(db, 'faculties'), docData);
      setFaculties(prev => prev.map(f => f.id === tempId ? { ...f, id: docRef.id } : f));

      recordAuditLog({
        category: 'Faculty',
        action: 'CREATE_FACULTY',
        details: `Added new faculty member "${savedName}" (${savedDesig})`,
        targetId: docRef.id,
        targetName: savedName,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Admin',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Admin'
      }).catch(console.warn);
    } catch (err: any) {
      console.error(err);
      setFaculties(prev => prev.filter(f => f.id !== tempId));
      showNotif('error', 'Failed to add faculty member.');
    } finally {
      setIsAddingFaculty(false);
    }
  }

  async function handleUpdateFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFaculty) return;
    if (!editFacultyName.trim() || !editFacultyDesignation.trim() || !editFacultyDeptId) {
      showNotif('error', 'Please fill out all required fields.');
      return;
    }
    const facultyId = editingFaculty.id;
    const previousFaculty = editingFaculty;
    const updatedData: any = {
      name: editFacultyName.trim(),
      designation: editFacultyDesignation.trim(),
      departmentId: editFacultyDeptId,
      imageUrl: editFacultyImgUrl.trim() || '',
      phone: editFacultyPhone.trim() || '',
      email: editFacultyEmail.trim() || '',
    };

    // Instant optimistic update & close edit form
    setFaculties(prev => prev.map(f => f.id === facultyId ? { ...f, ...updatedData } : f));
    setEditingFaculty(null);
    showNotif('success', `Faculty member "${updatedData.name}" updated!`);

    setIsUpdatingFaculty(true);
    try {
      await updateDoc(doc(db, 'faculties', facultyId), updatedData);

      recordAuditLog({
        category: 'Faculty',
        action: 'UPDATE_FACULTY',
        details: `Updated faculty member profile "${updatedData.name}"`,
        targetId: facultyId,
        targetName: updatedData.name,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Admin',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Admin'
      }).catch(console.warn);
    } catch (err: any) {
      console.error(err);
      setFaculties(prev => prev.map(f => f.id === facultyId ? previousFaculty : f));
      showNotif('error', 'Failed to update faculty member: ' + err.message);
    } finally {
      setIsUpdatingFaculty(false);
    }
  }

  function startEditingFaculty(faculty: Faculty) {
    setEditingFaculty(faculty);
    setEditFacultyName(faculty.name);
    setEditFacultyDesignation(faculty.designation);
    setEditFacultyDeptId(faculty.departmentId);
    setEditFacultyImgUrl(faculty.imageUrl || '');
    setEditFacultyPhone(faculty.phone || '');
    setEditFacultyEmail(faculty.email || '');
  }

  async function handleDeleteFaculty(facultyId: string, name: string) {
    const targetFaculty = faculties.find(f => f.id === facultyId);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Faculty Member',
      message: `Are you sure you want to delete "${name}"? This action is permanent.`,
      confirmText: 'Delete Member',
      onConfirm: async () => {
        setConfirmDialog(null);
        // Instant optimistic update
        setFaculties(prev => prev.filter(f => f.id !== facultyId));
        showNotif('success', `Faculty member "${name}" deleted.`);

        try {
          await deleteDoc(doc(db, 'faculties', facultyId));
          recordAuditLog({
            category: 'Faculty',
            action: 'DELETE_FACULTY',
            details: `Deleted faculty member "${name}"`,
            targetId: facultyId,
            targetName: name,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          if (targetFaculty) setFaculties(prev => [...prev, targetFaculty]);
          showNotif('error', err.message || 'Failed to delete faculty member');
        }
      }
    });
  }

  async function handleVerifyQuestion(questionId: string, action: 'published' | 'rejected', feedback: string = '') {
    const targetQ = questions.find(q => q.id === questionId);
    setVerifyingPaperId(questionId);

    // Instant optimistic in-memory update so cards/badges/counts reflect in 0ms
    setQuestions(prev => prev.map(q => q.id === questionId ? {
      ...q,
      status: action,
      verifiedByUID: currentUser?.uid,
      verifiedByUsername: currentUser?.username || 'Moderator',
      verificationFeedback: feedback.trim()
    } : q));

    showNotif('success', `Question paper ${action === 'published' ? 'approved & published' : 'rejected'} successfully.`);

    try {
      await updateDoc(doc(db, 'questions', questionId), {
        status: action,
        verifiedByUID: currentUser?.uid,
        verifiedByUsername: currentUser?.username || 'Moderator',
        verificationFeedback: feedback.trim()
      });

      recordAuditLog({
        category: 'Papers',
        action: action === 'published' ? 'APPROVE_PAPER' : 'REJECT_PAPER',
        details: `${action === 'published' ? 'Approved & published' : 'Rejected'} question paper "${targetQ?.courseName || questionId}" (${targetQ?.courseCode || ''})${feedback.trim() ? ` with feedback: "${feedback.trim()}"` : ''}`,
        targetId: questionId,
        targetName: `${targetQ?.courseName || ''} (${targetQ?.courseCode || ''})`,
        performedByUid: currentUser?.uid,
        performedByName: currentUser?.username || 'Moderator',
        performedByEmail: currentUser?.email,
        performedByRole: currentUser?.role || 'Moderator',
        metadata: { feedback: feedback.trim() }
      }).catch(console.warn);
    } catch (err: any) {
      if (targetQ) setQuestions(prev => prev.map(q => q.id === questionId ? targetQ : q));
      showNotif('error', err.message || 'Failed to update verification status');
    } finally {
      setVerifyingPaperId(null);
    }
  }

  async function promptFeedbackAndVerify(questionId: string, action: 'published' | 'rejected') {
    const verb = action === 'published' ? 'approve and publish' : 'reject';
    setDialogInputText('');
    setConfirmDialog({
      isOpen: true,
      title: `${action === 'published' ? 'Approve' : 'Reject'} Question Paper`,
      message: `Provide feedback or notes for this ${verb} action (optional):`,
      confirmText: action === 'published' ? 'Approve' : 'Reject',
      requireInput: true,
      inputLabel: 'Feedback Notes',
      inputPlaceholder: 'e.g. Approved: highly legible, complete. Or Rejected: bad quality...',
      onConfirm: async (text) => {
        setConfirmDialog(null);
        await handleVerifyQuestion(questionId, action, text || '');
      }
    });
  }

  // Filtering users / questions
  const filteredQuestions = questions.filter(q => {
    const qCourseName = (q.courseName || '').toLowerCase();
    const qCourseCode = (q.courseCode || '').toLowerCase();
    const qTeacher = (q.teacher || '').toLowerCase();
    const qSearch = (searchQuery || '').toLowerCase();

    const matchesSearch = qCourseName.includes(qSearch) ||
      qCourseCode.includes(qSearch) ||
      qTeacher.includes(qSearch);

    if (!matchesSearch) return false;

    if (paperStatusFilter === 'all') return true;
    if (paperStatusFilter === 'pending') return q.status === 'pending';
    if (paperStatusFilter === 'published') return q.status === 'published' || !q.status;
    if (paperStatusFilter === 'rejected') return q.status === 'rejected';

    return true;
  });

  const filteredUsers = users.filter(u => {
    const uName = (u.username || '').toLowerCase();
    const uEmail = (u.email || '').toLowerCase();
    const qSearch = (searchQuery || '').toLowerCase();
    return uName.includes(qSearch) || uEmail.includes(qSearch);
  });

  // Extract unique existing semester names and provide common academic options as defaults
  const uniqueSemesterNames = Array.from(new Set(semesters.map(s => (s?.name || '').trim()))).filter(Boolean);
  const defaultSemesterNames = [
    '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
    '5th Semester', '6th Semester', '7th Semester', '8th Semester',
    'Spring 2025', 'Summer 2025', 'Fall 2025',
    'Spring 2026', 'Summer 2026', 'Fall 2026',
    'Spring 2027', 'Summer 2027', 'Fall 2027'
  ];
  const allSemesterOptions = Array.from(
    new Set([...uniqueSemesterNames, ...defaultSemesterNames, ...customOptionList])
  ).filter(Boolean).sort(compareSemesterNames);

  async function handleClearAllLogs() {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Audit Logs',
      message: 'Are you sure you want to permanently clear all audit log records? This action is irreversible.',
      confirmText: 'Clear All Logs',
      onConfirm: async () => {
        try {
          // Optimistic update
          setAuditLogs([]);
          const snap = await getDocs(collection(db, 'audit_logs'));
          const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, 'audit_logs', d.id)));
          await Promise.all(deletePromises);
          showNotif('success', 'Audit log records cleared.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  return (
    <div id="admin-panel-root" className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-slate-900 dark:bg-slate-950 rounded-2xl border border-slate-800 shadow-lg mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white">Super Admin Dashboard</h1>
            <p className="text-xs text-slate-400 mt-1">Manage UU Qn Bank platform hierarchy, reports, papers, and users</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Automated Audit Active
          </span>
        </div>
      </div>

      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-100 dark:border-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'hierarchy', label: 'Academic Hierarchy', icon: FolderTree },
          { id: 'faculties', label: 'Manage Faculty', icon: GraduationCap },
          { id: 'questions', label: 'Manage Papers', icon: FileText },
          { id: 'users', label: 'Manage Users', icon: Users },
          { id: 'reports', label: 'Moderation Reports', icon: Flag },
          { id: 'logs', label: 'Audit Logs', icon: ScrollText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              id={`admin-tab-${tab.id}`}
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                isActive 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'reports' && reports.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
                  {reports.length}
                </span>
              )}
              {tab.id === 'logs' && auditLogs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full font-bold">
                  {auditLogs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-8">
          
          {/* --- TAB: ANALYTICS --- */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Departments', value: departments.length, color: 'border-indigo-500 text-indigo-600 dark:text-indigo-400' },
                { label: 'Total Question Papers', value: questions.length, color: 'border-emerald-500 text-emerald-600 dark:text-emerald-400' },
                { label: 'Active Contributors', value: users.length, color: 'border-violet-500 text-violet-600 dark:text-violet-400' },
                { label: 'Pending Reports', value: reports.length, color: 'border-red-500 text-red-600 dark:text-red-400' }
              ].map((stat, idx) => (
                <div key={idx} className={`p-6 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 border-l-4 ${stat.color.split(' ')[0]} shadow-sm`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="text-3xl font-bold font-display mt-2">{stat.value}</p>
                </div>
              ))}

              {/* Quick Actions Panel */}
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900">
                <h3 className="text-lg font-semibold font-display mb-4">Quick Management Shortcuts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button 
                    onClick={() => setActiveTab('hierarchy')}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-left flex items-center justify-between group transition-all"
                  >
                    <div>
                      <h4 className="font-semibold text-sm">Hierarchy Designer</h4>
                      <p className="text-xs text-slate-500">Add Departments, Batches, Semesters</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setActiveTab('reports')}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-left flex items-center justify-between group transition-all"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                        Moderation Hub
                        {reports.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
                      </h4>
                      <p className="text-xs text-slate-500">Review reported or toxic uploads</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setActiveTab('users')}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-left flex items-center justify-between group transition-all"
                  >
                    <div>
                      <h4 className="font-semibold text-sm">Account Overseer</h4>
                      <p className="text-xs text-slate-500">Ban / unban students or view reputation</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-left flex items-center justify-between group transition-all"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <ScrollText className="w-4 h-4" />
                        Audit Trail & Logs
                        {auditLogs.length > 0 && (
                          <span className="px-1.5 py-0.2 text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full font-bold">
                            {auditLogs.length}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500">Review automated activity records</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB: ACADEMIC HIERARCHY --- */}
          {activeTab === 'hierarchy' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* 1. Departments management */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">1. Departments</h3>
                  <p className="text-xs text-slate-500">Create global departments (e.g. CSE, EEE)</p>
                </div>

                <form onSubmit={handleCreateDepartment} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Department Name (e.g., Computer Science)"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Code (e.g. CSE)"
                      value={newDeptCode}
                      onChange={(e) => setNewDeptCode(e.target.value)}
                      className="w-1/3 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                    <button
                      type="submit"
                      className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <Plus className="w-4 h-4" /> Add Dept
                    </button>
                  </div>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{dept.name}</p>
                        <p className="text-xs font-mono text-slate-500">{dept.code}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteDepartment(dept.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Batches management */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">2. Batches</h3>
                  <p className="text-xs text-slate-500">Create student batches associated with a department</p>
                </div>

                <div className="space-y-3">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Select Target Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>

                  <form onSubmit={handleCreateBatch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Batch Name (e.g. Batch 60)"
                      value={newBatchName}
                      onChange={(e) => setNewBatchName(e.target.value)}
                      disabled={!selectedDeptId}
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!selectedDeptId}
                      className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {batches
                    .filter((b) => !selectedDeptId || b.departmentId === selectedDeptId)
                    .sort((a, b) => {
                      const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                      const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                      return numB - numA;
                    })
                    .map((batch) => {
                      const d = departments.find(dept => dept.id === batch.departmentId);
                      return (
                        <div key={batch.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{batch.name}</p>
                            <p className="text-xs text-slate-500">Dept: {d ? d.code : 'Unknown'}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 3. Semesters management */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold font-display">3. Semesters</h3>
                  <p className="text-xs text-slate-500">Create & assign semester folders under a student batch</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department (Short Form) *</label>
                    <select
                      value={selectedDeptForSemester}
                      onChange={(e) => {
                        setSelectedDeptForSemester(e.target.value);
                        setSelectedBatchId(''); // Reset batch selection when department changes
                        setCheckedSemesterNames([]);
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Department First</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.code} - {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Batch *</label>
                    <select
                      value={selectedBatchId}
                      onChange={(e) => {
                        setSelectedBatchId(e.target.value);
                        setCheckedSemesterNames([]); // reset selection when batch changes
                      }}
                      disabled={!selectedDeptForSemester}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedDeptForSemester ? "Please Select Department First" : "Select Target Batch"}
                      </option>
                      {batches
                        .filter((b) => b.departmentId === selectedDeptForSemester)
                        .sort((a, b) => {
                          const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                          const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                          return numB - numA;
                        })
                        .map((b) => {
                          const dept = departments.find(d => d.id === b.departmentId);
                          return (
                            <option key={b.id} value={b.id}>{b.name} ({dept ? dept.code : 'Unknown'})</option>
                          );
                        })}
                    </select>
                  </div>

                  {selectedBatchId && (
                    <div className="space-y-4 animate-fade-in">
                      {/* Checkbox checklist */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Semesters to Assign</label>
                          <span className="text-[10px] text-slate-400">Green = Already Assigned</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                          {allSemesterOptions.map((name) => {
                            const matchingSemDoc = semesters.find(s => s.batchId === selectedBatchId && s.name.toLowerCase() === name.toLowerCase());
                            const isAssigned = !!matchingSemDoc;
                            const isChecked = checkedSemesterNames.includes(name);

                            return (
                              <label
                                key={name}
                                className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isAssigned
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/15'
                                    : isChecked
                                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-semibold'
                                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned || isChecked}
                                  onChange={() => {
                                    if (isAssigned && matchingSemDoc) {
                                      handleDeleteSemester(matchingSemDoc.id);
                                      return;
                                    }
                                    if (isChecked) {
                                      setCheckedSemesterNames(prev => prev.filter(n => n !== name));
                                    } else {
                                      setCheckedSemesterNames(prev => [...prev, name]);
                                    }
                                  }}
                                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="truncate flex-1">{name}</span>
                                {isAssigned && (
                                  <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                                    Assigned
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Add Custom Semester Option */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Or Add Custom Semester Name</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Special Fall 2026, Summer 2028"
                            value={customSemesterName}
                            onChange={(e) => setCustomSemesterName(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomOption();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomOption}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
                          >
                            Add Option
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleCreateSemester}
                          disabled={checkedSemesterNames.length === 0 || isAssigningSemesters}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 disabled:opacity-50 transition-all"
                        >
                          {isAssigningSemesters ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Assign Selected Semesters ({checkedSemesterNames.length})
                        </button>
                      </div>
                    </div>
                  )}

                  {!selectedBatchId && (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <p className="text-xs">Please select a target batch to configure semesters</p>
                    </div>
                  )}
                </div>

                {/* Displaying assigned list */}
                {selectedBatchId && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900/60">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Assigned Folders for this Batch ({semesters.filter((s) => s.batchId === selectedBatchId).length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {semesters
                        .filter((s) => s.batchId === selectedBatchId)
                        .map((sem) => {
                          const b = batches.find(batch => batch.id === sem.batchId);
                          const d = b ? departments.find(dept => dept.id === b.departmentId) : null;
                          return (
                            <div key={sem.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 rounded-xl animate-fade-in">
                              <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sem.name}</p>
                                <p className="text-xs text-slate-500">
                                  {d ? d.code : 'Unknown'} - {b ? b.name : 'Unknown'}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteSemester(sem.id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* --- TAB: MANAGE PAPERS --- */}
          {activeTab === 'questions' && (
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold font-display">Manage All Questions</h3>
                  <p className="text-xs text-slate-500">Edit course metadata, view logs, or delete incorrect papers</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by Course Name, Code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              {/* Paper Verification Status Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl w-fit border border-slate-100 dark:border-slate-900">
                {(['pending', 'published', 'rejected', 'all'] as const).map((status) => {
                  const count = status === 'all' 
                    ? questions.length 
                    : status === 'published'
                    ? questions.filter(q => q.status === 'published' || !q.status).length
                    : questions.filter(q => q.status === status).length;
                  
                  return (
                    <button
                      key={status}
                      onClick={() => setPaperStatusFilter(status)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        paperStatusFilter === status
                          ? 'bg-white dark:bg-slate-950 text-slate-950 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-800'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {status === 'published' ? 'Verified & Published' : status === 'pending' ? 'Pending Verification' : status}
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-slate-200/60 dark:bg-slate-800 rounded-full font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-4 font-semibold">Course Code & Name</th>
                      <th className="p-4 font-semibold">Uploader</th>
                      <th className="p-4 font-semibold">Type</th>
                      <th className="p-4 font-semibold">Verification Status</th>
                      <th className="p-4 font-semibold">Views/DLs</th>
                      <th className="p-4 font-semibold">Reports</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {filteredQuestions.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/55 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{q.courseCode}</p>
                          <p className="text-xs text-slate-500">{q.courseName}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                          @{q.uploadedByUsername}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            q.examType === 'Mid' 
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' 
                              : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {q.examType}
                          </span>
                        </td>
                        <td className="p-4">
                          {!q.status || q.status === 'published' ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/40">
                              Verified
                            </span>
                          ) : q.status === 'pending' ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg uppercase tracking-wider border border-amber-100 dark:border-amber-900/40 animate-pulse">
                              Pending Review
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg uppercase tracking-wider border border-rose-100 dark:border-rose-900/40">
                                Rejected
                              </span>
                              {q.verificationFeedback && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs italic line-clamp-1" title={q.verificationFeedback}>
                                  Reason: "{q.verificationFeedback}"
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{q.views}</span>
                            <span>/</span>
                            <Download className="w-3.5 h-3.5" />
                            <span>{q.downloads}</span>
                          </span>
                        </td>
                        <td className="p-4">
                          {q.reportCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {q.reportCount} reports
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Clean</span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {q.status === 'pending' && (
                            <div className="inline-flex gap-1.5 mr-2">
                              <button
                                disabled={verifyingPaperId === q.id}
                                onClick={() => promptFeedbackAndVerify(q.id, 'published')}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Approve and Publish Paper"
                              >
                                {verifyingPaperId === q.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                              </button>
                              <button
                                disabled={verifyingPaperId === q.id}
                                onClick={() => promptFeedbackAndVerify(q.id, 'rejected')}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Reject and Hide Paper"
                              >
                                {verifyingPaperId === q.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <span>Reject</span>
                                )}
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setEditingQuestion(q);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center align-middle"
                            title="Edit paper details"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onNavigateToQuestion(q.id)}
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center align-middle"
                            title="View paper"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 text-red-600 rounded-lg transition-colors inline-flex items-center align-middle"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredQuestions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-500">
                          No question papers match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- TAB: MANAGE USERS --- */}
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold font-display">University Community Users</h3>
                  <p className="text-xs text-slate-500">Audit user profiles, upload statistics, and manage bans</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by Username, Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-4 font-semibold">Student Account</th>
                      <th className="p-4 font-semibold">Joined Date</th>
                      <th className="p-4 font-semibold">Uploads</th>
                      <th className="p-4 font-semibold">Likes Received</th>
                      <th className="p-4 font-semibold">System Status</th>
                      <th className="p-4 font-semibold">Role / Privileges</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {filteredUsers.map((u) => {
                      const isBanned = (u as any).status === 'banned';
                      const isSelf = u.uid === currentUser.uid;
                      return (
                        <tr key={u.uid} className="hover:bg-slate-50/55 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 flex items-center gap-3">
                            <img src={u.photoURL} alt={u.username} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800" />
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">@{u.username}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-mono text-xs">{u.uploadCount || 0}</td>
                          <td className="p-4 font-mono text-xs text-rose-500">
                            <span className="inline-flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                              <span>{u.likesReceived || 0}</span>
                            </span>
                          </td>
                          <td className="p-4">
                            {isBanned ? (
                              <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 rounded-full dark:bg-red-950/20 dark:text-red-400">
                                Banned
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-600 rounded-full dark:bg-emerald-950/20 dark:text-emerald-400">
                                Active Student
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            {isSelf ? (
                              <span className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-950/20 dark:text-indigo-400 uppercase">
                                Super Admin
                              </span>
                            ) : currentUser.role === 'super_admin' ? (
                              <select
                                value={u.role || 'user'}
                                onChange={(e) => handleChangeUserRole(u.uid, e.target.value as any)}
                                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                              >
                                <option value="user">Student (User)</option>
                                <option value="moderator">Moderator (Semi-Admin)</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${
                                u.role === 'super_admin' 
                                  ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' 
                                  : u.role === 'moderator'
                                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                              }`}>
                                {u.role === 'super_admin' ? 'Super Admin' : u.role === 'moderator' ? 'Moderator' : 'Student'}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {isSelf ? (
                              <span className="text-xs text-slate-400">Self (You)</span>
                            ) : (
                              <button
                                onClick={() => handleToggleBanUser(u.uid, isBanned)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors ${
                                  isBanned 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100' 
                                    : 'bg-red-50 dark:bg-red-950/30 text-red-600 hover:bg-red-100'
                                }`}
                              >
                                {isBanned ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" />
                                    Unban
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5" />
                                    Ban Student
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- TAB: REPORTS --- */}
          {activeTab === 'reports' && (
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-6">
              <div>
                <h3 className="text-lg font-semibold font-display">Moderation Reports Hub</h3>
                <p className="text-xs text-slate-500">Verify user reports and flag incorrect/illegal papers</p>
              </div>

              <div className="space-y-4">
                {reports.map((report) => (
                  <div 
                    key={report.id} 
                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 grid grid-cols-1 md:grid-cols-4 gap-4 items-center"
                  >
                    <div className="md:col-span-2 space-y-1">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded">
                        Reason: {report.reason}
                      </span>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-1">
                        {report.courseCode} - {report.courseName}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        "{report.description || 'No description provided.'}"
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Reported by @{report.reportedByUsername} on {new Date(report.reportedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end md:col-span-2">
                      <button
                        onClick={() => onNavigateToQuestion(report.questionId)}
                        className="px-3 py-1.5 bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Paper
                      </button>
                      <button
                        onClick={() => handleDismissReport(report.id)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 rounded-xl text-xs font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Dismiss Report
                      </button>
                      <button
                        onClick={() => handleResolveReport(report.questionId, report.id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 rounded-xl text-xs font-semibold flex items-center gap-1 text-red-600 dark:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Paper
                      </button>
                    </div>
                  </div>
                ))}

                {reports.length === 0 && (
                  <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <h4 className="font-semibold text-sm">All Clean!</h4>
                    <p className="text-xs text-slate-500 mt-1">No pending student moderation reports currently.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB: FACULTIES --- */}
          {activeTab === 'faculties' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900">
                <h3 className="text-lg font-semibold font-display flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                  <span>Faculty Management Hub</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Add, filter, and remove faculty members of Uttara University.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add or Edit Faculty Form */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 h-fit space-y-4">
                  {editingFaculty ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Edit Faculty</h4>
                        <button
                          type="button"
                          onClick={() => setEditingFaculty(null)}
                          className="text-xs font-semibold text-slate-400 hover:text-indigo-500 transition-colors"
                        >
                          Cancel Edit
                        </button>
                      </div>
                      <form onSubmit={handleUpdateFaculty} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faculty Name</label>
                          <input
                            type="text"
                            value={editFacultyName}
                            onChange={(e) => setEditFacultyName(e.target.value)}
                            placeholder="e.g. Dr. John Doe"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                          <input
                            type="text"
                            value={editFacultyDesignation}
                            onChange={(e) => setEditFacultyDesignation(e.target.value)}
                            placeholder="e.g. Professor / Associate Professor / Lecturer"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                          <select
                            value={editFacultyDeptId}
                            onChange={(e) => setEditFacultyDeptId(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          >
                            <option value="">Select Department</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name} ({dept.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Faculty Photo</span>
                              <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowEditManualUrlInput(!showEditManualUrlInput)}
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                            >
                              {showEditManualUrlInput ? 'Hide URL field' : 'Paste URL instead'}
                            </button>
                          </div>

                          {/* Live Photo Preview when selected/uploaded */}
                          {editFacultyImgUrl ? (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-indigo-500/20 bg-slate-200 dark:bg-slate-800 shrink-0 shadow-xs">
                                  <img
                                    src={formatImageUrl(editFacultyImgUrl)}
                                    alt="Faculty portrait preview"
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Photo Ready</p>
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Ready
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <label
                                  htmlFor="edit-faculty-direct-upload"
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Change
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setEditFacultyImgUrl('')}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Remove photo"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <input
                                id="edit-faculty-direct-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleDirectFacultyPhotoUpload(e.target.files[0], true);
                                  }
                                }}
                                className="hidden"
                              />
                            </div>
                          ) : (
                            /* Direct Upload Dropzone Button */
                            <div>
                              <label
                                htmlFor="edit-faculty-direct-upload"
                                className={`w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                                  isUploadingEditPhoto
                                    ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-900/60 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10'
                                }`}
                              >
                                {isUploadingEditPhoto ? (
                                  <div className="flex flex-col items-center gap-1.5 py-1 text-indigo-600 dark:text-indigo-400">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span className="text-xs font-bold">Uploading photo to cloud...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                      <Upload className="w-5 h-5" />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Direct Upload Faculty Photo
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Click to choose photo (JPG, PNG, WebP up to 10MB)
                                      </p>
                                    </div>
                                  </>
                                )}
                                <input
                                  id="edit-faculty-direct-upload"
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingEditPhoto}
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleDirectFacultyPhotoUpload(e.target.files[0], true);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}

                          {/* Fallback Manual URL Input */}
                          {(showEditManualUrlInput || (editFacultyImgUrl && !editFacultyImgUrl.includes('ibb.co'))) && (
                            <div className="pt-1">
                              <input
                                type="url"
                                value={editFacultyImgUrl}
                                onChange={(e) => setEditFacultyImgUrl(e.target.value)}
                                placeholder="Or paste image URL: https://..."
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Phone <span className="text-slate-400 font-normal">(Optional)</span></label>
                          <input
                            type="tel"
                            value={editFacultyPhone}
                            onChange={(e) => setEditFacultyPhone(e.target.value)}
                            placeholder="e.g. +880 1700-000000"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                          <input
                            type="email"
                            value={editFacultyEmail}
                            onChange={(e) => setEditFacultyEmail(e.target.value)}
                            placeholder="e.g. jdoe@uttarauniversity.edu.bd"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isUpdatingFaculty}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-98 transition-all flex items-center justify-center gap-2"
                        >
                          {isUpdatingFaculty ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Save Changes</span>
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Add New Faculty</h4>
                      <form onSubmit={handleAddFaculty} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faculty Name</label>
                          <input
                            type="text"
                            value={newFacultyName}
                            onChange={(e) => setNewFacultyName(e.target.value)}
                            placeholder="e.g. Dr. John Doe"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                          <input
                            type="text"
                            value={newFacultyDesignation}
                            onChange={(e) => setNewFacultyDesignation(e.target.value)}
                            placeholder="e.g. Professor / Associate Professor / Lecturer"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                          <select
                            value={newFacultyDeptId}
                            onChange={(e) => setNewFacultyDeptId(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            required
                          >
                            <option value="">Select Department</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name} ({dept.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Faculty Photo</span>
                              <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                            >
                              {showManualUrlInput ? 'Hide URL field' : 'Paste URL instead'}
                            </button>
                          </div>

                          {/* Live Photo Preview when selected/uploaded */}
                          {newFacultyImgUrl ? (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-indigo-500/20 bg-slate-200 dark:bg-slate-800 shrink-0 shadow-xs">
                                  <img
                                    src={formatImageUrl(newFacultyImgUrl)}
                                    alt="Faculty portrait preview"
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Photo Ready</p>
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Ready for submission
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <label
                                  htmlFor="new-faculty-direct-upload"
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Change
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setNewFacultyImgUrl('')}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Remove photo"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <input
                                id="new-faculty-direct-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleDirectFacultyPhotoUpload(e.target.files[0], false);
                                  }
                                }}
                                className="hidden"
                              />
                            </div>
                          ) : (
                            /* Direct Upload Dropzone Button */
                            <div>
                              <label
                                htmlFor="new-faculty-direct-upload"
                                className={`w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                                  isUploadingPhoto
                                    ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-900/60 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10'
                                }`}
                              >
                                {isUploadingPhoto ? (
                                  <div className="flex flex-col items-center gap-1.5 py-1 text-indigo-600 dark:text-indigo-400">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span className="text-xs font-bold">Uploading photo to cloud...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                      <Upload className="w-5 h-5" />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Direct Upload Faculty Photo
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Click to choose photo (JPG, PNG, WebP up to 10MB)
                                      </p>
                                    </div>
                                  </>
                                )}
                                <input
                                  id="new-faculty-direct-upload"
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingPhoto}
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleDirectFacultyPhotoUpload(e.target.files[0], false);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}

                          {/* Fallback Manual URL Input (Always available if toggled or if external URL present) */}
                          {(showManualUrlInput || (newFacultyImgUrl && !newFacultyImgUrl.includes('ibb.co'))) && (
                            <div className="pt-1">
                              <input
                                type="url"
                                value={newFacultyImgUrl}
                                onChange={(e) => setNewFacultyImgUrl(e.target.value)}
                                placeholder="Or paste image URL: https://..."
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Phone <span className="text-slate-400 font-normal">(Optional)</span></label>
                          <input
                            type="tel"
                            value={newFacultyPhone}
                            onChange={(e) => setNewFacultyPhone(e.target.value)}
                            placeholder="e.g. +880 1700-000000"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                          <input
                            type="email"
                            value={newFacultyEmail}
                            onChange={(e) => setNewFacultyEmail(e.target.value)}
                            placeholder="e.g. jdoe@uttarauniversity.edu.bd"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isAddingFaculty}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-98 transition-all flex items-center justify-center gap-2"
                        >
                          {isAddingFaculty ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>Add Faculty Member</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>

                {/* Faculty List & Filtering */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 self-start">Faculty Roster ({faculties.length})</h4>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <select
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
                      >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                    {faculties
                      .filter((f) => !selectedDeptId || f.departmentId === selectedDeptId)
                      .map((f) => {
                        const dept = departments.find((d) => d.id === f.departmentId);
                        return (
                          <div
                            key={f.id}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              {f.imageUrl ? (
                                <img
                                  src={f.imageUrl}
                                  alt={f.name}
                                  referrerPolicy="no-referrer"
                                  className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-800 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase flex-shrink-0">
                                  {f.name.charAt(0)}
                                </div>
                              )}
                              <div className="space-y-1 min-w-0">
                                <span className="inline-block px-2 py-0.5 text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-md">
                                  {dept ? `${dept.name} (${dept.code})` : 'Unknown Dept'}
                                </span>
                                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{f.name}</h5>
                                <p className="text-xs text-slate-500 truncate">{f.designation}</p>
                                
                                {(f.email || f.phone) && (
                                  <div className="flex flex-col gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 mt-1 pt-1 border-t border-slate-200/20 dark:border-slate-800/20">
                                    {f.email && (
                                      <span className="flex items-center gap-1 truncate">
                                        <Mail className="w-2.5 h-2.5 shrink-0 opacity-70" /> {f.email}
                                      </span>
                                    )}
                                    {f.phone && (
                                      <span className="flex items-center gap-1 truncate">
                                        <Phone className="w-2.5 h-2.5 shrink-0 opacity-70" /> {f.phone}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 mt-1">
                                  <span className="font-extrabold flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                                    <span>{f.averageRating ? f.averageRating.toFixed(2) : '0.00'}</span>
                                  </span>
                                  <span className="text-slate-400 dark:text-slate-600">•</span>
                                  <span className="text-slate-500">
                                    {f.totalRatingCount || 0} rating(s)
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => startEditingFaculty(f)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                                title="Edit Faculty Member"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFaculty(f.id, f.name)}
                                className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl transition-colors hover:shadow-sm"
                                title="Delete Faculty Member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {faculties.filter((f) => !selectedDeptId || f.departmentId === selectedDeptId).length === 0 && (
                      <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <GraduationCap className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <h4 className="font-semibold text-sm">No faculties found</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedDeptId ? 'No faculty members are listed under this department.' : 'Start by adding a faculty member.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB: AUDIT LOGS --- */}
          {activeTab === 'logs' && (
            <AuditLogsView
              logs={auditLogs}
              currentUser={currentUser}
              onClearLogs={handleClearAllLogs}
              onRefresh={() => setRefreshTrigger(prev => prev + 1)}
              loading={false}
            />
          )}

          {/* Custom Confirmation / Prompt Modal */}
          {confirmDialog && confirmDialog.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-950 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>

                {confirmDialog.requireInput && (
                  <div className="space-y-1.5">
                    {confirmDialog.inputLabel && (
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {confirmDialog.inputLabel}
                      </label>
                    )}
                    <textarea
                      value={dialogInputText}
                      onChange={(e) => setDialogInputText(e.target.value)}
                      placeholder={confirmDialog.inputPlaceholder || "Enter details..."}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDialog.onConfirm(confirmDialog.requireInput ? dialogInputText : undefined)}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 transition-all"
                  >
                    {confirmDialog.confirmText || 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Question Paper Modal */}
          <EditQuestionModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingQuestion(null);
            }}
            question={editingQuestion}
            currentUser={currentUser}
            onSuccess={() => {
              setRefreshTrigger(prev => prev + 1);
            }}
          />

      </div>
    </div>
  );
}
