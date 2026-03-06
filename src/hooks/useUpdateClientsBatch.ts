import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchUpdatePayload {
  ids: string[];
  updates: {
    department?: string;
    is_active?: boolean;
  };
}

export const useUpdateClientsBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: BatchUpdatePayload) => {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['paged-clients'] });
    },
    onError: (error: any) => {
      toast.error('Error al actualizar clientes', { description: error.message });
    },
  });
};

export const useDeleteClientsBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['paged-clients'] });
    },
    onError: (error: any) => {
      toast.error('Error al eliminar clientes', { description: error.message });
    },
  });
};
