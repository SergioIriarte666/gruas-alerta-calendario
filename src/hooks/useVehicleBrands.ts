import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useVehicleBrands");
type VehicleBrand = Tables<'vehicle_brands'>;
type VehicleBrandInsert = TablesInsert<'vehicle_brands'>;
type VehicleBrandUpdate = TablesUpdate<'vehicle_brands'>;

const QUERY_KEY = ['vehicle-brands'];

const VEHICLE_BRANDS_SELECT = `
  id,
  name,
  is_active,
  created_at,
  updated_at,
  created_by
`;

export const useVehicleBrands = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brands = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_brands')
        .select(VEHICLE_BRANDS_SELECT)
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
        .select(VEHICLE_BRANDS_SELECT)
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
      logger.error('Error creating brand:', error);
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
        .select(VEHICLE_BRANDS_SELECT)
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
      logger.error('Error updating brand:', error);
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
      logger.error('Error deleting brand:', error);
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
