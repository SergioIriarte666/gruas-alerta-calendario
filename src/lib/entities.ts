/**
 * Separación de entidades legales que conviven en el TMS: Grúas 5 Norte SpA (G5N)
 * financia hoy el 100% de los gastos de LowBoy Chile SpA; esta deuda intercompañía
 * se mide vía costs.entity / costs.paid_by e intercompany_adjustments.
 */
export type EntityKey = 'gruas_5_norte' | 'lowboy';

export const ENTITIES = {
  GRUAS_5_NORTE: { key: 'gruas_5_norte' as const, rut: '76.769.841-0', label: 'Grúas 5 Norte SpA' },
  LOWBOY: { key: 'lowboy' as const, rut: '78.387.656-6', label: 'LowBoy Chile SpA' },
} as const;

/** IDs de cranes del maestro que pertenecen a LowBoy Chile SpA (DSBZ-85, JD-6696, USA-FONTAINE). */
export const LOWBOY_CRANE_IDS = [
  '186d1c6b-d6f3-47be-b159-425b025cbe55',
  '9eac9487-c076-4c5a-ac16-6a5a94c1ae48',
  'd4e4b8df-cadb-4de5-90aa-94004f3aaac1',
] as const;

function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/** Resuelve la entidad dueña de un documento a partir de su RUT receptor/emisor. Retorna null si no coincide con ninguna entidad conocida. */
export function entityByRut(rut: string | null | undefined): EntityKey | null {
  if (!rut) return null;
  const normalized = normalizeRut(rut);
  if (!normalized) return null;
  if (normalized === normalizeRut(ENTITIES.LOWBOY.rut)) return ENTITIES.LOWBOY.key;
  if (normalized === normalizeRut(ENTITIES.GRUAS_5_NORTE.rut)) return ENTITIES.GRUAS_5_NORTE.key;
  return null;
}
