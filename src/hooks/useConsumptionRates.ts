import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useConsumptionRates");

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

const CONSUMPTION_RATES_SELECT = `
  id,
  crane_type,
  fuel_type,
  base_consumption_per_km,
  loaded_consumption_factor,
  towing_consumption_factor,
  toll_vehicle_category,
  is_active,
  created_at,
  updated_at
`;

export function useConsumptionRates() {
  return useQuery({
    queryKey: ['consumption-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crane_consumption_rates')
        .select(CONSUMPTION_RATES_SELECT)
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
        .select(CONSUMPTION_RATES_SELECT)
        .single();
      if (error) {
        logger.error('[useConsumptionRates] Error creando tasa de consumo:', error);
        throw error;
      }
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
        .select(CONSUMPTION_RATES_SELECT)
        .single();
      if (error) {
        logger.error('[useConsumptionRates] Error actualizando tasa de consumo:', error);
        throw error;
      }
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
      if (error) {
        logger.error('[useConsumptionRates] Error desactivando tasa de consumo:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-rates'] });
    },
  });
}
