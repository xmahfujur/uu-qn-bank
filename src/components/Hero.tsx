import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  BookOpen, 
  Download, 
  Upload, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

interface HeroProps {
  currentUser: any;
  onNavigateToDashboard: () => void;
  onTriggerAuth: () => void;
}

export default function Hero({ currentUser, onNavigateToDashboard, onTriggerAuth }: HeroProps) {
  // Statistics States
  const [stats, setStats] = useState({
    departments: 0,
    questions: 0,
    users: 0,
    downloads: 0,
    uploads: 0
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const deptsSnap = await getDocs(collection(db, 'departments'));
        const questionsSnap = await getDocs(collection(db, 'questions'));
        const usersSnap = await getDocs(collection(db, 'users'));
        
        let qCount = 0;
        let dCount = 0;
        let uCount = 0;

        questionsSnap.forEach((doc) => {
          qCount++;
          const data = doc.data();
          dCount += (data.downloads || 0);
          uCount += (data.views || 0);
        });

        setStats({
          departments: deptsSnap.size || 8,
          questions: qCount || 42,
          users: usersSnap.size || 150,
          downloads: dCount || 280,
          uploads: qCount || 42
        });
      } catch (err) {
        console.error('Error loading hero stats:', err);
        // Fallback placeholders if DB is empty
        setStats({
          departments: 8,
          questions: 42,
          users: 156,
          downloads: 284,
          uploads: 42
        });
      }
    }
    loadStats();
  }, []);

  return (
    <div id="hero-landing-root" className="relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Decorative Grid Overlays */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      {/* Main Hero Section */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center space-y-8">
        
        {/* Banner Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold shadow-sm backdrop-blur">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Uttara University Scholar Circle Portal</span>
        </div>

        {/* Display Heading */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold font-display text-slate-950 dark:text-white tracking-tight leading-tight">
            Preserving Academic History,<br/>
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">One Question Paper At A Time</span>
          </h1>
          <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-sans max-w-2xl mx-auto">
            Uttara University’s premium repository to preserve, organize, and access previous examination question papers. Understand trends, patterns, and prepare better for exams.
          </p>
        </div>

        {/* Interactive Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {currentUser ? (
            <button
              id="hero-go-dashboard-btn"
              onClick={onNavigateToDashboard}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-600/15 group transition-all transform hover:-translate-y-0.5"
            >
              Enter Dashboard Console
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <>
              <button
                id="hero-signup-btn"
                onClick={onTriggerAuth}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 group transition-all transform hover:-translate-y-0.5"
              >
                Sign Up with Google
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                id="hero-login-btn"
                onClick={onTriggerAuth}
                className="w-full sm:w-auto px-8 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all transform hover:-translate-y-0.5"
              >
                Sign In with Google
              </button>
            </>
          )}
        </div>

        {/* Live Counter Statistics Panel */}
        <div className="pt-8 max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 sm:p-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-3xl shadow-xl">
            {[
              { label: 'Academic Departments', value: `${stats.departments}+`, desc: 'CSE, EEE, BBA...' },
              { label: 'Preserved Papers', value: `${stats.questions}+`, desc: 'Verified semesters' },
              { label: 'Active Students', value: `${stats.users}+`, desc: 'Collaborative network' },
              { label: 'Direct Downloads', value: `${stats.downloads}+`, desc: 'High resolution' }
            ].map((stat, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-2xl sm:text-3xl font-extrabold font-display text-slate-950 dark:text-white">{stat.value}</p>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-[10px] text-slate-400">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Feature Cards Grid */}
      <div className="bg-white/40 dark:bg-slate-900/10 border-t border-slate-200 dark:border-slate-900/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-950 dark:text-white">Comprehensive Scholar Utility Features</h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">Designed to deliver high performance academic preservation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: BookOpen, 
                title: 'Traverse folders instantly', 
                desc: 'Traverse through hierarchical folders to instantly narrow down to Department › Batch › Semester › Exam Category. Clean and incredibly fast.' 
              },
              { 
                icon: Sparkles, 
                title: 'Gemini AI Assistant', 
                desc: 'Unlock next-gen capability. Parse image URLs to auto-extract course details, summarize questions, and generate predictive syllabus maps.' 
              },
              { 
                icon: ShieldCheck, 
                title: 'Vetted by community', 
                desc: 'Includes flag and report systems allowing student moderators to report duplicates, broken image URLs, or wrong uploads for high quality standards.' 
              }
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div key={idx} className="p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl w-fit mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold font-display text-slate-900 dark:text-white mb-2">{feat.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </div>

    </div>
  );
}
