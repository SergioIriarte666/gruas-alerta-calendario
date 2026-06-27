import type { Service } from '@/types';

/**
 * Servicio "in-situ": no requiere detalle de inventario ni set fotográfico
 * obligatorio. Se trabaja en un solo lugar sin recogida ni entrega.
 * Una sola fase de inspección, pasa directo a 'completed'.
 *
 * Hoy: Apertura de Vehículos, Cambio de Neumáticos, Taxi, Puente de
 * Batería, Carga de Combustible, Apoyo Mecánico, etc.
 */
export const isInSituService = (service: Pick<Service, 'serviceType'> | undefined | null): boolean => {
  if (!service?.serviceType) return false;
  const requiresDetail = service.serviceType.requiresDetail ?? true;
  const requiresPhotoSet = service.serviceType.requiresPhotoSet ?? true;
  return !requiresDetail && !requiresPhotoSet;
};
