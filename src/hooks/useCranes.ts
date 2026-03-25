import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crane } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const formattedCranes: Crane[] = data.map((crane: any) => ({
    id: crane.id,
    licensePlate: crane.license_plate,
    brand: crane.brand,
    model: crane.model,
    type: crane.type as Crane['type'],
    tollVehicleCategory: crane.toll_vehicle_category || '2',
    ownerCompanyRut: crane.owner_company_rut ?? undefined,
    ownerCompanyName: crane.owner_company_name ?? undefined,
    circulationPermitExpiry: crane.circulation_permit_expiry,
    insuranceExpiry: crane.insurance_expiry,
    technicalReviewExpiry: crane.technical_review_expiry,
    isActive: crane.is_active ?? false,
    createdAt: crane.created_at,
    updatedAt: crane.updated_at,
    createdBy: crane.created_by,
    creatorName: crane.creator?.full_name || crane.creator?.email || undefined
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
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('cranes')
        .insert({
          license_plate: craneData.licensePlate,
          brand: craneData.brand,
          model: craneData.model,
          type: craneData.type,
          toll_vehicle_category: craneData.tollVehicleCategory || '2',
          owner_company_rut: craneData.ownerCompanyRut || null,
          owner_company_name: craneData.ownerCompanyName || null,
          circulation_permit_expiry: craneData.circulationPermitExpiry,
          insurance_expiry: craneData.insuranceExpiry,
          technical_review_expiry: craneData.technicalReviewExpiry,
          is_active: craneData.isActive,
          created_by: user?.id || null
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
        tollVehicleCategory: data.toll_vehicle_category || '2',
        ownerCompanyRut: data.owner_company_rut ?? undefined,
        ownerCompanyName: data.owner_company_name ?? undefined,
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
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success("Grúa creada", {
        description: `Grúa ${newCrane.licensePlate} creada exitosamente.`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating crane:', error);
      
      // Check for duplicate errors
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
      console.log('🔧 INICIANDO ACTUALIZACIÓN DE GRÚA');
      console.log('ID de grúa:', id);
      console.log('Datos a actualizar:', craneData);
      
      // Verificar autenticación
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ Error de autenticación:', authError);
        throw new Error('Usuario no autenticado');
      }
      console.log('✅ Usuario autenticado:', user.id);

      // Verificar que la grúa existe antes de actualizar
      const { data: existingCrane, error: fetchError } = await supabase
        .from('cranes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ Error al buscar grúa existente:', fetchError);
        throw fetchError;
      }

      if (!existingCrane) {
        console.error('❌ Grúa no encontrada con ID:', id);
        throw new Error('Grúa no encontrada');
      }

      console.log('✅ Grúa existente encontrada:', existingCrane);

      const updateData: any = {};
      if (craneData.licensePlate !== undefined) updateData.license_plate = craneData.licensePlate;
      if (craneData.brand !== undefined) updateData.brand = craneData.brand;
      if (craneData.model !== undefined) updateData.model = craneData.model;
      if (craneData.type !== undefined) updateData.type = craneData.type;
      if (craneData.ownerCompanyRut !== undefined) updateData.owner_company_rut = craneData.ownerCompanyRut || null;
      if (craneData.ownerCompanyName !== undefined) updateData.owner_company_name = craneData.ownerCompanyName || null;
      if (craneData.circulationPermitExpiry !== undefined) updateData.circulation_permit_expiry = craneData.circulationPermitExpiry;
      if (craneData.insuranceExpiry !== undefined) updateData.insurance_expiry = craneData.insuranceExpiry;
      if (craneData.technicalReviewExpiry !== undefined) updateData.technical_review_expiry = craneData.technicalReviewExpiry;
      if (craneData.isActive !== undefined) updateData.is_active = craneData.isActive;
      if (craneData.tollVehicleCategory !== undefined) updateData.toll_vehicle_category = craneData.tollVehicleCategory;

      console.log('📝 Datos de actualización preparados:', updateData);

      // Realizar la actualización
      const { data: updatedData, error: updateError } = await supabase
        .from('cranes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error en la actualización:', updateError);
        console.error('Código de error:', updateError.code);
        console.error('Mensaje:', updateError.message);
        console.error('Detalles:', updateError.details);
        throw updateError;
      }

      if (!updatedData) {
        console.error('❌ No se recibieron datos actualizados');
        throw new Error('No se recibieron datos actualizados');
      }

      console.log('✅ Actualización exitosa. Datos recibidos:', updatedData);

      // Verificar que la actualización se aplicó correctamente
      const { data: verificationData, error: verifyError } = await supabase
        .from('cranes')
        .select('*')
        .eq('id', id)
        .single();

      if (verifyError) {
        console.error('❌ Error al verificar actualización:', verifyError);
      } else {
        console.log('🔍 Verificación post-actualización:', verificationData);
      }

      return updatedData;
    },
    onSuccess: (updatedData) => {
      console.log('🎉 Actualización completada exitosamente');
      console.log('Datos actualizados:', updatedData);
      
      // Invalidar y refrescar caches
      console.log('🔄 Invalidando caches...');
      queryClient.invalidateQueries({ queryKey: ['cranes'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      
      // Forzar refetch inmediato
      console.log('🔄 Forzando refetch de servicios...');
      queryClient.refetchQueries({ queryKey: ['services'] });
      
      toast.success("Grúa actualizada", {
        description: "La grúa ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error('💥 Error en updateCraneMutation:', error);
      console.error('Tipo de error:', typeof error);
      console.error('Error completo:', JSON.stringify(error, null, 2));
      
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
      const { error } = await supabase.from('cranes').delete().eq('id', id);
      if (error) throw error;
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

      const { data, error } = await supabase
        .from('cranes')
        .update({ is_active: !crane.isActive })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
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
