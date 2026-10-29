import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('TripServices');

/** Hijo de un viaje multi-vehículo con su prorrateo (vista trip_cost_allocations). */
export interface TripChildService {
  id: string;
  folio: string;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  value: number;
  status: string;
  purchaseOrder: string;
  incidentNumber: string;
  clientId: string;
  clientName: string;
  weight: number;
  allocatedAmount: number;
}

export const tripServicesKeys = {
  all: ['trip-services'] as const,
  children: (parentId: string | null | undefined) => ['trip-services', 'children', parentId ?? ''] as const,
  parent: (parentId: string | null | undefined) => ['trip-services', 'parent', parentId ?? ''] as const,
};

/** Vehículos (hijos) de un viaje, con cliente y prorrateo. Solo lectura. */
export const useTripChildren = (parentId: string | null | undefined) =>
  useQuery<TripChildService[]>({
    queryKey: tripServicesKeys.children(parentId),
    enabled: !!parentId,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: services, error }, { data: allocations, error: allocationsError }] = await Promise.all([
        supabase
          .from('services')
          .select(
            'id, folio, license_plate, vehicle_brand, vehicle_model, value, status, purchase_order, incident_number, client_id, client:clients!services_client_id_fkey(id, name)',
          )
          .eq('trip_parent_id', parentId!)
          .order('folio'),
        supabase
          .from('trip_cost_allocations')
          .select('child_id, weight, allocated_amount')
          .eq('parent_id', parentId!),
      ]);

      if (error) {
        logger.error('Error cargando vehículos del viaje:', error);
        throw error;
      }
      if (allocationsError) {
        logger.error('Error cargando prorrateo del viaje:', allocationsError);
        throw allocationsError;
      }

      const allocationByChild = new Map(
        (allocations ?? []).map((row) => [row.child_id, row] as const),
      );

      return (services ?? []).map((row) => {
        const allocation = allocationByChild.get(row.id);
        const client = Array.isArray(row.client) ? row.client[0] : row.client;
        return {
          id: row.id,
          folio: row.folio,
          licensePlate: row.license_plate ?? '',
          vehicleBrand: row.vehicle_brand ?? '',
          vehicleModel: row.vehicle_model ?? '',
          value: Number(row.value ?? 0),
          status: String(row.status ?? ''),
          purchaseOrder: row.purchase_order ?? '',
          incidentNumber: row.incident_number ?? '',
          clientId: row.client_id,
          clientName: client?.name ?? '',
          weight: Number(allocation?.weight ?? 0),
          allocatedAmount: Number(allocation?.allocated_amount ?? 0),
        };
      });
    },
  });

/** Folio del viaje padre de un hijo (para el banner "Parte del viaje …"). */
export const useTripParent = (parentId: string | null | undefined) =>
  useQuery<{ id: string; folio: string } | null>({
    queryKey: tripServicesKeys.parent(parentId),
    enabled: !!parentId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, folio')
        .eq('id', parentId!)
        .maybeSingle();
      if (error) {
        logger.error('Error cargando viaje padre:', error);
        throw error;
      }
      return data ?? null;
    },
  });
