import { Department } from '../types';

export function sortDepartmentsAlphabetically(departments: Department[]): Department[] {
  return [...departments].sort((a, b) => {
    // Trim and normalize multiple spaces to single spaces for clean comparison
    const nameA = (a.name || '').trim().replace(/\s+/g, ' ');
    const nameB = (b.name || '').trim().replace(/\s+/g, ' ');
    
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'accent', numeric: true });
  });
}
