import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TripEstimate {
  id: string;
  route_name: string | null;
  origin: string;
  destination: string;
  distance_km: number | null;
  estimated_time_hours: number | null;
  crane_type: string | null;
  vehicle_config: string | null;
  fuel_cost: number | null;
  toll_cost: number | null;
  additional_costs: number | null;
  total_estimate: number | null;
  calculation_details: Record<string, unknown> | null;
  service_id: string | null;
  created_by: string | null;
  created_at: string;
}

const TRIP_ESTIMATES_SELECT = `
  id,
  route_name,
  origin,
  destination,
  distance_km,
  estimated_time_hours,
  crane_type,
  vehicle_config,
  fuel_cost,
  toll_cost,
  additional_costs,
  total_estimate,
  calculation_details,
  service_id,
  created_by,
  created_at
`;

export function useTripEstimates() {
  return useQuery({
    queryKey: ['trip-estimates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_estimates')
        .select(TRIP_ESTIMATES_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TripEstimate[];
    },
  });
}

export function useAddTripEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (estimate: Omit<TripEstimate, 'id' | 'created_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const insertData = { ...estimate, created_by: user?.id } as any;
      const { data, error } = await supabase
        .from('trip_estimates')
        .insert(insertData)
        .select(TRIP_ESTIMATES_SELECT)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-estimates'] });
    },
  });
}

export function useDeleteTripEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('trip_estimates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-estimates'] });
    },
  });
}
