import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SupplierCategory } from '@/types/suppliers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useSupplierCategoryManager');

export interface SupplierCategoryFormData {
  name: string;
  label: string;
  description?: string | null;
  is_active?: boolean;
}

export const useSupplierCategoryManager = () => {
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['supplier-categories-management'],
    queryFn: async (): Promise<SupplierCategory[]> => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .select('*')
        .order('label', { ascending: true });

      if (error) throw error;
      return (data || []) as SupplierCategory[];
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (formData: SupplierCategoryFormData) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const payload = {
        name: formData.name,
        label: formData.label,
        description: formData.description ?? null,
        is_active: formData.is_active ?? true,
        created_by: userId ?? null,
      };

      const { data, error } = await supabase
        .from('supplier_categories')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      toast.success('Categoría de proveedor creada');
    },
    onError: (error: any) => {
      logger.error('Error creating supplier category:', error);
      toast.error('Error al crear la categoría de proveedor');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...formData }: SupplierCategoryFormData & { id: string }) => {
      const payload = {
        name: formData.name,
        label: formData.label,
        description: formData.description ?? null,
        is_active: formData.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('supplier_categories')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      toast.success('Categoría de proveedor actualizada');
    },
    onError: (error: any) => {
      logger.error('Error updating supplier category:', error);
      toast.error('Error al actualizar la categoría de proveedor');
    },
  });

  const toggleCategoryStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
    },
    onError: (error: any) => {
      logger.error('Error toggling supplier category:', error);
      toast.error('Error al cambiar el estado de la categoría');
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    toggleCategoryStatus: toggleCategoryStatusMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isToggling: toggleCategoryStatusMutation.isPending,
  };
};
