import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ServiceRouteMetrics = Database['public']['Tables']['service_route_metrics']['Row'];

const fetchServiceRouteMetrics = async (serviceId: string): Promise<ServiceRouteMetrics | null> => {
  const { data, error } = await supabase
    .from('service_route_metrics')
    .select('*')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el recorrido del servicio');
  }

  return data;
};

export const useServiceRouteMetrics = (serviceId?: string | null, enabled = true) =>
  useQuery({
    queryKey: ['service-route-metrics', serviceId],
    queryFn: () => fetchServiceRouteMetrics(serviceId as string),
    enabled: Boolean(serviceId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
