import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceHandoff');

export interface ServiceHandoff {
  id: string;
  service_id: string;
  outgoing_operator_id: string | null;
  incoming_operator_id: string;
  requested_at: string;
  confirmed_at: string | null;
  photo_paths: string[];
  notes: string | null;
}

/**
 * Traspaso PENDIENTE del servicio hacia el usuario actual.
 *
 * Devuelve algo solo cuando quien mira es el operador ENTRANTE: el saliente ve
 * el registro en el expediente, pero no tiene nada que confirmar. La consulta
 * se apoya en la RLS de service_operator_handoffs y además filtra por el
 * operador del usuario, para que la respuesta no dependa solo de la política.
 */
export const usePendingServiceHandoff = (serviceId?: string | null) => {
  return useQuery({
    queryKey: ['service-handoff', 'pending', serviceId],
    queryFn: async (): Promise<ServiceHandoff | null> => {
      if (!serviceId) return null;

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return null;

      const { data: operator } = await supabase
        .from('operators')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!operator?.id) return null;

      const { data, error } = await supabase
        .from('service_operator_handoffs')
        .select('id, service_id, outgoing_operator_id, incoming_operator_id, requested_at, confirmed_at, photo_paths, notes')
        .eq('service_id', serviceId)
        .eq('incoming_operator_id', operator.id)
        .is('confirmed_at', null)
        .maybeSingle();

      if (error) {
        logger.warn('No se pudo consultar el traspaso pendiente', error);
        throw new Error(error.message);
      }

      return (data as ServiceHandoff) || null;
    },
    enabled: !!serviceId,
    staleTime: 30 * 1000,
  });
};

/**
 * Historial de traspasos del servicio, para el expediente administrativo.
 */
export const useServiceHandoffs = (serviceId?: string | null) => {
  return useQuery({
    queryKey: ['service-handoff', 'history', serviceId],
    queryFn: async (): Promise<ServiceHandoff[]> => {
      if (!serviceId) return [];

      const { data, error } = await supabase
        .from('service_operator_handoffs')
        .select('id, service_id, outgoing_operator_id, incoming_operator_id, requested_at, confirmed_at, photo_paths, notes')
        .eq('service_id', serviceId)
        .order('requested_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data as ServiceHandoff[]) || [];
    },
    enabled: !!serviceId,
    staleTime: 60 * 1000,
  });
};

interface ConfirmHandoffInput {
  serviceId: string;
  /** El folio que la pantalla está mostrando: doble llave contra el id. */
  folio: string;
  photoPaths: string[];
  notes?: string;
}

export const useConfirmServiceHandoff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceId, folio, photoPaths, notes }: ConfirmHandoffInput) => {
      logger.debug('confirm_service_handoff request', { serviceId, folio, photos: photoPaths.length });

      const { data, error } = await supabase.rpc('confirm_service_handoff', {
        p_service_id: serviceId,
        p_folio: folio,
        p_photo_paths: photoPaths,
        p_notes: notes ?? null,
      });

      logger.debug('confirm_service_handoff response', { data, error: error?.message ?? null });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-handoff'] });
      queryClient.invalidateQueries({ queryKey: ['operator-services'] });
      queryClient.invalidateQueries({ queryKey: ['service', variables.serviceId] });
    },
  });
};
