import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { ServiceItem } from '@/types';

const logger = createLogger('ServiceItems');

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
      toUpsert,
      toDelete,
    }: {
      toUpsert: Omit<ServiceItem, 'created_at' | 'updated_at'>[];
      toDelete: string[];
    }) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Desglose guardado');
    },
    onError: (err) => {
      logger.error('Error guardando ítems', err);
      toast.error('Error al guardar el desglose');
    },
  });

  return { items, isLoading, saveItems };
}
