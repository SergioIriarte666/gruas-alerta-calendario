import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IncomeCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  created_at: string;
}

export interface IncomeCategoryFormData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
}

export const useIncomeCategoryManager = () => {
  const queryClient = useQueryClient();

  // Query para obtener todas las categorías
  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['income-categories-management'],
    queryFn: async (): Promise<IncomeCategory[]> => {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation para crear categoría
  const createCategoryMutation = useMutation({
    mutationFn: async (formData: IncomeCategoryFormData) => {
      const { data, error } = await supabase
        .from('income_categories')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['income-categories'] });
      toast.success('Categoría creada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error creating income category:', error);
      toast.error('Error al crear la categoría');
    },
  });

  // Mutation para actualizar categoría
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...formData }: IncomeCategoryFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('income_categories')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['income-categories'] });
      toast.success('Categoría actualizada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating income category:', error);
      toast.error('Error al actualizar la categoría');
    },
  });

  // Mutation para eliminar categoría
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('income_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['income-categories'] });
      toast.success('Categoría eliminada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error deleting income category:', error);
      toast.error('Error al eliminar la categoría');
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
};
