export type ServiceCategory = 'in_situ' | 'traslado' | 'externo_tercero' | 'excedente';

export const SERVICE_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ServiceCategory;
  label: string;
  description: string;
}> = [
  { value: 'in_situ', label: 'In Situ', description: 'Una sola fase, sin recogida ni entrega' },
  { value: 'traslado', label: 'Traslado', description: 'Dos fases: inspección inicial + entrega' },
  { value: 'externo_tercero', label: 'Externo / Tercero', description: 'Subcontratado, cierre manual por admin' },
  { value: 'excedente', label: 'Excedente', description: 'Sin inspección requerida' },
];

export const getServiceCategoryLabel = (value?: string | null): string => {
  return SERVICE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? 'Sin clasificar';
};

export const getServiceCategoryBadgeClasses = (value?: string | null): string => {
  switch (value) {
    case 'in_situ':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-blue-300 dark:border-blue-700';
    case 'traslado':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300 dark:border-amber-700';
    case 'externo_tercero':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border-purple-300 dark:border-purple-700';
    case 'excedente':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};
