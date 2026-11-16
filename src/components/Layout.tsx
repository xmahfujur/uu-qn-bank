import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { 
  ShieldAlert, 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
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
  ChevronUp,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  Globe,
  ChevronRight
} from 'lucide-react';
import {
  isInAppBrowser as detectInAppBrowser,
  startGoogleSignIn,
  signOutUser,
  AuthErrorInfo
} from '../firebase/config';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';
import { PWAInstallEntryPopup, PWAInstallButton, OfflineIndicator } from './PWAInstallPrompt';
import { SiteAnnouncementPopup } from './SiteAnnouncementPopup';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: UserProfile | null;
  authError: AuthErrorInfo | null;
  setAuthError: (err: AuthErrorInfo | null) => void;
  activeView: 'landing' | 'dashboard' | 'profile' | 'admin' | 'leaderboard' | 'faculty' | 'calendar';
  setActiveView: (view: 'landing' | 'dashboard' | 'profile' | 'admin' | 'leaderboard' | 'faculty' | 'calendar') => void;
  onOpenUpload: () => void;
}

export default function Layout({
  children,
  currentUser,
  authError,
  setAuthError,
  activeView,
  setActiveView,
  onOpenUpload
}: LayoutProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showInAppModal, setShowInAppModal] = useState(false);
  const [inAppBrowser] = useState(() => detectInAppBrowser());
  const prefersReducedMotion = useReducedMotion();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns / mobile menu on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inDesktopMenu = userMenuRef.current?.contains(target);
      const inMobileMenu = mobileUserMenuRef.current?.contains(target);
      if (!inDesktopMenu && !inMobileMenu) {
        setShowUserDropdown(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserDropdown(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Listen to global trigger-google-login event synchronously so click user gesture is preserved
  useEffect(() => {
    const handleTriggerLoginEvent = () => {
      handleLogin();
    };
    window.addEventListener('trigger-google-login', handleTriggerLoginEvent);
    return () => window.removeEventListener('trigger-google-login', handleTriggerLoginEvent);
  }, []);

  function openInBrowser() {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      const hostAndPath = currentUrl.replace(/^https?:\/\//, '');
      const isChrome = /Chrome/i.test(ua);
      const intentUrl = isChrome
        ? `intent://${hostAndPath}#Intent;scheme=https;action=android.intent.action.VIEW;end;`
        : `intent://${hostAndPath}#Intent;scheme=https;package=com.android.chrome;end;`;
      window.location.href = intentUrl;
    } else {
      navigator.clipboard?.writeText(currentUrl).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  function copyCurrentLink() {
    if (typeof window === 'undefined') return;
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  // Synchronous click handler: NO `await` before calling startGoogleSignIn()
  function handleLogin() {
    if (detectInAppBrowser()) {
      setShowInAppModal(true);
      setIsLoggingIn(false);
      return;
    }

    setAuthError(null);
    setIsLoggingIn(true);

    startGoogleSignIn()
      .then((res) => {
        if (res.status === 'in-app-browser') {
          setShowInAppModal(true);
          setIsLoggingIn(false);
          return;
        }
        if (res.status === 'redirecting') {
          // Browser is navigating away to Google sign-in
          return;
        }
        if (res.status === 'error') {
          setAuthError(res.error);
        }
        setIsLoggingIn(false);
      })
      .catch((err) => {
        console.error('[Firebase Auth Error]', err?.code || 'unknown', err);
        setIsLoggingIn(false);
      });
  }

  async function handleLogout() {
    try {
      await signOutUser();
      setActiveView('landing');
      setShowUserDropdown(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  return (
    <div id="layout-container" className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">

      {/* In-App Browser Warning Banner */}
      {inAppBrowser && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 shadow-md sticky top-0 z-50">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
            <span className="truncate">
              Please open this page in Chrome or Safari to sign in.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={openInBrowser}
              className="px-2.5 py-1 bg-indigo-950 text-white rounded-lg text-[11px] font-bold hover:bg-black transition-all cursor-pointer flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open in browser</span>
            </button>
            <button
              onClick={copyCurrentLink}
              className="px-2.5 py-1 bg-white/40 hover:bg-white/60 text-slate-950 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <nav
        aria-label="Primary navigation"
        className={`sticky ${inAppBrowser ? 'top-10' : 'top-0'} z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 xl:gap-6 h-14 lg:h-16">
            {/* Zone 1: Brand Lockup (strict single-line) */}
            <button
              type="button"
              onClick={() => {
                setActiveView('dashboard');
                setShowUserDropdown(false);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 cursor-pointer group shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl py-1 pr-1"
            >
              <div className="w-9 h-9 bg-indigo-600 rounded-xl text-white flex items-center justify-center shadow-sm shadow-indigo-600/20 group-hover:scale-105 group-active:scale-95 transition-transform duration-150 shrink-0">
                <BookOpen className="w-4.5 h-4.5" />
              </div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight font-display text-slate-950 dark:text-white whitespace-nowrap">
                UU Qn Bank
              </span>
            </button>

            {/* Zone 2: Desktop Segmented Navigation Dock (lg+: >= 1024px) */}
            <div className="hidden lg:flex items-center p-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xs shrink-0">
              {(
                [
                  { id: 'dashboard', label: 'Home', shortLabel: 'Home', icon: Home },
                  { id: 'leaderboard', label: 'Honor Roll', shortLabel: 'Rankings', icon: Trophy },
                  { id: 'faculty', label: 'Faculty Ranking', shortLabel: 'Faculty', icon: GraduationCap },
                  { id: 'calendar', label: 'Academic Calendar', shortLabel: 'Calendar', icon: Calendar }
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id === 'dashboard' ? 'home' : item.id}-btn`}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setShowUserDropdown(false);
                    }}
                    className={`relative px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer active:scale-[0.97] ${
                      isActive
                        ? 'text-indigo-700 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-active-bg"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 450, damping: 34 }
                        }
                        className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80"
                      />
                    )}
                    <Icon
                      className={`relative z-10 w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="relative z-10 xl:hidden">{item.shortLabel}</span>
                    <span className="relative z-10 hidden xl:inline">{item.label}</span>
                  </button>
                );
              })}

              {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                <>
                  <span
                    aria-hidden="true"
                    className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0"
                  />
                  <button
                    id="nav-admin-btn"
                    type="button"
                    onClick={() => {
                      setActiveView('admin');
                      setShowUserDropdown(false);
                    }}
                    className={`relative px-2.5 xl:px-3.5 py-2 rounded-xl text-xs xl:text-[13px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer active:scale-[0.97] ${
                      activeView === 'admin'
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/30'
                    }`}
                  >
                    {activeView === 'admin' && (
                      <motion.span
                        layoutId="desktop-nav-active-bg"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 450, damping: 34 }
                        }
                        className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-rose-200/80 dark:border-rose-800/70"
                      />
                    )}
                    <Shield className="relative z-10 w-4 h-4 shrink-0" />
                    <span className="relative z-10 xl:hidden">Admin</span>
                    <span className="relative z-10 hidden xl:inline">Admin Panel</span>
                  </button>
                </>
              )}
            </div>

            {/* Zone 3: Desktop Utility & Primary Action Cluster */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <PWAInstallButton />
              <ThemeToggle />

              <span
                aria-hidden="true"
                className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 xl:mx-1 shrink-0"
              />

              <button
                id="nav-upload-trigger-btn"
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    handleLogin();
                  } else {
                    onOpenUpload();
                  }
                }}
                disabled={isLoggingIn}
                className="h-10 px-3 xl:px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 xl:gap-2 shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 shrink-0" />
                    <span>Upload</span>
                    <span className="hidden xl:inline">Paper</span>
                  </>
                )}
              </button>

              {currentUser ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    id="nav-user-dropdown-btn"
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    aria-expanded={showUserDropdown}
                    className={`h-10 flex items-center gap-2 pl-1.5 pr-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left cursor-pointer whitespace-nowrap shrink-0 ${
                      showUserDropdown || activeView === 'profile'
                        ? 'border-indigo-500/60 ring-2 ring-indigo-500/15'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <UserAvatar
                      src={currentUser.photoURL}
                      username={currentUser.username}
                      size="sm"
                      className="w-7 h-7"
                    />
                    <div className="leading-tight max-w-[92px] xl:max-w-[135px]">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        @{currentUser.username}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {currentUser.role === 'super_admin'
                          ? 'Admin'
                          : currentUser.role === 'moderator'
                          ? 'Moderator'
                          : 'Student'}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        showUserDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {showUserDropdown && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50"
                      >
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-900 mb-1">
                          <p className="text-xs font-bold text-slate-950 dark:text-white truncate">
                            @{currentUser.username}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {currentUser.email}
                          </p>
                        </div>
                        <button
                          id="dropdown-profile-btn"
                          type="button"
                          onClick={() => {
                            setActiveView('profile');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>My Profile Workspace</span>
                        </button>
                        <div className="border-t border-slate-100 dark:border-slate-900 my-1" />
                        <button
                          id="dropdown-logout-btn"
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors font-semibold text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span>Logout</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  id="nav-login-btn"
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="h-10 px-4 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold rounded-xl hover:opacity-90 active:scale-[0.97] transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
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

            {/* Mobile & Tablet (< lg: < 1024px) Compact Right Header */}
            <div className="flex items-center lg:hidden gap-1.5 sm:gap-2 shrink-0">
              <PWAInstallButton compact />
              <ThemeToggle />

              {/* Compact Upload button visible on tablet/narrow desktop (sm to lg) */}
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) handleLogin();
                  else onOpenUpload();
                }}
                disabled={isLoggingIn}
                className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Upload</span>
              </button>

              {currentUser ? (
                <div className="relative" ref={mobileUserMenuRef}>
                  <button
                    id="mobile-user-menu-btn"
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="h-10 flex items-center gap-1.5 px-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl cursor-pointer active:scale-95 transition-transform"
                    aria-label="Account menu"
                  >
                    <UserAvatar
                      src={currentUser.photoURL}
                      username={currentUser.username}
                      size="sm"
                      className="w-7 h-7 border-indigo-500/40"
                    />
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                        showUserDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-900 mb-1">
                        <p className="text-xs font-bold text-slate-950 dark:text-white truncate">
                          @{currentUser.username}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('profile');
                          setShowUserDropdown(false);
                        }}
                        className="w-full min-h-[40px] flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl font-semibold text-left cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>My Profile Workspace</span>
                      </button>
                      {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('admin');
                            setShowUserDropdown(false);
                          }}
                          className="w-full min-h-[40px] flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl font-semibold text-left cursor-pointer"
                        >
                          <Shield className="w-4 h-4 shrink-0" />
                          <span>Admin Panel</span>
                        </button>
                      )}
                      <div className="border-t border-slate-100 dark:border-slate-900 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          handleLogout();
                          setShowUserDropdown(false);
                        }}
                        className="w-full min-h-[40px] flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl font-semibold text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  id="mobile-nav-login-btn"
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="h-10 px-3 bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isLoggingIn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Sign In</span>
                </button>
              )}

              {/* Interactive Navigation Drawer / Action Sheet Trigger */}
              <button
                id="mobile-nav-drawer-btn"
                type="button"
                onClick={() => {
                  setShowUserDropdown(false);
                  setMobileMenuOpen((prev) => !prev);
                }}
                aria-expanded={mobileMenuOpen}
                aria-label="Open navigation menu"
                className="h-10 px-2.5 sm:px-3 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Interactive Mobile & Tablet Slide-Up / Sheet Navigation Drawer (< lg) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-950 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] space-y-4 max-h-[85vh] overflow-y-auto"
            >
              {/* Drag Handle */}
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {currentUser ? (
                    <>
                      <UserAvatar
                        src={currentUser.photoURL}
                        username={currentUser.username}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-950 dark:text-white truncate">
                          @{currentUser.username}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {currentUser.role === 'super_admin'
                            ? 'Super Admin'
                            : currentUser.role === 'moderator'
                            ? 'Moderator'
                            : 'Uttara University Student'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm font-bold font-display text-slate-950 dark:text-white">
                        Quick Navigation
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Explore UU Qn Bank sections
                      </p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Cards */}
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    {
                      id: 'dashboard',
                      label: 'Home Repository',
                      desc: 'Browse & search previous exam papers',
                      icon: Home
                    },
                    {
                      id: 'leaderboard',
                      label: 'Honor Roll',
                      desc: 'Top student paper contributors',
                      icon: Trophy
                    },
                    {
                      id: 'faculty',
                      label: 'Faculty Ranking',
                      desc: 'Ratings, reviews & teacher directory',
                      icon: GraduationCap
                    },
                    {
                      id: 'calendar',
                      label: 'Academic Calendar',
                      desc: 'Upcoming Mid, Final & semester dates',
                      icon: Calendar
                    }
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full min-h-[54px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200'
                          : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{item.label}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                        }`}
                      />
                    </button>
                  );
                })}

                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('profile');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[54px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] cursor-pointer ${
                      activeView === 'profile'
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          activeView === 'profile'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700'
                        }`}
                      >
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">My Profile Workspace</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Manage uploads, bookmarks & settings
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                )}

                {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('admin');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[54px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] cursor-pointer ${
                      activeView === 'admin'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-200'
                        : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">Admin Console</p>
                        <p className="text-[11px] text-rose-600/80 dark:text-rose-300/80 truncate">
                          Manage papers, users, pop-ups & logs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                )}
              </div>

              {/* Primary Sheet Action */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (!currentUser) handleLogin();
                  else onOpenUpload();
                }}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{currentUser ? 'Upload Question Paper' : 'Sign In & Upload Paper'}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Core View Area */}
      <main className="flex-1 pb-20 md:pb-0">
        {authError && authError.category !== 'unauthorized-domain' && (
          <div className="max-w-xl mx-auto mt-6 mx-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-amber-950 dark:text-amber-200">{authError.title}</h4>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{authError.code}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{authError.message}</p>

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
                  <span>Retry</span>
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
        {authError?.category === 'unauthorized-domain' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                      {authError.title}
                    </h3>
                    <p className="text-xs text-slate-500">Google OAuth requires authorizing this domain in Firebase Console</p>
                  </div>
                </div>
                <button
                  onClick={() => setAuthError(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Your current hostname needs to be added:
                </p>
                <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <code className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">
                    {authError.hostname || (typeof window !== 'undefined' ? window.location.hostname : '')}
                  </code>
                  <button
                    onClick={() => {
                      const host = authError.hostname || window.location.hostname;
                      navigator.clipboard?.writeText(host);
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
                    setAuthError(null);
                    handleLogin();
                  }}
                  className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Modal: In-App Browser Guidance */}
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
                      Please open this page in Chrome or Safari to sign in
                    </h3>
                    <p className="text-xs text-slate-500">In-app browsers block Google OAuth</p>
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
                Please open this page in Chrome or Safari to sign in. Google blocks account sign-in inside in-app browsers such as Facebook, Instagram, Messenger, Telegram, or Line.
              </p>

              <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Tap the menu (<strong className="text-slate-900 dark:text-white">···</strong>) in the corner of your screen and choose <strong className="text-indigo-600 dark:text-indigo-400">Open in Chrome / Safari</strong>, or use the buttons below.
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    openInBrowser();
                    setShowInAppModal(false);
                  }}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in browser</span>
                </button>

                <button
                  onClick={copyCurrentLink}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
              </div>
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

      {/* Mobile Interactive Bottom Thumb Bar */}
      <nav
        id="mobile-bottom-nav"
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.4rem)]"
      >
        <div className="grid grid-cols-5 items-center justify-items-center max-w-lg mx-auto">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`relative flex flex-col items-center justify-center w-full min-h-[48px] py-1 text-center transition-all active:scale-95 cursor-pointer ${
              activeView === 'dashboard'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {activeView === 'dashboard' && (
              <motion.span
                layoutId="mobile-nav-indicator"
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute top-0 w-7 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
              />
            )}
            <div className={`p-1 rounded-xl transition-colors ${activeView === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Home</span>
          </button>

          {/* 2. Honor Roll */}
          <button
            type="button"
            onClick={() => setActiveView('leaderboard')}
            className={`relative flex flex-col items-center justify-center w-full min-h-[48px] py-1 text-center transition-all active:scale-95 cursor-pointer ${
              activeView === 'leaderboard'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {activeView === 'leaderboard' && (
              <motion.span
                layoutId="mobile-nav-indicator"
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute top-0 w-7 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
              />
            )}
            <div className={`p-1 rounded-xl transition-colors ${activeView === 'leaderboard' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Rankings</span>
          </button>

          {/* 3. Center Elevated Upload Action */}
          <button
            type="button"
            onClick={() => {
              if (!currentUser) handleLogin();
              else onOpenUpload();
            }}
            className="flex flex-col items-center justify-center w-full min-h-[48px] py-0.5 text-center transition-transform active:scale-90 cursor-pointer group"
            title="Upload Question Paper"
            aria-label="Upload Question Paper"
          >
            <div className="w-11 h-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/25 group-hover:scale-105 transition-all">
              <Upload className="w-4.5 h-4.5" />
            </div>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-tight mt-0.5 whitespace-nowrap">
              Upload
            </span>
          </button>

          {/* 4. Faculty Ranking */}
          <button
            type="button"
            onClick={() => setActiveView('faculty')}
            className={`relative flex flex-col items-center justify-center w-full min-h-[48px] py-1 text-center transition-all active:scale-95 cursor-pointer ${
              activeView === 'faculty'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {activeView === 'faculty' && (
              <motion.span
                layoutId="mobile-nav-indicator"
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute top-0 w-7 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
              />
            )}
            <div className={`p-1 rounded-xl transition-colors ${activeView === 'faculty' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Faculty</span>
          </button>

          {/* 5. Academic Calendar (always reachable in 1 tap on mobile) */}
          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`relative flex flex-col items-center justify-center w-full min-h-[48px] py-1 text-center transition-all active:scale-95 cursor-pointer ${
              activeView === 'calendar'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {activeView === 'calendar' && (
              <motion.span
                layoutId="mobile-nav-indicator"
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute top-0 w-7 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
              />
            )}
            <div className={`p-1 rounded-xl transition-colors ${activeView === 'calendar' ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Calendar</span>
          </button>
        </div>
      </nav>

      {/* Custom Daily Visitor Announcement Pop-Up, Install App Pop-Up & Offline Indicator */}
      <SiteAnnouncementPopup
        currentUser={currentUser}
        onOpenUpload={onOpenUpload}
        onTriggerAuth={handleLogin}
        onNavigate={(view) => setActiveView(view)}
      />
      <PWAInstallEntryPopup />
      <OfflineIndicator />

    </div>
  );
}
