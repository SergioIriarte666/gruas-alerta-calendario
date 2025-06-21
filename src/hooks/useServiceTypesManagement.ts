
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceTypeConfig, ServiceTypeFormData } from '@/types/serviceTypes';
import { toast } from 'sonner';

export const useServiceTypesManagement = () => {
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServiceTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedData: ServiceTypeConfig[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        basePrice: item.base_price,
        isActive: item.is_active,
        vehicleInfoOptional: item.vehicle_info_optional,
        purchaseOrderRequired: item.purchase_order_required,
        originRequired: item.origin_required,
        destinationRequired: item.destination_required,
        craneRequired: item.crane_required,
        operatorRequired: item.operator_required,
        vehicleBrandRequired: item.vehicle_brand_required,
        vehicleModelRequired: item.vehicle_model_required,
        licensePlateRequired: item.license_plate_required,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      setServiceTypes(formattedData);
    } catch (error: any) {
      console.error('Error fetching service types:', error);
      toast.error('Error al cargar tipos de servicio', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const createServiceType = async (data: ServiceTypeFormData) => {
    try {
      const { error } = await supabase
        .from('service_types')
        .insert({
          name: data.name,
          description: data.description,
          base_price: data.basePrice,
          is_active: data.isActive,
          vehicle_info_optional: data.vehicleInfoOptional,
          purchase_order_required: data.purchaseOrderRequired,
          origin_required: data.originRequired,
          destination_required: data.destinationRequired,
          crane_required: data.craneRequired,
          operator_required: data.operatorRequired,
          vehicle_brand_required: data.vehicleBrandRequired,
          vehicle_model_required: data.vehicleModelRequired,
          license_plate_required: data.licensePlateRequired
        });

      if (error) throw error;

      await fetchServiceTypes();
      toast.success('Tipo de servicio creado exitosamente');
    } catch (error: any) {
      console.error('Error creating service type:', error);
      toast.error('Error al crear tipo de servicio', {
        description: error.message
      });
      throw error;
    }
  };

  const updateServiceType = async (id: string, data: ServiceTypeFormData) => {
    try {
      const { error } = await supabase
        .from('service_types')
        .update({
          name: data.name,
          description: data.description,
          base_price: data.basePrice,
          is_active: data.isActive,
          vehicle_info_optional: data.vehicleInfoOptional,
          purchase_order_required: data.purchaseOrderRequired,
          origin_required: data.originRequired,
          destination_required: data.destinationRequired,
          crane_required: data.craneRequired,
          operator_required: data.operatorRequired,
          vehicle_brand_required: data.vehicleBrandRequired,
          vehicle_model_required: data.vehicleModelRequired,
          license_plate_required: data.licensePlateRequired,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      await fetchServiceTypes();
      toast.success('Tipo de servicio actualizado exitosamente');
    } catch (error: any) {
      console.error('Error updating service type:', error);
      toast.error('Error al actualizar tipo de servicio', {
        description: error.message
      });
      throw error;
    }
  };

  const deleteServiceType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchServiceTypes();
      toast.success('Tipo de servicio eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting service type:', error);
      toast.error('Error al eliminar tipo de servicio', {
        description: error.message
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  return {
    serviceTypes,
    loading,
    createServiceType,
    updateServiceType,
    deleteServiceType,
    refetch: fetchServiceTypes
  };
};
