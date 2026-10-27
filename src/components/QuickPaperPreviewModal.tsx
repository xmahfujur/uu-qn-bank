import React, { useState } from 'react';
import { 
  X, 
  Check, 
  AlertTriangle, 
  Download, 
  Eye, 
  Pencil, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User, 
  FileText, 
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  GraduationCap
} from 'lucide-react';
import { QuestionPaper, Department, Batch, Semester } from '../types';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';

interface QuickPaperPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionPaper | null;
  departments: Department[];
  batches: Batch[];
  semesters: Semester[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (question: QuestionPaper) => void;
  onDelete: (id: string) => void;
  onNavigateToDetail: (id: string) => void;
  verifyingId?: string | null;
}

export default function QuickPaperPreviewModal({
  isOpen,
  onClose,
  question,
  departments,
  batches,
  semesters,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onNavigateToDetail,
  verifyingId
}: QuickPaperPreviewModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!isOpen || !question) return null;

  // Resolve hierarchy names
  const dept = departments.find(d => d.id === question.departmentId);
  const batch = batches.find(b => b.id === question.batchId);
  const semester = semesters.find(s => s.id === question.semesterId);

  // Extract all images
  const images = question.imageUrls && question.imageUrls.length > 0 
    ? question.imageUrls 
    : question.imageUrl 
    ? [question.imageUrl] 
    : [];

  const currentImage = images[activeImageIndex] || images[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  {question.courseCode}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  question.examType === 'Mid'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}>
                  {question.examType} Term
                </span>
                {question.status === 'pending' ? (
                  <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Pending Review
                  </span>
                ) : question.status === 'rejected' ? (
                  <span className="text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md">
                    Rejected
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {question.courseName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateToDetail(question.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
              title="Open full question page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Page</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Two columns (Image Viewer + Metadata & Audit Info) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* Left: Image / PDF Gallery Preview (7 cols) */}
          <div className="md:col-span-7 p-4 sm:p-6 flex flex-col bg-slate-950/5 dark:bg-slate-950/60 min-h-[360px] justify-between">
            {images.length > 0 ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="relative flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[320px] max-h-[500px] group">
                  <img
                    src={formatImageUrl(currentImage)}
                    alt={`${question.courseCode} Page ${activeImageIndex + 1}`}
                    onError={handleImageError}
                    className="max-h-full max-w-full object-contain select-none"
                  />

                  {/* Previous / Next buttons */}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-950/60 text-white hover:bg-slate-950/90 backdrop-blur-sm transition-all"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-950/60 text-white hover:bg-slate-950/90 backdrop-blur-sm transition-all"
                        title="Next page"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Page indicator pill */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-white text-[11px] font-mono font-semibold">
                    Page {activeImageIndex + 1} of {images.length}
                  </div>

                  {/* Open raw image button */}
                  <a
                    href={formatImageUrl(currentImage)}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-3 right-3 p-2 rounded-xl bg-slate-950/60 text-white hover:bg-slate-950/90 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                    title="View full resolution"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                </div>

                {/* Thumbnails rail if multiple */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                          activeImageIndex === idx
                            ? 'border-indigo-600 scale-105 shadow-md shadow-indigo-600/20'
                            : 'border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img 
                          src={formatImageUrl(img)} 
                          alt={`Thumbnail ${idx + 1}`} 
                          className="w-full h-full object-cover" 
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                <FileText className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Image Preview Available</p>
                {question.pdfUrl && (
                  <a
                    href={question.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Open PDF Document
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right: Metadata, Context & Quick Audit Info (5 cols) */}
          <div className="md:col-span-5 p-4 sm:p-6 space-y-5 bg-white dark:bg-slate-900">
            {/* Academic Context */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Academic Hierarchy
              </h4>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Department
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {dept ? `${dept.name} (${dept.code})` : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" /> Batch
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {batch ? batch.name : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Semester
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {semester ? semester.name : 'Unknown'}
                  </span>
                </div>
                {question.teacher && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-slate-500">Course Instructor</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {question.teacher}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Uploader & Engagement Stats */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Contribution & Engagement
              </h4>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Uploaded By
                  </span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    @{question.uploadedByUsername}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Uploaded On</span>
                  <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {new Date(question.uploadedAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-center">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
                    <p className="text-[10px] text-slate-400">Views</p>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                      {question.views || 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
                    <p className="text-[10px] text-slate-400">Downloads</p>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                      {question.downloads || 0}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
                    <p className="text-[10px] text-slate-400">Reports</p>
                    <p className={`font-bold text-sm font-mono mt-0.5 ${
                      question.reportCount > 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {question.reportCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Moderation / Verification Notes */}
            {question.verificationFeedback && (
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Verification Feedback
                </h4>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                  <p className="italic">"{question.verificationFeedback}"</p>
                  {question.verifiedByUsername && (
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                      Reviewed by @{question.verifiedByUsername}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Action Strip */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(question)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Metadata
            </button>
            <button
              onClick={() => onDelete(question.id)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Paper
            </button>
          </div>

          <div className="flex items-center gap-2">
            {question.status !== 'rejected' && (
              <button
                disabled={verifyingId === question.id}
                onClick={() => onReject(question.id)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {verifyingId === question.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                Reject
              </button>
            )}
            {question.status !== 'published' && (
              <button
                disabled={verifyingId === question.id}
                onClick={() => onApprove(question.id)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {verifyingId === question.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Approve & Publish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
