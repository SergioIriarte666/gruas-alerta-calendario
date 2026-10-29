/**
 * Finanzas de un viaje multi-vehículo (Grupaje Lowboy) para el detalle y el
 * PDF. Única fuente del prorrateo: la vista trip_cost_allocations, leída por
 * useServiceCostTotals / useTripChildren. Aquí solo se combinan números.
 *
 * - Padre: vale 0 en BD a propósito; su "valor" es la suma de los hijos y su
 *   utilidad es ese total menos los costos cargados al viaje.
 * - Hijo: sus costos son los directos más la parte prorrateada del viaje.
 */
import type { TripChildService } from '@/hooks/services/useTripServices';
import type { TripChildInfo } from '@/hooks/services/useServiceCostTotals';

export interface TripVehicleFinance {
  id: string;
  folio: string;
  licensePlate: string;
  clientName: string;
  value: number;
  /** Peso del prorrateo (0..1). */
  weight: number;
  /** Parte de los costos del viaje que absorbe este vehículo. */
  allocatedAmount: number;
  /** Costos cargados directamente al servicio hijo. */
  directCosts: number;
  totalCosts: number;
  profit: number;
}

export interface TripParentFinance {
  kind: 'parent';
  tripValue: number;
  vehicleCount: number;
  /** Costos del viaje (cargados al padre), incluidas comisiones. */
  tripCosts: number;
  profit: number;
  vehicles: TripVehicleFinance[];
}

export interface TripChildFinance {
  kind: 'child';
  parentFolio: string;
  value: number;
  directCosts: number;
  allocatedAmount: number;
  totalCosts: number;
  profit: number;
}

export type TripFinance = TripParentFinance | TripChildFinance;

/**
 * @param children     hijos del viaje (useTripChildren)
 * @param totalsByChild costos por hijo según useServiceCostTotals.totals
 *                      (ya incluyen el prorrateo: directos + asignados)
 * @param tripCosts    costos del viaje cargados al padre
 */
export const buildTripParentFinance = (
  children: TripChildService[],
  totalsByChild: Record<string, number>,
  tripCosts: number,
): TripParentFinance => {
  const vehicles: TripVehicleFinance[] = children.map((child) => {
    const totalCosts = totalsByChild[child.id] ?? child.allocatedAmount;
    const directCosts = Math.max(0, totalCosts - child.allocatedAmount);
    return {
      id: child.id,
      folio: child.folio,
      licensePlate: child.licensePlate,
      clientName: child.clientName,
      value: child.value,
      weight: child.weight,
      allocatedAmount: child.allocatedAmount,
      directCosts,
      totalCosts,
      profit: child.value - totalCosts,
    };
  });
  const tripValue = vehicles.reduce((sum, vehicle) => sum + vehicle.value, 0);
  return {
    kind: 'parent',
    tripValue,
    vehicleCount: vehicles.length,
    tripCosts,
    profit: tripValue - tripCosts,
    vehicles,
  };
};

/**
 * @param value       valor propio del hijo
 * @param directCosts costos cargados directamente al hijo (sin prorrateo)
 * @param info        fila del hijo en trip_cost_allocations; undefined
 *                    mientras carga → prorrateo 0 sin romper el render
 */
export const buildTripChildFinance = (
  value: number,
  directCosts: number,
  info: TripChildInfo | undefined,
): TripChildFinance => {
  const allocatedAmount = info?.allocatedAmount ?? 0;
  const totalCosts = directCosts + allocatedAmount;
  return {
    kind: 'child',
    parentFolio: info?.parentFolio ?? '',
    value,
    directCosts,
    allocatedAmount,
    totalCosts,
    profit: value - totalCosts,
  };
};

export const formatTripWeight = (weight: number): string =>
  `${(weight * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
