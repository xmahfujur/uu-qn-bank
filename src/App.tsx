import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc,
  setDoc,
  updateDoc
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

import { Upload, HelpCircle, Loader2 } from 'lucide-react';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active View router
  const [activeView, setActiveView] = useState<'landing' | 'dashboard' | 'profile' | 'admin' | 'leaderboard' | 'faculty'>('dashboard');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Global Academic Data Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [academicLoading, setAcademicLoading] = useState(true);

  // Floating Universal Upload Modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshDashboardTrigger, setRefreshDashboardTrigger] = useState(0);

  // --- 1. USER AUTH SEED & DETECTOR ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
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
    });

    return () => unsubscribe();
  }, []);

  // --- 2. ACADEMIC DATA SEEDER & LOADER ---
  useEffect(() => {
    async function loadAcademicHierarchy() {
      setAcademicLoading(true);
      try {
        const deptSnap = await getDocs(collection(db, 'departments'));
        
        // AUTO-SEEDER: If no departments exist, populate Uttara University catalog automatically
        // ONLY trigger if the database is empty AND the user is logged in as an admin
        const isAdminUser = currentUser && (
          currentUser.role === 'super_admin' || 
          currentUser.email?.toLowerCase() === 'mr074770@gmail.com'
        );

        if (deptSnap.empty && isAdminUser) {
          console.log('Uttara University database is empty and Admin is connected. Auto-seeding default academic hierarchy...');
          
          // A. Create Departments
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

          // B. Create Batches for CSE
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

          // Create Batches for EEE & BBA
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

          // C. Create Semesters for CSE Batch 60
          const s1Ref = await addDoc(collection(db, 'semesters'), {
            batchId: b60Ref.id,
            name: 'Spring 2026',
            createdAt: new Date().toISOString()
          });
          const s2Ref = await addDoc(collection(db, 'semesters'), {
            batchId: b60Ref.id,
            name: 'Summer 2026',
            createdAt: new Date().toISOString()
          });

          // Create Semesters for other batches
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

          // D. Create Realistic Sample Questions papers
          await addDoc(collection(db, 'questions'), {
            courseCode: 'CSE 112',
            courseName: 'Structured Programming Language',
            teacher: 'Dr. M. R. Rahman',
            imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600',
            pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            departmentId: cseRef.id,
            batchId: b60Ref.id,
            semesterId: s1Ref.id,
            examType: 'Mid',
            uploadedByUID: 'system_seeder',
            uploadedByUsername: 'founding_scholar',
            uploadedAt: new Date().toISOString(),
            reportCount: 0,
            downloads: 12,
            views: 45,
            likes: 5,
            likedBy: [],
            bookmarks: []
          });

          await addDoc(collection(db, 'questions'), {
            courseCode: 'CSE 211',
            courseName: 'Object Oriented Programming',
            teacher: 'Prof. J. Hasan',
            imageUrl: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=600',
            departmentId: cseRef.id,
            batchId: b60Ref.id,
            semesterId: s2Ref.id,
            examType: 'Final',
            uploadedByUID: 'system_seeder',
            uploadedByUsername: 'scholar_contributor',
            uploadedAt: new Date().toISOString(),
            reportCount: 0,
            downloads: 24,
            views: 92,
            likes: 8,
            likedBy: [],
            bookmarks: []
          });

          console.log('Auto-seeding of Uttara University completed successfully!');
        }

        // Load Departments
        const dSnap = await getDocs(collection(db, 'departments'));
        const dList: Department[] = [];
        dSnap.forEach((doc) => dList.push({ id: doc.id, ...doc.data() } as Department));
        setDepartments(sortDepartmentsAlphabetically(dList));

        // Load Batches
        const bSnap = await getDocs(collection(db, 'batches'));
        const bList: Batch[] = [];
        bSnap.forEach((doc) => bList.push({ id: doc.id, ...doc.data() } as Batch));
        setBatches(bList);

        // Load Semesters
        const sSnap = await getDocs(collection(db, 'semesters'));
        const sList: Semester[] = [];
        sSnap.forEach((doc) => sList.push({ id: doc.id, ...doc.data() } as Semester));
        setSemesters(sortSemestersDescending(sList));

      } catch (err) {
        console.error('Error loading initial academic assets:', err);
      } finally {
        setAcademicLoading(false);
      }
    }

    loadAcademicHierarchy();
  }, [refreshDashboardTrigger, currentUser]);

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
    // Layout contains sign-in handlers, but this handles helper prompts
    const btn = document.getElementById('nav-login-btn') || document.getElementById('hero-signup-btn');
    if (btn) btn.click();
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
              onBack={() => setSelectedQuestionId(null)}
              onNavigateToQuestion={(id) => setSelectedQuestionId(id)}
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
                  onNavigateToQuestion={(id) => setSelectedQuestionId(id)}
                  departments={departments}
                  batches={batches}
                  semesters={semesters}
                  onTriggerAuth={triggerGoogleLogin}
                />
              )}

              {activeView === 'profile' && currentUser && (
                <Profile
                  currentUser={currentUser}
                  onNavigateToQuestion={(id) => setSelectedQuestionId(id)}
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
                <Leaderboard />
              )}

              {activeView === 'faculty' && (
                <FacultyRanking
                  currentUser={currentUser}
                  departments={departments}
                  onTriggerAuth={triggerGoogleLogin}
                />
              )}
            </>
          )}

          {/* Floating Universal Upload trigger button */}
          {!selectedQuestionId && activeView !== 'landing' && (
            <button
              id="universal-float-upload-btn"
              onClick={() => {
                if (!currentUser) {
                  triggerGoogleLogin();
                } else {
                  setUploadOpen(true);
                }
              }}
              className="fixed bottom-6 right-6 z-30 p-4 bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95 text-white rounded-full shadow-2xl shadow-indigo-600/30 flex items-center justify-center transition-all group"
              title="Upload question paper"
            >
              <Upload className="w-5.5 h-5.5 transition-transform group-hover:rotate-6" />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 font-bold text-xs uppercase tracking-wider transition-all duration-300">
                Upload Paper {!currentUser && '(Login Required)'}
              </span>
            </button>
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
