import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { normalizeCatalogName } from '@/utils/vehicleCatalogMatch';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useVehicleModels");

/** Neutraliza los comodines de LIKE para que el filtro sea sólo un acotador. */
const likeEscape = (value: string): string => value.replace(/[\\%_]/g, m => `\\${m}`);
type VehicleModel = Tables<'vehicle_models'> & {
  vehicle_brands?: { name: string };
};
type VehicleModelInsert = TablesInsert<'vehicle_models'>;
type VehicleModelUpdate = TablesUpdate<'vehicle_models'>;

const QUERY_KEY = ['vehicle-models'];

export const useVehicleModels = (brandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: models = [], isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, brandId],
    queryFn: async () => {
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
    },
  });

  const createMutation = useMutation({
    mutationFn: async (model: VehicleModelInsert) => {
      // Mismo criterio que en marcas: el catálogo no puede acumular gemelos
      // que sólo difieran en espacios o casing.
      const name = (model.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name) throw new Error('El nombre del modelo es requerido');

      // El ilike sólo acota; la igualdad real la decide normalizeCatalogName.
      const { data: existing, error: lookupError } = await supabase
        .from('vehicle_models')
        .select('*')
        .eq('brand_id', model.brand_id)
        .ilike('name', `%${likeEscape(name)}%`);

      if (lookupError) throw lookupError;

      const duplicate = (existing as VehicleModel[] | null)?.find(
        m => normalizeCatalogName(m.name ?? '') === normalizeCatalogName(name)
      );
      if (duplicate) {
        if (duplicate.is_active) return duplicate;
        const { data: revived, error: reviveError } = await supabase
          .from('vehicle_models')
          .update({ is_active: true })
          .eq('id', duplicate.id)
          .select()
          .single();
        if (reviveError) throw reviveError;
        return revived;
      }

      const { data, error } = await supabase
        .from('vehicle_models')
        .insert({ ...model, name })
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
      logger.error('Error creating model:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo crear el modelo de vehículo.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & VehicleModelUpdate) => {
      const payload: VehicleModelUpdate = data.name != null
        ? { ...data, name: data.name.trim().replace(/\s+/g, ' ') }
        : data;

      const { data: result, error } = await supabase
        .from('vehicle_models')
        .update(payload)
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
      logger.error('Error updating model:', error);
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
      logger.error('Error deleting model:', error);
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
    createModelAsync: createMutation.mutateAsync,
    updateModel: updateMutation.mutate,
    deleteModel: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};