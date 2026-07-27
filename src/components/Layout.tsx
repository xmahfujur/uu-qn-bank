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
  Cpu
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

  // Handle redirect sign-in result on page mount
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
        let errorMsg = err?.message || String(err);
        if (err?.code === 'auth/unauthorized-domain') {
          errorMsg = 'This domain is not authorized for Firebase Authentication. You must add this domain to the "Authorised domains" list in your Firebase Console under Authentication -> Settings -> Authorised domains.';
        } else if (err?.code === 'auth/operation-not-allowed') {
          errorMsg = 'Google Sign-In is not enabled as a sign-in provider in your Firebase project. Please enable Google under Authentication -> Sign-in method in the Firebase Console.';
        }
        setAuthError(errorMsg);
      });
  }, []);

  async function handleLogin() {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserProfile(result.user);
      setCurrentUser(profile);
    } catch (err: any) {
      console.error('Google Auth Login error:', err);
      let errorMsg = err?.message || String(err);
      if (err?.code === 'auth/unauthorized-domain') {
        errorMsg = 'This domain is not authorized for Firebase Authentication. You must add this domain to the "Authorised domains" list in your Firebase Console under Authentication -> Settings -> Authorised domains.';
      } else if (err?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Google Sign-In is not enabled as a sign-in provider in your Firebase project. Please enable Google under Authentication -> Sign-in method in the Firebase Console.';
      } else if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup') || err?.message?.includes('closed by user')) {
        // If popup was blocked or closed, notify user and attempt redirect sign-in immediately
        console.log('Popup blocked or closed by user. Trying redirect sign-in...');
        setAuthError('Popup blocked by browser. Attempting direct redirect login...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          console.error('Redirect login error:', redirectErr);
          errorMsg = 'Popup was blocked by your browser and direct redirect sign-in failed. Please enable popups or try again.';
        }
      }
      setAuthError(errorMsg);
    }
  }

  async function handleLoginWithRedirect() {
    setAuthError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Auth Redirect error:', err);
      let errorMsg = err?.message || String(err);
      if (err?.code === 'auth/unauthorized-domain') {
        errorMsg = 'This domain is not authorized for Firebase Authentication. You must add this domain to the "Authorised domains" list in your Firebase Console under Authentication -> Settings -> Authorised domains.';
      } else if (err?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Google Sign-In is not enabled as a sign-in provider in your Firebase project. Please enable Google under Authentication -> Sign-in method in the Firebase Console.';
      }
      setAuthError(errorMsg);
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/15 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Paper {!currentUser && '(Login Required)'}
              </button>

              {currentUser ? (
                <div className="relative">
                  <button
                    id="nav-user-dropdown-btn"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800 rounded-xl hover:bg-slate-100 transition-all text-left"
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors font-medium text-left"
                      >
                        <UserIcon className="w-4 h-4" />
                        My Profile Workspace
                      </button>
                      <div className="border-t border-slate-100 dark:border-slate-900 my-1"></div>
                      <button
                        id="dropdown-logout-btn"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors font-semibold text-left"
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
                  className="px-5 py-2.5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-extrabold rounded-xl hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
                >
                  Sign In with Google
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
                    className="w-full py-2.5 bg-indigo-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Paper (Login Required)
                  </button>

                  <button
                    onClick={() => {
                      handleLogin();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-extrabold rounded-xl text-xs"
                  >
                    Sign In with Google
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
          <div className="max-w-4xl mx-auto mt-6 mx-4 p-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex gap-4 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400 shrink-0 self-start">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-sm text-red-950 dark:text-red-200 font-display">Firebase Auth Setup / Popup Blocked</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{authError}</p>
              
              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleLoginWithRedirect}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Sign In with Redirect (No Popups)
                </button>
              </div>

              <div className="mt-4 text-xs bg-white/70 dark:bg-slate-900/50 rounded-xl p-4 border border-red-100 dark:border-red-950/70">
                <p className="font-bold text-slate-900 dark:text-slate-100 mb-2">How to solve this in 3 easy steps:</p>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400">
                  <li>
                    Open your <a href={`https://console.firebase.google.com/project/${auth.app.options.projectId}/authentication/settings`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold inline-flex items-center gap-0.5">
                      Firebase Console settings
                    </a>
                  </li>
                  <li>
                    Navigate to <span className="font-bold text-slate-800 dark:text-slate-200">Authorized domains</span> and add: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">{window.location.hostname}</code> (or your Vercel URL, e.g., <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">*.vercel.app</code>)
                  </li>
                  <li>
                    Ensure <span className="font-bold text-slate-800 dark:text-slate-200">Google Sign-In</span> is enabled under the <span className="font-bold text-slate-800 dark:text-slate-200">Sign-in method</span> tab in your Firebase Console.
                  </li>
                </ol>
              </div>
            </div>
            <button 
              onClick={() => setAuthError(null)} 
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg self-start transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </main>

      {/* Academic Premium Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/60 dark:border-slate-900/80 transition-all duration-300 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8">
          
          {/* Brand & Club Info */}
          <div className="space-y-3 text-center lg:text-left max-w-sm">
            <div className="flex items-center justify-center lg:justify-start gap-2.5">
              <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base text-slate-900 dark:text-white font-display block leading-tight">
                  UU Qn Bank
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Machine Learning Club Uttara University
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Official academic question bank preservation project managed by the Machine Learning Club of Uttara University.
            </p>
          </div>

          {/* Social Links Section */}
          <div className="flex flex-col items-center lg:items-end space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Connect With Our Main Club
            </span>

            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5">
              {/* FB Page */}
              <a
                href="https://www.facebook.com/uumlc"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 group"
                title="Facebook Page - Machine Learning Club Uttara University"
              >
                <Facebook className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>FB Page</span>
                <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              {/* FB Group */}
              <a
                href="https://www.facebook.com/groups/1721881928020923"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 group"
                title="Facebook Community Group - Machine Learning Club Uttara University"
              >
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>FB Group</span>
                <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/machine-learning-club-uttara-university/posts/?feedView=all"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-sky-600/10 hover:bg-sky-600/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 group"
                title="LinkedIn Page - Machine Learning Club Uttara University"
              >
                <Linkedin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>LinkedIn</span>
                <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/ml-clubuu"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-900/10 hover:bg-slate-900/20 dark:bg-slate-800/60 dark:hover:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 group"
                title="GitHub Organization - ML Club Uttara University"
              >
                <Github className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Copyright & Contact */}
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
          <p>© {new Date().getFullYear()} Machine Learning Club, Uttara University (UUMLC). All Rights Reserved.</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-2 gap-y-1 font-medium">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-500" />
              <span>Contact:</span>
            </div>
            <a href="mailto:mlclubuttarauniversity@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">
              mlclubuttarauniversity@gmail.com
            </a>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a href="mailto:uuqnbank@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">
              uuqnbank@gmail.com
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
