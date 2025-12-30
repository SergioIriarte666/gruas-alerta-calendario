import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineFetch } from '@/services/offlineOperations';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type VehicleModel = Tables<'vehicle_models'> & {
  vehicle_brands?: { name: string };
};
type VehicleModelInsert = TablesInsert<'vehicle_models'>;
type VehicleModelUpdate = TablesUpdate<'vehicle_models'>;

// Tipo para cache transformado
interface CachedVehicleModel {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean;
  createdAt: string;
}

const QUERY_KEY = ['vehicle-models'];

// Fetch online desde Supabase
const fetchModelsFromDb = async (brandId?: string): Promise<VehicleModel[]> => {
  let query = supabase
    .from('vehicle_models')
    .select(`
      *,
      vehicle_brands!inner(name)
    `)
    .eq('is_active', true)
    .order('name');

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as VehicleModel[];
};

// Transformar de cache (camelCase) a formato esperado por componentes
const transformFromCache = (item: any): VehicleModel => {
  // Si ya tiene formato DB (is_active), devolver directo
  if ('is_active' in item) {
    return item as VehicleModel;
  }
  // Si viene del cache transformado (isActive), convertir a formato DB
  return {
    id: item.id,
    name: item.name,
    brand_id: item.brandId || item.brand_id,
    is_active: item.isActive ?? true,
    created_at: item.createdAt || item.created_at
  } as VehicleModel;
};

export const useVehicleModels = (brandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveIsOnline } = useOfflineMode();

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, brandId],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<VehicleModel>(
        'vehicle_models',
        effectiveIsOnline,
        () => fetchModelsFromDb(brandId),
        (rawData) => {
          // Transformar datos del cache
          let transformed = rawData.map(transformFromCache);
          
          // Si hay brandId, filtrar localmente (para cache offline)
          if (brandId && isFromCache) {
            transformed = transformed.filter(m => 
              m.brand_id === brandId || (m as any).brandId === brandId
            );
          }
          
          return transformed;
        }
      );

      if (isFromCache && data.length > 0) {
        console.log(`📴 [OFFLINE] ${data.length} modelos de vehículo cargados desde cache`);
      }

      return data;
    },
    retry: effectiveIsOnline ? 2 : 0,
  });

  const createMutation = useMutation({
    mutationFn: async (model: VehicleModelInsert) => {
      const { data, error } = await supabase
        .from('vehicle_models')
        .insert(model)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        type: "success",
        title: "Modelo creado",
        description: "El modelo de vehículo ha sido creado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error creating model:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo crear el modelo de vehículo.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & VehicleModelUpdate) => {
      const { data: result, error } = await supabase
        .from('vehicle_models')
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
        title: "Modelo actualizado",
        description: "El modelo de vehículo ha sido actualizado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error updating model:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo actualizar el modelo de vehículo.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicle_models')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        type: "success",
        title: "Modelo eliminado",
        description: "El modelo de vehículo ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error deleting model:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo eliminar el modelo de vehículo.",
      });
    },
  });

  return {
    models,
    loading: isLoading,
    error,
    createModel: createMutation.mutate,
    updateModel: updateMutation.mutate,
    deleteModel: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
