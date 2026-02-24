import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TollStation, TollRate, RouteToll } from '@/types/transport';

export const useTollStations = () => {
  return useQuery({
    queryKey: ['toll-stations'],
    queryFn: async (): Promise<TollStation[]> => {
      const { data, error } = await supabase.from('toll_stations').select('*').order('name');
      if (error) throw error;
      return (data || []) as unknown as TollStation[];
    },
  });
};

export const useCreateTollStation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (station: Omit<TollStation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('toll_stations').insert(station as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toll-stations'] }),
  });
};

export const useUpdateTollStation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TollStation> & { id: string }) => {
      const { data, error } = await supabase.from('toll_stations').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toll-stations'] }),
  });
};

export const useDeleteTollStation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('toll_stations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toll-stations'] }),
  });
};

// Toll Rates
export const useTollRates = (stationId?: string) => {
  return useQuery({
    queryKey: ['toll-rates', stationId],
    queryFn: async (): Promise<TollRate[]> => {
      let query = supabase.from('toll_rates').select('*').order('vehicle_category');
      if (stationId) query = query.eq('toll_station_id', stationId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as TollRate[];
    },
    enabled: !!stationId || stationId === undefined,
  });
};

export const useCreateTollRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rate: Omit<TollRate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('toll_rates').insert(rate as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toll-rates'] }),
  });
};

export const useUpdateTollRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TollRate> & { id: string }) => {
      const { data, error } = await supabase.from('toll_rates').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toll-rates'] }),
  });
};

export const useDeleteTollRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('toll_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['toll-rates'] }),
  });
};

// Route Tolls
export const useRouteTolls = (routeId?: string) => {
  return useQuery({
    queryKey: ['route-tolls', routeId],
    queryFn: async (): Promise<RouteToll[]> => {
      const { data, error } = await supabase
        .from('route_tolls')
        .select('*, toll_stations(*)')
        .eq('route_id', routeId!)
        .order('sequence_order');
      if (error) throw error;
      return (data || []) as unknown as RouteToll[];
    },
    enabled: !!routeId,
  });
};
