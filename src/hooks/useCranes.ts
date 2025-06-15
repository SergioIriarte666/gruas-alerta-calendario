import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crane } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fetchCranes = async (): Promise<Crane[]> => {
  const { data, error } = await supabase
    .from('cranes')
    .select('*')
    .order('license_plate', { ascending: true });

  if (error) throw error;

  const formattedCranes: Crane[] = data.map(crane => ({
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
    updatedAt: crane.updated_at
  }));

  return formattedCranes;
};

export const useCranes = () => {
  const queryClient = useQueryClient();

  const { data: cranes = [], isLoading: loading, refetch } = useQuery<Crane[]>({
    queryKey: ['cranes'],
    queryFn: fetchCranes,
  });

  const createCraneMutation = useMutation({
    mutationFn: async (craneData: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data, error } = await supabase
        .from('cranes')
        .insert({
          license_plate: craneData.licensePlate,
          brand: craneData.brand,
          model: craneData.model,
          type: craneData.type,
          circulation_permit_expiry: craneData.circulationPermitExpiry,
          insurance_expiry: craneData.insuranceExpiry,
          technical_review_expiry: craneData.technicalReviewExpiry,
          is_active: craneData.isActive
        })
        .select()
        .single();
      if (error) throw error;
      const newCrane: Crane = {
        id: data.id,
        licensePlate: data.license_plate,
        brand: data.brand,
        model: data.model,
        type: data.type as Crane['type'],
        circulationPermitExpiry: data.circulation_permit_expiry,
        insuranceExpiry: data.insurance_expiry,
        technicalReviewExpiry: data.technical_review_expiry,
        isActive: data.is_active || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      return newCrane;
    },
    onSuccess: (newCrane) => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      toast.success("Grúa creada", {
        description: `Grúa ${newCrane.licensePlate} creada exitosamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating crane:', error);
      toast.error("Error", {
        description: "No se pudo crear la grúa.",
      });
    },
  });

  const updateCraneMutation = useMutation({
    mutationFn: async ({ id, craneData }: { id: string, craneData: Partial<Crane> }) => {
      const updateData: any = {};
      if (craneData.licensePlate !== undefined) updateData.license_plate = craneData.licensePlate;
      if (craneData.brand !== undefined) updateData.brand = craneData.brand;
      if (craneData.model !== undefined) updateData.model = craneData.model;
      if (craneData.type !== undefined) updateData.type = craneData.type;
      if (craneData.circulationPermitExpiry !== undefined) updateData.circulation_permit_expiry = craneData.circulationPermitExpiry;
      if (craneData.insuranceExpiry !== undefined) updateData.insurance_expiry = craneData.insuranceExpiry;
      if (craneData.technicalReviewExpiry !== undefined) updateData.technical_review_expiry = craneData.technicalReviewExpiry;
      if (craneData.isActive !== undefined) updateData.is_active = craneData.isActive;

      const { error } = await supabase.from('cranes').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      toast.success("Grúa actualizada", {
        description: "La grúa ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating crane:', error);
      toast.error("Error", {
        description: "No se pudo actualizar la grúa.",
      });
    },
  });

  const deleteCraneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cranes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
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

      const { error } = await supabase
        .from('cranes')
        .update({ is_active: !crane.isActive })
        .eq('id', id);

      if (error) throw error;
      return crane;
    },
    onSuccess: (crane) => {
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      toast.success("Estado actualizado", {
        description: `Grúa ${crane.isActive ? 'desactivada' : 'activada'} exitosamente.`,
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
