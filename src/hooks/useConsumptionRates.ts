import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConsumptionRate {
  id: string;
  crane_type: string;
  fuel_type: string;
  base_consumption_per_km: number;
  loaded_consumption_factor: number;
  towing_consumption_factor: number;
  toll_vehicle_category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useConsumptionRates() {
  return useQuery({
    queryKey: ['consumption-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crane_consumption_rates')
        .select('*')
        .eq('is_active', true)
        .order('crane_type');
      if (error) throw error;
      return data as ConsumptionRate[];
    },
  });
}

export function useAddConsumptionRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rate: Omit<ConsumptionRate, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
      const { data, error } = await supabase
        .from('crane_consumption_rates')
        .insert(rate)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rates'] });
    },
  });
}

export function useUpdateConsumptionRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ConsumptionRate> & { id: string }) => {
      const { data, error } = await supabase
        .from('crane_consumption_rates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rates'] });
    },
  });
}

export function useDeleteConsumptionRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crane_consumption_rates')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rates'] });
    },
  });
}
