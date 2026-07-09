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
  ArrowRight
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
import { Department, Batch, Semester, QuestionPaper, Report, UserProfile } from '../types';

interface AdminPanelProps {
  currentUser: any;
  onNavigateToQuestion: (questionId: string) => void;
}

export default function AdminPanel({ currentUser, onNavigateToQuestion }: AdminPanelProps) {
  // Navigation inside Admin Panel
  const [activeTab, setActiveTab] = useState<'analytics' | 'hierarchy' | 'questions' | 'users' | 'reports'>('analytics');

  // Loaders
  const [loading, setLoading] = useState(false);

  // Core Data Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [questions, setQuestions] = useState<QuestionPaper[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  // Selection states for hierarchies
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Creation/Edit Dialog States
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newBatchName, setNewBatchName] = useState('');
  const [newSemesterName, setNewSemesterName] = useState('');
  const [selectedSemesterOption, setSelectedSemesterOption] = useState('');
  const [customSemesterName, setCustomSemesterName] = useState('');

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paperStatusFilter, setPaperStatusFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('pending');
  const [feedbackPaperId, setFeedbackPaperId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        setDepartments(depts);

        // Load Batches
        const batchSnap = await getDocs(collection(db, 'batches'));
        const bList: Batch[] = [];
        batchSnap.forEach(doc => bList.push({ id: doc.id, ...doc.data() } as Batch));
        setBatches(bList);

        // Load Semesters
        const semSnap = await getDocs(collection(db, 'semesters'));
        const sList: Semester[] = [];
        semSnap.forEach(doc => sList.push({ id: doc.id, ...doc.data() } as Semester));
        setSemesters(sList);

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
    if (!window.confirm('Are you sure you want to delete this department? All associated papers/batches will remain but lose parent context.')) return;
    try {
      await deleteDoc(doc(db, 'departments', deptId));
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Department deleted.');
    } catch (err: any) {
      showNotif('error', err.message);
    }
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
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      await deleteDoc(doc(db, 'batches', batchId));
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Batch deleted.');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  async function handleCreateSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBatchId || !newSemesterName) {
      showNotif('error', 'Please select a batch and enter semester name.');
      return;
    }
    
    const formattedName = newSemesterName.trim();
    
    // Check if this batch already has this semester
    const exists = semesters.some(s => s.batchId === selectedBatchId && s.name.toLowerCase() === formattedName.toLowerCase());
    if (exists) {
      showNotif('error', `Semester "${formattedName}" is already assigned to this batch.`);
      return;
    }

    try {
      await addDoc(collection(db, 'semesters'), {
        batchId: selectedBatchId,
        name: formattedName,
        createdAt: new Date().toISOString()
      });
      setNewSemesterName('');
      setSelectedSemesterOption('');
      setCustomSemesterName('');
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Semester folder created and assigned!');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  async function handleDeleteSemester(semId: string) {
    if (!window.confirm('Are you sure you want to delete this semester folder?')) return;
    try {
      await deleteDoc(doc(db, 'semesters', semId));
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Semester deleted.');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  // --- ACTIONS ON QUESTIONS ---

  async function handleDeleteQuestion(id: string) {
    if (!window.confirm('Delete this question paper permanently? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'questions', id));
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Question paper deleted successfully.');
    } catch (err: any) {
      showNotif('error', err.message);
    }
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
    if (!window.confirm('Resolve report by deleting the question paper permanently?')) return;
    try {
      await deleteDoc(doc(db, 'questions', questionId));
      await deleteDoc(doc(db, 'reports', reportId));
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', 'Report resolved: Question paper deleted.');
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  // --- ACTIONS ON USERS ---

  async function handleToggleBanUser(userId: string, isCurrentlyBanned: boolean) {
    const action = isCurrentlyBanned ? 'Unban' : 'Ban';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      // We will model user ban by putting status: 'banned' or updating role
      await updateDoc(doc(db, 'users', userId), {
        status: isCurrentlyBanned ? 'active' : 'banned'
      });
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', `User ${isCurrentlyBanned ? 'unbanned' : 'banned'} successfully.`);
    } catch (err: any) {
      showNotif('error', err.message);
    }
  }

  async function handleChangeUserRole(userId: string, newRole: 'super_admin' | 'moderator' | 'user') {
    if (userId === currentUser.uid) {
      showNotif('error', 'You cannot change your own role.');
      return;
    }
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setRefreshTrigger(prev => prev + 1);
      showNotif('success', `User role updated to ${newRole} successfully.`);
    } catch (err: any) {
      showNotif('error', err.message);
    }
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
    const feedback = window.prompt(`[Optional] Enter verification feedback or notes for this ${verb}:`);
    if (feedback === null) return; // User cancelled
    await handleVerifyQuestion(questionId, action, feedback);
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
    'Spring 2025', 'Summer 2025', 'Fall 2025',
    'Spring 2026', 'Summer 2026', 'Fall 2026',
    'Spring 2027', 'Summer 2027', 'Fall 2027'
  ];
  const allSemesterOptions = Array.from(
    new Set([...uniqueSemesterNames, ...defaultSemesterNames])
  ).sort((a: string, b: string) => a.localeCompare(b));

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
                  <p className="text-xs text-slate-500">Create semester folders under a student batch</p>
                </div>

                <div className="space-y-3">
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Select Target Batch</option>
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

                  <form onSubmit={handleCreateSemester} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Select Semester Name</label>
                      <select
                        value={selectedSemesterOption}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSemesterOption(val);
                          if (val !== 'custom') {
                            setNewSemesterName(val);
                          } else {
                            setNewSemesterName('');
                          }
                        }}
                        disabled={!selectedBatchId}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 disabled:opacity-50"
                      >
                        <option value="">-- Choose Existing / Default --</option>
                        {allSemesterOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="custom">+ Create New Custom Semester</option>
                      </select>
                    </div>

                    {selectedSemesterOption === 'custom' && (
                      <div className="space-y-1 animate-fade-in">
                        <label className="text-xs font-semibold text-slate-500">Custom Semester Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Summer 2026, Fall 2026"
                          value={customSemesterName}
                          onChange={(e) => {
                            setCustomSemesterName(e.target.value);
                            setNewSemesterName(e.target.value);
                          }}
                          disabled={!selectedBatchId}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!selectedBatchId || !newSemesterName}
                      className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Add / Assign Semester
                    </button>
                  </form>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {semesters
                    .filter((s) => !selectedBatchId || s.batchId === selectedBatchId)
                    .map((sem) => {
                      const b = batches.find(batch => batch.id === sem.batchId);
                      const d = b ? departments.find(dept => dept.id === b.departmentId) : null;
                      return (
                        <div key={sem.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-xl">
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
                          👁️ {q.views} / 📥 {q.downloads}
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
                          <td className="p-4 font-mono text-xs text-rose-500">❤️ {u.likesReceived || 0}</td>
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

        </div>
      )}
    </div>
  );
}
