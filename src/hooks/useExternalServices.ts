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
  service_types!inner(name, service_category),
  clients(name),
  service_external_closures(id, closed_at)
`;

export const useExternalServices = (filter: ExternalServiceStatus = 'pending') => {
  return useQuery({
    queryKey: ['external-services', filter],
    queryFn: async (): Promise<ExternalServiceListItem[]> => {
      const { data, error } = await supabase
        .from('services')
        .select(SELECT)
        .eq('service_types.service_category', 'externo_tercero')
        .order('service_date', { ascending: false });

      if (error) {
        logger.error('Error loading external services:', error);
        throw new Error('Error al cargar servicios externos');
      }

      const mapped: ExternalServiceListItem[] = (data || []).map((s: any) => ({
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
        hasClosure: Array.isArray(s.service_external_closures) && s.service_external_closures.length > 0,
        closedAt: s.service_external_closures?.[0]?.closed_at ?? null,
        createdAt: s.created_at,
      }));

      return filter === 'pending'
        ? mapped.filter((s) => !s.hasClosure && s.status !== 'cancelled')
        : mapped.filter((s) => s.hasClosure);
    },
    staleTime: 60 * 1000,
  });
};
