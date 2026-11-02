import React from 'react';

export interface WatermarkOverlayProps {
  metadata?: any;
  variant?: 'full' | 'compact' | 'subtle';
  className?: string;
}

/**
 * Watermark overlay disabled as per user instruction.
 */
export default function WatermarkOverlay(_props: WatermarkOverlayProps) {
  return null;
}
