import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useExternalServices');

export type ExternalServiceStatus = 'pending' | 'closed';

export interface ExternalServiceListItem {
  id: string;
  folio: string;
  serviceTypeName: string;
  serviceDate: string;
  clientName: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  licensePlate: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  outsourcedProviderId: string | null;
  outsourcedCost: number | null;
  hasClosure: boolean;
  closedAt: string | null;
  createdAt: string;
}

const SELECT = `
  id,
  folio,
  service_date,
  status,
  origin,
  destination,
  vehicle_brand,
  vehicle_model,
  license_plate,
  outsourced_provider_id,
  outsourced_cost,
  created_at,
  service_types(name, service_category),
  clients!services_client_id_fkey(name)
`;

export const useExternalServices = (filter: ExternalServiceStatus = 'pending') => {
  return useQuery({
    queryKey: ['external-services', filter],
    queryFn: async (): Promise<ExternalServiceListItem[]> => {
      // Obtener IDs de tipos de servicio 'externo_tercero'
      const { data: extTypes, error: typeError } = await supabase
        .from('service_types')
        .select('id')
        .eq('service_category', 'externo_tercero');

      if (typeError) {
        logger.error('Error loading external service types:', typeError);
        throw new Error('Error al cargar tipos de servicios externos');
      }

      const extTypeIds = (extTypes || []).map((t: any) => t.id);
      if (extTypeIds.length === 0) return [];

      const { data, error } = await supabase
        .from('services')
        .select(SELECT)
        .in('service_type_id', extTypeIds)
        .order('service_date', { ascending: false });

      if (error) {
        logger.error('Error loading external services:', error);
        throw new Error('Error al cargar servicios externos');
      }

      const servicesArr = (data || []) as any[];

      // Obtener cierres por separado (el embed con RLS admin-only falla en PostgREST)
      const serviceIds = servicesArr.map((s) => s.id);
      const closuresMap: Record<string, string | null> = {};
      if (serviceIds.length > 0) {
        const { data: closures } = await supabase
          .from('service_external_closures')
          .select('service_id, closed_at')
          .in('service_id', serviceIds);
        for (const c of (closures || [])) {
          closuresMap[c.service_id] = c.closed_at;
        }
      }

      const mapped: ExternalServiceListItem[] = servicesArr.map((s) => ({
        id: s.id,
        folio: s.folio,
        serviceTypeName: s.service_types?.name ?? 'N/A',
        serviceDate: s.service_date,
        clientName: s.clients?.name ?? null,
        vehicleBrand: s.vehicle_brand,
        vehicleModel: s.vehicle_model,
        licensePlate: s.license_plate,
        origin: s.origin,
        destination: s.destination,
        status: s.status,
        outsourcedProviderId: s.outsourced_provider_id,
        outsourcedCost: s.outsourced_cost,
        hasClosure: s.id in closuresMap,
        closedAt: closuresMap[s.id] ?? null,
        createdAt: s.created_at,
      }));

      return filter === 'pending'
        ? mapped.filter((s) => !s.hasClosure && s.status !== 'cancelled')
        : mapped.filter((s) => s.hasClosure);
    },
    staleTime: 60 * 1000,
  });
};
