
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CostCategory } from '@/types/costs';

const fetchCostCategories = async (): Promise<CostCategory[]> => {
  const { data, error } = await supabase
    .from('cost_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching cost categories:', error);
    throw new Error(error.message);
  }

  return data || [];
};

export const useCostCategories = () => {
  return useQuery({
    queryKey: ['cost_categories'],
    queryFn: fetchCostCategories,
  });
};
