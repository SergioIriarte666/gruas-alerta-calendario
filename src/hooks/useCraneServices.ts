import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CraneService {
  id: string;
  folio: string;
  serviceDate: string;
  clientName: string;
  clientRut: string;
  operatorName: string;
  origin: string;
  destination: string;
  value: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced' | 'failed';
}

export const useCraneServices = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-services', craneId],
    queryFn: async (): Promise<CraneService[]> => {
      const { data, error } = await supabase
        .from('services')
        .select(`
          id,
          folio,
          service_date,
          start_time,
          end_time,
          crane_mileage,
          origin,
          destination,
          value,
          status,
          client:clients!services_client_id_fkey(id, name, rut),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut),  
          operator:operators(id, name)
        `)
        .eq('crane_id', craneId)
        .order('service_date', { ascending: false });

      if (error) {
        console.error('Error fetching crane services:', error);
        throw error;
      }

      return (data || []).map(service => ({
        id: service.id,
        folio: service.folio,
        serviceDate: service.service_date,
        clientName: (service.client || service.third_party_client)?.name || 'Cliente no disponible',
        clientRut: (service.client || service.third_party_client)?.rut || 'RUT no disponible',
        operatorName: service.operator?.name || 'Operador no disponible',
        origin: service.origin,
        destination: service.destination,
        value: service.value,
        status: service.status as CraneService['status']
      }));
    },
    enabled: !!craneId
  });
};