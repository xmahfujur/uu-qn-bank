import React, { useState, useEffect } from 'react';
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
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  Globe
} from 'lucide-react';
import { signInWithPopup, getRedirectResult, signOut } from 'firebase/auth';
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [popupBlockedModal, setPopupBlockedModal] = useState(false);
  const [showInAppModal, setShowInAppModal] = useState(false);

  // Synchronous and comprehensive in-app browser detection
  const isAppInAppBrowser = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    
    // 1. Social Media Apps (Facebook, Messenger, Instagram, Line, Twitter/X, WeChat, TikTok, Snapchat, WhatsApp)
    const socialInApp = /FBAN|FBAV|FB_IAB|FB4A|FBSS|FBIOS|Messenger|Instagram|Line|Twitter|MicroMessenger|Snapchat|TikTok|Bytedance|musical_ly|WhatsApp/i.test(ua);
    if (socialInApp) return true;

    // 2. Android WebView detection (Android with '; wv)' or 'Version/X.X Chrome')
    const isAndroidWebView = /Android/i.test(ua) && (/;\s*wv\)/i.test(ua) || /Version\/[0-9.]+\s+(?:Mobile\s+)?Chrome/i.test(ua) || /Version\/[0-9.]+/i.test(ua));
    if (isAndroidWebView) return true;

    // 3. iOS WebView detection (contains AppleWebKit but not standard Safari / Chrome iOS)
    const isIOS = /(iPhone|iPod|iPad)/i.test(ua);
    const isIOSWebView = isIOS && /AppleWebKit/i.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS/i.test(ua);
    if (isIOSWebView) return true;

    return false;
  };

  const [isInAppBrowser, setIsInAppBrowser] = useState(() => isAppInAppBrowser());

  useEffect(() => {
    setIsInAppBrowser(isAppInAppBrowser());
  }, []);

  // Listen to global trigger-google-login event so any button in the app can trigger login cleanly
  useEffect(() => {
    const handleTriggerLoginEvent = () => {
      handleLogin();
    };
    window.addEventListener('trigger-google-login', handleTriggerLoginEvent);
    return () => window.removeEventListener('trigger-google-login', handleTriggerLoginEvent);
  }, []);

  // Handle redirect sign-in result on page mount gracefully without throwing
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          const profile = await syncUserProfile(result.user);
          setCurrentUser(profile);
        }
      })
      .catch((err: any) => {
        // Silently catch known partitioned storage or cancelled errors
        if (
          err?.code === 'auth/missing-initial-state' ||
          err?.code === 'auth/popup-closed-by-user' || 
          err?.code === 'auth/cancelled-popup-request' ||
          err?.code === 'auth/user-cancelled'
        ) {
          return;
        }
        if (err?.code === 'auth/unauthorized-domain') {
          const domain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
          setUnauthorizedDomain(domain);
        }
      });
  }, []);

  function openInExternalChrome() {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (isAndroid) {
      // Android intent to open native Chrome browser
      const hostAndPath = window.location.href.replace(/^https?:\/\//, '');
      const intentUrl = `intent://${hostAndPath}#Intent;scheme=https;package=com.android.chrome;end;`;
      window.location.href = intentUrl;
    } else {
      navigator.clipboard.writeText(currentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  function openInSystemBrowser() {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (isAndroid) {
      // Android generic browser intent (opens default browser like Chrome, Samsung Internet, Edge)
      const hostAndPath = window.location.href.replace(/^https?:\/\//, '');
      const intentUrl = `intent://${hostAndPath}#Intent;scheme=https;action=android.intent.action.VIEW;end;`;
      window.location.href = intentUrl;
    } else {
      navigator.clipboard.writeText(currentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  async function handleLogin() {
    // CRITICAL: If inside an in-app browser like Messenger or Instagram, Google Sign-In
    // popups WILL crash or turn the screen white because WebViews disallow OAuth popups.
    // Show the friendly In-App modal immediately instead!
    if (isAppInAppBrowser() || isInAppBrowser) {
      setShowInAppModal(true);
      setIsLoggingIn(false);
      return;
    }

    setAuthError(null);
    setUnauthorizedDomain(null);
    setIsLoggingIn(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) {
        const profile = await syncUserProfile(result.user);
        setCurrentUser(profile);
      }
    } catch (err: any) {
      console.error('Google Auth Login error details:', {
        code: err?.code,
        message: err?.message,
        error: err
      });

      // User closed popup explicitly
      if (
        err?.code === 'auth/popup-closed-by-user' || 
        err?.code === 'auth/user-cancelled' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        setIsLoggingIn(false);
        return;
      }

      // Domain not in Firebase Authorized Domains list
      if (err?.code === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        setUnauthorizedDomain(domain);
        setIsLoggingIn(false);
        return;
      }

      // Browser blocked popup
      if (err?.code === 'auth/popup-blocked') {
        setPopupBlockedModal(true);
        setIsLoggingIn(false);
        return;
      }

      // Any other error
      setAuthError(`Sign-in error (${err?.code || 'auth-error'}): ${err?.message || 'Please try again.'}`);
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

      {/* In-App Browser Warning Banner for Messenger / Facebook / Instagram users */}
      {isInAppBrowser && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 shadow-md sticky top-0 z-50">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
            <span className="truncate">
              Viewing inside Messenger. Google Sign-In requires an external browser like Chrome or Safari.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowInAppModal(true)}
              className="px-2 py-1 bg-slate-950 text-white rounded-lg text-[11px] font-bold hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>Guide (···)</span>
            </button>
            <button
              onClick={openInExternalChrome}
              className="px-2.5 py-1 bg-indigo-950 text-white rounded-lg text-[11px] font-bold hover:bg-black transition-all cursor-pointer flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Chrome</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="px-2.5 py-1 bg-white/40 hover:bg-white/60 text-slate-950 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Premium Top Navigation Bar */}
      <nav className={`sticky ${isInAppBrowser ? 'top-10' : 'top-0'} z-40 bg-white/80 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-900/80 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Left Brand Area */}
            <div className="flex items-center gap-8">
              <div 
                onClick={() => setActiveView('dashboard')}
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

            {/* Mobile Top Header Right Area */}
            <div className="flex items-center md:hidden gap-2">
              <ThemeToggle />

              {currentUser ? (
                <div className="relative">
                  <button
                    id="mobile-user-menu-btn"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl cursor-pointer"
                  >
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.username} 
                      className="w-7 h-7 rounded-full object-cover border border-indigo-500/40 shadow-xs"
                    />
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-900">
                        <p className="text-xs font-bold text-slate-950 dark:text-white truncate">@{currentUser.username}</p>
                        <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveView('profile');
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl font-medium text-left cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>My Profile Workspace</span>
                      </button>
                      {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                        <button
                          onClick={() => {
                            setActiveView('admin');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-semibold text-left cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Admin Panel</span>
                        </button>
                      )}
                      <div className="border-t border-slate-100 dark:border-slate-900 my-1"></div>
                      <button
                        onClick={() => {
                          handleLogout();
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-semibold text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  id="mobile-nav-login-btn"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-3 py-1.5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold rounded-xl hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  <span>Sign In</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Always-Visible Top Horizontal Section Rail */}
        <div className="block md:hidden border-t border-slate-200/60 dark:border-slate-900/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-3 py-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setActiveView('leaderboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'leaderboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Honor Roll</span>
            </button>

            <button
              onClick={() => setActiveView('faculty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'faculty'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Faculty Ranking</span>
            </button>

            <button
              onClick={() => setActiveView('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>Academic Calendar</span>
            </button>

            {currentUser && (
              <button
                onClick={() => setActiveView('profile')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'profile'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>My Profile</span>
              </button>
            )}

            {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
              <button
                onClick={() => setActiveView('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'admin'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Core View Area */}
      <main className="flex-1 pb-20 md:pb-0">
        {authError && (
          <div className="max-w-xl mx-auto mt-6 mx-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-amber-950 dark:text-amber-200">Sign-In Notice</h4>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{authError}</p>
              
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  <span>Try Signing In Again</span>
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

        {/* 1. Modal: Firebase Authorized Domain Whitelisting */}
        {unauthorizedDomain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                      Firebase Setup: Domain Not Authorized
                    </h3>
                    <p className="text-xs text-slate-500">Google OAuth requires adding this preview domain in Firebase Console</p>
                  </div>
                </div>
                <button
                  onClick={() => setUnauthorizedDomain(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Your current preview hostname needs to be added:
                </p>
                <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <code className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                    {unauthorizedDomain}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(unauthorizedDomain);
                      setCopiedDomain(true);
                      setTimeout(() => setCopiedDomain(false), 2500);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
                  >
                    {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'Copied!' : 'Copy Domain'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white">How to fix in 30 seconds:</p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] leading-relaxed">
                  <li>Click <strong>Open Firebase Auth Settings</strong> below.</li>
                  <li>Scroll to the <strong>Authorized domains</strong> section and click <strong>Add domain</strong>.</li>
                  <li>Paste <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{unauthorizedDomain}</span> and click <strong>Add</strong>.</li>
                  <li>Return here and click <strong>Retry Sign In</strong> — it will log you in immediately!</li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <a
                  href="https://console.firebase.google.com/project/blogging-website-bfc4d/authentication/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Firebase Auth Settings</span>
                </a>
                <button
                  onClick={() => {
                    setUnauthorizedDomain(null);
                    handleLogin();
                  }}
                  className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Retry Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Modal: In-App Browser Guidance (Messenger / Instagram) */}
        {showInAppModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                      Open in External Browser
                    </h3>
                    <p className="text-xs text-slate-500">Messenger webview blocks Google OAuth</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInAppModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You are currently viewing this inside Facebook Messenger. Google strictly blocks account sign-in inside in-app webviews to protect account security.
              </p>

              {/* Visual guidance for Messenger 3-dots menu */}
              <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Messenger Header</span>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-extrabold animate-pulse">
                    <span>Look top right ➔</span>
                    <span className="text-xs font-black px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/30">···</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  1. Look at the <strong className="text-slate-900 dark:text-white">three dots (···)</strong> at the very top right of your Messenger screen.<br/>
                  2. Tap it and select <strong className="text-indigo-600 dark:text-indigo-400">"Open in Chrome"</strong> or <strong className="text-indigo-600 dark:text-indigo-400">"Open in external browser"</strong>.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    openInExternalChrome();
                    setShowInAppModal(false);
                  }}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Google Chrome (Direct Intent)</span>
                </button>

                <button
                  onClick={() => {
                    openInSystemBrowser();
                    setShowInAppModal(false);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer hover:opacity-90"
                >
                  <Globe className="w-4 h-4" />
                  <span>Open in Default Mobile Browser</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied! Open Chrome & Paste' : 'Copy Page Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Modal: Browser Popup Blocked */}
        {popupBlockedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-500/20">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                      Launch Google Sign-In
                    </h3>
                    <p className="text-xs text-slate-500">Tap below to open Google account window</p>
                  </div>
                </div>
                <button
                  onClick={() => setPopupBlockedModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Your browser blocked the automatic login popup. Tap the button below to grant direct permission and complete sign-in:
              </p>

              <button
                onClick={() => {
                  setPopupBlockedModal(false);
                  handleLogin();
                }}
                className="w-full py-3 px-4 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:opacity-90"
              >
                <span>Open Google Sign-In Window</span>
              </button>
            </div>
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

      {/* Mobile Always-Visible Bottom Thumb Bar */}
      <nav 
        id="mobile-bottom-nav" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <div className="grid grid-cols-5 items-center justify-items-center max-w-lg mx-auto">
          {/* 1. Home */}
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors cursor-pointer ${
              activeView === 'dashboard' 
                ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeView === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Home</span>
          </button>

          {/* 2. Honor Roll */}
          <button
            onClick={() => setActiveView('leaderboard')}
            className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors cursor-pointer ${
              activeView === 'leaderboard' 
                ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeView === 'leaderboard' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Honor Roll</span>
          </button>

          {/* 3. Prominent Center Action: Upload Paper */}
          <button
            onClick={() => {
              if (!currentUser) handleLogin();
              else onOpenUpload();
            }}
            className="flex flex-col items-center justify-center w-full -mt-4 cursor-pointer group"
            title="Upload Question Paper"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 border-2 border-white dark:border-slate-950 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-tight mt-0.5">
              Upload
            </span>
          </button>

          {/* 4. Faculty Ranking */}
          <button
            onClick={() => setActiveView('faculty')}
            className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors cursor-pointer ${
              activeView === 'faculty' 
                ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeView === 'faculty' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Faculty</span>
          </button>

          {/* 5. Calendar or Profile */}
          <button
            onClick={() => {
              if (currentUser) setActiveView('profile');
              else setActiveView('calendar');
            }}
            className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors cursor-pointer ${
              (currentUser && activeView === 'profile') || (!currentUser && activeView === 'calendar')
                ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${(currentUser && activeView === 'profile') || (!currentUser && activeView === 'calendar') ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              {currentUser ? <UserIcon className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">
              {currentUser ? 'Profile' : 'Calendar'}
            </span>
          </button>
        </div>
      </nav>

    </div>
  );
}
