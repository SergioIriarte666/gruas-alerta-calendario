import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CostCategory } from "@/types/costs";

export interface CostCategoryFormData {
  name: string;
  description?: string;
  default_cost_center_id?: string | null;
}

export const useCostCategoryManager = () => {
  const queryClient = useQueryClient();

  // Query para obtener todas las categorías
  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['cost-categories-management'],
    queryFn: async (): Promise<CostCategory[]> => {
      const { data, error } = await supabase
        .from('cost_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation para crear categoría
  const createCategoryMutation = useMutation({
    mutationFn: async (formData: CostCategoryFormData) => {
      const { data, error } = await supabase
        .from('cost_categories')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['cost-categories'] });
      toast.success('Categoría creada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error creating cost category:', error);
      toast.error('Error al crear la categoría');
    },
  });

  // Mutation para actualizar categoría
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...formData }: CostCategoryFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('cost_categories')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['cost-categories'] });
      toast.success('Categoría actualizada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating cost category:', error);
      toast.error('Error al actualizar la categoría');
    },
  });

  // Mutation para eliminar categoría
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cost_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-categories-management'] });
      queryClient.invalidateQueries({ queryKey: ['cost-categories'] });
      toast.success('Categoría eliminada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error deleting cost category:', error);
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
