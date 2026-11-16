import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  Download,
  Eye,
  GraduationCap,
  Heart,
  Library,
  Loader2,
  Rocket,
  Shield,
  Sprout,
  Crown,
  Check,
  FileText
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department, QuestionPaper, Semester, UserProfile } from '../types';
import UserAvatar from './UserAvatar';
import { formatImageUrl } from '../utils/imageUrl';

interface PublicProfileProps {
  userId: string;
  fallbackUsername?: string;
  fallbackPhotoURL?: string;
  departments?: Department[];
  semesters?: Semester[];
  onBack: () => void;
  onNavigateToQuestion: (questionId: string) => void;
}

interface AchievementBadge {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  unlocked: boolean;
  color: string;
}

export default function PublicProfile({
  userId,
  fallbackUsername,
  fallbackPhotoURL,
  departments = [],
  semesters = [],
  onBack,
  onNavigateToQuestion
}: PublicProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authoredPapers, setAuthoredPapers] = useState<QuestionPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicProfile() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const [userSnap, papersSnap] = await Promise.all([
          getDoc(doc(db, 'users', userId)).catch(() => null),
          getDocs(query(collection(db, 'questions'), where('uploadedByUID', '==', userId)))
        ]);

        if (!isMounted) return;

        const papers: QuestionPaper[] = [];
        papersSnap.forEach((d) => {
          const item = { id: d.id, ...d.data() } as QuestionPaper;
          if (item.status === 'published' || !item.status) {
            papers.push(item);
          }
        });

        papers.sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        setAuthoredPapers(papers);

        if (userSnap && userSnap.exists()) {
          const data = userSnap.data() as UserProfile;
          setProfile({
            ...data,
            uid: userSnap.id
          });
        } else if (papers.length > 0 || fallbackUsername) {
          setProfile({
            uid: userId,
            email: '',
            username: papers[0]?.uploadedByUsername || fallbackUsername || 'scholar',
            photoURL: fallbackPhotoURL || '',
            createdAt: papers[papers.length - 1]?.uploadedAt || new Date().toISOString(),
            role: 'user',
            uploadCount: papers.length,
            likesReceived: papers.reduce((sum, p) => sum + (p.likes || 0), 0)
          });
        } else {
          setProfile(null);
        }
      } catch (err: any) {
        console.error('Error loading contributor profile:', err);
        if (isMounted) {
          setErrorMsg('Unable to load contributor profile right now.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (userId) {
      loadPublicProfile();
    } else {
      setLoading(false);
      setProfile(null);
    }

    return () => {
      isMounted = false;
    };
  }, [userId, fallbackUsername, fallbackPhotoURL]);

  const displayUsername =
    profile?.username ||
    authoredPapers[0]?.uploadedByUsername ||
    fallbackUsername ||
    'scholar';
  const displayPhoto = profile?.photoURL || fallbackPhotoURL || '';

  const stats = useMemo(() => {
    const uploads = authoredPapers.length;
    const likes = authoredPapers.reduce((acc, q) => {
      const count =
        typeof q.likes === 'number'
          ? Math.max(0, q.likes)
          : Array.isArray(q.likedBy)
          ? q.likedBy.length
          : 0;
      return acc + count;
    }, 0);
    const views = authoredPapers.reduce((acc, q) => acc + (q.views || 0), 0);
    const downloads = authoredPapers.reduce((acc, q) => acc + (q.downloads || 0), 0);

    return {
      uploads: Math.max(uploads, profile?.uploadCount || 0),
      publishedCount: uploads,
      likes: Math.max(likes, profile?.likesReceived || 0),
      views,
      downloads
    };
  }, [authoredPapers, profile]);

  const badgesList: AchievementBadge[] = [
    {
      id: 'early_member',
      name: 'Early Member',
      desc: 'Joined during the repository founding era.',
      icon: <Sprout className="w-5 h-5" />,
      unlocked: true,
      color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'first_upload',
      name: 'First Contributor',
      desc: 'Contributed an examination question paper.',
      icon: <Rocket className="w-5 h-5" />,
      unlocked: stats.uploads >= 1,
      color: 'from-indigo-500/10 to-blue-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    },
    {
      id: 'ten_uploads',
      name: 'Scholar Elite',
      desc: 'Contributed 10+ previous question papers.',
      icon: <BookOpen className="w-5 h-5" />,
      unlocked: stats.uploads >= 10,
      color: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    },
    {
      id: 'fifty_uploads',
      name: 'Academic Archivist',
      desc: 'Superb contributor with 50+ paper uploads.',
      icon: <Library className="w-5 h-5" />,
      unlocked: stats.uploads >= 50,
      color: 'from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
    },
    {
      id: 'top_contributor',
      name: 'Top Contributor',
      desc: 'Highly liked scholar (15+ uploads or 10+ helpful likes).',
      icon: <Crown className="w-5 h-5" />,
      unlocked: stats.uploads >= 15 || stats.likes >= 10,
      color: 'from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
    }
  ];

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto py-16 px-4 sm:px-6 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">
          Loading contributor profile...
        </p>
      </div>
    );
  }

  if (errorMsg || !profile) {
    return (
      <div className="w-full max-w-3xl mx-auto py-14 px-4 sm:px-6 text-center space-y-4">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-3">
          <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
            Profile Unavailable
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {errorMsg || 'This contributor profile could not be found.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[40px] px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Question Bank</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel =
    profile.role === 'super_admin'
      ? 'Super Admin'
      : profile.role === 'moderator'
      ? 'Moderator'
      : 'UU Student';

  return (
    <div id="public-profile-root" className="w-full max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Top Navigation & View-Only Context Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span>Contributor Profile</span>
          <span aria-hidden="true">·</span>
          <span>View Only</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column: Read-Only Profile Card */}
        <aside className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 h-fit">
          <div className="flex flex-col items-center text-center space-y-3">
            <UserAvatar
              src={displayPhoto}
              username={displayUsername}
              size="xl"
              className="border-2 border-indigo-500/70 shadow-md"
            />

            <div className="space-y-1">
              <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white break-all">
                @{displayUsername}
              </h1>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5">
                {profile.role === 'super_admin' || profile.role === 'moderator' ? (
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>{roleLabel}</span>
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-900 pt-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Joined{' '}
                {profile.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'Uttara University'}
              </span>
            </div>
          </div>

          {/* Contributor Metrics */}
          <div className="border-t border-slate-100 dark:border-slate-900 pt-4 grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Papers Shared
              </p>
              <p className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-indigo-600 dark:text-indigo-400">
                {stats.publishedCount}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Helpful Likes
              </p>
              <p className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-rose-500 flex items-center justify-center gap-1.5">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500 shrink-0" />
                <span>{stats.likes}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Total Views
              </p>
              <p className="text-xl font-bold font-mono tabular-nums mt-1 text-slate-800 dark:text-slate-200">
                {stats.views}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Downloads
              </p>
              <p className="text-xl font-bold font-mono tabular-nums mt-1 text-slate-800 dark:text-slate-200">
                {stats.downloads}
              </p>
            </div>
          </div>
        </aside>

        {/* Right Column: Read-Only Badges & Uploaded Papers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Achievement Badges */}
          <section className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                Contributor Badges
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {badgesList.map((badge) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                    badge.unlocked
                      ? `bg-gradient-to-r ${badge.color} border-slate-200 dark:border-slate-800`
                      : 'bg-slate-50/50 dark:bg-slate-900/20 border-dashed border-slate-200 dark:border-slate-800 opacity-45'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-700/40 shrink-0">
                    {badge.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {badge.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {badge.desc}
                    </p>
                    {badge.unlocked ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1.5 inline-flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Unlocked</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1.5 block">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Uploaded Question Papers */}
          <section className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                  Uploaded Question Papers ({authoredPapers.length})
                </h2>
              </div>
            </div>

            {authoredPapers.length > 0 ? (
              <div className="space-y-3">
                {authoredPapers.map((q) => {
                  const deptObj = departments.find((d) => d.id === q.departmentId);
                  const semObj = semesters.find((s) => s.id === q.semesterId);
                  const thumbUrl =
                    q.imageUrls && q.imageUrls.length > 0 ? q.imageUrls[0] : q.imageUrl;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onNavigateToQuestion(q.id)}
                      className="w-full text-left p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-14 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                          {thumbUrl ? (
                            <img
                              src={formatImageUrl(thumbUrl)}
                              alt={q.courseName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <FileText className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {q.courseCode || 'GENERAL'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{q.examType === 'Mid' ? 'Mid-Term' : 'Final Exam'}</span>
                            {deptObj && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{deptObj.code || deptObj.name}</span>
                              </>
                            )}
                            {semObj && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{semObj.name}</span>
                              </>
                            )}
                          </div>

                          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                            {q.courseName}
                          </h3>

                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              <span>{q.views || 0}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Download className="w-3.5 h-3.5" />
                              <span>{q.downloads || 0}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-rose-500">
                              <Heart className="w-3.5 h-3.5 fill-rose-500" />
                              <span>{q.likes || 0}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 whitespace-nowrap">
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">View</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No published question papers from @{displayUsername} yet.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
