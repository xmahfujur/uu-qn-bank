import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, 
  RotateCw, 
  CheckCircle2, 
  X, 
  Sliders, 
  Loader2,
  Crop as CropIcon,
  Maximize2
} from 'lucide-react';
import { generateUniquePaperFileName } from '../utils/imageUploader';

interface FreeCropEditorProps {
  imageSrc: string;
  onApplyCrop: (croppedResult: { file: File; dataUrl: string }) => Promise<void> | void;
  onCancel: () => void;
  pageIndex: number;
}

type HandleType = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move' | null;

export default function FreeCropEditor({
  imageSrc,
  onApplyCrop,
  onCancel,
  pageIndex
}: FreeCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  
  // Controls
  const [rotation, setRotation] = useState<number>(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined); // undefined = Free size
  const [isProcessing, setIsProcessing] = useState(false);

  // Container & Image display layout
  const [layout, setLayout] = useState<{
    containerWidth: number;
    containerHeight: number;
    dispWidth: number;
    dispHeight: number;
    offsetX: number;
    offsetY: number;
  }>({
    containerWidth: 0,
    containerHeight: 0,
    dispWidth: 0,
    dispHeight: 0,
    offsetX: 0,
    offsetY: 0
  });

  // Crop rectangle in display pixels relative to dispWidth/dispHeight (0..dispWidth, 0..dispHeight)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });

  // Active drag handle
  const activeHandleRef = useRef<HandleType>(null);
  const startDragRef = useRef<{ pageX: number; pageY: number; cropRect: { x: number; y: number; width: number; height: number } } | null>(null);

  // Load natural image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Recalculate display scale and crop box when container size, rotation, or aspect preset changes
  const updateLayoutAndCrop = useCallback((preserveBox = false) => {
    if (!containerRef.current || !imgNaturalSize.width || !imgNaturalSize.height) return;

    const rect = containerRef.current.getBoundingClientRect();
    const cWidth = rect.width;
    const cHeight = rect.height;

    // Determine effective natural dimensions based on rotation
    const isRotatedVertical = rotation === 90 || rotation === 270;
    const effNatWidth = isRotatedVertical ? imgNaturalSize.height : imgNaturalSize.width;
    const effNatHeight = isRotatedVertical ? imgNaturalSize.width : imgNaturalSize.height;

    const padding = 20;
    const availWidth = Math.max(100, cWidth - padding * 2);
    const availHeight = Math.max(100, cHeight - padding * 2);

    const scale = Math.min(availWidth / effNatWidth, availHeight / effNatHeight);
    const dispWidth = effNatWidth * scale;
    const dispHeight = effNatHeight * scale;
    const offsetX = (cWidth - dispWidth) / 2;
    const offsetY = (cHeight - dispHeight) / 2;

    setLayout({
      containerWidth: cWidth,
      containerHeight: cHeight,
      dispWidth,
      dispHeight,
      offsetX,
      offsetY
    });

    if (!preserveBox) {
      if (aspect !== undefined) {
        // Compute maximum box with given aspect ratio
        let boxW = dispWidth * 0.9;
        let boxH = boxW / aspect;
        if (boxH > dispHeight * 0.9) {
          boxH = dispHeight * 0.9;
          boxW = boxH * aspect;
        }
        setCropRect({
          x: (dispWidth - boxW) / 2,
          y: (dispHeight - boxH) / 2,
          width: boxW,
          height: boxH
        });
      } else {
        // Free size: start at 90% of displayed image
        const boxW = dispWidth * 0.9;
        const boxH = dispHeight * 0.9;
        setCropRect({
          x: (dispWidth - boxW) / 2,
          y: (dispHeight - boxH) / 2,
          width: boxW,
          height: boxH
        });
      }
    }
  }, [imgNaturalSize, rotation, aspect]);

  useEffect(() => {
    if (imageLoaded) {
      updateLayoutAndCrop(false);
    }
  }, [imageLoaded, rotation, aspect, updateLayoutAndCrop]);

  // Handle Resize of Container
  useEffect(() => {
    const handleResize = () => {
      updateLayoutAndCrop(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateLayoutAndCrop]);

  // Start Drag
  const handleStartDrag = (handle: HandleType, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    activeHandleRef.current = handle;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    startDragRef.current = {
      pageX: clientX,
      pageY: clientY,
      cropRect: { ...cropRect }
    };
  };

  // Move Drag
  const handleMoveDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!activeHandleRef.current || !startDragRef.current || !layout.dispWidth) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const dx = clientX - startDragRef.current.pageX;
    const dy = clientY - startDragRef.current.pageY;

    const handle = activeHandleRef.current;
    const initial = startDragRef.current.cropRect;
    const minSize = 40;

    let { x, y, width, height } = initial;

    if (handle === 'move') {
      x = Math.max(0, Math.min(layout.dispWidth - width, initial.x + dx));
      y = Math.max(0, Math.min(layout.dispHeight - height, initial.y + dy));
      setCropRect({ x, y, width, height });
      return;
    }

    if (aspect === undefined) {
      // FREE SIZE MODE: Drag any edge or corner freely!
      if (handle.includes('w')) {
        const newX = Math.max(0, Math.min(initial.x + initial.width - minSize, initial.x + dx));
        width = initial.width + (initial.x - newX);
        x = newX;
      }
      if (handle.includes('e')) {
        width = Math.max(minSize, Math.min(layout.dispWidth - initial.x, initial.width + dx));
      }
      if (handle.includes('n')) {
        const newY = Math.max(0, Math.min(initial.y + initial.height - minSize, initial.y + dy));
        height = initial.height + (initial.y - newY);
        y = newY;
      }
      if (handle.includes('s')) {
        height = Math.max(minSize, Math.min(layout.dispHeight - initial.y, initial.height + dy));
      }
    } else {
      // ASPECT RATIO CONSTRAINED MODE
      if (handle === 'se' || handle === 'e' || handle === 's') {
        width = Math.max(minSize, Math.min(layout.dispWidth - initial.x, initial.width + dx));
        height = width / aspect;
        if (initial.y + height > layout.dispHeight) {
          height = layout.dispHeight - initial.y;
          width = height * aspect;
        }
      } else if (handle === 'nw' || handle === 'w' || handle === 'n') {
        const maxDx = initial.x;
        const maxDy = initial.y;
        let change = Math.min(dx, dy);
        width = Math.max(minSize, initial.width - change);
        height = width / aspect;
        x = initial.x + (initial.width - width);
        y = initial.y + (initial.height - height);
        if (x < 0) { x = 0; width = initial.x + initial.width; height = width / aspect; y = initial.y + initial.height - height; }
        if (y < 0) { y = 0; height = initial.y + initial.height; width = height * aspect; x = initial.x + initial.width - width; }
      } else if (handle === 'ne') {
        width = Math.max(minSize, Math.min(layout.dispWidth - initial.x, initial.width + dx));
        height = width / aspect;
        y = initial.y + (initial.height - height);
        if (y < 0) { y = 0; height = initial.y + initial.height; width = height * aspect; }
      } else if (handle === 'sw') {
        const newX = Math.max(0, Math.min(initial.x + initial.width - minSize, initial.x + dx));
        width = initial.width + (initial.x - newX);
        height = width / aspect;
        x = newX;
        if (initial.y + height > layout.dispHeight) {
          height = layout.dispHeight - initial.y;
          width = height * aspect;
          x = initial.x + initial.width - width;
        }
      }
    }

    setCropRect({ x, y, width, height });
  }, [aspect, layout]);

  // End Drag
  const handleEndDrag = useCallback(() => {
    activeHandleRef.current = null;
    startDragRef.current = null;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => handleMoveDrag(e);
    const onEnd = () => handleEndDrag();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [handleMoveDrag, handleEndDrag]);

  // Render & Export High Quality Crop
  const handleConfirmCrop = async () => {
    if (!imgNaturalSize.width || !imgNaturalSize.height || !layout.dispWidth) return;

    setIsProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });

      // Normalize crop coordinates relative to displayed image space (0..1)
      const normX = cropRect.x / layout.dispWidth;
      const normY = cropRect.y / layout.dispHeight;
      const normW = cropRect.width / layout.dispWidth;
      const normH = cropRect.height / layout.dispHeight;

      const isRotatedVertical = rotation === 90 || rotation === 270;
      const effWidth = isRotatedVertical ? img.naturalHeight : img.naturalWidth;
      const effHeight = isRotatedVertical ? img.naturalWidth : img.naturalHeight;

      const pxX = normX * effWidth;
      const pxY = normY * effHeight;
      const pxW = normW * effWidth;
      const pxH = normH * effHeight;

      // Create intermediate canvas for rotated image
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = effWidth;
      rotCanvas.height = effHeight;
      const rotCtx = rotCanvas.getContext('2d');
      if (!rotCtx) throw new Error('Failed canvas context');

      rotCtx.translate(effWidth / 2, effHeight / 2);
      rotCtx.rotate((rotation * Math.PI) / 180);
      rotCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      // Create crop canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.round(pxW));
      cropCanvas.height = Math.max(1, Math.round(pxH));
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) throw new Error('Failed crop context');

      cropCtx.drawImage(
        rotCanvas,
        pxX, pxY, pxW, pxH,
        0, 0, cropCanvas.width, cropCanvas.height
      );

      const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.92);
      const blob = await new Promise<Blob | null>(res => cropCanvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Failed blob export');

      const uniqueFileName = generateUniquePaperFileName(`cropped-page-${pageIndex + 1}.jpg`, pageIndex + 1);
      const file = new File([blob], uniqueFileName, { type: 'image/jpeg' });

      await onApplyCrop({ file, dataUrl });
    } catch (err) {
      console.error('Crop export error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <CropIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Crop & Edit Page {pageIndex + 1}</h3>
              <p className="text-[11px] text-slate-400">
                {aspect === undefined 
                  ? 'Free Size Mode: Drag any of the 8 border handles freely' 
                  : 'Preset Box Mode: Drag corners to adjust proportional crop box'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Interactive Canvas Area */}
        <div 
          ref={containerRef}
          className="relative w-full h-[380px] sm:h-[460px] bg-slate-950 overflow-hidden select-none flex items-center justify-center"
        >
          {imageLoaded && layout.dispWidth > 0 && (
            <div 
              className="relative"
              style={{
                width: `${layout.dispWidth}px`,
                height: `${layout.dispHeight}px`
              }}
            >
              {/* Displayed Rotated Image */}
              <img
                src={imageSrc}
                alt="Cropping target"
                className="w-full h-full object-contain pointer-events-none select-none"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out'
                }}
              />

              {/* Dark Overlay Outside Crop Area */}
              <div 
                className="absolute inset-0 bg-black/60 pointer-events-none"
                style={{
                  clipPath: `polygon(
                    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                    ${cropRect.x}px ${cropRect.y}px,
                    ${cropRect.x}px ${cropRect.y + cropRect.height}px,
                    ${cropRect.x + cropRect.width}px ${cropRect.y + cropRect.height}px,
                    ${cropRect.x + cropRect.width}px ${cropRect.y}px,
                    ${cropRect.x}px ${cropRect.y}px
                  )`
                }}
              />

              {/* Crop Window Box */}
              <div
                className="absolute border-2 border-white shadow-2xl cursor-move touch-none"
                style={{
                  left: `${cropRect.x}px`,
                  top: `${cropRect.y}px`,
                  width: `${cropRect.width}px`,
                  height: `${cropRect.height}px`
                }}
                onMouseDown={(e) => handleStartDrag('move', e)}
                onTouchStart={(e) => handleStartDrag('move', e)}
              >
                {/* Rule of Thirds Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                  <div className="border-r border-b border-white/60" />
                  <div className="border-r border-b border-white/60" />
                  <div className="border-b border-white/60" />
                  <div className="border-r border-b border-white/60" />
                  <div className="border-r border-b border-white/60" />
                  <div className="border-b border-white/60" />
                  <div className="border-r border-white/60" />
                  <div className="border-r border-white/60" />
                  <div className="" />
                </div>

                {/* Corner Bracket Handles (Large touch hitboxes) */}
                {/* NW (Top-Left) */}
                <div
                  onMouseDown={(e) => handleStartDrag('nw', e)}
                  onTouchStart={(e) => handleStartDrag('nw', e)}
                  className="absolute -top-3 -left-3 w-7 h-7 flex items-center justify-center cursor-nwse-resize touch-none z-20 group"
                >
                  <div className="w-4 h-4 border-t-4 border-l-4 border-amber-400 bg-slate-900/50 shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* NE (Top-Right) */}
                <div
                  onMouseDown={(e) => handleStartDrag('ne', e)}
                  onTouchStart={(e) => handleStartDrag('ne', e)}
                  className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center cursor-nesw-resize touch-none z-20 group"
                >
                  <div className="w-4 h-4 border-t-4 border-r-4 border-amber-400 bg-slate-900/50 shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* SW (Bottom-Left) */}
                <div
                  onMouseDown={(e) => handleStartDrag('sw', e)}
                  onTouchStart={(e) => handleStartDrag('sw', e)}
                  className="absolute -bottom-3 -left-3 w-7 h-7 flex items-center justify-center cursor-nesw-resize touch-none z-20 group"
                >
                  <div className="w-4 h-4 border-b-4 border-l-4 border-amber-400 bg-slate-900/50 shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* SE (Bottom-Right) */}
                <div
                  onMouseDown={(e) => handleStartDrag('se', e)}
                  onTouchStart={(e) => handleStartDrag('se', e)}
                  className="absolute -bottom-3 -right-3 w-7 h-7 flex items-center justify-center cursor-nwse-resize touch-none z-20 group"
                >
                  <div className="w-4 h-4 border-b-4 border-r-4 border-amber-400 bg-slate-900/50 shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* Side Edge Handles (Active in Free Size Mode or Proportional Resizing) */}
                {/* Top Side (N) */}
                <div
                  onMouseDown={(e) => handleStartDrag('n', e)}
                  onTouchStart={(e) => handleStartDrag('n', e)}
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-ns-resize touch-none z-20 group"
                >
                  <div className="w-8 h-1.5 bg-amber-400 rounded-full shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* Bottom Side (S) */}
                <div
                  onMouseDown={(e) => handleStartDrag('s', e)}
                  onTouchStart={(e) => handleStartDrag('s', e)}
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-ns-resize touch-none z-20 group"
                >
                  <div className="w-8 h-1.5 bg-amber-400 rounded-full shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* Left Side (W) */}
                <div
                  onMouseDown={(e) => handleStartDrag('w', e)}
                  onTouchStart={(e) => handleStartDrag('w', e)}
                  className="absolute top-1/2 -translate-y-1/2 -left-2.5 h-12 w-5 flex items-center justify-center cursor-ew-resize touch-none z-20 group"
                >
                  <div className="h-8 w-1.5 bg-amber-400 rounded-full shadow-md group-hover:scale-125 transition-transform" />
                </div>

                {/* Right Side (E) */}
                <div
                  onMouseDown={(e) => handleStartDrag('e', e)}
                  onTouchStart={(e) => handleStartDrag('e', e)}
                  className="absolute top-1/2 -translate-y-1/2 -right-2.5 h-12 w-5 flex items-center justify-center cursor-ew-resize touch-none z-20 group"
                >
                  <div className="h-8 w-1.5 bg-amber-400 rounded-full shadow-md group-hover:scale-125 transition-transform" />
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Toolbar & Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
          
          {/* Preset Buttons */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-indigo-500" />
              Crop Ratio Mode:
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[
                { label: 'Free Size (Paper)', value: undefined },
                { label: '3:4 Paper', value: 3 / 4 },
                { label: '1:1 Square', value: 1 },
                { label: '4:3 Wide', value: 4 / 3 },
                { label: '16:9 Banner', value: 16 / 9 },
              ].map((preset) => {
                const isSelected = aspect === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setAspect(preset.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls & Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            {/* Rotate buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRotation(r => (r - 90 + 360) % 360)}
                className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Rotate Left 90°"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Left</span>
              </button>
              <button
                type="button"
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Rotate Right 90°"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">Right</span>
              </button>
            </div>

            {/* Submit / Cancel */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={isProcessing}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Crop</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
