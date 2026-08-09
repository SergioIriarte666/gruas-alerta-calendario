import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { normalizeCatalogName } from '@/utils/vehicleCatalogMatch';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useVehicleBrands");

/** Neutraliza los comodines de LIKE para que el filtro sea sólo un acotador. */
const likeEscape = (value: string): string => value.replace(/[\\%_]/g, m => `\\${m}`);
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
      // El catálogo es la referencia contra la que se resuelve el historial de
      // servicios: un 'Nissan ' acá genera un duplicado que rompe el matching.
      const name = (brand.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name) throw new Error('El nombre de la marca es requerido');

      // Reusar la fila equivalente en vez de duplicarla (compara sin casing ni
      // espacios). Incluye inactivas: crear una gemela activa deja dos filas.
      // El ilike sólo acota; la igualdad real la decide normalizeCatalogName.
      const { data: existing, error: lookupError } = await supabase
        .from('vehicle_brands')
        .select(VEHICLE_BRANDS_SELECT)
        .ilike('name', `%${likeEscape(name)}%`);

      if (lookupError) throw lookupError;

      const duplicate = (existing as VehicleBrand[] | null)?.find(
        b => normalizeCatalogName(b.name ?? '') === normalizeCatalogName(name)
      );
      if (duplicate) {
        if (duplicate.is_active) return duplicate;
        // Reactivar la existente en lugar de insertar una gemela.
        const { data: revived, error: reviveError } = await supabase
          .from('vehicle_brands')
          .update({ is_active: true })
          .eq('id', duplicate.id)
          .select(VEHICLE_BRANDS_SELECT)
          .single();
        if (reviveError) throw reviveError;
        return revived;
      }

      const { data, error } = await supabase
        .from('vehicle_brands')
        .insert({ ...brand, name })
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
      const payload: VehicleBrandUpdate = data.name != null
        ? { ...data, name: data.name.trim().replace(/\s+/g, ' ') }
        : data;

      const { data: result, error } = await supabase
        .from('vehicle_brands')
        .update(payload)
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
