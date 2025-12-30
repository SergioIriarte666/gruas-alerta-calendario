import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineFetch } from '@/services/offlineOperations';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type VehicleBrand = Tables<'vehicle_brands'>;
type VehicleBrandInsert = TablesInsert<'vehicle_brands'>;
type VehicleBrandUpdate = TablesUpdate<'vehicle_brands'>;

// Tipo para cache transformado
interface CachedVehicleBrand {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

const QUERY_KEY = ['vehicle-brands'];

// Fetch online desde Supabase
const fetchBrandsFromDb = async (): Promise<VehicleBrand[]> => {
  const { data, error } = await supabase
    .from('vehicle_brands')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data as VehicleBrand[];
};

// Transformar de cache (camelCase) a formato esperado por componentes
const transformFromCache = (item: any): VehicleBrand => {
  // Si ya tiene formato DB (is_active), devolver directo
  if ('is_active' in item) {
    return item as VehicleBrand;
  }
  // Si viene del cache transformado (isActive), convertir a formato DB
  return {
    id: item.id,
    name: item.name,
    is_active: item.isActive ?? true,
    created_at: item.createdAt || item.created_at
  } as VehicleBrand;
};

export const useVehicleBrands = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveIsOnline } = useOfflineMode();

  const { data: brands = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<VehicleBrand>(
        'vehicle_brands',
        effectiveIsOnline,
        fetchBrandsFromDb,
        (rawData) => rawData.map(transformFromCache)
      );

      if (isFromCache && data.length > 0) {
        console.log(`📴 [OFFLINE] ${data.length} marcas de vehículo cargadas desde cache`);
      }

      return data;
    },
    retry: effectiveIsOnline ? 2 : 0,
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
    updateBrand: updateMutation.mutate,
    deleteBrand: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
