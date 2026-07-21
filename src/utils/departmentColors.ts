import { Client } from '@/types';

export const DEPARTMENT_COLORS = [
  { bg: 'bg-primary-soft', text: 'text-primary', border: 'border-primary/30' },
  { bg: 'bg-info-soft', text: 'text-info', border: 'border-info/30' },
  { bg: 'bg-success-soft', text: 'text-success', border: 'border-success/30' },
  { bg: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/30' },
  { bg: 'bg-danger-soft', text: 'text-danger', border: 'border-danger/30' },
  { bg: 'bg-secondary', text: 'text-secondary-foreground', border: 'border-border' },
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
