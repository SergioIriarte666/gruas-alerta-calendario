import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FuelPrice } from '@/types/transport';

export const useFuelPrices = () => {
  return useQuery({
    queryKey: ['fuel-prices'],
    queryFn: async (): Promise<FuelPrice[]> => {
      const { data, error } = await supabase
        .from('fuel_prices')
        .select('*')
        .order('price_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FuelPrice[];
    },
  });
};

export const useCurrentFuelPrice = () => {
  return useQuery({
    queryKey: ['fuel-price-current'],
    queryFn: async (): Promise<FuelPrice | null> => {
      const { data, error } = await supabase
        .from('fuel_prices')
        .select('*')
        .eq('is_current', true)
        .eq('fuel_type', 'diesel')
        .order('price_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FuelPrice | null;
    },
  });
};

export const useCreateFuelPrice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (price: { price_per_liter: number; fuel_type?: string; region?: string }) => {
      // Set all existing current prices to not current
      await supabase
        .from('fuel_prices')
        .update({ is_current: false } as any)
        .eq('fuel_type', price.fuel_type || 'diesel')
        .eq('is_current', true);

      const { data, error } = await supabase
        .from('fuel_prices')
        .insert({
          fuel_type: price.fuel_type || 'diesel',
          price_per_liter: price.price_per_liter,
          region: price.region || 'Nacional',
          source: 'manual',
          is_current: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-prices'] });
      qc.invalidateQueries({ queryKey: ['fuel-price-current'] });
    },
  });
};
