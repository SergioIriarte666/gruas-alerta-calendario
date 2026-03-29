import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FuelPrice {
  id: string;
  fuel_type: string;
  price_per_liter: number;
  price_date: string;
  region: string | null;
  source: string | null;
  is_current: boolean;
  currency: string;
  created_at: string;
  updated_by: string | null;
}

const FUEL_PRICES_SELECT = `
  id,
  fuel_type,
  price_per_liter,
  price_date,
  region,
  source,
  is_current,
  currency,
  created_at,
  updated_by
`;

const FUEL_TYPE_LABELS: Record<string, string> = {
  diesel: 'Diesel',
  gasolina_93: 'Gasolina 93',
  gasolina_95: 'Gasolina 95',
};

export const getFuelTypeLabel = (type: string) => FUEL_TYPE_LABELS[type] || type;

export const FUEL_TYPES = Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export const REGIONS = [
  { value: 'Nacional', label: 'Nacional' },
  { value: 'RM', label: 'Región Metropolitana' },
  { value: 'Norte', label: 'Norte' },
  { value: 'Centro', label: 'Centro' },
  { value: 'Sur', label: 'Sur' },
];

export function useCurrentFuelPrices() {
  return useQuery({
    queryKey: ['fuel-prices', 'current'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_prices')
        .select(FUEL_PRICES_SELECT)
        .eq('is_current', true)
        .order('fuel_type');
      if (error) throw error;
      return data as FuelPrice[];
    },
  });
}

export function useFuelPriceHistory(fuelType?: string, region?: string) {
  return useQuery({
    queryKey: ['fuel-prices', 'history', fuelType, region],
    queryFn: async () => {
      let query = supabase
        .from('fuel_prices')
        .select(FUEL_PRICES_SELECT)
        .order('price_date', { ascending: false })
        .order('fuel_type');

      if (fuelType && fuelType !== 'all') {
        query = query.eq('fuel_type', fuelType);
      }
      if (region && region !== 'all') {
        query = query.eq('region', region);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FuelPrice[];
    },
  });
}

export function useAddFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (price: {
      fuel_type: string;
      price_per_liter: number;
      price_date: string;
      region: string;
      source: string;
    }) => {
      // Deactivate current prices for this fuel type
      await supabase
        .from('fuel_prices')
        .update({ is_current: false })
        .eq('fuel_type', price.fuel_type)
        .eq('is_current', true);

      // Insert new current price
      const { data, error } = await supabase
        .from('fuel_prices')
        .insert({
          ...price,
          is_current: true,
          currency: 'CLP',
        })
        .select(FUEL_PRICES_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}

export function useUpdateFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<FuelPrice> & { id: string }) => {
      const { data, error } = await supabase
        .from('fuel_prices')
        .update(updates)
        .eq('id', id)
        .select(FUEL_PRICES_SELECT)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}

export function useDeleteFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fuel_prices')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}
