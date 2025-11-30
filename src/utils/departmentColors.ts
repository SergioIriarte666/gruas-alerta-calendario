import { Client } from '@/types';

export const DEPARTMENT_COLORS = [
  { bg: 'bg-violet-500/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30' },
  { bg: 'bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/30' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30' },
];

/**
 * Get all unique departments for a given RUT
 */
export const getDepartmentsForRut = (clientRut: string, allClients: Client[]): string[] => {
  const departments = allClients
    .filter(c => c.rut === clientRut)
    .map(c => c.department)
    .filter((dept, index, self) => self.indexOf(dept) === index)
    .sort();
  return departments;
};

/**
 * Check if a RUT has multiple departments
 */
export const hasMultipleDepartments = (clientRut: string, allClients: Client[]): boolean => {
  return getDepartmentsForRut(clientRut, allClients).length > 1;
};

/**
 * Get the color for a department based on its position in the sorted list of departments for that RUT
 */
export const getDepartmentColor = (
  department: string,
  clientRut: string,
  allClients: Client[]
): typeof DEPARTMENT_COLORS[0] | null => {
  if (!hasMultipleDepartments(clientRut, allClients)) {
    return null;
  }

  const departments = getDepartmentsForRut(clientRut, allClients);
  const index = departments.indexOf(department);
  
  if (index === -1) return null;
  
  return DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length];
};
