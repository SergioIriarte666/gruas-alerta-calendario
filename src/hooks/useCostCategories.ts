import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CostCategory } from '@/types/costs';

const COST_CATEGORIES_SELECT = 'id, name, description, default_cost_center_id, created_at';

const fetchCostCategories = async (): Promise<CostCategory[]> => {
  const { data, error } = await supabase
    .from('cost_categories')
    .select(COST_CATEGORIES_SELECT)
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
