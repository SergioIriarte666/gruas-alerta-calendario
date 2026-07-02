import { CraneType } from '@/types';

export const CRANE_TYPE_LABELS: Record<CraneType, string> = {
  light: 'Liviana',
  medium: 'Mediana',
  heavy: 'Pesada',
  taxi: 'Taxi',
  other: 'Otros',
  horquilla: 'Horquilla',
  remolque: 'Remolque',
};

export const CRANE_TYPE_OPTIONS: Array<{ value: CraneType; label: string }> = [
  { value: 'light', label: CRANE_TYPE_LABELS.light },
  { value: 'medium', label: CRANE_TYPE_LABELS.medium },
  { value: 'heavy', label: CRANE_TYPE_LABELS.heavy },
  { value: 'taxi', label: CRANE_TYPE_LABELS.taxi },
  { value: 'horquilla', label: CRANE_TYPE_LABELS.horquilla },
  { value: 'remolque', label: CRANE_TYPE_LABELS.remolque },
  { value: 'other', label: CRANE_TYPE_LABELS.other },
];

export const getCraneTypeLabel = (type?: string | null) => {
  if (!type) return 'Sin tipo';

  return CRANE_TYPE_LABELS[type as CraneType] ?? type;
};
