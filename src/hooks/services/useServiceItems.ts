import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { ServiceItem } from '@/types';
import { VENTA_PRODUCTOS_SERVICE_TYPE_ID } from '@/utils/pdf/serviceItemsData';

const logger = createLogger('ServiceItems');

interface SaveServiceItemsParams {
  serviceId: string;
  toUpsert: Omit<ServiceItem, 'created_at' | 'updated_at'>[];
  toDelete: string[];
}

export const persistServiceItems = async ({
  serviceId,
  toUpsert,
  toDelete,
}: SaveServiceItemsParams) => {
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('service_items')
      .delete()
      .in('id', toDelete);
    if (error) throw error;
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('service_items')
      .upsert(toUpsert, { onConflict: 'id' });
    if (error) throw error;
  }

  const { data: serviceMeta, error: serviceMetaError } = await supabase
    .from('services')
    .select('service_type_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (serviceMetaError) {
    throw serviceMetaError;
  }

  if (serviceMeta?.service_type_id === VENTA_PRODUCTOS_SERVICE_TYPE_ID) {
    const subtotal = toUpsert.reduce(
      (sum, item) => sum + Number(item.cantidad || 0) * Number(item.valor_unitario || 0),
      0,
    );

    const { error: updateValueError } = await supabase
      .from('services')
      .update({ value: subtotal })
      .eq('id', serviceId);

    if (updateValueError) throw updateValueError;
  }
};

export function useServiceItems(serviceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['service-items', serviceId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_items')
        .select('*')
        .eq('service_id', serviceId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ServiceItem[];
    },
  });

  const saveItems = useMutation({
    mutationFn: async ({
      serviceId: targetServiceId,
      toUpsert,
      toDelete,
    }: {
      serviceId?: string;
      toUpsert: Omit<ServiceItem, 'created_at' | 'updated_at'>[];
      toDelete: string[];
      silent?: boolean;
    }) => {
      const resolvedServiceId = targetServiceId || serviceId;
      if (!resolvedServiceId) {
        throw new Error('No se recibió serviceId para guardar el desglose');
      }

      await persistServiceItems({
        serviceId: resolvedServiceId,
        toUpsert,
        toDelete,
      });
    },
    onSuccess: (_, variables) => {
      const resolvedServiceId = variables.serviceId || serviceId;
      if (resolvedServiceId) {
        queryClient.invalidateQueries({ queryKey: ['service-items', resolvedServiceId] });
        queryClient.invalidateQueries({ queryKey: ['services', resolvedServiceId] });
        queryClient.invalidateQueries({ queryKey: ['serviceDetails', resolvedServiceId] });
        queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', resolvedServiceId] });
        queryClient.invalidateQueries({ queryKey: ['service-change-history', resolvedServiceId] });
      }
      if (!variables.silent) {
        toast.success('Desglose guardado');
      }
    },
    onError: (err) => {
      logger.error('Error guardando ítems', err);
      toast.error('Error al guardar el desglose');
    },
  });

  return { items, isLoading, saveItems };
}
