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
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced';
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
          origin,
          destination,
          value,
          status,
          clients!inner(name, rut),
          operators!inner(name)
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
        clientName: service.clients.name,
        clientRut: service.clients.rut,
        operatorName: service.operators.name,
        origin: service.origin,
        destination: service.destination,
        value: service.value,
        status: service.status as CraneService['status']
      }));
    },
    enabled: !!craneId
  });
};