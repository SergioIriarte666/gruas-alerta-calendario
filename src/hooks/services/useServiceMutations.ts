
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';

export const useServiceMutations = () => {
  const createService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }): Promise<Service> => {
    try {
      console.log('Creating service with data:', serviceData);
      
      const { data, error } = await supabase
        .from('services')
        .insert({
          folio: serviceData.folio,
          request_date: serviceData.requestDate,
          service_date: serviceData.serviceDate,
          client_id: serviceData.client.id,
          service_type_id: serviceData.serviceType.id,
          crane_id: serviceData.crane?.id,
          operator_id: serviceData.operator?.id,
          vehicle_brand: serviceData.vehicleBrand,
          vehicle_model: serviceData.vehicleModel,
          license_plate: serviceData.licensePlate,
          origin: serviceData.origin,
          destination: serviceData.destination,
          value: serviceData.value,
          operator_commission: serviceData.operatorCommission,
          status: serviceData.status,
          observations: serviceData.observations,
          purchase_order: serviceData.purchaseOrder
        })
        .select(`
          *,
          clients!inner(*),
          cranes!inner(*),
          operators!inner(*),
          service_types!inner(*)
        `)
        .single();

      if (error) {
        console.error('Error creating service:', error);
        throw new Error(`Error al crear el servicio: ${error.message}`);
      }

      return {
        id: data.id,
        folio: data.folio,
        requestDate: data.request_date,
        serviceDate: data.service_date,
        client: data.clients,
        serviceType: data.service_types,
        crane: data.cranes,
        operator: data.operators,
        vehicleBrand: data.vehicle_brand,
        vehicleModel: data.vehicle_model,
        licensePlate: data.license_plate,
        origin: data.origin,
        destination: data.destination,
        value: data.value,
        operatorCommission: data.operator_commission,
        status: data.status,
        observations: data.observations,
        purchaseOrder: data.purchase_order,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error in createService:', error);
      throw error;
    }
  };

  const updateService = async (id: string, serviceData: Partial<Service>): Promise<Partial<Service>> => {
    try {
      console.log('Updating service:', id, serviceData);
      
      const updateData: any = {};
      
      if (serviceData.requestDate) updateData.request_date = serviceData.requestDate;
      if (serviceData.serviceDate) updateData.service_date = serviceData.serviceDate;
      if (serviceData.client?.id) updateData.client_id = serviceData.client.id;
      if (serviceData.serviceType?.id) updateData.service_type_id = serviceData.serviceType.id;
      if (serviceData.crane?.id) updateData.crane_id = serviceData.crane.id;
      if (serviceData.operator?.id) updateData.operator_id = serviceData.operator.id;
      if (serviceData.vehicleBrand !== undefined) updateData.vehicle_brand = serviceData.vehicleBrand;
      if (serviceData.vehicleModel !== undefined) updateData.vehicle_model = serviceData.vehicleModel;
      if (serviceData.licensePlate !== undefined) updateData.license_plate = serviceData.licensePlate;
      if (serviceData.origin !== undefined) updateData.origin = serviceData.origin;
      if (serviceData.destination !== undefined) updateData.destination = serviceData.destination;
      if (serviceData.value !== undefined) updateData.value = serviceData.value;
      if (serviceData.operatorCommission !== undefined) updateData.operator_commission = serviceData.operatorCommission;
      if (serviceData.status) updateData.status = serviceData.status;
      if (serviceData.observations !== undefined) updateData.observations = serviceData.observations;
      if (serviceData.purchaseOrder !== undefined) updateData.purchase_order = serviceData.purchaseOrder;

      const { error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating service:', error);
        throw new Error(`Error al actualizar el servicio: ${error.message}`);
      }

      return serviceData;
    } catch (error) {
      console.error('Error in updateService:', error);
      throw error;
    }
  };

  const deleteService = async (id: string): Promise<void> => {
    try {
      console.log('Deleting service:', id);
      
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting service:', error);
        throw new Error(`Error al eliminar el servicio: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in deleteService:', error);
      throw error;
    }
  };

  return {
    createService,
    updateService,
    deleteService
  };
};
