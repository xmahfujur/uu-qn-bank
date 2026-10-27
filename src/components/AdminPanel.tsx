import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Users, 
  FileText, 
  Flag, 
  BarChart3, 
  FolderTree, 
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
  Upload, 
  Camera, 
  X,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Copy,
  Info
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, Batch, Semester, QuestionPaper, Report, UserProfile, Faculty, AuditLog } from '../types';
import EditQuestionModal from './EditQuestionModal';
import AuditLogsView from './AuditLogsView';
import QuickPaperPreviewModal from './QuickPaperPreviewModal';
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
      if (saved && ['analytics', 'hierarchy' , 'questions', 'users', 'reports', 'faculties', 'logs'].includes(saved)) {
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAssigningSemesters, setIsAssigningSemesters] = useState(false);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [isUpdatingFaculty, setIsUpdatingFaculty] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingEditPhoto, setIsUploadingEditPhoto] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const [showEditManualUrlInput, setShowEditManualUrlInput] = useState(false);
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

  // Quick Paper Preview Modal state
  const [previewQuestion, setPreviewQuestion] = useState<QuestionPaper | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Selection states for hierarchies
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDeptForSemester, setSelectedDeptForSemester] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [deptSearchTerm, setDeptSearchTerm] = useState('');
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [semesterFilterTerm, setSemesterFilterTerm] = useState('');

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
  const [paperDeptFilter, setPaperDeptFilter] = useState<string>('all');
  const [paperExamFilter, setPaperExamFilter] = useState<string>('all');
  
  // User Filters
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');

  // Faculty Directory Filter
  const [facultyDeptFilter, setFacultyDeptFilter] = useState<string>('all');
  const [facultySearchTerm, setFacultySearchTerm] = useState<string>('');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Custom confirmation and prompt dialog
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
    setTimeout(() => setNotification(null), 3500);
  }

  // Pending items counts for quick alerts
  const pendingQuestionsCount = useMemo(() => {
    return questions.filter(q => q.status === 'pending').length;
  }, [questions]);

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

    setDepartments(prev => sortDepartmentsAlphabetically([...prev.filter(d => d.id !== tempId), newDept]));
    setNewDeptName('');
    setNewDeptCode('');
    showNotif('success', `Department "${name}" (${code}) created.`);

    try {
      const docRef = await addDoc(collection(db, 'departments'), {
        name,
        code,
        createdAt: newDept.createdAt
      });

      setDepartments(prev => prev.map(d => d.id === tempId ? { ...d, id: docRef.id } : d));

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

  async function handleEditDepartment(dept: Department) {
    setDialogInputText(`${dept.name} | ${dept.code}`);
    setConfirmDialog({
      isOpen: true,
      title: `Edit Department: ${dept.code}`,
      message: 'Update the full name and short code separated by a pipe (|):',
      confirmText: 'Save Department',
      requireInput: true,
      inputLabel: 'Full Name | Short Code',
      inputPlaceholder: 'e.g. Computer Science and Engineering | CSE',
      onConfirm: async (inputText) => {
        if (!inputText) return;
        const parts = inputText.split('|');
        const newName = (parts[0] || '').trim();
        const newCode = (parts[1] || parts[0] || '').trim().toUpperCase();
        if (!newName || !newCode) {
          showNotif('error', 'Both Department name and code are required.');
          return;
        }

        setConfirmDialog(null);
        const prevDept = dept;
        setDepartments(prev => sortDepartmentsAlphabetically(
          prev.map(d => d.id === dept.id ? { ...d, name: newName, code: newCode } : d)
        ));
        showNotif('success', `Department updated to "${newName}" (${newCode}).`);

        try {
          await updateDoc(doc(db, 'departments', dept.id), {
            name: newName,
            code: newCode
          });

          recordAuditLog({
            category: 'Hierarchy',
            action: 'UPDATE_DEPARTMENT',
            details: `Updated department from "${prevDept.name} (${prevDept.code})" to "${newName} (${newCode})"`,
            targetId: dept.id,
            targetName: newName,
            performedByUid: currentUser?.uid,
            performedByName: currentUser?.username || 'Admin',
            performedByEmail: currentUser?.email,
            performedByRole: currentUser?.role || 'Admin'
          }).catch(console.warn);
        } catch (err: any) {
          setDepartments(prev => sortDepartmentsAlphabetically(
            prev.map(d => d.id === dept.id ? prevDept : d)
          ));
          showNotif('error', err.message || 'Failed to update department');
        }
      }
    });
  }

  async function handleDeleteDepartment(deptId: string) {
    const targetDept = departments.find(d => d.id === deptId);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Department',
      message: `Delete department "${targetDept?.name || deptId}"? Batches and question papers belonging to this department will lose their parent link.`,
      confirmText: 'Delete Department',
      onConfirm: async () => {
        setConfirmDialog(null);
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
      message: `Delete batch "${targetBatch?.name || batchId}"? All assigned semesters under this batch will also lose parent association.`,
      confirmText: 'Delete Batch',
      onConfirm: async () => {
        setConfirmDialog(null);
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
    
    const uniqueSemesterNames = Array.from(new Set(semesters.map(s => (s?.name || '').trim()))).filter(Boolean);
    const defaultSemesterNames = [
      '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
      '5th Semester', '6th Semester', '7th Semester', '8th Semester',
      'Spring 2025', 'Summer 2025', 'Fall 2025',
      'Spring 2026', 'Summer 2026', 'Fall 2026',
      'Spring 2027', 'Summer 2027', 'Fall 2027'
    ];
    const currentOptions = Array.from(new Set([...uniqueSemesterNames, ...defaultSemesterNames, ...customOptionList]));
    
    const exists = currentOptions.some(opt => opt.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setCustomOptionList(prev => [...prev, trimmed]);
    }
    
    const matchName = currentOptions.find(opt => opt.toLowerCase() === trimmed.toLowerCase()) || trimmed;
    if (!checkedSemesterNames.includes(matchName)) {
      setCheckedSemesterNames(prev => [...prev, matchName]);
    }
    setCustomSemesterName('');
    showNotif('success', `Added custom option "${trimmed}" to the list!`);
  }

  async function handleCreateSemester(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedBatchId) {
      showNotif('error', 'Please select a target batch first.');
      return;
    }
    
    if (checkedSemesterNames.length === 0) {
      showNotif('error', 'Please select at least one semester checkbox to assign.');
      return;
    }

    const targetBatch = batches.find(b => b.id === selectedBatchId);
    const toAssign = [...checkedSemesterNames];
    setIsAssigningSemesters(true);

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
      message: `Delete semester folder "${targetSem?.name || semId}"?`,
      confirmText: 'Delete Semester',
      onConfirm: async () => {
        setConfirmDialog(null);
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
      message: `Delete "${targetQuestion?.courseName || id}" (${targetQuestion?.courseCode || ''}) permanently? All associated image pages will be automatically deleted from cloud storage.`,
      confirmText: 'Delete Paper & Images',
      onConfirm: async () => {
        setConfirmDialog(null);
        if (previewQuestion?.id === id) {
          setIsPreviewModalOpen(false);
          setPreviewQuestion(null);
        }
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
            details: `Permanently deleted question paper "${targetQuestion?.courseName || 'Unknown'}" (${targetQuestion?.courseCode || id}) with ${targetQuestion?.imageUrls?.length || (targetQuestion?.imageUrl ? 1 : 0)} images`,
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

  async function handleVerifyQuestion(questionId: string, action: 'published' | 'rejected', feedback: string = '') {
    const targetQ = questions.find(q => q.id === questionId);
    setVerifyingPaperId(questionId);

    setQuestions(prev => prev.map(q => q.id === questionId ? {
      ...q,
      status: action,
      verifiedByUID: currentUser?.uid,
      verifiedByUsername: currentUser?.username || 'Moderator',
      verificationFeedback: feedback.trim()
    } : q));

    if (previewQuestion?.id === questionId) {
      setPreviewQuestion(prev => prev ? {
        ...prev,
        status: action,
        verifiedByUID: currentUser?.uid,
        verifiedByUsername: currentUser?.username || 'Moderator',
        verificationFeedback: feedback.trim()
      } : null);
    }

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
      title: `${action === 'published' ? 'Approve & Publish' : 'Reject'} Question Paper`,
      message: `Optional: Add feedback or reviewer notes for this ${verb} decision:`,
      confirmText: action === 'published' ? 'Confirm Approval' : 'Confirm Rejection',
      requireInput: true,
      inputLabel: 'Verification Notes / Reason',
      inputPlaceholder: action === 'published' 
        ? 'e.g. Verified: High quality, legible scan, accurate semester.' 
        : 'e.g. Rejected: Page 2 blurry, wrong subject code, please re-upload...',
      onConfirm: async (text) => {
        setConfirmDialog(null);
        await handleVerifyQuestion(questionId, action, text || '');
      }
    });
  }

  // --- ACTIONS ON REPORTS ---

  async function handleDismissReport(reportId: string) {
    const targetReport = reports.find(r => r.id === reportId);
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
      title: 'Resolve Report (Delete Paper)',
      message: 'Resolve report by deleting the question paper permanently? All uploaded images will also be removed from storage.',
      confirmText: 'Resolve & Delete Paper',
      onConfirm: async () => {
        setConfirmDialog(null);
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
      title: `${action} Student Account`,
      message: `Are you sure you want to ${action.toLowerCase()} student @${targetUser?.username || userId}? ${isCurrentlyBanned ? 'They will regain ability to upload papers.' : 'They will be prevented from uploading or interacting.'}`,
      confirmText: `${action} Student`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: isCurrentlyBanned ? 'active' : 'banned' } : u));
        showNotif('success', `User @${targetUser?.username || 'Student'} ${isCurrentlyBanned ? 'unbanned' : 'banned'} successfully.`);

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
      message: `Change permission level for @${targetUser?.username || 'User'} to "${roleLabel}"?`,
      confirmText: 'Update Role',
      onConfirm: async () => {
        setConfirmDialog(null);
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

  // --- ACTIONS ON FACULTIES ---

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
      showNotif('success', 'Uploading faculty photo...');
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
      showNotif('error', 'Please fill out Name, Designation, and Department.');
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

    setFaculties(prev => [...prev.filter(f => f.id !== tempId), { id: tempId, ...docData }]);
    const savedName = newFacultyName.trim();
    const savedDesig = newFacultyDesignation.trim();
    setNewFacultyName('');
    setNewFacultyDesignation('');
    setNewFacultyDeptId('');
    setNewFacultyImgUrl('');
    setNewFacultyPhone('');
    setNewFacultyEmail('');
    showNotif('success', `Faculty member "${savedName}" added!`);

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
      message: `Permanently delete faculty member "${name}"?`,
      confirmText: 'Delete Member',
      onConfirm: async () => {
        setConfirmDialog(null);
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

  // Semester options computation
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

  // Filtered Questions with Department, Status, Exam Type, and Search Query
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const qCourseName = (q.courseName || '').toLowerCase();
      const qCourseCode = (q.courseCode || '').toLowerCase();
      const qTeacher = (q.teacher || '').toLowerCase();
      const qUploader = (q.uploadedByUsername || '').toLowerCase();
      const qSearch = (searchQuery || '').toLowerCase();

      const matchesSearch = !searchQuery || 
        qCourseName.includes(qSearch) ||
        qCourseCode.includes(qSearch) ||
        qTeacher.includes(qSearch) ||
        qUploader.includes(qSearch);

      if (!matchesSearch) return false;

      // Status Filter
      if (paperStatusFilter === 'pending' && q.status !== 'pending') return false;
      if (paperStatusFilter === 'published' && q.status !== 'published' && q.status !== undefined) return false;
      if (paperStatusFilter === 'rejected' && q.status !== 'rejected') return false;

      // Department Filter
      if (paperDeptFilter !== 'all' && q.departmentId !== paperDeptFilter) return false;

      // Exam Type Filter
      if (paperExamFilter !== 'all' && q.examType !== paperExamFilter) return false;

      return true;
    });
  }, [questions, searchQuery, paperStatusFilter, paperDeptFilter, paperExamFilter]);

  // Filtered Users with Role, Status, and Search Query
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const uName = (u.username || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      const qSearch = (searchQuery || '').toLowerCase();

      const matchesSearch = !searchQuery || uName.includes(qSearch) || uEmail.includes(qSearch);
      if (!matchesSearch) return false;

      // Role Filter
      if (userRoleFilter !== 'all') {
        const role = u.role || 'user';
        if (role !== userRoleFilter) return false;
      }

      // Status Filter
      if (userStatusFilter !== 'all') {
        const isBanned = (u as any).status === 'banned';
        if (userStatusFilter === 'banned' && !isBanned) return false;
        if (userStatusFilter === 'active' && isBanned) return false;
      }

      return true;
    });
  }, [users, searchQuery, userRoleFilter, userStatusFilter]);

  // Filtered Faculties with Department and Search Query
  const filteredFaculties = useMemo(() => {
    return faculties.filter(f => {
      if (facultyDeptFilter !== 'all' && f.departmentId !== facultyDeptFilter) return false;
      if (!facultySearchTerm) return true;
      const term = facultySearchTerm.toLowerCase();
      return (f.name || '').toLowerCase().includes(term) ||
             (f.designation || '').toLowerCase().includes(term) ||
             (f.email || '').toLowerCase().includes(term);
    });
  }, [faculties, facultyDeptFilter, facultySearchTerm]);

  async function handleClearAllLogs() {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Audit Trail',
      message: 'Permanently purge all activity audit logs? This action is irreversible.',
      confirmText: 'Purge All Logs',
      onConfirm: async () => {
        try {
          setAuditLogs([]);
          const snap = await getDocs(collection(db, 'audit_logs'));
          const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, 'audit_logs', d.id)));
          await Promise.all(deletePromises);
          showNotif('success', 'Audit trail purged.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  // Quick helper to preview paper in modal
  const handleOpenPreview = (question: QuestionPaper) => {
    setPreviewQuestion(question);
    setIsPreviewModalOpen(true);
  };

  return (
    <div id="admin-panel-root" className="w-full max-w-7xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE PRODUCTION COMMAND BAR                                      */}
      {/* ========================================================================= */}
      <header className="relative overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl p-6 sm:p-8 text-white">
        {/* Subtle radial glow accent */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                UU Question Bank Console
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync Active
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Shield className="w-7 h-7 text-indigo-400" />
              <span>Super Admin Control Center</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Real-time administrative governance for Uttara University exam archives, departmental hierarchies, faculty rankings, and community safety.
            </p>
          </div>

          {/* Quick Action Badges / Alert Pills */}
          <div className="flex flex-wrap items-center gap-2.5 lg:self-center">
            {pendingQuestionsCount > 0 && (
              <button
                onClick={() => {
                  handleTabChange('questions');
                  setPaperStatusFilter('pending');
                }}
                className="px-3.5 py-2 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/10 active:scale-95 group"
                title="Review pending submissions"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping group-hover:scale-125" />
                <span>{pendingQuestionsCount} Pending Paper{pendingQuestionsCount > 1 ? 's' : ''}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {reports.length > 0 && (
              <button
                onClick={() => handleTabChange('reports')}
                className="px-3.5 py-2 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-500/10 active:scale-95 group"
                title="Investigate reported questions"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                <span>{reports.length} Open Report{reports.length > 1 ? 's' : ''}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            <button
              onClick={() => {
                setIsRefreshing(true);
                setRefreshTrigger(p => p + 1);
                setTimeout(() => {
                  setIsRefreshing(false);
                  showNotif('success', 'Realtime sync refreshed.');
                }, 600);
              }}
              className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
              title="Refresh database streams"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Global Notification Toast */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md animate-in slide-in-from-bottom duration-200 ${
          notification.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-100 border-emerald-800 shadow-emerald-950/30' 
            : 'bg-red-950/90 text-red-100 border-red-800 shadow-red-950/30'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold">{notification.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REFINED SEGMENTED NAVIGATION BAR                                      */}
      {/* ========================================================================= */}
      <nav 
        id="admin-segmented-tabs" 
        className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800/80 no-scrollbar"
      >
        {[
          { id: 'analytics', label: 'Overview', icon: BarChart3 },
          { id: 'hierarchy', label: 'Academic Hierarchy', icon: FolderTree },
          { id: 'questions', label: 'Question Papers', icon: FileText, badge: pendingQuestionsCount > 0 ? pendingQuestionsCount : null, badgeColor: 'bg-amber-500' },
          { id: 'faculties', label: 'Faculty Roster', icon: GraduationCap, badge: faculties.length || null, badgeColor: 'bg-indigo-500' },
          { id: 'users', label: 'Student Accounts', icon: Users, badge: users.length || null, badgeColor: 'bg-slate-500' },
          { id: 'reports', label: 'Moderation Hub', icon: Flag, badge: reports.length > 0 ? reports.length : null, badgeColor: 'bg-red-500' },
          { id: 'logs', label: 'Audit Trail', icon: ScrollText, badge: auditLogs.length > 0 ? auditLogs.length : null, badgeColor: 'bg-slate-500' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              id={`admin-tab-${tab.id}`}
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-2xl whitespace-nowrap transition-all cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md scale-[1.02]' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] text-white rounded-full font-mono font-bold ${tab.badgeColor || 'bg-indigo-500'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ========================================================================= */}
      {/* 3. TAB VIEWS                                                             */}
      {/* ========================================================================= */}
      <div className="space-y-8">
        
        {/* ----------------------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW & ANALYTICS                                             */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            
            {/* Action Alert Banner for Pending Papers */}
            {pendingQuestionsCount > 0 && (
              <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-amber-200">
                      {pendingQuestionsCount} Question Paper{pendingQuestionsCount > 1 ? 's' : ''} Awaiting Review
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      New student submissions need verification to ensure legibility and accurate exam metadata before publishing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleTabChange('questions');
                    setPaperStatusFilter('pending');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Review Submissions</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Stat 1: Total Question Papers */}
              <div className="p-6 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Papers</span>
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {questions.length}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {questions.filter(q => q.status === 'published' || !q.status).length} Verified
                    </span>
                    <span>•</span>
                    <span className={pendingQuestionsCount > 0 ? 'text-amber-500 font-bold' : ''}>
                      {pendingQuestionsCount} Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat 2: Active University Students */}
              <div className="p-6 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">University Community</span>
                  <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {users.length}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span>{users.filter(u => u.uploadCount > 0).length} Contributors</span>
                    <span>•</span>
                    <span className="text-rose-500 font-bold flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-rose-500" />
                      {users.reduce((acc, u) => acc + (u.likesReceived || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat 3: Academic Catalog */}
              <div className="p-6 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Academic Hierarchy</span>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <FolderTree className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {departments.length}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span>{batches.length} Batches</span>
                    <span>•</span>
                    <span>{semesters.length} Semesters</span>
                  </div>
                </div>
              </div>

              {/* Stat 4: Faculty Directory */}
              <div className="p-6 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faculty Roster</span>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {faculties.length}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-amber-500 font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {(faculties.reduce((acc, f) => acc + (f.averageRating || 0), 0) / (faculties.length || 1)).toFixed(2)} Avg
                    </span>
                    <span>•</span>
                    <span>{faculties.reduce((acc, f) => acc + (f.totalRatingCount || 0), 0)} Reviews</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Management Shortcuts */}
            <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Administrative Workflow Shortcuts
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct pathways to high-frequency administrative controls.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => handleTabChange('hierarchy')}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-left transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                    <FolderTree className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Hierarchy Designer
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Configure departments, batches, and semesters</p>
                </button>

                <button
                  onClick={() => handleTabChange('questions')}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-left transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Question Papers
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Review, approve, edit metadata, or delete papers</p>
                </button>

                <button
                  onClick={() => handleTabChange('faculties')}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-left transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Faculty Directory
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Add professors, upload photos, and update details</p>
                </button>

                <button
                  onClick={() => handleTabChange('users')}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-left transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-3">
                    <Users className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    Student Community
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Assign admin/moderator roles or manage bans</p>
                </button>
              </div>
            </div>

            {/* Recent Activity Audit Preview */}
            <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-indigo-500" />
                    <span>Recent Administrative Audit Events</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Automated trail of all system changes</p>
                </div>
                <button
                  onClick={() => handleTabChange('logs')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Logs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-900">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0">
                        {log.category}
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {log.details}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}

                {auditLogs.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">No activity recorded yet.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 2: ACADEMIC HIERARCHY DESIGNER                                      */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'hierarchy' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Departments Section */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <span>1. Departments</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono">
                      {departments.length} Depts
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Create or edit university faculties (e.g. CSE, EEE, BBA)</p>
                </div>

                {/* Create Department Form */}
                <form onSubmit={handleCreateDepartment} className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Computer Science)"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Code (e.g. CSE)"
                      value={newDeptCode}
                      onChange={(e) => setNewDeptCode(e.target.value)}
                      className="w-1/3 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white uppercase font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Dept
                    </button>
                  </div>
                </form>

                {/* Search filter for departments */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={deptSearchTerm}
                    onChange={(e) => setDeptSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                {/* Departments Roster List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {departments
                    .filter(d => !deptSearchTerm || d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) || d.code.toLowerCase().includes(deptSearchTerm.toLowerCase()))
                    .map((dept) => {
                      const deptBatches = batches.filter(b => b.departmentId === dept.id);
                      const deptPapers = questions.filter(q => q.departmentId === dept.id);
                      return (
                        <div key={dept.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl flex items-center justify-between gap-3 group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                                {dept.code}
                              </span>
                              <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {dept.name}
                              </h4>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {deptBatches.length} Batches • {deptPapers.length} Papers
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditDepartment(dept)}
                              className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              title="Edit department name or code"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(dept.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Delete department"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* 2. Batches Section */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-emerald-500" />
                      <span>2. Student Batches</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono">
                      {batches.length} Batches
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Create student cohorts linked to a department</p>
                </div>

                {/* Filter and Add Batch */}
                <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select Target Department *</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>

                  <form onSubmit={handleCreateBatch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Batch 60, Batch 61"
                      value={newBatchName}
                      onChange={(e) => setNewBatchName(e.target.value)}
                      disabled={!selectedDeptId}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!selectedDeptId}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>
                </div>

                {/* Batches List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {batches
                    .filter(b => !selectedDeptId || b.departmentId === selectedDeptId)
                    .sort((a, b) => {
                      const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                      const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                      return numB - numA;
                    })
                    .map((batch) => {
                      const dept = departments.find(d => d.id === batch.departmentId);
                      const semsCount = semesters.filter(s => s.batchId === batch.id).length;
                      return (
                        <div key={batch.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {batch.name}
                              </span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {dept ? dept.code : 'Unknown'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {semsCount} Semester Folder{semsCount !== 1 ? 's' : ''} assigned
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}

                  {batches.filter(b => !selectedDeptId || b.departmentId === selectedDeptId).length === 0 && (
                    <p className="text-center py-8 text-xs text-slate-400">
                      {selectedDeptId ? 'No batches in this department yet.' : 'Select a department to view batches.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Semesters Section */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-violet-500" />
                      <span>3. Semester Folders</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 font-mono">
                      {semesters.length} Folders
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Assign semester folders under a student batch</p>
                </div>

                {/* Cascading selectors */}
                <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                  <select
                    value={selectedDeptForSemester}
                    onChange={(e) => {
                      setSelectedDeptForSemester(e.target.value);
                      setSelectedBatchId('');
                      setCheckedSemesterNames([]);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">1. Pick Department First *</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.code} - {dept.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedBatchId}
                    onChange={(e) => {
                      setSelectedBatchId(e.target.value);
                      setCheckedSemesterNames([]);
                    }}
                    disabled={!selectedDeptForSemester}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">
                      {!selectedDeptForSemester ? "Select Department First" : "2. Pick Target Batch *"}
                    </option>
                    {batches
                      .filter(b => b.departmentId === selectedDeptForSemester)
                      .sort((a, b) => {
                        const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
                        const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
                        return numB - numA;
                      })
                      .map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                </div>

                {/* Semester Assignment Checklist */}
                {selectedBatchId ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                        Available Semesters
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const unassigned = allSemesterOptions.filter(name => 
                              !semesters.some(s => s.batchId === selectedBatchId && s.name.toLowerCase() === name.toLowerCase())
                            );
                            setCheckedSemesterNames(unassigned);
                          }}
                          className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setCheckedSemesterNames([])}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Checkbox grid */}
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                      {allSemesterOptions.map((name) => {
                        const matchingSemDoc = semesters.find(s => s.batchId === selectedBatchId && s.name.toLowerCase() === name.toLowerCase());
                        const isAssigned = !!matchingSemDoc;
                        const isChecked = checkedSemesterNames.includes(name);

                        return (
                          <label
                            key={name}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer border transition-all ${
                              isAssigned
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : isChecked
                                ? 'bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400 font-semibold'
                                : 'bg-white dark:bg-slate-950 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300'
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
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
                            />
                            <span className="truncate flex-1 text-[11px]">{name}</span>
                            {isAssigned && (
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                Assigned
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Custom Semester option */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add custom name (e.g. Special Fall 2026)"
                        value={customSemesterName}
                        onChange={(e) => setCustomSemesterName(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
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
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Commit Button */}
                    <button
                      type="button"
                      onClick={() => handleCreateSemester()}
                      disabled={checkedSemesterNames.length === 0 || isAssigningSemesters}
                      className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-violet-600/10 cursor-pointer"
                    >
                      {isAssigningSemesters ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Assign Selected Semesters ({checkedSemesterNames.length})
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-xs">Select Department and Batch above to assign semesters</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 3: MANAGE QUESTION PAPERS (TABLE + QUICK PREVIEW MODAL)              */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'questions' && (
          <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
            
            {/* Header + Search & Filter Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <span>Question Papers Repository</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review student submissions, edit metadata, or purge invalid papers.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by Course, Code, Instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Filter Ribbon: Status + Department + Exam Type */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {/* Status Segmented Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                {(['pending', 'published', 'rejected', 'all'] as const).map((status) => {
                  const count = status === 'all' 
                    ? questions.length 
                    : status === 'published'
                    ? questions.filter(q => q.status === 'published' || !q.status).length
                    : questions.filter(q => q.status === status).length;
                  
                  const isCurrent = paperStatusFilter === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setPaperStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-800'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>
                        {status === 'published' ? 'Verified' : status === 'pending' ? 'Pending Review' : status}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                        status === 'pending' && count > 0 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Department & Exam Dropdowns */}
              <div className="flex items-center gap-2">
                <select
                  value={paperDeptFilter}
                  onChange={(e) => setPaperDeptFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.code}</option>
                  ))}
                </select>

                <select
                  value={paperExamFilter}
                  onChange={(e) => setPaperExamFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Terms</option>
                  <option value="Mid">Mid Term</option>
                  <option value="Final">Final Term</option>
                </select>
              </div>
            </div>

            {/* Questions Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200/80 dark:border-slate-800/80 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Course Code & Title</th>
                    <th className="p-4">Uploader</th>
                    <th className="p-4">Hierarchy</th>
                    <th className="p-4">Term</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Views / DLs</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {filteredQuestions.map((q) => {
                    const dept = departments.find(d => d.id === q.departmentId);
                    const isPending = q.status === 'pending';
                    const isRejected = q.status === 'rejected';

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                        {/* Course Code & Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                              {q.courseCode}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {q.courseName}
                            </span>
                          </div>
                          {q.teacher && (
                            <p className="text-[10px] text-slate-400 mt-0.5">Instructor: {q.teacher}</p>
                          )}
                        </td>

                        {/* Uploader */}
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-400">
                          @{users.find(u => u.uid === q.uploadedByUID)?.username || (currentUser && currentUser.uid === q.uploadedByUID ? currentUser.username : q.uploadedByUsername)}
                        </td>

                        {/* Hierarchy */}
                        <td className="p-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {dept ? dept.code : 'General'}
                          </span>
                        </td>

                        {/* Term */}
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                            q.examType === 'Mid' 
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' 
                              : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                          }`}>
                            {q.examType}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          {isPending ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg uppercase tracking-wider border border-amber-500/20 flex items-center gap-1 w-fit animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Pending
                            </span>
                          ) : isRejected ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg uppercase tracking-wider border border-rose-500/20 w-fit">
                              Rejected
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </td>

                        {/* Views / DLs */}
                        <td className="p-4 font-mono text-[11px] text-slate-500">
                          {q.views || 0} / {q.downloads || 0}
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Quick In-Place Preview Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(q)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                              title="Quick in-place preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>

                            {/* Approve / Reject buttons if pending */}
                            {isPending && (
                              <>
                                <button
                                  disabled={verifyingPaperId === q.id}
                                  onClick={() => promptFeedbackAndVerify(q.id, 'published')}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors cursor-pointer"
                                  title="Approve paper"
                                >
                                  {verifyingPaperId === q.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  disabled={verifyingPaperId === q.id}
                                  onClick={() => promptFeedbackAndVerify(q.id, 'rejected')}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl transition-colors cursor-pointer"
                                  title="Reject paper"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingQuestion(q);
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit metadata"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredQuestions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-12 text-slate-400">
                        No question papers found matching your current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 4: FACULTY ROSTER HUB                                               */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'faculties' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Add or Edit Faculty Form (Left Col) */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs h-fit space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-500" />
                  <span>{editingFaculty ? 'Edit Faculty Profile' : 'Add New Faculty Member'}</span>
                </h4>
                {editingFaculty && (
                  <button
                    type="button"
                    onClick={() => setEditingFaculty(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={editingFaculty ? handleUpdateFaculty : handleAddFaculty} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faculty Name *</label>
                  <input
                    type="text"
                    value={editingFaculty ? editFacultyName : newFacultyName}
                    onChange={(e) => editingFaculty ? setEditFacultyName(e.target.value) : setNewFacultyName(e.target.value)}
                    placeholder="e.g. Dr. John Doe"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Designation *</label>
                  <input
                    type="text"
                    value={editingFaculty ? editFacultyDesignation : newFacultyDesignation}
                    onChange={(e) => editingFaculty ? setEditFacultyDesignation(e.target.value) : setNewFacultyDesignation(e.target.value)}
                    placeholder="e.g. Professor & Head of CSE"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department *</label>
                  <select
                    value={editingFaculty ? editFacultyDeptId : newFacultyDeptId}
                    onChange={(e) => editingFaculty ? setEditFacultyDeptId(e.target.value) : setNewFacultyDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

                {/* Photo Dropzone & Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Portrait Photo (Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingFaculty) setShowEditManualUrlInput(!showEditManualUrlInput);
                        else setShowManualUrlInput(!showManualUrlInput);
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      Paste URL
                    </button>
                  </div>

                  {/* Photo Preview if loaded */}
                  {(editingFaculty ? editFacultyImgUrl : newFacultyImgUrl) ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={formatImageUrl(editingFaculty ? editFacultyImgUrl : newFacultyImgUrl)}
                          alt="Faculty"
                          onError={handleImageError}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Photo Uploaded</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingFaculty) setEditFacultyImgUrl('');
                          else setNewFacultyImgUrl('');
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="faculty-photo-upload-input"
                      className="w-full border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/40"
                    >
                      {(editingFaculty ? isUploadingEditPhoto : isUploadingPhoto) ? (
                        <div className="flex flex-col items-center gap-1.5 py-1 text-indigo-600 dark:text-indigo-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-xs font-bold">Uploading to cloud...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-indigo-500" />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Choose portrait photo</p>
                          <p className="text-[10px] text-slate-400">JPG, PNG, WebP up to 10MB</p>
                        </>
                      )}
                      <input
                        id="faculty-photo-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleDirectFacultyPhotoUpload(e.target.files[0], !!editingFaculty);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* Manual URL input fallback */}
                  {((editingFaculty ? showEditManualUrlInput : showManualUrlInput) || 
                    ((editingFaculty ? editFacultyImgUrl : newFacultyImgUrl) && !(editingFaculty ? editFacultyImgUrl : newFacultyImgUrl).includes('ibb.co'))) && (
                    <input
                      type="url"
                      value={editingFaculty ? editFacultyImgUrl : newFacultyImgUrl}
                      onChange={(e) => editingFaculty ? setEditFacultyImgUrl(e.target.value) : setNewFacultyImgUrl(e.target.value)}
                      placeholder="Paste image URL (https://...)"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Email (Optional)</label>
                  <input
                    type="email"
                    value={editingFaculty ? editFacultyEmail : newFacultyEmail}
                    onChange={(e) => editingFaculty ? setEditFacultyEmail(e.target.value) : setNewFacultyEmail(e.target.value)}
                    placeholder="e.g. name@uttarauniversity.edu.bd"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={editingFaculty ? editFacultyPhone : newFacultyPhone}
                    onChange={(e) => editingFaculty ? setEditFacultyPhone(e.target.value) : setNewFacultyPhone(e.target.value)}
                    placeholder="e.g. +880 1700-000000"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingFaculty || isUpdatingFaculty}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {(isAddingFaculty || isUpdatingFaculty) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingFaculty ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{editingFaculty ? 'Save Faculty Profile' : 'Add Faculty Member'}</span>
                </button>
              </form>
            </div>

            {/* Faculty Directory (Right 2 Cols) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Faculty Directory ({filteredFaculties.length})
                  </h4>
                  <p className="text-xs text-slate-500">Filter by department or search by name</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={facultyDeptFilter}
                    onChange={(e) => setFacultyDeptFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.code}</option>
                    ))}
                  </select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search faculty..."
                      value={facultySearchTerm}
                      onChange={(e) => setFacultySearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none w-36 sm:w-44"
                    />
                  </div>
                </div>
              </div>

              {/* Roster Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredFaculties.map((f) => {
                  const dept = departments.find(d => d.id === f.departmentId);
                  return (
                    <div key={f.id} className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between gap-3 group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                      <div className="flex items-start gap-3">
                        {f.imageUrl ? (
                          <img
                            src={formatImageUrl(f.imageUrl)}
                            alt={f.name}
                            onError={handleImageError}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-base flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
                            {f.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                            {dept ? dept.code : 'General'}
                          </span>
                          <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate mt-1">
                            {f.name}
                          </h5>
                          <p className="text-[11px] text-slate-500 truncate">{f.designation}</p>

                          <div className="flex items-center gap-1.5 text-amber-500 font-mono text-[11px] mt-1.5">
                            <Star className="w-3 h-3 fill-amber-400 inline" />
                            <span className="font-bold">{f.averageRating ? f.averageRating.toFixed(2) : '0.00'}</span>
                            <span className="text-slate-400 text-[10px]">({f.totalRatingCount || 0} reviews)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/40 dark:border-slate-800/40 text-[10px] text-slate-400">
                        <div className="truncate">
                          {f.email && <span className="mr-2">📧 {f.email}</span>}
                          {f.phone && <span>📞 {f.phone}</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditingFaculty(f)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            title="Edit faculty"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFaculty(f.id, f.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete faculty"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredFaculties.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-xs">No faculty members found matching your search.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 5: STUDENT COMMUNITY & ROLE OVERSEER                                */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <span>Student Community Accounts</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Promote students to moderators, audit contribution love points, or ban abusive accounts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="user">Students</option>
                  <option value="moderator">Moderators</option>
                  <option value="super_admin">Super Admins</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="banned">Banned Only</option>
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by username or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200/80 dark:border-slate-800/80 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Student Profile</th>
                    <th className="p-4">Uploads</th>
                    <th className="p-4">Love Received</th>
                    <th className="p-4">Joined Date</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4">Role Privileges</th>
                    <th className="p-4 text-right">Account Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {filteredUsers.map((u) => {
                    const isBanned = (u as any).status === 'banned';
                    const isSelf = u.uid === currentUser?.uid;

                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                        {/* Profile Info */}
                        <td className="p-4 flex items-center gap-3">
                          <img
                            src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=random`}
                            alt={u.username}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-800"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white">@{u.username}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </td>

                        {/* Uploads */}
                        <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {u.uploadCount || 0}
                        </td>

                        {/* Love Received */}
                        <td className="p-4 font-mono text-rose-500 font-bold">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 fill-rose-500" />
                            {u.likesReceived || 0}
                          </span>
                        </td>

                        {/* Joined Date */}
                        <td className="p-4 font-mono text-[11px] text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </td>

                        {/* System Status */}
                        <td className="p-4">
                          {isBanned ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg uppercase tracking-wider border border-rose-500/20">
                              Banned
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg uppercase tracking-wider border border-emerald-500/20">
                              Active Student
                            </span>
                          )}
                        </td>

                        {/* Role Select */}
                        <td className="p-4">
                          {isSelf ? (
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg uppercase border border-indigo-500/20">
                              Super Admin (You)
                            </span>
                          ) : currentUser?.role === 'super_admin' ? (
                            <select
                              value={u.role || 'user'}
                              onChange={(e) => handleChangeUserRole(u.uid, e.target.value as any)}
                              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                              <option value="user">Student</option>
                              <option value="moderator">Moderator</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          ) : (
                            <span className="text-[10px] font-bold uppercase text-slate-500">
                              {u.role || 'Student'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          {isSelf ? (
                            <span className="text-slate-400 text-xs">Self</span>
                          ) : (
                            <button
                              onClick={() => handleToggleBanUser(u.uid, isBanned)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                isBanned
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100'
                              }`}
                            >
                              {isBanned ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Unban</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Ban</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-12 text-slate-400">
                        No students match your current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 6: MODERATION REPORTS HUB                                           */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'reports' && (
          <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                <span>Moderation Reports Hub ({reports.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Investigate student flags regarding duplicate, incorrect, blurry, or copyright-infringing exam papers.
              </p>
            </div>

            <div className="space-y-4">
              {reports.map((report) => {
                const targetQ = questions.find(q => q.id === report.questionId);
                return (
                  <div 
                    key={report.id} 
                    className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
                          {report.reason}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {report.courseCode} - {report.courseName}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                        "{report.description || 'No additional details provided.'}"
                      </p>

                      <p className="text-[10px] text-slate-400 font-mono">
                        Flagged by @{report.reportedByUsername} on {new Date(report.reportedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {targetQ ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(targetQ)}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview Paper
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Paper deleted</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDismissReport(report.id)}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Dismiss
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResolveReport(report.questionId, report.id)}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Paper
                      </button>
                    </div>
                  </div>
                );
              })}

              {reports.length === 0 && (
                <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Clean Moderation Queue</h4>
                  <p className="text-xs text-slate-500 mt-1">No active reports from university students currently.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 7: AUDIT TRAIL VIEW                                                 */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'logs' && (
          <AuditLogsView
            logs={auditLogs}
            currentUser={currentUser}
            onClearLogs={handleClearAllLogs}
            onRefresh={() => setRefreshTrigger(prev => prev + 1)}
            loading={false}
          />
        )}

      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS & IN-PLACE DIALOGS                                             */}
      {/* ========================================================================= */}

      {/* Quick Paper Preview Modal */}
      <QuickPaperPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setPreviewQuestion(null);
        }}
        question={previewQuestion}
        departments={departments}
        batches={batches}
        semesters={semesters}
        onApprove={(id) => promptFeedbackAndVerify(id, 'published')}
        onReject={(id) => promptFeedbackAndVerify(id, 'rejected')}
        onEdit={(q) => {
          setIsPreviewModalOpen(false);
          setEditingQuestion(q);
          setIsEditModalOpen(true);
        }}
        onDelete={(id) => handleDeleteQuestion(id)}
        onNavigateToDetail={(id) => {
          setIsPreviewModalOpen(false);
          onNavigateToQuestion(id);
        }}
        verifyingId={verifyingPaperId}
      />

      {/* Edit Question Modal */}
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

      {/* Custom Universal Confirmation / Feedback Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            {confirmDialog.requireInput && (
              <div className="space-y-1.5">
                {confirmDialog.inputLabel && (
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {confirmDialog.inputLabel}
                  </label>
                )}
                <textarea
                  value={dialogInputText}
                  onChange={(e) => setDialogInputText(e.target.value)}
                  placeholder={confirmDialog.inputPlaceholder || "Enter details..."}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  rows={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.onConfirm(confirmDialog.requireInput ? dialogInputText : undefined)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/15 active:scale-98 transition-all cursor-pointer"
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
