import { toTitleCase } from '@/lib/utils';

/**
 * Los departamentos de un mismo RUT son unidades operativas separadas y comparten
 * nombre y RUT: "Salinas y Fabres" son tres filas de `clients` (Autycam, Neumateca,
 * Servicios). Mostrar solo el nombre las vuelve indistinguibles en cualquier lista
 * o selector, así que el departamento forma parte de la identidad visible.
 *
 * 'General' es el valor por defecto de un cliente sin departamentos: no se muestra.
 */
const getClientDepartmentLabel = (department?: string | null): string | null => {
  const label = department?.trim();
  if (!label || label.toLowerCase() === 'general') return null;
  return label;
};

interface ClientNameFields {
  name?: string | null;
  department?: string | null;
}

/** "Salinas y Fabres — Autycam" (o solo el nombre si no hay departamento). */
export const getClientDisplayName = (client?: ClientNameFields | null): string => {
  if (!client) return '';
  const name = toTitleCase(client.name || '');
  const department = getClientDepartmentLabel(client.department);
  return department ? `${name} — ${department}` : name;
};
