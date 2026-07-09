import { Semester } from '../types';

export function compareSemesterNames(a: string, b: string): number {
  // Extract 4-digit year (e.g. 2024, 2025, 2026)
  const yearA = parseInt(a.match(/\b(20\d{2})\b/)?.[1] || '0', 10);
  const yearB = parseInt(b.match(/\b(20\d{2})\b/)?.[1] || '0', 10);

  if (yearA !== yearB) {
    return yearB - yearA; // Higher years first (descending)
  }

  // Same year or no year. Compare seasons/terms.
  // Order: Fall > Summer > Spring
  const getTermWeight = (name: string) => {
    const l = name.toLowerCase();
    if (l.includes('fall')) return 3;
    if (l.includes('summer')) return 2;
    if (l.includes('spring')) return 1;
    
    // For numbered semesters, parse the number
    const numMatch = name.match(/^(\d+)/);
    if (numMatch) {
      return -parseInt(numMatch[1], 10); // e.g. 1st is -1, 2nd is -2, so 1st > 2nd
    }
    return 0;
  };

  const weightA = getTermWeight(a);
  const weightB = getTermWeight(b);

  if (weightA !== weightB) {
    return weightB - weightA; // Higher weight first
  }

  // Fallback to alphabetical ascending
  return a.localeCompare(b);
}

export function sortSemestersDescending(semesters: Semester[]): Semester[] {
  return [...semesters].sort((a, b) => compareSemesterNames(a.name, b.name));
}

export function sortSemesterNamesDescending(names: string[]): string[] {
  return [...names].sort((a, b) => compareSemesterNames(a, b));
}
