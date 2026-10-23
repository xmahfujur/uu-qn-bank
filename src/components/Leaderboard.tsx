import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Award, 
  Heart, 
  Upload, 
  Sparkles, 
  Loader2, 
  ChevronUp, 
  Search, 
  BookOpen, 
  Crown,
  User as UserIcon,
  Star,
  ArrowRight,
  Flame,
  Zap,
  Target,
  X,
  Medal,
  CheckCircle2,
  LogIn
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile } from '../types';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';

interface LeaderboardProps {
  currentUser?: UserProfile | null;
  onTriggerAuth?: () => void;
  onOpenUpload?: () => void;
  onNavigateToProfile?: () => void;
}

export default function Leaderboard({ 
  currentUser, 
  onTriggerAuth, 
  onOpenUpload,
  onNavigateToProfile 
}: LeaderboardProps) {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [questionStats, setQuestionStats] = useState<Record<string, { uploadCount: number; likesReceived: number; username?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'top10' | 'my_standing'>('all');
  const [sortBy, setSortBy] = useState<'uploads' | 'likes'>('uploads');

  // Real-time listener for both user profiles and live question love/upload statistics
  useEffect(() => {
    setLoading(true);
    let usersLoaded = false;
    let questionsLoaded = false;

    const checkLoading = () => {
      if (usersLoaded && questionsLoaded) {
        setLoading(false);
      }
    };

    // 1. Real-time users profile listener
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        uList.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setUsersList(uList);
      usersLoaded = true;
      checkLoading();
    }, (err) => {
      console.error('Error listening to leaderboard users:', err);
      usersLoaded = true;
      checkLoading();
    });

    // 2. Real-time questions collection listener: accurately sums up live likes/loves & upload counts for EVERY scholar
    const unsubscribeQuestions = onSnapshot(collection(db, 'questions'), (snapshot) => {
      const stats: Record<string, { uploadCount: number; likesReceived: number; username?: string }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = data.uploadedByUID;
        if (!uid) return;

        if (!stats[uid]) {
          stats[uid] = { 
            uploadCount: 0, 
            likesReceived: 0, 
            username: data.uploadedByUsername 
          };
        }
        stats[uid].uploadCount += 1;
        const count = typeof data.likes === 'number' 
          ? Math.max(0, data.likes) 
          : (Array.isArray(data.likedBy) ? data.likedBy.length : 0);
        stats[uid].likesReceived += count;
        if (data.uploadedByUsername && !stats[uid].username) {
          stats[uid].username = data.uploadedByUsername;
        }
      });
      setQuestionStats(stats);
      questionsLoaded = true;
      checkLoading();
    }, (err) => {
      console.error('Error listening to question paper statistics for leaderboard:', err);
      questionsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubscribeUsers();
      unsubscribeQuestions();
    };
  }, []);

  // Merge registered user profiles with live question reaction stats
  const allLeaders = useMemo(() => {
    const userMap = new Map<string, UserProfile>();

    // Add all registered users with merged stats
    for (const u of usersList) {
      const stat = questionStats[u.uid] || { uploadCount: 0, likesReceived: 0 };
      userMap.set(u.uid, {
        ...u,
        uploadCount: Math.max(u.uploadCount || 0, stat.uploadCount),
        likesReceived: Math.max(u.likesReceived || 0, stat.likesReceived)
      });
    }

    // Ensure currentUser is included even if just registered or not yet in snapshot
    if (currentUser) {
      const existing = userMap.get(currentUser.uid) || currentUser;
      const stat = questionStats[currentUser.uid] || { uploadCount: 0, likesReceived: 0 };
      userMap.set(currentUser.uid, {
        ...existing,
        ...currentUser,
        uploadCount: Math.max(existing.uploadCount || 0, currentUser.uploadCount || 0, stat.uploadCount),
        likesReceived: Math.max(existing.likesReceived || 0, currentUser.likesReceived || 0, stat.likesReceived)
      });
    }

    // Include any scholar who contributed papers but whose user doc is pending
    Object.entries(questionStats).forEach(([uid, stat]) => {
      if (!userMap.has(uid) && stat.uploadCount > 0) {
        userMap.set(uid, {
          uid,
          email: '',
          username: stat.username || `scholar_${uid.slice(0, 5)}`,
          photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`,
          createdAt: new Date().toISOString(),
          role: 'user',
          uploadCount: stat.uploadCount,
          likesReceived: stat.likesReceived
        });
      }
    });

    return Array.from(userMap.values());
  }, [usersList, questionStats, currentUser]);

  // Silently sync current user's profile document if live stats are higher
  useEffect(() => {
    if (!currentUser?.uid) return;
    const myLiveStats = questionStats[currentUser.uid];
    if (!myLiveStats) return;

    if (
      myLiveStats.likesReceived > (currentUser.likesReceived || 0) ||
      myLiveStats.uploadCount > (currentUser.uploadCount || 0)
    ) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        likesReceived: myLiveStats.likesReceived,
        uploadCount: myLiveStats.uploadCount
      }).catch(() => {});
    }
  }, [currentUser?.uid, questionStats]);

  // Global ranking calculation (unfiltered)
  const rankedScholars = useMemo(() => {
    return [...allLeaders].sort((a, b) => {
      if (sortBy === 'uploads') {
        const diffUpload = (b.uploadCount || 0) - (a.uploadCount || 0);
        if (diffUpload !== 0) return diffUpload;
        return (b.likesReceived || 0) - (a.likesReceived || 0);
      } else {
        const diffLikes = (b.likesReceived || 0) - (a.likesReceived || 0);
        if (diffLikes !== 0) return diffLikes;
        return (b.uploadCount || 0) - (a.uploadCount || 0);
      }
    });
  }, [allLeaders, sortBy]);

  // Current user's exact ranking
  const myIndex = currentUser ? rankedScholars.findIndex(u => u.uid === currentUser.uid) : -1;
  const myRank = myIndex !== -1 ? myIndex + 1 : null;
  const myProfile = myIndex !== -1 ? rankedScholars[myIndex] : currentUser;

  // Scholar Tier Badge Helper
  const getScholarBadge = (uploads: number) => {
    if (uploads >= 30) return { label: 'Grandmaster Scholar', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', icon: '🏆' };
    if (uploads >= 15) return { label: 'Gold Contributor', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30', icon: '🥇' };
    if (uploads >= 8) return { label: 'Silver Scholar', color: 'text-slate-400 bg-slate-400/10 border-slate-400/30', icon: '🥈' };
    if (uploads >= 3) return { label: 'Bronze Scholar', color: 'text-amber-700 bg-amber-700/10 border-amber-700/30', icon: '🥉' };
    return { label: 'Rising Contributor', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30', icon: '🌱' };
  };

  // Filtered list based on active tab and search query
  const displayedScholars = useMemo(() => {
    let list = rankedScholars;

    if (activeTab === 'top10') {
      list = list.slice(0, 10);
    } else if (activeTab === 'my_standing' && myIndex !== -1) {
      // Show rival bracket: 2 scholars above, currentUser, and 2 scholars below
      const start = Math.max(0, myIndex - 2);
      const end = Math.min(list.length, myIndex + 3);
      list = list.slice(start, end);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(u => 
        (u.username || '').toLowerCase().includes(q) || 
        (u.email || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [rankedScholars, activeTab, myIndex, searchQuery]);

  // Check if currentUser is currently visible in the displayed table
  const isCurrentUserInView = currentUser && displayedScholars.some(u => u.uid === currentUser.uid);

  // Jump to user's row helper
  const scrollToMyRow = () => {
    if (!currentUser) return;
    setActiveTab('all');
    setSearchQuery('');
    setTimeout(() => {
      const element = document.getElementById(`scholar-row-${currentUser.uid}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  return (
    <div id="leaderboard-root" className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      
      {/* Visual Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex p-3 bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 rounded-2xl border border-amber-500/30 shadow-inner">
          <Trophy className="w-8 h-8 animate-bounce" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-slate-900 dark:text-white tracking-tight">
          Honor Roll & Contributor Leaderboard
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Honoring the Uttara University scholars who actively archive and share examination papers to help fellow students excel.
        </p>
      </div>

      {/* ======================================================== */}
      {/* 1. DEDICATED "YOUR RANKING" SPOTLIGHT CARD                */}
      {/* ======================================================== */}
      {currentUser ? (
        <div 
          id="my-honor-roll-spotlight"
          className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl border-2 border-indigo-500/40 shadow-2xl p-6 sm:p-8 text-white transition-all"
        >
          {/* Subtle Decorative Glows */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Left: User Avatar, Identity, and Tier */}
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="relative shrink-0">
                <img 
                  src={myProfile?.photoURL ? formatImageUrl(myProfile.photoURL) : `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(currentUser.username || 'scholar')}`}
                  alt={currentUser.username}
                  onError={handleImageError}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-400/60 shadow-lg bg-slate-800"
                />
                <span className="absolute -bottom-2 -right-1 px-2 py-0.5 bg-indigo-600 text-[10px] font-black rounded-full uppercase tracking-wider border border-indigo-400/60 shadow">
                  You
                </span>
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Your Personal Rank
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getScholarBadge(myProfile?.uploadCount || 0).color}`}>
                    {getScholarBadge(myProfile?.uploadCount || 0).icon} {getScholarBadge(myProfile?.uploadCount || 0).label}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black font-display text-white truncate flex items-center gap-2">
                  <span>@{currentUser.username}</span>
                  {currentUser.role === 'super_admin' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40">Admin</span>
                  )}
                </h3>

                <p className="text-xs text-indigo-200/80">
                  {currentUser.email} • Joined {new Date(currentUser.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Right: Prominent Rank Badge & Key Metrics */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap sm:flex-nowrap">
              
              {/* Giant Rank Number Display */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-indigo-500/40 shadow-inner min-w-[100px] sm:min-w-[120px]">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-300">
                  Global Rank
                </span>
                <div className="flex items-baseline gap-1 my-0.5">
                  <span className="text-2xl sm:text-4xl font-black font-mono text-amber-400 drop-shadow">
                    #{myRank || '-'}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    /{rankedScholars.length}
                  </span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold">
                  {myRank && myRank <= 3 ? '🏆 Podium Scholar' : myRank && myRank <= 10 ? '⭐ Top 10 Elite' : 'Active Contributor'}
                </span>
              </div>

              {/* Uploads Count Display */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-indigo-500/40 shadow-inner min-w-[85px] sm:min-w-[100px]">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
                  <Upload className="w-3 h-3 text-indigo-400" /> Uploads
                </span>
                <span className="text-xl sm:text-3xl font-black font-mono text-white my-0.5">
                  {myProfile?.uploadCount || 0}
                </span>
                <span className="text-[9px] text-indigo-300 font-medium">Papers</span>
              </div>

              {/* Likes Received Display */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-indigo-500/40 shadow-inner min-w-[85px] sm:min-w-[100px]">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400" /> Likes
                </span>
                <span className="text-xl sm:text-3xl font-black font-mono text-rose-400 my-0.5">
                  {myProfile?.likesReceived || 0}
                </span>
                <span className="text-[9px] text-rose-300 font-medium">Earned</span>
              </div>

            </div>

          </div>

          {/* Motivational Insight & Quick Action Bar */}
          <div className="mt-5 pt-4 border-t border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-indigo-200">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span>
                {myRank === 1 ? (
                  <strong className="text-amber-300 font-bold">
                    👑 Incredible! You are currently #1 on the Uttara University Honor Roll!
                  </strong>
                ) : myRank && myRank > 1 && myIndex > 0 ? (
                  <span>
                    You are only <strong className="text-white font-bold">{Math.max(1, (rankedScholars[myIndex - 1]?.uploadCount || 0) - (myProfile?.uploadCount || 0) + 1)} upload(s)</strong> away from overtaking <span className="text-amber-300 font-bold">@{rankedScholars[myIndex - 1]?.username}</span> for <strong>#{myRank - 1}</strong>!
                  </span>
                ) : (
                  <span>
                    Share question papers to earn contributor badges, climb the leaderboard, and help fellow students!
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={scrollToMyRow}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>Locate in Table</span>
              </button>

              {onOpenUpload && (
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Paper (+Rank)</span>
                </button>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Logged Out CTA Banner */
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <Trophy className="w-4 h-4" />
              <span>Looking for your personal rank?</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold font-display text-white">
              Sign In to View Your Honor Roll Standing
            </h3>
            <p className="text-xs text-indigo-200">
              Log in with your University or Google account to track your official contributor rank, view received likes, and climb the scholar ranks.
            </p>
          </div>

          {onTriggerAuth && (
            <button
              onClick={onTriggerAuth}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      )}

      {/* Loading HUD */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-900 shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-3">Computing Scholar Rankings...</p>
          <p className="text-xs text-slate-500">Retrieving uploads and reputation metrics from Firestore</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">

          {/* ======================================================== */}
          {/* 2. TOP 3 PODIUM DISPLAY                                  */}
          {/* ======================================================== */}
          {rankedScholars.length >= 3 && !searchQuery && activeTab !== 'my_standing' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 shadow-sm">
              
              {/* Second Place (Silver) */}
              <div className={`p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border flex flex-col items-center justify-center text-center space-y-3 relative order-2 md:order-1 transition-all ${
                currentUser?.uid === rankedScholars[1].uid ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-800'
              }`}>
                <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-xs shadow-inner">
                  2
                </div>
                {currentUser?.uid === rankedScholars[1].uid && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase">
                    You
                  </span>
                )}
                <div className="relative">
                  <img 
                    src={rankedScholars[1].photoURL ? formatImageUrl(rankedScholars[1].photoURL) : `https://api.dicebear.com/7.x/adventurer/svg?seed=${rankedScholars[1].username}`} 
                    alt={rankedScholars[1].username} 
                    onError={handleImageError}
                    className="w-16 h-16 rounded-full border-4 border-slate-300 dark:border-slate-700 shadow-md object-cover bg-slate-100" 
                  />
                  <span className="absolute -bottom-1 -right-1 text-base">🥈</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">@{rankedScholars[1].username}</h4>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1 inline-block ${getScholarBadge(rankedScholars[1].uploadCount || 0).color}`}>
                    {getScholarBadge(rankedScholars[1].uploadCount || 0).label}
                  </span>
                </div>
                <div className="flex gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
                  <span className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-indigo-500" />{rankedScholars[1].uploadCount || 0}</span>
                  <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />{rankedScholars[1].likesReceived || 0}</span>
                </div>
              </div>

              {/* First Place (Gold Champion) */}
              <div className={`p-6 rounded-2xl bg-gradient-to-b from-amber-500/10 to-transparent dark:from-amber-500/15 border-2 flex flex-col items-center justify-center text-center space-y-3 relative order-1 md:order-2 shadow-lg -translate-y-2 transition-all ${
                currentUser?.uid === rankedScholars[0].uid ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-amber-400/50'
              }`}>
                <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-md">
                  1
                </div>
                {currentUser?.uid === rankedScholars[0].uid && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full uppercase shadow">
                    You
                  </span>
                )}
                <div className="absolute -top-5 text-amber-500 bg-white dark:bg-slate-900 p-2 rounded-full border border-amber-400/50 shadow-md">
                  <Crown className="w-6 h-6 fill-amber-400 text-amber-400 animate-pulse" />
                </div>
                <div className="relative mt-2">
                  <img 
                    src={rankedScholars[0].photoURL ? formatImageUrl(rankedScholars[0].photoURL) : `https://api.dicebear.com/7.x/adventurer/svg?seed=${rankedScholars[0].username}`} 
                    alt={rankedScholars[0].username} 
                    onError={handleImageError}
                    className="w-20 h-20 rounded-full border-4 border-amber-400 shadow-xl object-cover bg-slate-100" 
                  />
                  <span className="absolute -bottom-1 -right-1 text-lg">🥇</span>
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900 dark:text-white">@{rankedScholars[0].username}</h4>
                  <p className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest mt-0.5">Top Contributor</p>
                </div>
                <div className="flex gap-5 text-xs font-black text-slate-800 dark:text-slate-200 pt-1">
                  <span className="flex items-center gap-1.5"><Upload className="w-4 h-4 text-indigo-500" />{rankedScholars[0].uploadCount || 0} Uploads</span>
                  <span className="flex items-center gap-1.5"><Heart className="w-4 h-4 text-rose-500 fill-rose-500" />{rankedScholars[0].likesReceived || 0} Likes</span>
                </div>
              </div>

              {/* Third Place (Bronze) */}
              <div className={`p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border flex flex-col items-center justify-center text-center space-y-3 relative order-3 transition-all ${
                currentUser?.uid === rankedScholars[2].uid ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-800'
              }`}>
                <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-amber-700/20 text-amber-700 dark:text-amber-500 flex items-center justify-center font-black text-xs">
                  3
                </div>
                {currentUser?.uid === rankedScholars[2].uid && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase">
                    You
                  </span>
                )}
                <div className="relative">
                  <img 
                    src={rankedScholars[2].photoURL ? formatImageUrl(rankedScholars[2].photoURL) : `https://api.dicebear.com/7.x/adventurer/svg?seed=${rankedScholars[2].username}`} 
                    alt={rankedScholars[2].username} 
                    onError={handleImageError}
                    className="w-16 h-16 rounded-full border-4 border-amber-700/40 shadow-md object-cover bg-slate-100" 
                  />
                  <span className="absolute -bottom-1 -right-1 text-base">🥉</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">@{rankedScholars[2].username}</h4>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1 inline-block ${getScholarBadge(rankedScholars[2].uploadCount || 0).color}`}>
                    {getScholarBadge(rankedScholars[2].uploadCount || 0).label}
                  </span>
                </div>
                <div className="flex gap-4 text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
                  <span className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-indigo-500" />{rankedScholars[2].uploadCount || 0}</span>
                  <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />{rankedScholars[2].likesReceived || 0}</span>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* 3. CONTROLS TOOLBAR: TABS, SEARCH, SORT                  */}
          {/* ======================================================== */}
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Navigation Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  id="tab-all-scholars"
                  onClick={() => setActiveTab('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Medal className="w-3.5 h-3.5 text-amber-500" />
                  <span>All Scholars ({rankedScholars.length})</span>
                </button>

                <button
                  type="button"
                  id="tab-top-10"
                  onClick={() => setActiveTab('top10')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'top10'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Top 10 Elite</span>
                </button>

                {currentUser && myIndex !== -1 && (
                  <button
                    type="button"
                    id="tab-my-standing"
                    onClick={() => setActiveTab('my_standing')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'my_standing'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>My Rank Bracket (#{myRank})</span>
                  </button>
                )}
              </div>

              {/* Right Side: Sort dropdown & Real-time Search */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                
                {/* Search Scholar Input */}
                <div className="relative w-full sm:w-60">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search scholar username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort Option */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="uploads">Rank by Uploads</option>
                  <option value="likes">Rank by Helpful Likes</option>
                </select>

              </div>

            </div>

            {/* Subtext info */}
            {activeTab === 'my_standing' && (
              <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <Target className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>Showing your close rivals and surrounding competitors on the Honor Roll.</span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 4. SCHOLAR HONOR ROLL TABLE                              */}
          {/* ======================================================== */}
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-900 shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-900">
            
            {displayedScholars.map((u) => {
              // Calculate actual global rank in full database
              const globalRank = rankedScholars.findIndex(item => item.uid === u.uid) + 1;
              const isMe = currentUser?.uid === u.uid;
              const badge = getScholarBadge(u.uploadCount || 0);

              return (
                <div 
                  key={u.uid} 
                  id={`scholar-row-${u.uid}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 transition-all duration-200 gap-3 ${
                    isMe 
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 shadow-xs' 
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-900/40'
                  }`}
                >
                  {/* Left: Global Rank + Scholar Profile */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    
                    {/* Rank Number Badge */}
                    <div className="w-8 shrink-0 flex items-center justify-center font-mono font-black text-sm">
                      {globalRank === 1 ? (
                        <span className="p-1.5 rounded-full bg-amber-500 text-white text-xs shadow">🥇</span>
                      ) : globalRank === 2 ? (
                        <span className="p-1.5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white text-xs">🥈</span>
                      ) : globalRank === 3 ? (
                        <span className="p-1.5 rounded-full bg-amber-700 text-white text-xs">🥉</span>
                      ) : (
                        <span className={`text-xs ${isMe ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400'}`}>
                          #{globalRank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img 
                        src={u.photoURL ? formatImageUrl(u.photoURL) : `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`} 
                        alt={u.username} 
                        onError={handleImageError}
                        className={`w-10 h-10 rounded-full object-cover border-2 ${
                          isMe ? 'border-indigo-500 shadow-md' : 'border-slate-200 dark:border-slate-800'
                        }`} 
                      />
                      {isMe && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 border-2 border-white dark:border-slate-950 rounded-full flex items-center justify-center">
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                        </span>
                      )}
                    </div>

                    {/* Username & Badges */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-bold text-sm truncate flex items-center gap-1.5 ${
                          isMe ? 'text-indigo-950 dark:text-indigo-100 font-extrabold' : 'text-slate-900 dark:text-white'
                        }`}>
                          @{u.username}
                        </h4>

                        {/* YOU Badge */}
                        {isMe && (
                          <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-md tracking-wider uppercase shadow-xs">
                            YOU
                          </span>
                        )}

                        {/* Contributor Tier Badge */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Joined {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                      </p>
                    </div>

                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-10 shrink-0 pl-11 sm:pl-0">
                    
                    {/* Uploads Count */}
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploads</p>
                      <p className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-200 mt-0.5 flex items-center justify-end gap-1">
                        <Upload className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{u.uploadCount || 0}</span>
                      </p>
                    </div>

                    {/* Helpful Likes */}
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Helpful Likes</p>
                      <p className="font-extrabold text-sm sm:text-base text-rose-500 mt-0.5 flex items-center gap-1 justify-end">
                        <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        <span>{u.likesReceived || 0}</span>
                      </p>
                    </div>

                  </div>

                </div>
              );
            })}

            {displayedScholars.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">No Scholars Match Your Search</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  We couldn't find any contributor matching "{searchQuery}". Try searching with a different username.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold"
                >
                  Clear Search
                </button>
              </div>
            )}

          </div>

          {/* ======================================================== */}
          {/* 5. PINNED USER FOOTER (When user is not in current view) */}
          {/* ======================================================== */}
          {currentUser && myRank && !isCurrentUserInView && (
            <div className="p-4 bg-indigo-900 text-white rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-indigo-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow">
                  #{myRank}
                </div>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Your Standing: <strong>#{myRank}</strong> of {rankedScholars.length} scholars</span>
                    <span className="px-1.5 py-0.2 bg-indigo-600 text-[10px] font-black rounded uppercase">You</span>
                  </p>
                  <p className="text-[11px] text-indigo-200">
                    @{currentUser.username} • {myProfile?.uploadCount || 0} uploads • {myProfile?.likesReceived || 0} likes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={scrollToMyRow}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Show in Table
                </button>
                {onOpenUpload && (
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow transition-all cursor-pointer"
                  >
                    Upload Paper
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
