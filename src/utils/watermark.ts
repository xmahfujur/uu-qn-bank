import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface WatermarkSettings {
  enabled: boolean;
  primaryText: string;
  secondaryText: string;
  opacity: number;
  pattern: 'diagonal_grid' | 'center_crest' | 'corner_subtle';
  includeCourseInfo: boolean;
  includeUploader: boolean;
  stampOnUpload: boolean;
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: false,
  primaryText: 'UU QUESTION BANK',
  secondaryText: 'Official Academic Archive • Verified Question Repository',
  opacity: 0.18,
  pattern: 'diagonal_grid',
  includeCourseInfo: false,
  includeUploader: false,
  stampOnUpload: false
};

const STORAGE_KEY = 'uu_qn_bank_watermark_settings';

/**
 * Retrieve watermark settings synchronously (always disabled per user instruction).
 */
export function getWatermarkSettings(): WatermarkSettings {
  return DEFAULT_WATERMARK_SETTINGS;
}

/**
 * Save watermark settings (no-op).
 */
export async function saveWatermarkSettings(_settings: WatermarkSettings, _syncToFirestore = false): Promise<void> {
  return;
}

/**
 * Load global watermark settings (always disabled).
 */
export async function loadGlobalWatermarkSettings(): Promise<WatermarkSettings> {
  return DEFAULT_WATERMARK_SETTINGS;
}

export interface WatermarkMetadata {
  courseCode?: string;
  courseName?: string;
  examType?: string;
  uploader?: string;
  term?: string;
}

export function applyWatermarkToCanvas(
  _ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  _metadata?: WatermarkMetadata,
  _customSettings?: Partial<WatermarkSettings>
) {
  return;
}

export async function applyWatermarkToBlob(blob: Blob, _metadata?: WatermarkMetadata): Promise<Blob> {
  return blob;
}

