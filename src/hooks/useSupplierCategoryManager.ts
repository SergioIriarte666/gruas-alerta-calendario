import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupplierCategory } from "@/types/suppliers";

export interface SupplierCategoryFormData {
  name: string;
  label: string;
  description?: string;
  is_active: boolean;
}

export const useSupplierCategoryManager = () => {
  const queryClient = useQueryClient();

  // Query para obtener todas las categorías
  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['supplier-categories'],
    queryFn: async (): Promise<SupplierCategory[]> => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .select('*')
        .order('label', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Query para obtener solo categorías activas
  const {
    data: activeCategories = [],
  } = useQuery({
    queryKey: ['supplier-categories-active'],
    queryFn: async (): Promise<SupplierCategory[]> => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .select('*')
        .eq('is_active', true)
        .order('label', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation para crear categoría
  const createCategoryMutation = useMutation({
    mutationFn: async (formData: SupplierCategoryFormData) => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-active'] });
      toast.success('Categoría creada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error creating supplier category:', error);
      toast.error('Error al crear la categoría');
    },
  });

  // Mutation para actualizar categoría
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...formData }: SupplierCategoryFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-active'] });
      toast.success('Categoría actualizada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating supplier category:', error);
      toast.error('Error al actualizar la categoría');
    },
  });

  // Mutation para eliminar categoría
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-active'] });
      toast.success('Categoría eliminada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error deleting supplier category:', error);
      toast.error('Error al eliminar la categoría');
    },
  });

  // Mutation para cambiar estado activo/inactivo
  const toggleCategoryStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primero obtener el estado actual
      const { data: currentCategory, error: fetchError } = await supabase
        .from('supplier_categories')
        .select('is_active')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Cambiar el estado
      const { data, error } = await supabase
        .from('supplier_categories')
        .update({ is_active: !currentCategory.is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-categories-active'] });
      toast.success('Estado de categoría actualizado');
    },
    onError: (error: any) => {
      console.error('Error toggling supplier category status:', error);
      toast.error('Error al cambiar el estado de la categoría');
    },
  });

  return {
    categories,
    activeCategories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    toggleCategoryStatus: toggleCategoryStatusMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
    isToggling: toggleCategoryStatusMutation.isPending,
  };
};