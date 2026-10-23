import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, syncUserProfile } from './firebase/config';
import { Department, Batch, Semester, UserProfile } from './types';
import { sortSemestersDescending } from './utils/semesterSort';
import { sortDepartmentsAlphabetically } from './utils/departmentSort';

// Import modular sub-components
import Layout from './components/Layout';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import Leaderboard from './components/Leaderboard';
import QuestionDetail from './components/QuestionDetail';
import UploadModal from './components/UploadModal';
import FacultyRanking from './components/FacultyRanking';
import AcademicCalendar from './components/AcademicCalendar';

import { Loader2 } from 'lucide-react';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active View router
  const [activeView, setActiveView] = useState<'landing' | 'dashboard' | 'profile' | 'admin' | 'leaderboard' | 'faculty' | 'calendar'>('dashboard');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Global Academic Data Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [academicLoading, setAcademicLoading] = useState(true);

  // Floating Universal Upload Modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshDashboardTrigger, setRefreshDashboardTrigger] = useState(0);

  // Helper for question detail navigation with history push state
  const handleNavigateToQuestion = (id: string | null) => {
    if (id) {
      window.history.pushState({ type: 'question_detail', questionId: id }, '');
      setSelectedQuestionId(id);
    } else {
      if (window.history.state?.type === 'question_detail') {
        window.history.back();
      } else {
        setSelectedQuestionId(null);
      }
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.type === 'question_detail') {
        setSelectedQuestionId(e.state.questionId);
      } else {
        setSelectedQuestionId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- 1. USER AUTH SEED & DETECTOR ---
  useEffect(() => {
    let isInitial = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isInitial) {
        setAuthLoading(true);
      }
      if (firebaseUser) {
        try {
          const profile = await syncUserProfile(firebaseUser);
          setCurrentUser(profile);
          
          // Auto-direct to dashboard on first sign-in
          if (activeView === 'landing') {
            setActiveView('dashboard');
          }
        } catch (err) {
          console.error('Error syncing auth state profile:', err);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
      isInitial = false;
    });

    return () => unsubscribe();
  }, []);

  // --- 2. ACADEMIC DATA SEEDER & REAL-TIME LISTENERS ---
  useEffect(() => {
    let deptsInitial = false;
    let batchesInitial = false;
    let semestersInitial = false;

    const checkAllLoaded = () => {
      if (deptsInitial && batchesInitial && semestersInitial) {
        setAcademicLoading(false);
      }
    };

    // Real-time Departments Listener
    const unsubDepts = onSnapshot(collection(db, 'departments'), async (snap) => {
      // Auto-seed only if completely empty and admin is signed in
      const isAdminUser = currentUser && (
        currentUser.role === 'super_admin' || 
        currentUser.email?.toLowerCase() === 'mr074770@gmail.com'
      );

      if (snap.empty && isAdminUser) {
        console.log('Uttara University database is empty and Admin is connected. Auto-seeding default academic hierarchy...');
        try {
          const cseRef = await addDoc(collection(db, 'departments'), {
            name: 'Computer Science and Engineering',
            code: 'CSE',
            createdAt: new Date().toISOString()
          });
          const eeeRef = await addDoc(collection(db, 'departments'), {
            name: 'Electrical and Electronic Engineering',
            code: 'EEE',
            createdAt: new Date().toISOString()
          });
          const bbaRef = await addDoc(collection(db, 'departments'), {
            name: 'Business Administration',
            code: 'BBA',
            createdAt: new Date().toISOString()
          });

          const b60Ref = await addDoc(collection(db, 'batches'), {
            departmentId: cseRef.id,
            name: 'Batch 60',
            createdAt: new Date().toISOString()
          });
          const b61Ref = await addDoc(collection(db, 'batches'), {
            departmentId: cseRef.id,
            name: 'Batch 61',
            createdAt: new Date().toISOString()
          });
          const beeeRef = await addDoc(collection(db, 'batches'), {
            departmentId: eeeRef.id,
            name: 'Batch 48',
            createdAt: new Date().toISOString()
          });
          const bbbaRef = await addDoc(collection(db, 'batches'), {
            departmentId: bbaRef.id,
            name: 'Batch 55',
            createdAt: new Date().toISOString()
          });

          await addDoc(collection(db, 'semesters'), {
            batchId: b60Ref.id,
            name: 'Spring 2026',
            createdAt: new Date().toISOString()
          });
          await addDoc(collection(db, 'semesters'), {
            batchId: b60Ref.id,
            name: 'Summer 2026',
            createdAt: new Date().toISOString()
          });
          await addDoc(collection(db, 'semesters'), {
            batchId: beeeRef.id,
            name: 'Spring 2026',
            createdAt: new Date().toISOString()
          });
          await addDoc(collection(db, 'semesters'), {
            batchId: bbbaRef.id,
            name: 'Spring 2026',
            createdAt: new Date().toISOString()
          });
        } catch (seedErr) {
          console.error('Seeding error:', seedErr);
        }
      }

      const dList: Department[] = [];
      snap.forEach((doc) => dList.push({ id: doc.id, ...doc.data() } as Department));
      setDepartments(sortDepartmentsAlphabetically(dList));
      deptsInitial = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Departments subscription error:', err);
      deptsInitial = true;
      checkAllLoaded();
    });

    // Real-time Batches Listener
    const unsubBatches = onSnapshot(collection(db, 'batches'), (snap) => {
      const bList: Batch[] = [];
      snap.forEach((doc) => bList.push({ id: doc.id, ...doc.data() } as Batch));
      setBatches(bList);
      batchesInitial = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Batches subscription error:', err);
      batchesInitial = true;
      checkAllLoaded();
    });

    // Real-time Semesters Listener
    const unsubSemesters = onSnapshot(collection(db, 'semesters'), (snap) => {
      const sList: Semester[] = [];
      snap.forEach((doc) => sList.push({ id: doc.id, ...doc.data() } as Semester));
      setSemesters(sortSemestersDescending(sList));
      semestersInitial = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Semesters subscription error:', err);
      semestersInitial = true;
      checkAllLoaded();
    });

    return () => {
      unsubDepts();
      unsubBatches();
      unsubSemesters();
    };
  }, []);

  // Handle successful upload to trigger catalog updates
  async function handleUploadSuccess() {
    setRefreshDashboardTrigger((prev) => prev + 1);
    
    // Increment total contribution count for logged in user profile
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const nextUploadCount = (currentUser.uploadCount || 0) + 1;
        await updateDoc(userRef, {
          uploadCount: nextUploadCount
        });
        setCurrentUser({
          ...currentUser,
          uploadCount: nextUploadCount
        });
      } catch (err) {
        console.error('Failed to update upload count statistic:', err);
      }
    }
  }

  // Google Sign-In helper triggers
  async function triggerGoogleLogin() {
    window.dispatchEvent(new CustomEvent('trigger-google-login'));
  }

  return (
    <Layout
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
      activeView={activeView}
      setActiveView={(view) => {
        setActiveView(view);
        setSelectedQuestionId(null);
      }}
      onOpenUpload={() => setUploadOpen(true)}
    >
      {/* Absolute Loading HUD for startup */}
      {(authLoading || academicLoading) ? (
        <div className="flex flex-col items-center justify-center min-h-[70vh] bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-semibold text-slate-500 mt-3 font-display">Authorizing secure university access...</p>
        </div>
      ) : (
        <div className="relative min-h-[70vh]">
          
          {/* Main Visual routing */}
          {selectedQuestionId ? (
            <QuestionDetail
              questionId={selectedQuestionId}
              currentUser={currentUser}
              onBack={() => handleNavigateToQuestion(null)}
              onNavigateToQuestion={(id) => handleNavigateToQuestion(id)}
              onTriggerAuth={triggerGoogleLogin}
            />
          ) : (
            <>
              {activeView === 'landing' && (
                <Hero
                  currentUser={currentUser}
                  onNavigateToDashboard={() => setActiveView('dashboard')}
                  onTriggerAuth={triggerGoogleLogin}
                />
              )}

              {activeView === 'dashboard' && (
                <Dashboard
                  currentUser={currentUser}
                  onNavigateToQuestion={(id) => handleNavigateToQuestion(id)}
                  departments={departments}
                  batches={batches}
                  semesters={semesters}
                  onTriggerAuth={triggerGoogleLogin}
                  onNavigateToCalendar={() => setActiveView('calendar')}
                />
              )}

              {activeView === 'profile' && currentUser && (
                <Profile
                  currentUser={currentUser}
                  onNavigateToQuestion={(id) => handleNavigateToQuestion(id)}
                  onProfileUpdated={(updated) => setCurrentUser(updated)}
                />
              )}

              {activeView === 'admin' && currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                <AdminPanel
                  currentUser={currentUser}
                  onNavigateToQuestion={(id) => setSelectedQuestionId(id)}
                />
              )}

              {activeView === 'leaderboard' && (
                <Leaderboard
                  currentUser={currentUser}
                  onTriggerAuth={triggerGoogleLogin}
                  onOpenUpload={() => setUploadOpen(true)}
                  onNavigateToProfile={() => setActiveView('profile')}
                />
              )}

              {activeView === 'faculty' && (
                <FacultyRanking
                  currentUser={currentUser}
                  departments={departments}
                  onTriggerAuth={triggerGoogleLogin}
                />
              )}

              {activeView === 'calendar' && (
                <AcademicCalendar
                  currentUser={currentUser}
                  departments={departments}
                  onTriggerAuth={triggerGoogleLogin}
                  onNavigateToDashboardWithFilter={(deptId, examType) => {
                    setActiveView('dashboard');
                    // Store preferred filters in window or state if needed
                  }}
                />
              )}
            </>
          )}

          {/* Universal Upload Dialog */}
          <UploadModal
            isOpen={uploadOpen}
            onClose={() => setUploadOpen(false)}
            currentUser={currentUser}
            onUploadSuccess={handleUploadSuccess}
          />

        </div>
      )}
    </Layout>
  );
}
