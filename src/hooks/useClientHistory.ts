import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceStatus } from '@/types';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useClientHistory");
export interface ClientHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  status: ServiceStatus;
  serviceType: {
    name: string;
  };
  /** Valor ya normalizado por getServiceValueForClosure, igual que useVehicleHistory. */
  value: number;
  origin: string;
  destination: string;
  licensePlate: string;
  // Insumos del cálculo de valor: sin ellos una custodia se reportaba en $0.
  custody_total_amount?: number | null;
  has_excess?: boolean | null;
  client_covered_amount?: number | null;
}

const fetchClientHistory = async (clientId: string): Promise<ClientHistoryEntry[]> => {
  if (!clientId) return [];

  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      status,
      value,
      origin,
      destination,
      license_plate,
      custody_total_amount,
      has_excess,
      client_covered_amount,
      service_types(name)
    `)
    .eq('client_id', clientId)
    .order('service_date', { ascending: false });

  if (error) {
    logger.error('Error fetching client history:', error);
    throw new Error('Could not fetch client history');
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    folio: item.folio,
    serviceDate: item.service_date,
    status: item.status,
    serviceType: item.service_types || { name: 'Desconocido' },
    value: Number(item.value || 0),
    origin: item.origin || '',
    destination: item.destination || '',
    licensePlate: item.license_plate || 'N/A',
    // Insumos de getServiceValueForClosure (se aplica más abajo, como en useVehicleHistory).
    custody_total_amount: item.custody_total_amount,
    has_excess: item.has_excess,
    client_covered_amount: item.client_covered_amount
  }));
};

export const useClientHistory = (clientId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clientHistory', clientId],
    queryFn: () => fetchClientHistory(clientId),
    enabled: !!clientId,
  });

  // Mismo criterio de valor que useVehicleHistory y que los exports: una
  // custodia guarda el monto en custody_total_amount con value = 0, así que
  // leer `value` crudo la mostraba en $0.
  const processedEntries = data
    ? data.map(entry => ({ ...entry, value: getServiceValueForClosure(entry) }))
    : [];

  return { history: processedEntries, isLoading, error };
};
