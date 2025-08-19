import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CostCategory } from '@/types/costs';

const fetchCostCategories = async (): Promise<CostCategory[]> => {
  const { data, error } = await supabase
    .from('cost_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

export const useCostCategories = () => {
  return useQuery({
    queryKey: ['cost-categories'],
    queryFn: fetchCostCategories,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};