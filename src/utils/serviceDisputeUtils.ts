import { DisputeType } from '@/types';

export const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  item_faltante_oc: 'Ítem faltante en OC',
  patente_incorrecta: 'Patente incorrecta',
  monto_distinto: 'Monto distinto a cotización',
  documento_faltante: 'Documento faltante',
  otro: 'Otro',
};

export const DISPUTE_TYPE_OPTIONS: { value: DisputeType; label: string }[] = (
  Object.keys(DISPUTE_TYPE_LABELS) as DisputeType[]
).map(value => ({ value, label: DISPUTE_TYPE_LABELS[value] }));
