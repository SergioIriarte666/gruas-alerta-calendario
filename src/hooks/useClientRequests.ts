import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';

export const useClientRequests = (clientId: string | null) => {
  const [requests, setRequests] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequestsByClient = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          clients!inner(id, name, rut, phone, email, address, department, is_active),
          cranes(id, license_plate, brand, model, type, is_active),
          operators(id, name, rut, phone, license_number, is_active),
          service_types(id, name, description, base_price, is_active, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
        `)
        .eq('client_id', id)
        .in('status', ['pending', 'cancelled'])
        .order('request_date', { ascending: false });

      if (error) throw error;
      
      const formattedRequests: Service[] = data.map(service => ({
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
          department: service.clients.department || 'General',
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
          basePrice: service.service_types.base_price,
          isActive: service.service_types.is_active,
          vehicleInfoOptional: service.service_types.vehicle_info_optional || false,
          purchaseOrderRequired: service.service_types.purchase_order_required || false,
          originRequired: service.service_types.origin_required !== false,
          destinationRequired: service.service_types.destination_required !== false,
          craneRequired: service.service_types.crane_required !== false,
          operatorRequired: service.service_types.operator_required !== false,
          vehicleBrandRequired: service.service_types.vehicle_brand_required !== false,
          vehicleModelRequired: service.service_types.vehicle_model_required !== false,
          licensePlateRequired: service.service_types.license_plate_required !== false,
          createdAt: service.service_types.created_at || '',
          updatedAt: service.service_types.updated_at || ''
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
        status: service.status as Service['status'],
        observations: service.observations,
        createdAt: service.created_at,
        updatedAt: service.updated_at,
      }));

      setRequests(formattedRequests);
    } catch (error: any) {
      console.error('Error fetching client requests:', error);
      toast.error("Error", {
        description: "No se pudieron cargar las solicitudes del cliente.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      fetchRequestsByClient(clientId);
    } else {
      setRequests([]);
      setLoading(false);
    }
  }, [clientId, fetchRequestsByClient]);

  const requestMetrics = {
    totalRequests: requests.length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    cancelledRequests: requests.filter(r => r.status === 'cancelled').length,
    totalRequestedValue: requests.reduce((sum, r) => sum + r.value, 0),
  };

  return { 
    requests, 
    loading, 
    metrics: requestMetrics, 
    refetch: () => clientId && fetchRequestsByClient(clientId) 
  };
};