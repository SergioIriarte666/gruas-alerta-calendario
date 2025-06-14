import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost, CostFormData } from '@/types/costs';

const fetchCosts = async (): Promise<Cost[]> => {
  const { data, error } = await supabase
    .from('costs')
    .select(`
      *,
      cost_categories (*),
      cranes (*),
      operators (*),
      services (*)
    `)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching costs:', error);
    throw new Error(error.message);
  }

  return (data as any) || [];
};

export const useCosts = () => {
  return useQuery({
    queryKey: ['costs'],
    queryFn: fetchCosts,
  });
};

const addCost = async (costData: CostFormData) => {
  console.log('[useCosts - addCost] Attempting to add cost with data:', costData);
  const { data, error } = await supabase
    .from('costs')
    .insert([costData])
    .select();

  if (error) {
    console.error('[useCosts - addCost] Supabase error:', error);
    throw new Error(error.message);
  }
  
  console.log('[useCosts - addCost] Successfully added cost. Response:', data);
  return data;
};

export const useAddCost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addCost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
  });
};

const updateCost = async ({ id, ...costData }: { id: string } & Partial<CostFormData>) => {
  console.log(`[useCosts - updateCost] Attempting to update cost ID ${id} with data:`, costData);
  const { data, error } = await supabase
    .from('costs')
    .update(costData)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`[useCosts - updateCost] Supabase error for ID ${id}:`, error);
    throw new Error(error.message);
  }
  
  console.log(`[useCosts - updateCost] Successfully updated cost ID ${id}. Response:`, data);
  return data;
};

export const useUpdateCost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
  });
};

const deleteCost = async (id: string) => {
    const { error } = await supabase.from('costs').delete().eq('id', id);

    if (error) {
        console.error('Error deleting cost:', error);
        throw new Error(error.message);
    }
};

export const useDeleteCost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteCost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['costs'] });
        },
    });
};
