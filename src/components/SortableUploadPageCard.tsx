import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  Crop,
  FolderPlus,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { formatImageUrl, handleImageError } from '../utils/imageUrl';

export type SortablePageUploadStatus = 'pending' | 'uploading' | 'done' | 'failed';

export interface SortableCapturedPage {
  id: string;
  file?: File | null;
  dataUrl: string;
  originalName?: string;
  originalSize?: number;
  originalLastModified?: number;
  status: SortablePageUploadStatus;
  attemptText?: string;
  uploadedUrl?: string;
  deleteUrl?: string;
  isUploading?: boolean;
  uploadError?: string;
}

interface SortablePreviewCardProps {
  page: SortableCapturedPage;
  index: number;
  totalCount: number;
  isAnalyzing: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAIExtract: () => void;
  onRemove: (index: number) => void;
  onExpandPreview: (url: string) => void;
  onRetryUpload: (pageId: string) => void;
}

export function SortablePreviewCard({
  page,
  index,
  totalCount,
  isAnalyzing,
  onMoveUp,
  onMoveDown,
  onAIExtract,
  onRemove,
  onExpandPreview,
  onRetryUpload,
}: SortablePreviewCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    disabled: totalCount <= 1,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const previewSrc = page.dataUrl || (page.uploadedUrl ? formatImageUrl(page.uploadedUrl) : '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white dark:bg-slate-950 border rounded-xl p-3 shadow-sm flex flex-col justify-between space-y-2.5 transition-shadow ${
        isDragging
          ? 'opacity-40 border-indigo-500 ring-2 ring-indigo-500/30 z-10'
          : 'border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/50'
      }`}
    >
      {/* Header: Drag Handle, Page Badge, Arrow Controls & Actions */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...(totalCount > 1 ? attributes : {})}
            {...(totalCount > 1 ? listeners : {})}
            disabled={totalCount <= 1}
            className={`touch-none select-none p-1.5 rounded-lg border transition-colors shrink-0 flex items-center justify-center ${
              totalCount > 1
                ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-grab active:cursor-grabbing shadow-2xs'
                : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 text-slate-300 dark:text-slate-600 cursor-default'
            }`}
            title={totalCount > 1 ? 'Drag to reorder page (touch or mouse)' : 'Add more pages to reorder'}
            aria-label={totalCount > 1 ? `Drag Page ${index + 1} to reorder` : `Page ${index + 1} drag handle`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-[11px] font-bold rounded-md shrink-0">
            Page {index + 1}
          </span>

          {totalCount > 1 && (
            <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp(index);
                }}
                disabled={index === 0}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Move Earlier"
                aria-label={`Move Page ${index + 1} earlier`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown(index);
                }}
                disabled={index === totalCount - 1}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Move Later"
                aria-label={`Move Page ${index + 1} later`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {index === 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAIExtract();
              }}
              disabled={isAnalyzing || (!page.uploadedUrl && !page.dataUrl)}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              title="Scan Page 1 with AI OCR to auto-fill course code and title"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 text-amber-300" />
              )}
              <span>AI Scan</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
            title="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* High-Res Thumbnail Preview */}
      <div
        onClick={() => previewSrc && onExpandPreview(previewSrc)}
        className="relative h-44 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1 cursor-pointer group-hover:border-indigo-500/40 transition-colors"
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={`Page ${index + 1} Preview`}
            className="w-full h-full object-contain rounded select-none pointer-events-none"
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (page.file) {
                try {
                  e.currentTarget.src = URL.createObjectURL(page.file);
                  return;
                } catch {}
              }
              if (page.uploadedUrl && e.currentTarget.src !== formatImageUrl(page.uploadedUrl)) {
                e.currentTarget.src = formatImageUrl(page.uploadedUrl);
                return;
              }
              handleImageError(e, `Page ${index + 1}`);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
            <ImageIcon className="w-8 h-8 opacity-40 mb-1" />
            <span>Loading preview...</span>
          </div>
        )}

        {/* Status Badge Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          {page.status === 'pending' ? (
            <span className="px-2 py-1 bg-slate-950/80 backdrop-blur-md text-slate-200 border border-slate-600/40 text-[10px] font-bold rounded-md flex items-center gap-1.5 shadow-sm">
              Pending...
            </span>
          ) : page.status === 'uploading' || page.isUploading ? (
            <span className="px-2 py-1 bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-400/30 text-[10px] font-bold rounded-md flex items-center gap-1.5 shadow-sm">
              <Loader2 className="w-3 h-3 animate-spin" />
              {page.attemptText || 'Uploading...'}
            </span>
          ) : page.status === 'failed' || page.uploadError ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRetryUpload(page.id);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRetryUpload(page.id);
              }}
              className="pointer-events-auto px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-rose-400/50"
              title="Tap to retry upload"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Failed · Tap to Retry</span>
            </button>
          ) : (
            <span className="px-2 py-0.5 bg-emerald-950/80 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-md flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Ready
            </span>
          )}

          <span className="pointer-events-auto px-1.5 py-0.5 bg-slate-950/80 hover:bg-slate-900 text-white/80 text-[9px] rounded font-medium flex items-center gap-1 border border-slate-700/60 shadow-sm backdrop-blur-sm">
            <Maximize2 className="w-2.5 h-2.5" /> Tap to view
          </span>
        </div>
      </div>
    </div>
  );
}

interface SortableOrganizerCardProps {
  item: SortableCapturedPage;
  index: number;
  totalCount: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onStartCrop: (index: number) => void;
  onExpandPreview: (url: string) => void;
  onRemove: (index: number) => void;
  onTriggerRetakeBrowse: (index: number) => void;
  onTriggerRetakeCamera: (index: number) => void;
}

export function SortableOrganizerCard({
  item,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onStartCrop,
  onExpandPreview,
  onRemove,
  onTriggerRetakeBrowse,
  onTriggerRetakeCamera,
}: SortableOrganizerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: totalCount <= 1,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 space-y-3 transition-shadow ${
        isDragging
          ? 'opacity-40 border-indigo-500 ring-2 ring-indigo-500/30 z-10'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...(totalCount > 1 ? attributes : {})}
            {...(totalCount > 1 ? listeners : {})}
            disabled={totalCount <= 1}
            className={`touch-none select-none p-1.5 rounded-lg border transition-colors shrink-0 flex items-center justify-center ${
              totalCount > 1
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-grab active:cursor-grabbing shadow-2xs'
                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 text-slate-300 dark:text-slate-600 cursor-default'
            }`}
            title={totalCount > 1 ? 'Drag to reorder page (touch or mouse)' : 'Add more pages to reorder'}
            aria-label={totalCount > 1 ? `Drag Page ${index + 1} to reorder` : `Page ${index + 1} drag handle`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs rounded-md uppercase">
            Page {index + 1}
          </span>

          {/* Page Order Re-alignment Controls */}
          <div className="flex items-center gap-0.5 ml-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Move Page Up (Earlier)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={index === totalCount - 1}
              className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Move Page Down (Later)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStartCrop(index)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Crop</span>
          </button>
          <button
            type="button"
            onClick={() => onExpandPreview(item.dataUrl)}
            className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg flex items-center gap-1 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Inspect</span>
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            title="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Preview Container */}
      <div className="relative h-52 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-slate-800">
        <img
          src={item.dataUrl}
          alt={`Question Page ${index + 1}`}
          className="w-full h-full object-contain select-none pointer-events-none"
        />
      </div>

      {/* Action Buttons: Crop, Replace File, Retake Camera */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onStartCrop(index)}
          className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Crop className="w-3.5 h-3.5" />
          <span>Crop</span>
        </button>
        <button
          type="button"
          onClick={() => onTriggerRetakeBrowse(index)}
          className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
          <span>Replace File</span>
        </button>
        <button
          type="button"
          onClick={() => onTriggerRetakeCamera(index)}
          className="py-1.5 px-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Retake</span>
        </button>
      </div>
    </div>
  );
}

interface SortableFileListRowProps {
  page: SortableCapturedPage;
  index: number;
  totalCount: number;
  onRetryUpload: (pageId: string) => void;
}

export function SortableFileListRow({
  page,
  index,
  totalCount,
  onRetryUpload,
}: SortableFileListRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    disabled: totalCount <= 1,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`py-1.5 px-1 flex items-center justify-between gap-2 rounded-lg transition-colors ${
        isDragging
          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-400 opacity-60 z-10'
          : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...(totalCount > 1 ? attributes : {})}
          {...(totalCount > 1 ? listeners : {})}
          disabled={totalCount <= 1}
          className={`touch-none select-none p-1 rounded border shrink-0 flex items-center justify-center transition-colors ${
            totalCount > 1
              ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 cursor-grab active:cursor-grabbing'
              : 'border-transparent text-slate-300 dark:text-slate-700 cursor-default'
          }`}
          title={totalCount > 1 ? 'Drag to reorder file' : 'Add more pages to reorder'}
          aria-label={`Drag file ${index + 1} to reorder`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded font-bold text-slate-600 dark:text-slate-300 shrink-0">
          P{index + 1}
        </span>
        <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
          {page.originalName || page.file?.name || `Page ${index + 1}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {page.status === 'pending' && (
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded">
            pending
          </span>
        )}
        {page.status === 'uploading' && (
          <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold rounded flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            {page.attemptText || 'uploading'}
          </span>
        )}
        {page.status === 'done' && (
          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            done
          </span>
        )}
        {page.status === 'failed' && (
          <button
            type="button"
            onClick={() => onRetryUpload(page.id)}
            className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold rounded flex items-center gap-1 cursor-pointer"
            title={page.uploadError || 'Retry this page'}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>failed · retry</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface SortablePageDragOverlayProps {
  page: SortableCapturedPage;
  pageNumber: number;
}

export function SortablePageDragOverlay({ page, pageNumber }: SortablePageDragOverlayProps) {
  const previewSrc = page.dataUrl || (page.uploadedUrl ? formatImageUrl(page.uploadedUrl) : '');
  return (
    <div className="bg-white dark:bg-slate-950 border-2 border-indigo-500 rounded-xl p-3 shadow-2xl ring-4 ring-indigo-500/20 flex flex-col space-y-2.5 scale-[1.02] cursor-grabbing">
      <div className="flex items-center gap-1.5">
        <span className="p-1 text-indigo-600 dark:text-indigo-400">
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-md">
          Page {pageNumber}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {page.originalName || 'Moving page...'}
        </span>
      </div>
      <div className="h-44 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={`Dragging Page ${pageNumber}`}
            className="w-full h-full object-contain rounded"
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-slate-500" />
        )}
      </div>
    </div>
  );
}
