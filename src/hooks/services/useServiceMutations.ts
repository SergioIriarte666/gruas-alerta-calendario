import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';

export const useServiceMutations = () => {

  const createService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }) => {
    try {
      const { data: newService, error } = await supabase
        .from('services')
        .insert({
          folio: serviceData.folio,
          request_date: serviceData.requestDate,
          service_date: serviceData.serviceDate,
          client_id: serviceData.client.id,
          purchase_order: serviceData.purchaseOrder,
          vehicle_brand: serviceData.vehicleBrand || null,
          vehicle_model: serviceData.vehicleModel || null,
          license_plate: serviceData.licensePlate || null,
          origin: serviceData.origin,
          destination: serviceData.destination,
          service_type_id: serviceData.serviceType.id,
          value: serviceData.value,
          crane_id: serviceData.crane.id,
          operator_id: serviceData.operator.id,
          operator_commission: serviceData.operatorCommission,
          status: serviceData.status,
          observations: serviceData.observations
        })
        .select()
        .single();

      if (error) throw error;

      const formattedService: Service = {
        ...serviceData,
        id: newService.id,
        createdAt: newService.created_at,
        updatedAt: newService.updated_at
      };

      // Enviar emails de confirmación (no bloqueantes)
      try {
        console.log('📧 Iniciando envío de emails para servicio:', formattedService.folio);
        
        // 1. Email de confirmación al cliente
        const clientEmailResult = await supabase.functions.invoke('send-service-confirmation', {
          body: {
            serviceId: formattedService.id,
            clientEmail: serviceData.client.email,
            folio: serviceData.folio,
            origin: serviceData.origin,
            destination: serviceData.destination,
            serviceDate: serviceData.serviceDate,
            serviceTypeName: serviceData.serviceType.name,
            clientName: serviceData.client.name
          }
        });

        // 2. Email de notificación al operador (usar el email de notificación del sistema)
        const operatorEmailResult = await supabase.functions.invoke('send-operator-notification', {
          body: {
            operatorEmail: 'notifica@gruas5norte.cl',
            operatorName: serviceData.operator.name,
            serviceId: formattedService.id,
            folio: serviceData.folio,
            clientName: serviceData.client.name,
            serviceDate: serviceData.serviceDate,
            origin: serviceData.origin,
            destination: serviceData.destination,
            serviceTypeName: serviceData.serviceType.name,
            craneLicensePlate: serviceData.crane.licensePlate
          }
        });

        if (operatorEmailResult.error) {
          console.error('❌ Error enviando notificación al operador:', operatorEmailResult.error);
        } else {
          console.log('✅ Notificación al operador enviada exitosamente');
        }

        if (clientEmailResult.error) {
          console.error('❌ Error enviando email de confirmación:', clientEmailResult.error);
          toast.error("Advertencia", {
            description: "El servicio fue creado exitosamente, pero no se pudo enviar el email de confirmación.",
          });
        } else {
          console.log('✅ Email de confirmación enviado exitosamente');
          toast.success("Servicio creado y emails enviados", {
            description: `Servicio ${serviceData.folio} creado exitosamente. Se han enviado las notificaciones correspondientes.`,
          });
        }
      } catch (emailError) {
        console.error('❌ Error crítico enviando emails:', emailError);
        toast.error("Advertencia", {
          description: "El servicio fue creado exitosamente, pero no se pudieron enviar las notificaciones por email.",
        });
      }

      toast.success("Servicio creado", {
        description: `Servicio ${serviceData.folio} creado exitosamente.`,
      });

      return formattedService;
    } catch (error: any) {
      console.error('Error creating service:', error);
      toast.error("Error", {
        description: "No se pudo crear el servicio.",
      });
      throw error;
    }
  };

  const updateService = async (id: string, serviceData: Partial<Service>) => {
    try {
      const updateData: any = {};
      
      if (serviceData.folio !== undefined) updateData.folio = serviceData.folio;
      if (serviceData.requestDate !== undefined) updateData.request_date = serviceData.requestDate;
      if (serviceData.serviceDate !== undefined) updateData.service_date = serviceData.serviceDate;
      if (serviceData.client !== undefined) updateData.client_id = serviceData.client.id;
      if (serviceData.purchaseOrder !== undefined) updateData.purchase_order = serviceData.purchaseOrder;
      if (serviceData.vehicleBrand !== undefined) updateData.vehicle_brand = serviceData.vehicleBrand || null;
      if (serviceData.vehicleModel !== undefined) updateData.vehicle_model = serviceData.vehicleModel || null;
      if (serviceData.licensePlate !== undefined) updateData.license_plate = serviceData.licensePlate || null;
      if (serviceData.origin !== undefined) updateData.origin = serviceData.origin;
      if (serviceData.destination !== undefined) updateData.destination = serviceData.destination;
      if (serviceData.serviceType !== undefined) updateData.service_type_id = serviceData.serviceType.id;
      if (serviceData.value !== undefined) updateData.value = serviceData.value;
      if (serviceData.crane !== undefined) updateData.crane_id = serviceData.crane.id;
      if (serviceData.operator !== undefined) updateData.operator_id = serviceData.operator.id;
      if (serviceData.operatorCommission !== undefined) updateData.operator_commission = serviceData.operatorCommission;
      if (serviceData.status !== undefined) updateData.status = serviceData.status;
      if (serviceData.observations !== undefined) updateData.observations = serviceData.observations;

      const { error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success("Servicio actualizado", {
        description: "El servicio ha sido actualizado exitosamente.",
      });

      return { ...serviceData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error updating service:', error);
      toast.error("Error", {
        description: "No se pudo actualizar el servicio.",
      });
      throw error;
    }
  };

  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Servicio eliminado", {
        description: "El servicio ha sido eliminado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting service:', error);
      toast.error("Error", {
        description: "No se pudo eliminar el servicio.",
      });
      throw error;
    }
  };

  return {
    createService,
    updateService,
    deleteService
  };
};
