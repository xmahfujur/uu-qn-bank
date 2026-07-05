import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Award, 
  Heart, 
  Upload, 
  Sparkles, 
  Loader2, 
  ChevronUp, 
  Search,
  BookOpen
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile } from '../types';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), orderBy('uploadCount', 'desc'), limit(15));
        const querySnapshot = await getDocs(q);
        const usersList: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          usersList.push({ uid: doc.id, ...doc.data() } as any as UserProfile);
        });
        
        // Let's sort manually if Firestore rules require indices we haven't created yet
        const sorted = usersList.sort((a, b) => (b.uploadCount || 0) - (a.uploadCount || 0));
        setLeaders(sorted);
      } catch (err) {
        console.error('Error loading leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, []);

  return (
    <div id="leaderboard-root" className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Visual Header */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 shadow-inner">
          <Trophy className="w-8 h-8 animate-bounce" />
        </div>
        <h2 className="text-3xl font-extrabold font-display text-slate-900 dark:text-white">Contributor Leaderboard</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
          Uttara University academic heroes preserving education history. Build your reputation and earn contributor badges by sharing question papers!
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs text-slate-500 mt-2">Opening scholar honor roll...</p>
        </div>
      )}

      {!loading && (
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 shadow-xl overflow-hidden">
          
          {/* Top 3 Podium Cards */}
          {leaders.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/10">
              
              {/* Second Place */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-2.5 relative order-2 md:order-1">
                <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-xs">2</div>
                <img src={leaders[1].photoURL} alt={leaders[1].username} className="w-16 h-16 rounded-full border-2 border-slate-300 shadow" />
                <div>
                  <h4 className="font-bold text-sm">@{leaders[1].username}</h4>
                  <p className="text-[10px] text-slate-400">Bronze Scholar</p>
                </div>
                <div className="flex gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1"><Upload className="w-3.5 h-3.5 text-indigo-500" />{leaders[1].uploadCount || 0}</span>
                  <span className="flex items-center gap-1">❤️ {leaders[1].likesReceived || 0}</span>
                </div>
              </div>

              {/* First Place */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-500/30 flex flex-col items-center justify-center text-center space-y-2.5 relative order-1 md:order-2 shadow-md -translate-y-2">
                <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md">1</div>
                <div className="absolute -top-4 text-2xl">👑</div>
                <img src={leaders[0].photoURL} alt={leaders[0].username} className="w-20 h-20 rounded-full border-4 border-amber-400 shadow-md" />
                <div>
                  <h4 className="font-extrabold text-base">@{leaders[0].username}</h4>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Top Contributor</p>
                </div>
                <div className="flex gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1"><Upload className="w-3.5 h-3.5 text-indigo-500" />{leaders[0].uploadCount || 0}</span>
                  <span className="flex items-center gap-1">❤️ {leaders[0].likesReceived || 0}</span>
                </div>
              </div>

              {/* Third Place */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-2.5 relative order-3">
                <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-xs">3</div>
                <img src={leaders[2].photoURL} alt={leaders[2].username} className="w-16 h-16 rounded-full border-2 border-amber-600/30 shadow" />
                <div>
                  <h4 className="font-bold text-sm">@{leaders[2].username}</h4>
                  <p className="text-[10px] text-slate-400">Elite Scholar</p>
                </div>
                <div className="flex gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1"><Upload className="w-3.5 h-3.5 text-indigo-500" />{leaders[2].uploadCount || 0}</span>
                  <span className="flex items-center gap-1">❤️ {leaders[2].likesReceived || 0}</span>
                </div>
              </div>

            </div>
          )}

          {/* Table List View */}
          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {leaders.map((u, idx) => (
              <div key={u.uid} className="flex items-center justify-between p-4 sm:px-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm text-slate-400 font-mono w-6 text-right">#{idx + 1}</span>
                  <img src={u.photoURL} alt={u.username} className="w-9 h-9 rounded-full object-cover border border-slate-200/60 dark:border-slate-800" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      @{u.username}
                      {u.uploadCount >= 15 && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    </h4>
                    <p className="text-[10px] text-slate-400">Joined UU {new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 sm:gap-10">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Uploads</p>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 mt-0.5">{u.uploadCount || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Likes</p>
                    <p className="font-bold text-sm text-rose-500 mt-0.5">❤️ {u.likesReceived || 0}</p>
                  </div>
                </div>
              </div>
            ))}

            {leaders.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No contributors listed on the scholar board yet.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
