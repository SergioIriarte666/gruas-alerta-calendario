import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CostSubcategory } from "@/types/costs";

const COST_SUBCATEGORIES_SELECT = `
  id,
  category_id,
  name,
  description,
  is_active,
  display_order,
  requires_crane,
  requires_operator,
  requires_supplier,
  requires_document,
  requires_location,
  requires_other_reason,
  routes_to_inventory,
  other_reasons,
  created_at,
  created_by,
  updated_at
`;

export interface CostSubcategoryFormData {
  category_id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  display_order?: number;
  requires_crane?: boolean;
  requires_operator?: boolean;
  requires_supplier?: boolean;
  requires_document?: boolean;
  requires_location?: boolean;
  requires_other_reason?: boolean;
  routes_to_inventory?: boolean;
  other_reasons?: any;
}

export const useCostSubcategories = (categoryId?: string) => {
  const queryClient = useQueryClient();
  
  // Validate UUID format to prevent Supabase errors
  const isValidUuid = categoryId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId) : false;

  // Query para obtener subcategorías activas por categoría (para el formulario)
  const {
    data: subcategories = [],
    isLoading,
  } = useQuery({
    queryKey: ['cost-subcategories', categoryId],
    queryFn: async (): Promise<CostSubcategory[]> => {
      if (!categoryId || !isValidUuid) return [];
      
      const { data, error } = await supabase
        .from('cost_subcategories')
        .select(COST_SUBCATEGORIES_SELECT)
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId && isValidUuid,
  });

  // Query para obtener TODAS las subcategorías de una categoría (para gestión)
  const {
    data: allSubcategories = [],
    isLoading: isLoadingAll,
  } = useQuery({
    queryKey: ['cost-subcategories-all', categoryId],
    queryFn: async (): Promise<CostSubcategory[]> => {
      if (!categoryId || !isValidUuid) return [];
      
      const { data, error } = await supabase
        .from('cost_subcategories')
        .select(COST_SUBCATEGORIES_SELECT)
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId && isValidUuid,
  });

  // Mutation para crear subcategoría
  const createSubcategoryMutation = useMutation({
    mutationFn: async (formData: CostSubcategoryFormData) => {
      const { data, error } = await supabase
        .from('cost_subcategories')
        .insert([formData])
        .select(COST_SUBCATEGORIES_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories', data.category_id] });
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories-all', data.category_id] });
      toast.success('Subcategoría creada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error creating subcategory:', error);
      toast.error('Error al crear la subcategoría');
    },
  });

  // Mutation para actualizar subcategoría
  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, ...formData }: CostSubcategoryFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('cost_subcategories')
        .update(formData)
        .eq('id', id)
        .select(COST_SUBCATEGORIES_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories', data.category_id] });
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories-all', data.category_id] });
      toast.success('Subcategoría actualizada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating subcategory:', error);
      toast.error('Error al actualizar la subcategoría');
    },
  });

  // Mutation para eliminar subcategoría
  const deleteSubcategoryMutation = useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      const { error } = await supabase
        .from('cost_subcategories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return category_id;
    },
    onSuccess: (category_id) => {
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories', category_id] });
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories-all', category_id] });
      toast.success('Subcategoría eliminada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error deleting subcategory:', error);
      toast.error('Error al eliminar la subcategoría');
    },
  });

  // Mutation para alternar estado activo/inactivo
  const toggleSubcategoryStatusMutation = useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      // Obtener estado actual
      const { data: current, error: fetchError } = await supabase
        .from('cost_subcategories')
        .select('is_active')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Cambiar estado
      const { data, error } = await supabase
        .from('cost_subcategories')
        .update({ is_active: !current.is_active })
        .eq('id', id)
        .select(COST_SUBCATEGORIES_SELECT)
        .single();

      if (error) throw error;
      return { ...data, category_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories', data.category_id] });
      queryClient.invalidateQueries({ queryKey: ['cost-subcategories-all', data.category_id] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      console.error('Error toggling subcategory status:', error);
      toast.error('Error al cambiar el estado');
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
