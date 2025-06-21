
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceTypeConfig } from '@/types/serviceTypes';

interface CreateServiceTypeData {
  name: string;
  description?: string;
  base_price?: number;
  vehicle_info_optional?: boolean;
  purchase_order_required?: boolean;
  origin_required?: boolean;
  destination_required?: boolean;
  crane_required?: boolean;
  operator_required?: boolean;
  vehicle_brand_required?: boolean;
  vehicle_model_required?: boolean;
  license_plate_required?: boolean;
}

export const useServiceTypesManagement = () => {
  const queryClient = useQueryClient();

  const { data: serviceTypes = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['service-types'],
    queryFn: async (): Promise<ServiceTypeConfig[]> => {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading service types:', error);
        throw new Error('Error al cargar tipos de servicio');
      }

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        basePrice: item.base_price || 0,
        isActive: item.is_active,
        vehicleInfoOptional: item.vehicle_info_optional || false,
        purchaseOrderRequired: item.purchase_order_required || false,
        originRequired: item.origin_required !== false,
        destinationRequired: item.destination_required !== false,
        craneRequired: item.crane_required !== false,
        operatorRequired: item.operator_required !== false,
        vehicleBrandRequired: item.vehicle_brand_required !== false,
        vehicleModelRequired: item.vehicle_model_required !== false,
        licensePlateRequired: item.license_plate_required !== false,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateServiceTypeData) => {
      const { error } = await supabase
        .from('service_types')
        .insert([data]);

      if (error) {
        console.error('Error creating service type:', error);
        throw new Error('Error al crear tipo de servicio');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
      toast.success('Tipo de servicio creado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al crear tipo de servicio', {
        description: error.message
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateServiceTypeData> }) => {
      const { error } = await supabase
        .from('service_types')
        .update(data)
        .eq('id', id);

      if (error) {
        console.error('Error updating service type:', error);
        throw new Error('Error al actualizar tipo de servicio');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
      toast.success('Tipo de servicio actualizado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar tipo de servicio', {
        description: error.message
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_types')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting service type:', error);
        throw new Error('Error al eliminar tipo de servicio');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
      toast.success('Tipo de servicio eliminado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar tipo de servicio', {
        description: error.message
      });
    }
  });

  return {
    serviceTypes,
    loading,
    refetch,
    createServiceType: createMutation.mutate,
    updateServiceType: (id: string, data: Partial<CreateServiceTypeData>) => 
      updateMutation.mutate({ id, data }),
    deleteServiceType: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};
