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
  GraduationCap
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
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, Batch, Semester, QuestionPaper, Report, UserProfile, Faculty } from '../types';
import EditQuestionModal from './EditQuestionModal';
import { compareSemesterNames, sortSemestersDescending } from '../utils/semesterSort';
import { sortDepartmentsAlphabetically } from '../utils/departmentSort';

interface AdminPanelProps {
  currentUser: any;
  onNavigateToQuestion: (questionId: string) => void;
}

export default function AdminPanel({ currentUser, onNavigateToQuestion }: AdminPanelProps) {
  // Navigation inside Admin Panel
  const [activeTab, setActiveTab] = useState<'analytics' | 'hierarchy' | 'questions' | 'users' | 'reports' | 'faculties'>('analytics');

  // Loaders
  const [loading, setLoading] = useState(false);

  // Core Data Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [questions, setQuestions] = useState<QuestionPaper[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

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

  // Reload lists trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      try {
        // Load Departments
        const deptSnap = await getDocs(collection(db, 'departments'));
        const depts: Department[] = [];
        deptSnap.forEach(doc => depts.push({ id: doc.id, ...doc.data() } as Department));
        setDepartments(sortDepartmentsAlphabetically(depts));

        // Load Batches
        const batchSnap = await getDocs(collection(db, 'batches'));
        const bList: Batch[] = [];
        batchSnap.forEach(doc => bList.push({ id: doc.id, ...doc.data() } as Batch));
        setBatches(bList);

        // Load Semesters
        const semSnap = await getDocs(collection(db, 'semesters'));
        const sList: Semester[] = [];
        semSnap.forEach(doc => sList.push({ id: doc.id, ...doc.data() } as Semester));
        setSemesters(sortSemestersDescending(sList));

        // Load Questions
        const qSnap = await getDocs(collection(db, 'questions'));
        const qList: QuestionPaper[] = [];
        qSnap.forEach(doc => qList.push({ id: doc.id, ...doc.data() } as QuestionPaper));
        setQuestions(qList);

        // Load Users
        const userSnap = await getDocs(collection(db, 'users'));
        const uList: UserProfile[] = [];
        userSnap.forEach(doc => uList.push({ uid: doc.id, ...doc.data() } as any as UserProfile));
        setUsers(uList);

        // Load Reports
        const reportSnap = await getDocs(collection(db, 'reports'));
        const rList: Report[] = [];
        reportSnap.forEach(doc => rList.push({ id: doc.id, ...doc.data() } as Report));
        setReports(rList);

        // Load Faculties
        const facSnap = await getDocs(collection(db, 'faculties'));
        const facList: Faculty[] = [];
        facSnap.forEach(doc => facList.push({ id: doc.id, ...doc.data() } as Faculty));
        setFaculties(facList);
      } catch (err: any) {
        console.error('Error fetching admin data:', err);
        showNotif('error', 'Failed to retrieve data.');
      } finally {
        setLoading(false);
      }
    }
    fetchAdminData();
  }, [refreshTrigger]);

  function showNotif(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }

  // --- HIERARCHY MANAGEMENT ---

  async function handleCreateDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) {
      showNotif('error', 'Department name and code are required.');
      return;
    }
    try {
      await addDoc(collection(db, 'departments'), {
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
        createdAt: new Date().toISOString()
      });
      setNewDeptName('');
      setNewDeptCode('');
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Department created successfully!');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  async function handleDeleteDepartment(deptId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Department',
      message: 'Are you sure you want to delete this department? All associated papers/batches will remain but lose parent context.',
      confirmText: 'Delete Department',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'departments', deptId));
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', 'Department deleted.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeptId || !newBatchName) {
      showNotif('error', 'Please select a department and enter batch name.');
      return;
    }
    try {
      await addDoc(collection(db, 'batches'), {
        departmentId: selectedDeptId,
        name: newBatchName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewBatchName('');
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Batch created successfully!');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  async function handleDeleteBatch(batchId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Batch',
      message: 'Are you sure you want to delete this batch?',
      confirmText: 'Delete Batch',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'batches', batchId));
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', 'Batch deleted.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  function handleAddCustomOption() {
    const trimmed = customSemesterName.trim();
    if (!trimmed) return;
    
    // Extract default options & existing unique options
    const uniqueSemesterNames = Array.from(new Set(semesters.map(s => s.name.trim()))).filter(Boolean);
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

    setLoading(true);
    try {
      let addedCount = 0;
      for (const semName of checkedSemesterNames) {
        const formattedName = semName.trim();
        // Double check if already exists to prevent duplicates
        const exists = semesters.some(s => s.batchId === selectedBatchId && s.name.toLowerCase() === formattedName.toLowerCase());
        if (!exists) {
          await addDoc(collection(db, 'semesters'), {
            batchId: selectedBatchId,
            name: formattedName,
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }
      
      setCheckedSemesterNames([]);
      setCustomSemesterName('');
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', `Successfully assigned ${addedCount} semester(s) to the batch!`);
    } catch (err: any) {
      showNotif('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSemester(semId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Semester',
      message: 'Are you sure you want to delete this semester folder?',
      confirmText: 'Delete Semester',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'semesters', semId));
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', 'Semester deleted.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  // --- ACTIONS ON QUESTIONS ---

  async function handleDeleteQuestion(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Question Paper',
      message: 'Delete this question paper permanently? This action cannot be undone.',
      confirmText: 'Delete Paper',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'questions', id));
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', 'Question paper deleted successfully.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  // --- ACTIONS ON REPORTS ---

  async function handleDismissReport(reportId: string) {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Report dismissed.');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  async function handleResolveReport(questionId: string, reportId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Resolve Report',
      message: 'Resolve report by deleting the question paper permanently?',
      confirmText: 'Resolve & Delete',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'questions', questionId));
          await deleteDoc(doc(db, 'reports', reportId));
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', 'Report resolved: Question paper deleted.');
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  // --- ACTIONS ON USERS ---

  async function handleToggleBanUser(userId: string, isCurrentlyBanned: boolean) {
    const action = isCurrentlyBanned ? 'Unban' : 'Ban';
    setConfirmDialog({
      isOpen: true,
      title: `${action} User`,
      message: `Are you sure you want to ${action} this user?`,
      confirmText: `${action} User`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', userId), {
            status: isCurrentlyBanned ? 'active' : 'banned'
          });
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', `User ${isCurrentlyBanned ? 'unbanned' : 'banned'} successfully.`);
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  async function handleChangeUserRole(userId: string, newRole: 'super_admin' | 'moderator' | 'user') {
    if (userId === currentUser.uid) {
      showNotif('error', 'You cannot change your own role.');
      return;
    }
    const roleLabel = newRole === 'super_admin' ? 'Super Admin' : newRole === 'moderator' ? 'Moderator (Semi-Admin)' : 'Student';
    setConfirmDialog({
      isOpen: true,
      title: 'Update User Role',
      message: `Are you sure you want to change this user's role to ${roleLabel}?`,
      confirmText: 'Update Role',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', userId), {
            role: newRole
          });
          setRefreshTrigger(prev => prev + 1);
          showNotif('success', `User role updated to ${roleLabel} successfully.`);
        } catch (err: any) {
          showNotif('error', err.message);
        }
        setConfirmDialog(null);
      }
    });
  }

  async function handleAddFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!newFacultyName.trim() || !newFacultyDesignation.trim() || !newFacultyDeptId) {
      showNotif('error', 'Please fill out all fields.');
      return;
    }
    setLoading(true);
    try {
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

      await addDoc(collection(db, 'faculties'), docData);
      showNotif('success', `Faculty member "${newFacultyName}" successfully added!`);
      setNewFacultyName('');
      setNewFacultyDesignation('');
      setNewFacultyDeptId('');
      setNewFacultyImgUrl('');
      setNewFacultyPhone('');
      setNewFacultyEmail('');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      showNotif('error', 'Failed to add faculty member.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFaculty) return;
    if (!editFacultyName.trim() || !editFacultyDesignation.trim() || !editFacultyDeptId) {
      showNotif('error', 'Please fill out all required fields.');
      return;
    }
    setLoading(true);
    try {
      const updatedData: any = {
        name: editFacultyName.trim(),
        designation: editFacultyDesignation.trim(),
        departmentId: editFacultyDeptId,
      };
      updatedData.imageUrl = editFacultyImgUrl.trim() || '';
      updatedData.phone = editFacultyPhone.trim() || '';
      updatedData.email = editFacultyEmail.trim() || '';

      await updateDoc(doc(db, 'faculties', editingFaculty.id), updatedData);
      showNotif('success', `Faculty member "${editFacultyName}" successfully updated!`);
      setEditingFaculty(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      showNotif('error', 'Failed to update faculty member: ' + err.message);
    } finally {
      setLoading(false);
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
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Faculty Member',
      message: `Are you sure you want to delete "${name}"? This action is permanent.`,
      confirmText: 'Delete Member',
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteDoc(doc(db, 'faculties', facultyId));
          showNotif('success', `Faculty member "${name}" deleted.`);
          setRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
          showNotif('error', err.message);
        } finally {
          setLoading(false);
        }
        setConfirmDialog(null);
      }
    });
  }

  async function handleVerifyQuestion(questionId: string, action: 'published' | 'rejected', feedback: string = '') {
    try {
      await updateDoc(doc(db, 'questions', questionId), {
        status: action,
        verifiedByUID: currentUser.uid,
        verifiedByUsername: currentUser.username || 'Moderator',
        verificationFeedback: feedback.trim()
      });
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', `Question paper ${action === 'published' ? 'approved & published' : 'rejected'} successfully.`);
    } catch (err: any) {
      showNotif('error', err.message);
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
        await handleVerifyQuestion(questionId, action, text || '');
        setConfirmDialog(null);
      }
    });
  }

  // Filtering users / questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.teacher && q.teacher.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (paperStatusFilter === 'all') return true;
    if (paperStatusFilter === 'pending') return q.status === 'pending';
    if (paperStatusFilter === 'published') return q.status === 'published' || !q.status;
    if (paperStatusFilter === 'rejected') return q.status === 'rejected';

    return true;
  });

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Extract unique existing semester names and provide common academic options as defaults
  const uniqueSemesterNames = Array.from(new Set(semesters.map(s => s.name.trim()))).filter(Boolean);
  const defaultSemesterNames = [
    '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
    '5th Semester', '6th Semester', '7th Semester', '8th Semester',
    'Spring 2025', 'Summer 2025', 'Fall 2025',
    'Spring 2026', 'Summer 2026', 'Fall 2026',
    'Spring 2027', 'Summer 2027', 'Fall 2027'
  ];
  const allSemesterOptions = Array.from(
    new Set([...uniqueSemesterNames, ...defaultSemesterNames, ...customOptionList])
  ).sort(compareSemesterNames);

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
          <span className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">
            System Overseer: mr074770@gmail.com
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
          { id: 'reports', label: 'Moderation Reports', icon: Flag }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              id={`admin-tab-${tab.id}`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearchQuery('');
              }}
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
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500 mt-2">Updating dashboard data...</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-8 animate-fade-in">
          
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Batch *</label>
                    <select
                      value={selectedBatchId}
                      onChange={(e) => {
                        setSelectedBatchId(e.target.value);
                        setCheckedSemesterNames([]); // reset selection when batch changes
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Target Batch First</option>
                      {batches
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
                          disabled={checkedSemesterNames.length === 0 || loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 disabled:opacity-50 transition-all"
                        >
                          {loading ? (
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
                                onClick={() => promptFeedbackAndVerify(q.id, 'published')}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Approve and Publish Paper"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => promptFeedbackAndVerify(q.id, 'rejected')}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                                title="Reject and Hide Paper"
                              >
                                Reject
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

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faculty Image URL <span className="text-slate-400 font-normal">(Optional)</span></label>
                          <input
                            type="url"
                            value={editFacultyImgUrl}
                            onChange={(e) => setEditFacultyImgUrl(e.target.value)}
                            placeholder="e.g. https://example.com/photo.jpg"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
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
                          disabled={loading}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-98 transition-all flex items-center justify-center gap-2"
                        >
                          {loading ? (
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

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faculty Image URL <span className="text-slate-400 font-normal">(Optional)</span></label>
                          <input
                            type="url"
                            value={newFacultyImgUrl}
                            onChange={(e) => setNewFacultyImgUrl(e.target.value)}
                            placeholder="e.g. https://example.com/photo.jpg"
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
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
                          disabled={loading}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-98 transition-all flex items-center justify-center gap-2"
                        >
                          {loading ? (
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
                                        <span className="opacity-70">✉</span> {f.email}
                                      </span>
                                    )}
                                    {f.phone && (
                                      <span className="flex items-center gap-1 truncate">
                                        <span className="opacity-70">☎</span> {f.phone}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 mt-1">
                                  <span className="font-extrabold flex items-center gap-0.5">
                                    ★ {f.averageRating ? f.averageRating.toFixed(2) : '0.00'}
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
            onSuccess={() => {
              setRefreshTrigger(prev => prev + 1);
            }}
          />

        </div>
      )}
    </div>
  );
}
