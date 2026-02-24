import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CraneConsumptionRate } from '@/types/transport';

export const useCraneConsumptionRates = () => {
  return useQuery({
    queryKey: ['crane-consumption-rates'],
    queryFn: async (): Promise<CraneConsumptionRate[]> => {
      const { data, error } = await supabase
        .from('crane_consumption_rates')
        .select('*')
        .eq('is_active', true)
        .order('crane_type');
      if (error) throw error;
      return (data || []) as unknown as CraneConsumptionRate[];
    },
  });
};

export const useUpdateConsumptionRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CraneConsumptionRate> & { id: string }) => {
      const { data, error } = await supabase
        .from('crane_consumption_rates')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crane-consumption-rates'] }),
  });
};
