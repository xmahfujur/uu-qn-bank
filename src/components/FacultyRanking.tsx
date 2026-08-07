import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Loader2, 
  Star, 
  Search, 
  Crown, 
  Award, 
  User, 
  ThumbsUp, 
  MessageSquare,
  BookOpen,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  runTransaction, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Faculty, Department, UserProfile } from '../types';

interface FacultyRankingProps {
  currentUser: UserProfile | null;
  departments: Department[];
  onTriggerAuth: () => void;
}

export default function FacultyRanking({ currentUser, departments, onTriggerAuth }: FacultyRankingProps) {
  const [loading, setLoading] = useState(true);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [userRatings, setUserRatings] = useState<{ [facultyId: string]: number }>({});
  const [ratingLoading, setRatingLoading] = useState<{ [facultyId: string]: boolean }>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showNotif(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  }
  
  // Filtering and Searching
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Fetch all faculties from Firestore
  async function fetchFaculties() {
    try {
      const snap = await getDocs(collection(db, 'faculties'));
      const list: Faculty[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Faculty);
      });
      setFaculties(list);
    } catch (err) {
      console.error("Error fetching faculties:", err);
    }
  }

  // Fetch faculties and user ratings on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await fetchFaculties();
      setLoading(false);
    }
    loadData();
  }, []);

  // Fetch current user's ratings
  useEffect(() => {
    if (!currentUser) {
      setUserRatings({});
      return;
    }
    async function fetchUserRatings() {
      try {
        const q = query(collection(db, 'faculty_ratings'), where('userId', '==', currentUser.uid));
        const snap = await getDocs(q);
        const map: { [key: string]: number } = {};
        snap.forEach(doc => {
          const data = doc.data();
          map[data.facultyId] = data.rating;
        });
        setUserRatings(map);
      } catch (err) {
        console.error("Error loading user ratings:", err);
      }
    }
    fetchUserRatings();
  }, [currentUser]);

  // Handle Interactive Rating (1-5 Stars) using Firestore Transaction
  async function handleRateFaculty(facultyId: string, rating: number) {
    if (!currentUser) {
      onTriggerAuth();
      return;
    }
    
    // Prevent double clicking / concurrent operations
    if (ratingLoading[facultyId]) return;
    
    setRatingLoading(prev => ({ ...prev, [facultyId]: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const ratingId = `${currentUser.uid}_${facultyId}`;
        const ratingRef = doc(db, 'faculty_ratings', ratingId);
        const facultyRef = doc(db, 'faculties', facultyId);

        const ratingSnap = await transaction.get(ratingRef);
        const facultySnap = await transaction.get(facultyRef);

        if (!facultySnap.exists()) {
          throw new Error("Faculty member no longer exists.");
        }

        const facultyData = facultySnap.data();
        const currentSum = facultyData.totalRatingSum || 0;
        const currentCount = facultyData.totalRatingCount || 0;

        let oldRating = 0;
        const isNew = !ratingSnap.exists();
        if (!isNew) {
          oldRating = ratingSnap.data().rating;
        }

        const ratingDiff = rating - oldRating;
        const newSum = currentSum + ratingDiff;
        const newCount = isNew ? currentCount + 1 : currentCount;
        const newAverage = newCount > 0 ? Number((newSum / newCount).toFixed(2)) : 0;

        // Atomically set rating document
        transaction.set(ratingRef, {
          id: ratingId,
          userId: currentUser.uid,
          username: currentUser.username,
          facultyId,
          rating,
          createdAt: new Date().toISOString()
        });

        // Atomically update faculty document stats
        transaction.update(facultyRef, {
          totalRatingSum: newSum,
          totalRatingCount: newCount,
          averageRating: newAverage
        });
      });

      // Update local rating map state
      setUserRatings(prev => ({ ...prev, [facultyId]: rating }));
      
      // Refresh local faculties data
      await fetchFaculties();
      showNotif('success', 'Rating submitted successfully!');
    } catch (err: any) {
      console.error("Rating transaction failed:", err);
      showNotif('error', "Failed to submit rating: " + err.message);
    } finally {
      setRatingLoading(prev => ({ ...prev, [facultyId]: false }));
    }
  }

  // Filter & Sort Faculties based on criteria
  const filteredFaculties = faculties
    .filter(f => {
      const matchDept = !selectedDeptId || f.departmentId === selectedDeptId;
      const matchSearch = !searchQuery.trim() || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.designation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchSearch;
    })
    // Sort descending by averageRating, and sub-sort by totalRatingCount
    .sort((a, b) => {
      if ((b.averageRating || 0) !== (a.averageRating || 0)) {
        return (b.averageRating || 0) - (a.averageRating || 0);
      }
      return (b.totalRatingCount || 0) - (a.totalRatingCount || 0);
    });

  // Extract Podium leaders (Top 3)
  const podiumLeaders = filteredFaculties.slice(0, 3);
  const listFaculties = filteredFaculties.slice(3);

  // Helper component to render stars for display
  function StarDisplay({ rating }: { rating: number }) {
    const stars = [];
    const roundedRating = Math.round(rating * 2) / 2; // nearest half star
    
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(<Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />);
      } else if (i - 0.5 === roundedRating) {
        stars.push(
          <div key={i} className="relative inline-block">
            <Star className="w-4 h-4 text-slate-300 dark:text-slate-700" />
            <div className="absolute top-0 left-0 overflow-hidden w-[50%]">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
        );
      } else {
        stars.push(<Star key={i} className="w-4 h-4 text-slate-300 dark:text-slate-700" />);
      }
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  }

  // Interactive Star Selector for user rating
  function StarRatingSelector({ facultyId, currentRating, onRate }: { facultyId: string; currentRating: number; onRate: (rating: number) => void }) {
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const isLoading = ratingLoading[facultyId];

    if (isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />;
    }

    return (
      <div className="flex flex-col items-end sm:items-center space-y-1">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((starValue) => {
            const active = hoverRating !== null ? starValue <= hoverRating : starValue <= currentRating;
            return (
              <button
                key={starValue}
                type="button"
                onMouseEnter={() => setHoverRating(starValue)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => onRate(starValue)}
                className="transition-transform active:scale-125 focus:outline-none"
              >
                <Star 
                  className={`w-5 h-5 cursor-pointer transition-colors ${
                    active 
                      ? 'fill-amber-400 text-amber-400 scale-105' 
                      : 'text-slate-300 dark:text-slate-700 hover:text-amber-300'
                  }`} 
                />
              </button>
            );
          })}
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {currentRating > 0 ? `Your Rating: ${currentRating}★` : 'Rate Faculty'}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4 py-6">
      
      {/* Title Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight font-display text-slate-900 dark:text-white">
          Faculty Excellence Board
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Recognizing the most dedicated academic instructors of Uttara University. Explore departments and submit your genuine feedback.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-900 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by faculty name or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-850 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full md:w-auto px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-750 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Computing rankings...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">

          {/* Podium (Top 3) */}
          {podiumLeaders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 items-end">
              
              {/* 2nd Place */}
              {podiumLeaders[1] && (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900/80 flex flex-col items-center justify-center text-center space-y-3 relative order-2 md:order-1 shadow-sm min-h-[220px]">
                  <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shadow-sm">
                    2
                  </div>
                  <div className="absolute -top-4 text-slate-400">
                    <Award className="w-7 h-7 fill-slate-300 text-slate-400" />
                  </div>
                  {podiumLeaders[1].imageUrl ? (
                    <img
                      src={podiumLeaders[1].imageUrl}
                      alt={podiumLeaders[1].name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 font-black text-lg">
                      {podiumLeaders[1].name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="max-w-full overflow-hidden">
                    <h4 className="font-extrabold text-slate-850 dark:text-slate-150 text-sm line-clamp-1">{podiumLeaders[1].name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{podiumLeaders[1].designation}</p>
                    <p className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wide mt-1">
                      {departments.find(d => d.id === podiumLeaders[1].departmentId)?.code}
                    </p>
                    {(podiumLeaders[1].email || podiumLeaders[1].phone) && (
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-900/50 flex flex-col items-center gap-0.5 max-w-full">
                        {podiumLeaders[1].email && <span className="truncate max-w-[170px]">✉ {podiumLeaders[1].email}</span>}
                        {podiumLeaders[1].phone && <span className="truncate max-w-[170px]">☎ {podiumLeaders[1].phone}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-900/60 w-full">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                        {podiumLeaders[1].averageRating ? podiumLeaders[1].averageRating.toFixed(2) : '0.00'}
                      </span>
                      <StarDisplay rating={podiumLeaders[1].averageRating || 0} />
                    </div>
                    <span className="text-[10px] text-slate-400">({podiumLeaders[1].totalRatingCount || 0} review(s))</span>
                  </div>

                  {currentUser && (
                    <div className="pt-2 w-full flex justify-center border-t border-slate-50 dark:border-slate-900">
                      <StarRatingSelector 
                        facultyId={podiumLeaders[1].id} 
                        currentRating={userRatings[podiumLeaders[1].id] || 0} 
                        onRate={(r) => handleRateFaculty(podiumLeaders[1].id, r)} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 1st Place */}
              {podiumLeaders[0] && (
                <div className="p-8 rounded-2xl bg-white dark:bg-slate-950 border-2 border-amber-400/40 flex flex-col items-center justify-center text-center space-y-3 relative order-1 md:order-2 shadow-md -translate-y-2 min-h-[250px]">
                  <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shadow-md">
                    1
                  </div>
                  <div className="absolute -top-4.5 text-amber-500 bg-white dark:bg-slate-950 p-1.5 rounded-full border border-amber-400/30 shadow-sm">
                    <Crown className="w-5 h-5 fill-amber-400 text-amber-400 animate-pulse" />
                  </div>
                  {podiumLeaders[0].imageUrl ? (
                    <img
                      src={podiumLeaders[0].imageUrl}
                      alt={podiumLeaders[0].name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border-2 border-amber-300 shadow-md animate-pulse-none"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xl shadow-inner">
                      {podiumLeaders[0].name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="max-w-full overflow-hidden">
                    <h4 className="font-black text-slate-900 dark:text-white text-base line-clamp-1">{podiumLeaders[0].name}</h4>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5 line-clamp-1">{podiumLeaders[0].designation}</p>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mt-1 bg-amber-500/10 px-2 py-0.5 rounded-full inline-block">
                      {departments.find(d => d.id === podiumLeaders[0].departmentId)?.code}
                    </p>
                    {(podiumLeaders[0].email || podiumLeaders[0].phone) && (
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-900/50 flex flex-col items-center gap-0.5 max-w-full">
                        {podiumLeaders[0].email && <span className="truncate max-w-[190px]">✉ {podiumLeaders[0].email}</span>}
                        {podiumLeaders[0].phone && <span className="truncate max-w-[190px]">☎ {podiumLeaders[0].phone}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-900/60 w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-base text-slate-900 dark:text-white">
                        {podiumLeaders[0].averageRating ? podiumLeaders[0].averageRating.toFixed(2) : '0.00'}
                      </span>
                      <StarDisplay rating={podiumLeaders[0].averageRating || 0} />
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">({podiumLeaders[0].totalRatingCount || 0} review(s))</span>
                  </div>

                  {currentUser && (
                    <div className="pt-2 w-full flex justify-center border-t border-slate-100 dark:border-slate-900">
                      <StarRatingSelector 
                        facultyId={podiumLeaders[0].id} 
                        currentRating={userRatings[podiumLeaders[0].id] || 0} 
                        onRate={(r) => handleRateFaculty(podiumLeaders[0].id, r)} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3rd Place */}
              {podiumLeaders[2] && (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900/80 flex flex-col items-center justify-center text-center space-y-3 relative order-3 md:order-3 shadow-sm min-h-[220px]">
                  <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-amber-700/10 text-amber-700 dark:text-amber-650 flex items-center justify-center font-bold text-xs shadow-sm">
                    3
                  </div>
                  <div className="absolute -top-4 text-amber-600">
                    <Award className="w-7 h-7 fill-amber-650/40 text-amber-700" />
                  </div>
                  {podiumLeaders[2].imageUrl ? (
                    <img
                      src={podiumLeaders[2].imageUrl}
                      alt={podiumLeaders[2].name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 font-black text-lg">
                      {podiumLeaders[2].name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="max-w-full overflow-hidden">
                    <h4 className="font-extrabold text-slate-850 dark:text-slate-150 text-sm line-clamp-1">{podiumLeaders[2].name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{podiumLeaders[2].designation}</p>
                    <p className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wide mt-1">
                      {departments.find(d => d.id === podiumLeaders[2].departmentId)?.code}
                    </p>
                    {(podiumLeaders[2].email || podiumLeaders[2].phone) && (
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-900/50 flex flex-col items-center gap-0.5 max-w-full">
                        {podiumLeaders[2].email && <span className="truncate max-w-[170px]">✉ {podiumLeaders[2].email}</span>}
                        {podiumLeaders[2].phone && <span className="truncate max-w-[170px]">☎ {podiumLeaders[2].phone}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-900/60 w-full">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                        {podiumLeaders[2].averageRating ? podiumLeaders[2].averageRating.toFixed(2) : '0.00'}
                      </span>
                      <StarDisplay rating={podiumLeaders[2].averageRating || 0} />
                    </div>
                    <span className="text-[10px] text-slate-400">({podiumLeaders[2].totalRatingCount || 0} review(s))</span>
                  </div>

                  {currentUser && (
                    <div className="pt-2 w-full flex justify-center border-t border-slate-50 dark:border-slate-900">
                      <StarRatingSelector 
                        facultyId={podiumLeaders[2].id} 
                        currentRating={userRatings[podiumLeaders[2].id] || 0} 
                        onRate={(r) => handleRateFaculty(podiumLeaders[2].id, r)} 
                      />
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* Roster List (4th Place and below) */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {podiumLeaders.length > 0 ? 'Remaining Faculty Rankings' : 'Faculty Rankings'}
              </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {listFaculties.map((f, idx) => {
                const rank = idx + 4;
                const dept = departments.find(d => d.id === f.departmentId);
                const userRating = userRatings[f.id] || 0;
                
                return (
                  <div key={f.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors">
                    
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Rank Indicator */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {rank}
                      </div>

                      {f.imageUrl ? (
                        <img
                          src={f.imageUrl}
                          alt={f.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-800 flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0">
                          {f.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                            {f.name}
                          </h4>
                          {dept && (
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 rounded-md font-sans">
                              {dept.code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{f.designation}</p>

                        {(f.email || f.phone) && (
                          <div className="flex flex-col gap-0.5 text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                            {f.email && <span className="truncate">✉ {f.email}</span>}
                            {f.phone && <span className="truncate">☎ {f.phone}</span>}
                          </div>
                        )}
                        
                        {/* Rating Stats Summary */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                            {f.averageRating ? f.averageRating.toFixed(2) : '0.00'}
                          </span>
                          <StarDisplay rating={f.averageRating || 0} />
                          <span className="text-[10px] text-slate-400">
                            ({f.totalRatingCount || 0} reviews)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Rater (if authenticated) */}
                    {currentUser ? (
                      <div className="flex sm:justify-end items-center">
                        <StarRatingSelector 
                          facultyId={f.id} 
                          currentRating={userRating} 
                          onRate={(r) => handleRateFaculty(f.id, r)} 
                        />
                      </div>
                    ) : (
                      <button 
                        onClick={onTriggerAuth}
                        className="self-start sm:self-auto px-3 py-1 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-800/80"
                      >
                        Sign in to rate
                      </button>
                    )}

                  </div>
                );
              })}

              {/* No records handling */}
              {filteredFaculties.length === 0 && (
                <div className="text-center py-16">
                  <GraduationCap className="w-12 h-12 text-slate-300 dark:text-slate-750 mx-auto mb-3" />
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200">No instructors listed yet</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery.trim() || selectedDeptId 
                      ? 'No faculty members match your search criteria or department filter.' 
                      : 'Admins and moderators can add faculty members from the Admin Panel to populate this leaderboard.'}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
          notification.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-100 dark:border-emerald-800' 
            : 'bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-100 dark:border-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

    </div>
  );
}
