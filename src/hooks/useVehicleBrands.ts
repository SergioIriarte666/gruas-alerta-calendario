import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type VehicleBrand = Tables<'vehicle_brands'>;
type VehicleBrandInsert = TablesInsert<'vehicle_brands'>;
type VehicleBrandUpdate = TablesUpdate<'vehicle_brands'>;

const QUERY_KEY = ['vehicle-brands'];

export const useVehicleBrands = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brands = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_brands')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as VehicleBrand[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (brand: VehicleBrandInsert) => {
      const { data, error } = await supabase
        .from('vehicle_brands')
        .insert(brand)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        type: "success",
        title: "Marca creada",
        description: "La marca de vehículo ha sido creada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating brand:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo crear la marca de vehículo.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & VehicleBrandUpdate) => {
      const { data: result, error } = await supabase
        .from('vehicle_brands')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        type: "success",
        title: "Marca actualizada",
        description: "La marca de vehículo ha sido actualizada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error updating brand:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo actualizar la marca de vehículo.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicle_brands')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        type: "success",
        title: "Marca eliminada",
        description: "La marca de vehículo ha sido eliminada exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error deleting brand:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo eliminar la marca de vehículo.",
      });
    },
  });

  return {
    brands,
    loading: isLoading,
    error,
    createBrand: createMutation.mutate,
    createBrandAsync: createMutation.mutateAsync,
    updateBrand: updateMutation.mutate,
    deleteBrand: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};