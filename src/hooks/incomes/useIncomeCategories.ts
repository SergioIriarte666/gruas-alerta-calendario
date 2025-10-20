import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { IncomeCategory } from '@/types/incomes';

export const useIncomeCategories = () => {
  return useQuery({
    queryKey: ['income-categories'],
    queryFn: async (): Promise<IncomeCategory[]> => {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
};
