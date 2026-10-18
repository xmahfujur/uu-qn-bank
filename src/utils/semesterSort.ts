import { Semester } from '../types';

export function compareSemesterNames(a: string = '', b: string = ''): number {
  const strA = typeof a === 'string' ? a : '';
  const strB = typeof b === 'string' ? b : '';

  // Extract 4-digit year (e.g. 2024, 2025, 2026)
  const yearA = parseInt(strA.match(/\b(20\d{2})\b/)?.[1] || '0', 10);
  const yearB = parseInt(strB.match(/\b(20\d{2})\b/)?.[1] || '0', 10);

  if (yearA !== yearB) {
    return yearB - yearA; // Higher years first (descending)
  }

  // Same year or no year. Compare seasons/terms.
  // Order: Fall > Summer > Spring
  const getTermWeight = (name: string = '') => {
    const l = (name || '').toLowerCase();
    if (l.includes('fall')) return 3;
    if (l.includes('summer')) return 2;
    if (l.includes('spring')) return 1;
    
    // For numbered semesters, parse the number
    const numMatch = name ? name.match(/^(\d+)/) : null;
    if (numMatch) {
      return -parseInt(numMatch[1], 10); // e.g. 1st is -1, 2nd is -2
    }
    return 0;
  };

  const weightA = getTermWeight(strA);
  const weightB = getTermWeight(strB);

  if (weightA !== weightB) {
    return weightB - weightA; // Higher weight first
  }

  // Fallback to alphabetical ascending
  return strA.localeCompare(strB);
}

export function sortSemestersDescending(semesters: Semester[] = []): Semester[] {
  if (!Array.isArray(semesters)) return [];
  return [...semesters].sort((a, b) => compareSemesterNames(a?.name || '', b?.name || ''));
}

export function sortSemesterNamesDescending(names: string[] = []): string[] {
  if (!Array.isArray(names)) return [];
  return [...names].filter(Boolean).sort((a, b) => compareSemesterNames(a || '', b || ''));
}
