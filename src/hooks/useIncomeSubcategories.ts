import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IncomeSubcategory } from "@/types/incomes";

export interface IncomeSubcategoryFormData {
  category_id: string;
  name: string;
  description?: string;
  display_order?: number;
}

export const useIncomeSubcategories = (categoryId?: string) => {
  const queryClient = useQueryClient();

  // Query para obtener subcategorías activas (usado en formularios)
  const {
    data: subcategories = [],
    isLoading
  } = useQuery({
    queryKey: ['income-subcategories', categoryId],
    queryFn: async (): Promise<IncomeSubcategory[]> => {
      if (!categoryId) return [];
      
      const { data, error } = await supabase
        .from('income_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
  });

  // Query para obtener todas las subcategorías (usado en gestión)
  const {
    data: allSubcategories = [],
    isLoading: isLoadingAll
  } = useQuery({
    queryKey: ['income-subcategories-all', categoryId],
    queryFn: async (): Promise<IncomeSubcategory[]> => {
      if (!categoryId) return [];
      
      const { data, error } = await supabase
        .from('income_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
  });

  // Mutation para crear subcategoría
  const createSubcategoryMutation = useMutation({
    mutationFn: async (formData: IncomeSubcategoryFormData) => {
      const { data, error } = await supabase
        .from('income_subcategories')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['income-subcategories-all'] });
      toast.success('Subcategoría creada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error creating income subcategory:', error);
      toast.error('Error al crear la subcategoría');
    },
  });

  // Mutation para actualizar subcategoría
  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<IncomeSubcategoryFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from('income_subcategories')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['income-subcategories-all'] });
      toast.success('Subcategoría actualizada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating income subcategory:', error);
      toast.error('Error al actualizar la subcategoría');
    },
  });

  // Mutation para eliminar subcategoría
  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('income_subcategories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['income-subcategories-all'] });
      toast.success('Subcategoría eliminada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error deleting income subcategory:', error);
      toast.error('Error al eliminar la subcategoría');
    },
  });

  // Mutation para cambiar estado activo/inactivo
  const toggleSubcategoryStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('income_subcategories')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['income-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['income-subcategories-all'] });
      toast.success(
        data.is_active 
          ? 'Subcategoría activada exitosamente' 
          : 'Subcategoría desactivada exitosamente'
      );
    },
    onError: (error: any) => {
      console.error('Error toggling income subcategory status:', error);
      toast.error('Error al cambiar el estado de la subcategoría');
    },
  });

  return {
    subcategories,
    allSubcategories,
    isLoading,
    isLoadingAll,
    createSubcategory: createSubcategoryMutation.mutate,
    updateSubcategory: updateSubcategoryMutation.mutate,
    deleteSubcategory: deleteSubcategoryMutation.mutate,
    toggleSubcategoryStatus: toggleSubcategoryStatusMutation.mutate,
    isCreating: createSubcategoryMutation.isPending,
    isUpdating: updateSubcategoryMutation.isPending,
    isDeleting: deleteSubcategoryMutation.isPending,
    isToggling: toggleSubcategoryStatusMutation.isPending,
  };
};
