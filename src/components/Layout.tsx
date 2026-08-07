import React, { useState } from 'react';
import { 
  ShieldAlert, 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
  Bell, 
  Upload, 
  BookOpen, 
  Shield, 
  Trophy, 
  Home,
  Menu,
  X,
  GraduationCap,
  Calendar,
  Linkedin,
  Github,
  Facebook,
  Users,
  ExternalLink,
  Mail,
  Cpu,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, googleProvider, syncUserProfile } from '../firebase/config';
import ThemeToggle from './ThemeToggle';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  activeView: 'landing' | 'dashboard' | 'profile' | 'admin' | 'leaderboard' | 'faculty' | 'calendar';
  setActiveView: (view: 'landing' | 'dashboard' | 'profile' | 'admin' | 'leaderboard' | 'faculty' | 'calendar') => void;
  onOpenUpload: () => void;
}

export default function Layout({ 
  children, 
  currentUser, 
  setCurrentUser, 
  activeView, 
  setActiveView,
  onOpenUpload 
}: LayoutProps) {
  
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Handle redirect sign-in result on page mount (for existing redirect sessions)
  React.useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          const profile = await syncUserProfile(result.user);
          setCurrentUser(profile);
        }
      })
      .catch((err: any) => {
        console.error('Redirect sign-in result error:', err);
        if (
          err?.code === 'auth/popup-closed-by-user' || 
          err?.code === 'auth/cancelled-popup-request' ||
          err?.code === 'auth/user-cancelled'
        ) {
          return;
        }
      });
  }, []);

  async function handleLogin() {
    setAuthError(null);
    setIsLoggingIn(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) {
        const profile = await syncUserProfile(result.user);
        setCurrentUser(profile);
      }
    } catch (err: any) {
      console.error('Google Auth Login error:', err);

      // Ignore normal user close or cancellation actions
      if (
        err?.code === 'auth/popup-closed-by-user' || 
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/user-cancelled'
      ) {
        setIsLoggingIn(false);
        return;
      }

      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Sign-in window was blocked by your browser settings. Please allow popups for this site and click Sign In again.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError('This website domain is pending authorization in Firebase Auth settings.');
      } else {
        setAuthError(err?.message || 'Sign-in could not be completed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setActiveView('landing');
      setShowUserDropdown(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  return (
    <div id="layout-container" className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* Premium Top Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-900/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Left Brand Area */}
            <div className="flex items-center gap-8">
              <div 
                onClick={() => {
                  setActiveView('dashboard');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/15 group-hover:scale-105 transition-all">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-lg tracking-tight font-display text-slate-950 dark:text-white">
                    UU Qn Bank
                  </span>
                  <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 tracking-widest uppercase">
                    Uttara University
                  </p>
                </div>
              </div>

              {/* Desktop Nav Items */}
              <div className="hidden md:flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <button
                  id="nav-home-btn"
                  onClick={() => setActiveView('dashboard')}
                  className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                    activeView === 'dashboard' ? 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-white' : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>
                <button
                  id="nav-leaderboard-btn"
                  onClick={() => setActiveView('leaderboard')}
                  className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                    activeView === 'leaderboard' ? 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-white' : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  Honor Roll
                </button>
                <button
                  id="nav-faculty-btn"
                  onClick={() => setActiveView('faculty')}
                  className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                    activeView === 'faculty' ? 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-white' : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  Faculty Ranking
                </button>
                <button
                  id="nav-calendar-btn"
                  onClick={() => setActiveView('calendar')}
                  className={`px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                    activeView === 'calendar' ? 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-white' : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  Academic Calendar
                </button>

                {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                  <button
                    id="nav-admin-btn"
                    onClick={() => setActiveView('admin')}
                    className={`px-3.5 py-1.5 rounded-xl text-red-600 dark:text-red-400 transition-colors flex items-center gap-1.5 ${
                      activeView === 'admin' ? 'bg-red-500/10 border border-red-500/20' : 'hover:bg-red-500/5'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </button>
                )}
              </div>
            </div>

            {/* Right Interactive Area */}
            <div className="hidden md:flex items-center gap-4">
              <ThemeToggle />

              <button
                id="nav-upload-trigger-btn"
                onClick={() => {
                  if (!currentUser) {
                    handleLogin();
                  } else {
                    onOpenUpload();
                  }
                }}
                disabled={isLoggingIn}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/15 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Paper {!currentUser && '(Login Required)'}</span>
                  </>
                )}
              </button>

              {currentUser ? (
                <div className="relative">
                  <button
                    id="nav-user-dropdown-btn"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800 rounded-xl hover:bg-slate-100 transition-all text-left cursor-pointer"
                  >
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.username} 
                      className="w-8 h-8 rounded-full border border-slate-200/30 object-cover"
                    />
                    <div className="pr-2 leading-tight">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">@{currentUser.username}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 capitalize">
                        {currentUser.role === 'super_admin' ? 'Admin' : currentUser.role === 'moderator' ? 'Moderator' : 'Student'}
                      </p>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pr-1" />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2.5 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-xl p-1.5 z-50">
                      <button
                        id="dropdown-profile-btn"
                        onClick={() => {
                          setActiveView('profile');
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors font-medium text-left cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4" />
                        My Profile Workspace
                      </button>
                      <div className="border-t border-slate-100 dark:border-slate-900 my-1"></div>
                      <button
                        id="dropdown-logout-btn"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors font-semibold text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  id="nav-login-btn"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-5 py-2.5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-extrabold rounded-xl hover:opacity-90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign In with Google</span>
                  )}
                </button>
              )}
            </div>

            {/* Mobile Hamburger toggle */}
            <div className="flex items-center md:hidden gap-3">
              <ThemeToggle />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Flyout Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 p-4 space-y-4 shadow-xl">
            <div className="flex flex-col gap-2 font-semibold">
              <button
                onClick={() => {
                  setActiveView('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-left ${activeView === 'dashboard' ? 'bg-slate-100 dark:bg-slate-900 text-indigo-600' : ''}`}
              >
                Home
              </button>
              <button
                onClick={() => {
                  setActiveView('leaderboard');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-left ${activeView === 'leaderboard' ? 'bg-slate-100 dark:bg-slate-900 text-indigo-600' : ''}`}
              >
                Honor Roll
              </button>
              <button
                onClick={() => {
                  setActiveView('faculty');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-left ${activeView === 'faculty' ? 'bg-slate-100 dark:bg-slate-900 text-indigo-600' : ''}`}
              >
                Faculty Ranking
              </button>
              <button
                onClick={() => {
                  setActiveView('calendar');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-left flex items-center justify-between ${activeView === 'calendar' ? 'bg-slate-100 dark:bg-slate-900 text-indigo-600 font-bold' : ''}`}
              >
                <span>Academic Calendar & Countdown</span>
                <Calendar className="w-4 h-4 text-indigo-500" />
              </button>

              {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                <button
                  onClick={() => {
                    setActiveView('admin');
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-left text-red-600 ${activeView === 'admin' ? 'bg-red-500/10' : ''}`}
                >
                  Admin Panel
                </button>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-900 pt-3 flex flex-col gap-3">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <img src={currentUser.photoURL} alt={currentUser.username} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-bold text-slate-950 dark:text-white">@{currentUser.username}</p>
                      <p className="text-[10px] text-slate-500">{currentUser.email}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setActiveView('profile');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 bg-slate-100 dark:bg-slate-900 rounded-xl font-bold text-xs"
                  >
                    View My Profile Workspace
                  </button>

                  <button
                    onClick={onOpenUpload}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Paper
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full py-2 bg-red-50 text-red-600 dark:bg-red-950/25 dark:text-red-400 rounded-xl font-bold text-xs"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      handleLogin();
                      setMobileMenuOpen(false);
                    }}
                    disabled={isLoggingIn}
                    className="w-full py-2.5 bg-indigo-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Paper (Login Required)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      handleLogin();
                      setMobileMenuOpen(false);
                    }}
                    disabled={isLoggingIn}
                    className="w-full py-2.5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In with Google</span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Core View Area */}
      <main className="flex-1">
        {authError && (
          <div className="max-w-xl mx-auto mt-6 mx-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-amber-950 dark:text-amber-200">Sign-In Notice</h4>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{authError}</p>
              
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5" />
                  )}
                  <span>Try Sign In Again</span>
                </button>
              </div>
            </div>
            <button 
              onClick={() => setAuthError(null)} 
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg shrink-0 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </main>

      {/* Amazon-Style Multi-Column Academic Footer */}
      <footer className="bg-slate-950 text-slate-300 text-xs border-t border-slate-800/80 transition-all duration-300">
        
        {/* Amazon-style Back to Top Bar */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors border-b border-slate-800 flex items-center justify-center gap-2 cursor-pointer shadow-inner"
        >
          <span>Back to top</span>
          <ChevronUp className="w-4 h-4 text-indigo-400" />
        </button>

        {/* Main Amazon Multi-Column Directory Links */}
        <div className="bg-slate-900/90 py-12 px-6 sm:px-10 border-b border-slate-800/80">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Column 1: Get to Know Us */}
            <div className="space-y-3">
              <h4 className="text-white font-extrabold text-sm uppercase tracking-wider border-b border-indigo-500/40 pb-2 inline-block">
                Get to Know Us
              </h4>
              <ul className="space-y-2 text-slate-400 font-medium text-xs">
                <li>
                  <button onClick={() => setActiveView('dashboard')} className="hover:text-white hover:underline transition-colors text-left">
                    About UU Qn Bank
                  </button>
                </li>
                <li>
                  <a href="https://www.facebook.com/uumlc" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline transition-colors flex items-center gap-1">
                    Machine Learning Club (UUMLC)
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <button onClick={() => setActiveView('dashboard')} className="hover:text-white hover:underline transition-colors text-left">
                    Uttara University Departments
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveView('leaderboard')} className="hover:text-white hover:underline transition-colors text-left">
                    Top Student Contributors
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: Quick Navigation */}
            <div className="space-y-3">
              <h4 className="text-white font-extrabold text-sm uppercase tracking-wider border-b border-indigo-500/40 pb-2 inline-block">
                Quick Navigation
              </h4>
              <ul className="space-y-2 text-slate-400 font-medium text-xs">
                <li>
                  <button onClick={() => setActiveView('dashboard')} className="hover:text-white hover:underline transition-colors text-left flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Home Dashboard</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveView('calendar')} className="hover:text-white hover:underline transition-colors text-left flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Academic Calendar</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveView('leaderboard')} className="hover:text-white hover:underline transition-colors text-left flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Honor Roll</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveView('faculty')} className="hover:text-white hover:underline transition-colors text-left flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Faculty Ranking</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Academic Resources */}
            <div className="space-y-3">
              <h4 className="text-white font-extrabold text-sm uppercase tracking-wider border-b border-indigo-500/40 pb-2 inline-block">
                Academic Resources
              </h4>
              <ul className="space-y-2 text-slate-400 font-medium text-xs">
                <li>
                  <button onClick={() => setActiveView('dashboard')} className="hover:text-white hover:underline transition-colors text-left">
                    Mid-Term Exam Papers
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveView('dashboard')} className="hover:text-white hover:underline transition-colors text-left">
                    Final Exam Papers
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenUpload()} className="hover:text-white hover:underline transition-colors text-left">
                    Upload Exam Question
                  </button>
                </li>
                <li>
                  <a href="mailto:mlclubuttarauniversity@gmail.com" className="hover:text-white hover:underline transition-colors text-left">
                    Request Paper Verification
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Main Club & Socials */}
            <div className="space-y-3">
              <h4 className="text-white font-extrabold text-sm uppercase tracking-wider border-b border-indigo-500/40 pb-2 inline-block">
                Main Club & Socials
              </h4>
              <div className="space-y-2">
                <div className="flex flex-col gap-2">
                  <a
                    href="https://www.facebook.com/uumlc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white text-slate-400 flex items-center gap-2 hover:underline"
                  >
                    <Facebook className="w-4 h-4 text-blue-500" />
                    <span>FB Page (uumlc)</span>
                  </a>
                  <a
                    href="https://www.facebook.com/groups/1721881928020923"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white text-slate-400 flex items-center gap-2 hover:underline"
                  >
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>FB Community Group</span>
                  </a>
                  <a
                    href="https://www.linkedin.com/company/machine-learning-club-uttara-university/posts/?feedView=all"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white text-slate-400 flex items-center gap-2 hover:underline"
                  >
                    <Linkedin className="w-4 h-4 text-sky-400" />
                    <span>LinkedIn Organization</span>
                  </a>
                  <a
                    href="https://github.com/ml-clubuu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white text-slate-400 flex items-center gap-2 hover:underline"
                  >
                    <Github className="w-4 h-4 text-slate-200" />
                    <span>GitHub Open Source</span>
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Amazon-style Secondary Brand Bar */}
        <div className="py-8 px-6 text-center border-b border-slate-900 bg-slate-950">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center space-y-4">
            
            <div className="flex items-center gap-3">
              <img 
                src="https://i.ibb.co.com/DfpPDbVb/Code-Generated-Image.jpg" 
                alt="Machine Learning Club UU Logo" 
                className="w-11 h-11 object-cover rounded-xl border border-indigo-500/40 shadow-lg shadow-indigo-600/20 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <span className="font-black text-white text-sm tracking-tight block">
                  UU Qn Bank
                </span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                  Machine Learning Club Uttara University
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
              Official academic question bank preservation portal managed by Machine Learning Club, Uttara University. Dedicated to helping students prepare for Mid-Term & Final examinations seamlessly.
            </p>

            {/* Official Emails */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-slate-300 font-semibold">
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>Club Mail:</span>
                <a href="mailto:mlclubuttarauniversity@gmail.com" className="text-indigo-400 hover:underline">
                  mlclubuttarauniversity@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>System Mail:</span>
                <a href="mailto:uuqnbank@gmail.com" className="text-indigo-400 hover:underline">
                  uuqnbank@gmail.com
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* Amazon-style Copyright Sub-footer */}
        <div className="py-6 px-4 bg-slate-950 text-slate-500 text-[11px] text-center">
          <p>© {new Date().getFullYear()} Machine Learning Club, Uttara University (UUMLC). All Rights Reserved.</p>
        </div>

      </footer>

    </div>
  );
}
