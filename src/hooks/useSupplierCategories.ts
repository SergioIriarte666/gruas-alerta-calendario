import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupplierCategory } from '@/types/suppliers';

const SUPPLIER_CATEGORIES_SELECT = 'id, name, label, description, is_active, created_at, updated_at, created_by';

const fetchSupplierCategories = async (): Promise<SupplierCategory[]> => {
  const { data, error } = await supabase
    .from('supplier_categories')
    .select(SUPPLIER_CATEGORIES_SELECT)
    .order('label', { ascending: true });

  if (error) {
    return [];
  }

  return (data || []) as SupplierCategory[];
};

export const useSupplierCategories = () => {
  return useQuery({
    queryKey: ['supplier-categories'],
    queryFn: fetchSupplierCategories,
    staleTime: 5 * 60 * 1000,
  });
};
