import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Fila de la vista trip_cost_allocations (prorrateo ponderado por valor). */
export interface TripChildAllocation {
  childId: string;
  childFolio: string;
  childClientId: string;
  childLicensePlate: string | null;
  childStatus: string | null;
  childValue: number;
  weight: number;
  allocatedAmount: number;
}

/** Resumen del viaje visto desde el PADRE. */
export interface TripSummary {
  parentId: string;
  parentFolio: string;
  /** Suma de los valores de los hijos: es el "valor del viaje" (el padre lleva value 0). */
  tripValue: number;
  vehicleCount: number;
  /** Clientes distintos entre los hijos (viaje multicliente cuando > 1). */
  clientCount: number;
  /** Costos directos del padre (los que se prorratean). */
  parentCosts: number;
  children: TripChildAllocation[];
}

/** Lo que un HIJO necesita saber de su viaje. */
export interface TripChildInfo {
  parentId: string;
  parentFolio: string;
  tripValue: number;
  weight: number;
  allocatedAmount: number;
}

export interface ServiceCostTotalsData {
  /** Costos por servicio: hijo = directos + prorrateados; padre = directos. */
  totals: Record<string, number>;
  parents: Record<string, TripSummary>;
  children: Record<string, TripChildInfo>;
}

const PAGE_SIZE = 1000;

/**
 * Costos registrados (incluidas comisiones) por página de servicios, más el
 * prorrateo de los viajes multi-vehículo. El prorrateo vive en SQL
 * (trip_cost_allocations): aquí solo se suma.
 */
export const useServiceCostTotals = (serviceIds: string[]) => {
  const ids = [...new Set(serviceIds)].sort();
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['costs', 'service-totals'] });
    };
    window.addEventListener('global-data-refresh', refresh);
    return () => window.removeEventListener('global-data-refresh', refresh);
  }, [queryClient]);

  return useQuery<ServiceCostTotalsData>({
    queryKey: ['costs', 'service-totals', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const totals: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
      // Paginar también los costos: una página de servicios puede superar
      // el límite de filas de PostgREST. No asumir costos cero ante un error.
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('costs')
          .select('id, service_id, amount')
          .in('service_id', ids)
          .order('id')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        for (const cost of data) {
          if (cost.service_id) totals[cost.service_id] += Number(cost.amount || 0);
        }
        if (data.length < PAGE_SIZE) break;
      }

      // Prorrateo: filas donde el padre o el hijo está en la página visible.
      const idList = ids.join(',');
      const { data: allocations, error: allocationsError } = await supabase
        .from('trip_cost_allocations')
        .select('*')
        .or(`parent_id.in.(${idList}),child_id.in.(${idList})`);
      if (allocationsError) throw allocationsError;

      const parents: Record<string, TripSummary> = {};
      const children: Record<string, TripChildInfo> = {};
      const visible = new Set(ids);

      for (const row of allocations ?? []) {
        if (!row.parent_id || !row.child_id) continue;
        const allocation: TripChildAllocation = {
          childId: row.child_id,
          childFolio: row.child_folio ?? '',
          childClientId: row.child_client_id ?? '',
          childLicensePlate: row.child_license_plate ?? null,
          childStatus: row.child_status ?? null,
          childValue: Number(row.child_value ?? 0),
          weight: Number(row.weight ?? 0),
          allocatedAmount: Number(row.allocated_amount ?? 0),
        };

        if (!parents[row.parent_id]) {
          parents[row.parent_id] = {
            parentId: row.parent_id,
            parentFolio: row.parent_folio ?? '',
            tripValue: Number(row.trip_value ?? 0),
            vehicleCount: Number(row.vehicle_count ?? 0),
            clientCount: Number(row.client_count ?? 0),
            parentCosts: Number(row.parent_costs ?? 0),
            children: [],
          };
        }
        parents[row.parent_id].children.push(allocation);

        children[row.child_id] = {
          parentId: row.parent_id,
          parentFolio: row.parent_folio ?? '',
          tripValue: Number(row.trip_value ?? 0),
          weight: allocation.weight,
          allocatedAmount: allocation.allocatedAmount,
        };

        if (visible.has(row.child_id)) {
          totals[row.child_id] += allocation.allocatedAmount;
        }
      }

      for (const summary of Object.values(parents)) {
        summary.children.sort((a, b) => a.childFolio.localeCompare(b.childFolio));
      }

      return { totals, parents, children };
    },
  });
};
