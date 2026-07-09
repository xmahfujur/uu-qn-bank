import React, { useState, useEffect } from 'react';
import { 
  Award, 
  BookOpen, 
  Bookmark, 
  Heart, 
  Calendar, 
  Mail, 
  User as UserIcon, 
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Eye,
  ExternalLink,
  Pencil,
  Sprout,
  Rocket,
  Library,
  Crown,
  Shield,
  GraduationCap,
  Download,
  Check
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile, QuestionPaper } from '../types';
import EditQuestionModal from './EditQuestionModal';

interface ProfileProps {
  currentUser: UserProfile;
  onNavigateToQuestion: (questionId: string) => void;
  onProfileUpdated: (updatedProfile: UserProfile) => void;
}

interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode; // changed from string to React.ReactNode
  unlocked: boolean;
  color: string;
}

export default function Profile({ currentUser, onNavigateToQuestion, onProfileUpdated }: ProfileProps) {
  const [myUploads, setMyUploads] = useState<QuestionPaper[]>([]);
  const [myBookmarks, setMyBookmarks] = useState<QuestionPaper[]>([]);
  const [loading, setLoading] = useState(false);

  // Refresh trigger to reload profile data on successful edits
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Edit Question modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionPaper | null>(null);
  
  // Profile picture edit state
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [newPhotoURL, setNewPhotoURL] = useState(currentUser.photoURL);
  
  // Username edit state
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [usernameError, setUsernameError] = useState('');

  // Keep state updated if currentUser profile changes
  useEffect(() => {
    setNewUsername(currentUser.username);
  }, [currentUser.username]);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadUserData() {
      setLoading(true);
      try {
        // Load authored papers
        const qAuthored = query(collection(db, 'questions'), where('uploadedByUID', '==', currentUser.uid));
        const authSnap = await getDocs(qAuthored);
        const authoredList: QuestionPaper[] = [];
        authSnap.forEach((doc) => {
          authoredList.push({ id: doc.id, ...doc.data() } as QuestionPaper);
        });
        setMyUploads(authoredList);

        // Load bookmarked papers
        const qAll = query(collection(db, 'questions'));
        const allSnap = await getDocs(qAll);
        const bookmarksList: QuestionPaper[] = [];
        allSnap.forEach((doc) => {
          const q = { id: doc.id, ...doc.data() } as QuestionPaper;
          if (q.bookmarks && q.bookmarks.includes(currentUser.uid)) {
            bookmarksList.push(q);
          }
        });
        setMyBookmarks(bookmarksList);
      } catch (err) {
        console.error('Error loading user profile data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, [currentUser.uid, refreshTrigger]);

  // Handle Profile Pic Update
  async function handleUpdatePhoto(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhotoURL.trim()) return;

    setLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        photoURL: newPhotoURL.trim()
      });
      
      const updatedProfile = {
        ...currentUser,
        photoURL: newPhotoURL.trim()
      };
      onProfileUpdated(updatedProfile);
      setEditingPhoto(false);
      setNotification({ type: 'success', message: 'Profile picture updated successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to update profile picture.' });
    } finally {
      setLoading(false);
    }
  }

  // Handle Username Update
  async function handleUpdateUsername(e: React.FormEvent) {
    e.preventDefault();
    const sanitized = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    if (sanitized.length < 3 || sanitized.length > 20) {
      setUsernameError('Username must be between 3 and 20 alphanumeric characters or underscores.');
      return;
    }

    if (sanitized === currentUser.username) {
      setEditingUsername(false);
      return;
    }

    setLoading(true);
    setUsernameError('');
    try {
      // 1. Duplicate check query
      const q = query(collection(db, 'users'), where('username', '==', sanitized));
      const querySnapshot = await getDocs(q);
      
      let isDuplicate = false;
      querySnapshot.forEach((doc) => {
        if (doc.id !== currentUser.uid) {
          isDuplicate = true;
        }
      });

      if (isDuplicate) {
        setUsernameError('This username is already taken. Please try another one.');
        setLoading(false);
        return;
      }

      // 2. Update the user doc
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        username: sanitized
      });
      
      const updatedProfile = {
        ...currentUser,
        username: sanitized
      };
      onProfileUpdated(updatedProfile);
      setEditingUsername(false);
      setNotification({ type: 'success', message: 'Username updated successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to update username.' });
    } finally {
      setLoading(false);
    }
  }

  // Handle authored paper deletion
  async function handleDeleteOwnUpload(questionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete your uploaded question paper permanently?')) return;

    try {
      await deleteDoc(doc(db, 'questions', questionId));
      setMyUploads(prev => prev.filter(q => q.id !== questionId));
      setNotification({ type: 'success', message: 'Question paper deleted.' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to delete question paper.' });
    }
  }

  // Compute reputation metric
  const totalUploads = myUploads.length;
  const totalLikesReceived = myUploads.reduce((acc, q) => acc + (q.likes || 0), 0);

  // Generate gamified achievement badges based on contributions
  const badgesList: Badge[] = [
    {
      id: 'early_member',
      name: 'Early Member',
      desc: 'Joined during the repository founding era.',
      icon: <Sprout className="w-6 h-6" />,
      unlocked: true,
      color: 'from-emerald-500/10 to-teal-500/10 text-emerald-500 border-emerald-500/20'
    },
    {
      id: 'first_upload',
      name: 'First Contributor',
      desc: 'Contributed the very first examination paper.',
      icon: <Rocket className="w-6 h-6 animate-bounce" style={{ animationDuration: '3s' }} />,
      unlocked: totalUploads >= 1,
      color: 'from-indigo-500/10 to-blue-500/10 text-indigo-500 border-indigo-500/20'
    },
    {
      id: 'ten_uploads',
      name: 'Scholar Elite',
      desc: 'Contributed 10+ previous question papers.',
      icon: <BookOpen className="w-6 h-6" />,
      unlocked: totalUploads >= 10,
      color: 'from-amber-500/10 to-orange-500/10 text-amber-500 border-amber-500/20'
    },
    {
      id: 'fifty_uploads',
      name: 'Academic Archivist',
      desc: 'Superb contributor with 50+ paper uploads.',
      icon: <Library className="w-6 h-6" />,
      unlocked: totalUploads >= 50,
      color: 'from-purple-500/10 to-pink-500/10 text-purple-500 border-purple-500/20'
    },
    {
      id: 'top_contributor',
      name: 'Top Contributor',
      desc: 'Highly liked scholar (15+ uploads or 10+ useful likes).',
      icon: <Crown className="w-6 h-6" />,
      unlocked: totalUploads >= 15 || totalLikesReceived >= 10,
      color: 'from-rose-500/10 to-red-500/10 text-rose-500 border-rose-500/20'
    }
  ];

  return (
    <div id="profile-root" className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6">
      
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-100 dark:border-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Info panel */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-6 h-fit">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative group">
              <img 
                src={currentUser.photoURL} 
                alt={currentUser.username} 
                className="w-24 h-24 rounded-full border-2 border-indigo-500 shadow-md object-cover"
              />
              <button
                onClick={() => setEditingPhoto(!editingPhoto)}
                className="absolute bottom-0 right-0 p-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-full border border-slate-200 dark:border-slate-800 opacity-90 hover:opacity-100 transition-opacity shadow-sm"
                title="Edit profile picture"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 group/username">
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">@{currentUser.username}</h2>
                <button
                  onClick={() => {
                    setNewUsername(currentUser.username);
                    setUsernameError('');
                    setEditingUsername(!editingUsername);
                    setEditingPhoto(false);
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                  title="Edit custom username"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                {currentUser.role === 'super_admin' ? (
                  <>
                    <Shield className="w-3.5 h-3.5 fill-indigo-500/10 text-indigo-600 dark:text-indigo-400" />
                    <span>Super Admin</span>
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>UU Student</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {editingPhoto && (
            <form onSubmit={handleUpdatePhoto} className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Avatar / Photo URL</label>
              <input
                id="edit-profile-photo-input"
                type="url"
                value={newPhotoURL}
                onChange={(e) => setNewPhotoURL(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
                required
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingPhoto(false)}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {editingUsername && (
            <form onSubmit={handleUpdateUsername} className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Edit Username</label>
                <span className="text-[9px] text-slate-400">Lowercase & numbers or _</span>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-semibold">@</span>
                <input
                  id="edit-profile-username-input"
                  type="text"
                  value={newUsername}
                  onChange={(e) => {
                    // Force lowercase alphanumeric + underscores
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    setNewUsername(val);
                    if (usernameError) setUsernameError('');
                  }}
                  placeholder="new_username"
                  className="w-full pl-6 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>
              {usernameError && (
                <p className="text-[10px] text-red-500 font-semibold">{usernameError}</p>
              )}
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingUsername(false)}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-700"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-slate-100 dark:border-slate-900/85 pt-4 space-y-3.5">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="truncate">{currentUser.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Joined UU {new Date(currentUser.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* User Reputation stats */}
          <div className="border-t border-slate-100 dark:border-slate-900/85 pt-4 grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-900 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">My Uploads</p>
              <p className="text-2xl font-extrabold font-display mt-1 text-indigo-600 dark:text-indigo-400">{totalUploads}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-900 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Likes Received</p>
              <p className="text-2xl font-extrabold font-display mt-1 text-rose-500 flex items-center justify-center gap-1.5">
                <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                <span>{totalLikesReceived}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Badges and Lists area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Achievement Badges Section */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Achievement Badges</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badgesList.map((badge) => (
                <div 
                  key={badge.id}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                    badge.unlocked 
                      ? `bg-gradient-to-r ${badge.color} border-slate-200 dark:border-slate-900` 
                      : 'bg-slate-50/50 dark:bg-slate-900/20 border-dashed border-slate-200 dark:border-slate-800 opacity-40'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white/40 dark:bg-slate-900/40 border border-slate-200/20 shadow-sm flex-shrink-0">
                    {badge.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{badge.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{badge.desc}</p>
                    {badge.unlocked ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mt-1 flex items-center gap-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Unlocked</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">Locked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bookmarks Section */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Bookmarked Questions</h3>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {myBookmarks.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => onNavigateToQuestion(q.id)}
                  className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl hover:bg-slate-100/55 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-slate-500">{q.courseCode}</p>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{q.courseName}</h4>
                    <p className="text-xs text-slate-500">Exam Type: {q.examType}</p>
                  </div>
                  <Eye className="w-4 h-4 text-slate-400" />
                </div>
              ))}

              {myBookmarks.length === 0 && (
                <p className="text-xs text-slate-500 italic text-center py-6">You haven't bookmarked any question papers yet.</p>
              )}
            </div>
          </div>

          {/* User's Authored Uploads Section */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">My Upload Contributions</h3>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {myUploads.map((q) => (
                <div 
                  key={q.id}
                  onClick={() => onNavigateToQuestion(q.id)}
                  className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900 rounded-xl hover:bg-slate-100/55 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">{q.courseCode}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                        q.examType === 'Mid' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600' : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600'
                      }`}>
                        {q.examType}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{q.courseName}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>{q.views || 0} views</span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        <span>{q.downloads || 0} downloads</span>
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingQuestion(q);
                        setIsEditModalOpen(true);
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/45 dark:border-slate-800 transition-colors"
                      title="Edit question paper"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteOwnUpload(q.id, e)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 rounded-lg transition-colors"
                      title="Delete question paper"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {myUploads.length === 0 && (
                <p className="text-xs text-slate-500 italic text-center py-6">You haven't uploaded any previous question papers yet.</p>
              )}
            </div>
          </div>

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

      </div>

    </div>
  );
}
