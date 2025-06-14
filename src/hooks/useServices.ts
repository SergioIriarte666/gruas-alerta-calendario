import { useState, useEffect } from 'react';
import { Service, ServiceStatus } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperators } from './useOperators';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          clients(id, name, rut, phone, email, address, is_active),
          cranes(id, license_plate, brand, model, type, is_active),
          operators(id, name, rut, phone, license_number, is_active),
          service_types(id, name, description, is_active)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedServices: Service[] = data.map(service => ({
        id: service.id,
        folio: service.folio,
        requestDate: service.request_date,
        serviceDate: service.service_date,
        client: {
          id: service.clients.id,
          name: service.clients.name,
          rut: service.clients.rut,
          phone: service.clients.phone || '',
          email: service.clients.email || '',
          address: service.clients.address || '',
          isActive: service.clients.is_active,
          createdAt: '',
          updatedAt: ''
        },
        purchaseOrder: service.purchase_order,
        vehicleBrand: service.vehicle_brand,
        vehicleModel: service.vehicle_model,
        licensePlate: service.license_plate,
        origin: service.origin,
        destination: service.destination,
        serviceType: {
          id: service.service_types.id,
          name: service.service_types.name,
          description: service.service_types.description || '',
          isActive: service.service_types.is_active,
          createdAt: '',
          updatedAt: ''
        },
        value: Number(service.value),
        crane: {
          id: service.cranes.id,
          licensePlate: service.cranes.license_plate,
          brand: service.cranes.brand,
          model: service.cranes.model,
          type: service.cranes.type,
          isActive: service.cranes.is_active,
          createdAt: '',
          updatedAt: '',
          circulationPermitExpiry: '',
          insuranceExpiry: '',
          technicalReviewExpiry: ''
        },
        operator: {
          id: service.operators.id,
          name: service.operators.name,
          rut: service.operators.rut,
          phone: service.operators.phone || '',
          licenseNumber: service.operators.license_number,
          isActive: service.operators.is_active,
          createdAt: '',
          updatedAt: '',
          examExpiry: ''
        },
        operatorCommission: Number(service.operator_commission),
        status: service.status as ServiceStatus,
        observations: service.observations,
        createdAt: service.created_at,
        updatedAt: service.updated_at
      }));

      setServices(formattedServices);
    } catch (error: any) {
      console.error('Error fetching services:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch when dependencies are available
    if (clients.length > 0 && cranes.length > 0 && operators.length > 0) {
      fetchServices();
    }
  }, [clients, cranes, operators]);

  const createService = async (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Generate folio
      const folioNumber = services.length + 1;
      const folio = `SRV-${String(folioNumber).padStart(3, '0')}`;

      const { data: newService, error } = await supabase
        .from('services')
        .insert({
          folio,
          request_date: serviceData.requestDate,
          service_date: serviceData.serviceDate,
          client_id: serviceData.client.id,
          purchase_order: serviceData.purchaseOrder,
          vehicle_brand: serviceData.vehicleBrand,
          vehicle_model: serviceData.vehicleModel,
          license_plate: serviceData.licensePlate,
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
        folio,
        createdAt: newService.created_at,
        updatedAt: newService.updated_at
      };

      setServices(prev => [formattedService, ...prev]);

      toast({
        title: "Servicio creado",
        description: `Servicio ${folio} creado exitosamente.`,
      });

      return formattedService;
    } catch (error: any) {
      console.error('Error creating service:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el servicio.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateService = async (id: string, serviceData: Partial<Service>) => {
    try {
      const updateData: any = {};
      
      if (serviceData.requestDate !== undefined) updateData.request_date = serviceData.requestDate;
      if (serviceData.serviceDate !== undefined) updateData.service_date = serviceData.serviceDate;
      if (serviceData.client !== undefined) updateData.client_id = serviceData.client.id;
      if (serviceData.purchaseOrder !== undefined) updateData.purchase_order = serviceData.purchaseOrder;
      if (serviceData.vehicleBrand !== undefined) updateData.vehicle_brand = serviceData.vehicleBrand;
      if (serviceData.vehicleModel !== undefined) updateData.vehicle_model = serviceData.vehicleModel;
      if (serviceData.licensePlate !== undefined) updateData.license_plate = serviceData.licensePlate;
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

      setServices(prev => prev.map(service => 
        service.id === id 
          ? { ...service, ...serviceData, updatedAt: new Date().toISOString() }
          : service
      ));

      toast({
        title: "Servicio actualizado",
        description: "El servicio ha sido actualizado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error updating service:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el servicio.",
        variant: "destructive",
      });
    }
  };

  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(prev => prev.filter(service => service.id !== id));
      
      toast({
        title: "Servicio eliminado",
        description: "El servicio ha sido eliminado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el servicio.",
        variant: "destructive",
      });
    }
  };

  return {
    services,
    loading,
    createService,
    updateService,
    deleteService,
    refetch: fetchServices
  };
};
