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
      return 'border-info/30 bg-info-soft text-info-text';
    case 'traslado':
      return 'border-warning/30 bg-warning-soft text-warning-text';
    case 'externo_tercero':
      return 'border-primary/30 bg-primary-soft text-primary';
    case 'excedente':
      return 'border-border bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};
