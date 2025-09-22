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
          origin,
          destination,
          value,
          status,
          client_id,
          operator_id
        `)
        .eq('crane_id', craneId)
        .order('service_date', { ascending: false });

      if (error) {
        console.error('Error fetching crane services:', error);
        throw error;
      }

      // Get unique client and operator IDs
      const clientIds = [...new Set(data?.map(s => s.client_id).filter(Boolean) || [])];
      const operatorIds = [...new Set(data?.map(s => s.operator_id).filter(Boolean) || [])];

      // Fetch clients and operators separately
      const [clientsRes, operatorsRes] = await Promise.all([
        clientIds.length > 0 ? supabase.from('clients').select('id, name, rut').in('id', clientIds) : { data: [] },
        operatorIds.length > 0 ? supabase.from('operators').select('id, name').in('id', operatorIds) : { data: [] }
      ]);

      const clientsMap = new Map<string, any>();
      const operatorsMap = new Map<string, any>();
      
      // Populate clients map
      if (clientsRes.data) {
        for (const client of clientsRes.data) {
          clientsMap.set(client.id, client);
        }
      }
      
      // Populate operators map
      if (operatorsRes.data) {
        for (const operator of operatorsRes.data) {
          operatorsMap.set(operator.id, operator);
        }
      }

      return (data || []).map(service => ({
        id: service.id,
        folio: service.folio,
        serviceDate: service.service_date,
        clientName: clientsMap.get(service.client_id)?.name || 'Cliente no disponible',
        clientRut: clientsMap.get(service.client_id)?.rut || 'RUT no disponible',
        operatorName: operatorsMap.get(service.operator_id)?.name || 'Operador no disponible',
        origin: service.origin,
        destination: service.destination,
        value: service.value,
        status: service.status as CraneService['status']
      }));
    },
    enabled: !!craneId
  });
};