import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { ServiceStop, ServiceStopDraft } from '@/types';

const logger = createLogger('Services');

/**
 * Paradas de servicios multidestino (service_stops). Persistencia por
 * reemplazo completo (delete + insert) dentro del flujo de guardado del
 * formulario, mismo patrón que service_items.
 */
export const persistServiceStops = async (serviceId: string, drafts: ServiceStopDraft[]) => {
  const { error: deleteError } = await supabase
    .from('service_stops')
    .delete()
    .eq('service_id', serviceId);
  if (deleteError) throw deleteError;

  const rows = drafts
    .filter((stop) => stop.label.trim() !== '')
    .map((stop, index) => ({
      service_id: serviceId,
      stop_order: index + 1,
      label: stop.label.trim(),
      address: stop.address.trim() || null,
      lat: stop.lat,
      lng: stop.lng,
      stop_type: stop.stopType,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('service_stops').insert(rows);
    if (insertError) throw insertError;
  }
};

export function useServiceStops(serviceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['service-stops', serviceId];

  const { data: stops = [], isLoading } = useQuery({
    queryKey,
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_stops')
        .select('*')
        .eq('service_id', serviceId!)
        .order('stop_order', { ascending: true });
      if (error) throw error;
      return data as ServiceStop[];
    },
  });

  const saveStops = useMutation({
    mutationFn: async ({
      serviceId: targetServiceId,
      drafts,
    }: {
      serviceId?: string;
      drafts: ServiceStopDraft[];
    }) => {
      const resolvedServiceId = targetServiceId || serviceId;
      if (!resolvedServiceId) {
        throw new Error('No se recibió serviceId para guardar las paradas');
      }
      await persistServiceStops(resolvedServiceId, drafts);
    },
    onSuccess: (_, variables) => {
      const resolvedServiceId = variables.serviceId || serviceId;
      if (resolvedServiceId) {
        queryClient.invalidateQueries({ queryKey: ['service-stops', resolvedServiceId] });
      }
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (err) => {
      logger.error('Error guardando paradas del recorrido', err);
      toast.error('Error al guardar las paradas del recorrido');
    },
  });

  return { stops, isLoading, saveStops };
}
