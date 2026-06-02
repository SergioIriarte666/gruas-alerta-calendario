
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceTypeConfig, ServiceTypeFormData } from '@/types/serviceTypes';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceTypesManagement");
interface CreateServiceTypeData {
  name: string;
  description?: string;
  base_price?: number;
  is_active?: boolean;
  vehicle_info_optional?: boolean;
  is_outsourced?: boolean;
  purchase_order_required?: boolean;
  origin_required?: boolean;
  destination_required?: boolean;
  crane_required?: boolean;
  operator_required?: boolean;
  vehicle_brand_required?: boolean;
  vehicle_model_required?: boolean;
  license_plate_required?: boolean;
}

const SERVICE_TYPE_SELECT = `
  id,
  name,
  description,
  base_price,
  is_active,
  vehicle_info_optional,
  is_outsourced,
  purchase_order_required,
  origin_required,
  destination_required,
  crane_required,
  operator_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  created_at,
  updated_at
`;

// Función para transformar datos del frontend al formato de la DB
const transformToDbFormat = (data: ServiceTypeFormData): CreateServiceTypeData => {
  return {
    name: data.name,
    description: data.description || undefined,
    base_price: data.basePrice || undefined,
    is_active: data.isActive,
    vehicle_info_optional: data.vehicleInfoOptional,
    is_outsourced: data.isOutsourced,
    purchase_order_required: data.purchaseOrderRequired,
    origin_required: data.originRequired,
    destination_required: data.destinationRequired,
    crane_required: data.craneRequired,
    operator_required: data.operatorRequired,
    vehicle_brand_required: data.vehicleBrandRequired,
    vehicle_model_required: data.vehicleModelRequired,
    license_plate_required: data.licensePlateRequired
  };
};

export const useServiceTypesManagement = () => {
  const queryClient = useQueryClient();

  const { data: serviceTypes = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['service-types'],
    queryFn: async (): Promise<ServiceTypeConfig[]> => {
      const { data, error } = await supabase
        .from('service_types')
        .select(SERVICE_TYPE_SELECT)
        .order('name');

      if (error) {
        logger.error('Error loading service types:', error);
        throw new Error('Error al cargar tipos de servicio');
      }

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        basePrice: item.base_price || 0,
        isActive: item.is_active,
        vehicleInfoOptional: item.vehicle_info_optional || false,
        isOutsourced: item.is_outsourced || false,
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
    mutationFn: async (data: ServiceTypeFormData) => {
      const dbData = transformToDbFormat(data);
      
      const { error } = await supabase
        .from('service_types')
        .insert([dbData]);

      if (error) {
        logger.error('Error creating service type:', error);
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
    mutationFn: async ({ id, data }: { id: string; data: ServiceTypeFormData }) => {
      const dbData = transformToDbFormat(data);
      
      const { error } = await supabase
        .from('service_types')
        .update(dbData)
        .eq('id', id);

      if (error) {
        logger.error('Error updating service type:', error);
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
        logger.error('Error deleting service type:', error);
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
    updateServiceType: (id: string, data: ServiceTypeFormData) => 
      updateMutation.mutate({ id, data }),
    deleteServiceType: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};
