import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Route } from '@/types/transport';

export const useRoutes = () => {
  return useQuery({
    queryKey: ['transport-routes'],
    queryFn: async (): Promise<Route[]> => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as Route[];
    },
  });
};

export const useCreateRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (route: Omit<Route, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase.from('routes').insert(route as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-routes'] }),
  });
};

export const useUpdateRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Route> & { id: string }) => {
      const { data, error } = await supabase.from('routes').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-routes'] }),
  });
};

export const useDeleteRoute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-routes'] }),
  });
};
