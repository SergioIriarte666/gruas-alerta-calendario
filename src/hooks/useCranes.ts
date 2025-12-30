import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crane } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { 
  offlineCreate, 
  offlineUpdate, 
  offlineDelete, 
  offlineFetch 
} from '@/services/offlineOperations';

// Transformaciones DB <-> App
const transformFromDb = (crane: any): Crane => ({
  id: crane.id,
  licensePlate: crane.license_plate,
  brand: crane.brand,
  model: crane.model,
  type: crane.type as Crane['type'],
  circulationPermitExpiry: crane.circulation_permit_expiry,
  insuranceExpiry: crane.insurance_expiry,
  technicalReviewExpiry: crane.technical_review_expiry,
  isActive: crane.is_active ?? false,
  createdAt: crane.created_at,
  updatedAt: crane.updated_at,
  createdBy: crane.created_by,
  creatorName: crane.creator?.full_name || crane.creator?.email || undefined,
  _isOffline: crane._isOffline || false
});

const transformToDb = (crane: Partial<Crane>) => {
  const data: any = {};
  if (crane.licensePlate !== undefined) data.license_plate = crane.licensePlate;
  if (crane.brand !== undefined) data.brand = crane.brand;
  if (crane.model !== undefined) data.model = crane.model;
  if (crane.type !== undefined) data.type = crane.type;
  if (crane.circulationPermitExpiry !== undefined) data.circulation_permit_expiry = crane.circulationPermitExpiry;
  if (crane.insuranceExpiry !== undefined) data.insurance_expiry = crane.insuranceExpiry;
  if (crane.technicalReviewExpiry !== undefined) data.technical_review_expiry = crane.technicalReviewExpiry;
  if (crane.isActive !== undefined) data.is_active = crane.isActive;
  return data;
};

const fetchCranes = async (): Promise<Crane[]> => {
  const { data, error } = await supabase
    .from('cranes')
    .select(`
      *,
      creator:profiles!cranes_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .order('license_plate', { ascending: true });

  if (error) throw error;
  return data.map(transformFromDb);
};

export const useCranes = () => {
  const queryClient = useQueryClient();
  const { effectiveIsOnline } = useOfflineMode();

  const { data: cranes = [], isLoading: loading, refetch } = useQuery<Crane[]>({
    queryKey: ['cranes'],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<Crane>(
        'cranes',
        effectiveIsOnline,
        fetchCranes,
        (rawData) => rawData.map(transformFromDb)
      );
      
      if (isFromCache && data.length > 0) {
        toast.info('Datos desde cache local', { 
          description: `${data.length} grúas cargadas offline`,
          duration: 2000
        });
      }
      
      return data;
    },
    retry: effectiveIsOnline ? 2 : 0,
  });

  const createCraneMutation = useMutation({
    mutationFn: async (craneData: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const dbData = {
        license_plate: craneData.licensePlate,
        brand: craneData.brand,
        model: craneData.model,
        type: craneData.type,
        circulation_permit_expiry: craneData.circulationPermitExpiry,
        insurance_expiry: craneData.insuranceExpiry,
        technical_review_expiry: craneData.technicalReviewExpiry,
        is_active: craneData.isActive,
        created_by: user?.id || null
      };

      const result = await offlineCreate<Crane>(
        'cranes',
        dbData as any,
        effectiveIsOnline,
        undefined,
        transformFromDb
      );

      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (newCrane) => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success("Grúa creada", {
        description: `Grúa ${newCrane.licensePlate} creada exitosamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating crane:', error);
      
      if (error?.code === '23505' || error?.message?.includes('duplicate key value')) {
        if (error?.message?.includes('license_plate')) {
          toast.error("Grúa duplicada", {
            description: `Ya existe una grúa registrada con esta patente.`,
          });
          return;
        }
      }
      
      toast.error("Error", {
        description: "No se pudo crear la grúa.",
      });
    },
  });

  const updateCraneMutation = useMutation({
    mutationFn: async ({ id, craneData }: { id: string, craneData: Partial<Crane> }) => {
      const result = await offlineUpdate<Crane>(
        'cranes',
        id,
        craneData,
        effectiveIsOnline,
        transformToDb,
        transformFromDb
      );

      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.refetchQueries({ queryKey: ['services'] });
      
      toast.success("Grúa actualizada", {
        description: "La grúa ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating crane:', error);
      
      let errorMessage = "No se pudo actualizar la grúa.";
      
      if (error?.message?.includes('no autenticado')) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (error?.code === '23505') {
        errorMessage = "Ya existe una grúa con esa patente.";
      } else if (error?.code === 'PGRST116') {
        errorMessage = "No tienes permisos para actualizar esta grúa.";
      }
      
      toast.error("Error", {
        description: errorMessage,
      });
    },
  });

  const deleteCraneMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await offlineDelete('cranes', id, effectiveIsOnline);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success("Grúa eliminada", {
        description: "La grúa ha sido eliminada exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting crane:', error);
      toast.error("Error", {
        description: "No se pudo eliminar la grúa.",
      });
    },
  });

  const toggleCraneStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const crane = cranes.find(c => c.id === id);
      if (!crane) throw new Error('Crane not found');

      const result = await offlineUpdate<Crane>(
        'cranes',
        id,
        { isActive: !crane.isActive },
        effectiveIsOnline,
        transformToDb,
        transformFromDb
      );

      if (result.error) throw result.error;
      return { ...crane, isActive: !crane.isActive };
    },
    onSuccess: (crane) => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.refetchQueries({ queryKey: ['services'] });
      
      toast.success("Estado actualizado", {
        description: `Grúa ${crane.isActive ? 'activada' : 'desactivada'} exitosamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error toggling crane status:', error);
      toast.error("Error", {
        description: "No se pudo cambiar el estado de la grúa.",
      });
    },
  });

  return {
    cranes,
    loading,
    createCrane: createCraneMutation.mutateAsync,
    updateCrane: (id: string, craneData: Partial<Crane>) => updateCraneMutation.mutateAsync({ id, craneData }),
    deleteCrane: deleteCraneMutation.mutateAsync,
    toggleCraneStatus: toggleCraneStatusMutation.mutateAsync,
    refetch,
  };
};
