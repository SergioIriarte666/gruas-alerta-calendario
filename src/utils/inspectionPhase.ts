import type { Service } from '@/types';

/**
 * Servicio "in-situ": una sola fase de inspección. No hay recogida ni
 * entrega. El servicio se completa en una sola visita y pasa directo a
 * status='completed'.
 *
 * El criterio se basa en la columna service_types.service_category.
 * NO derivar desde requires_detail/requires_photo_set: hay tipos
 * (Lavado, Revisión Técnica) que requieren detalle/fotos pero NO son
 * in-situ; tienen flujo de dos fases.
 */
export const isInSituService = (
  service: Pick<Service, 'serviceType'> | undefined | null,
): boolean => {
  return service?.serviceType?.serviceCategory === 'in_situ';
};
