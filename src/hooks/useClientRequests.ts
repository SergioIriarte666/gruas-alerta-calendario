import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useClientRequests");
const CLIENT_REQUEST_SELECT = `
  id,
  folio,
  request_date,
  service_date,
  purchase_order,
  vehicle_brand,
  vehicle_model,
  license_plate,
  origin,
  destination,
  value,
  custody_total_amount,
  custody_mode,
  operator_commission,
  status,
  observations,
  created_at,
  updated_at,
  cranes(id, license_plate, brand, model, type, is_active),
  operators(id, name, rut, phone, license_number, is_active),
  service_types(id, name, description, base_price, is_active, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
`;

export const useClientRequests = (clientId: string | null) => {
  const [requests, setRequests] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequestsByClient = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select(CLIENT_REQUEST_SELECT)
        .eq('client_id', id)
        .in('status', ['pending', 'cancelled'])
        .order('request_date', { ascending: false });

      if (error) {
        logger.error('Supabase error fetching client requests:', error);
        throw new Error(`Error en consulta: ${error.message}`);
      }

      if (!data) {
        setRequests([]);
        return;
      }

      // Get client data separately for more robust error handling
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name, rut, phone, email, address, department, is_active')
        .eq('id', id)
        .single();

      if (clientError) {
        logger.error('Client fetch error for requests:', clientError);
        // Continue without client data rather than failing completely
      }
      
      const formattedRequests: Service[] = data.map(service => ({
        id: service.id,
        folio: service.folio,
        requestDate: service.request_date,
        serviceDate: service.service_date,
        client: clientData ? {
          id: clientData.id,
          name: clientData.name,
          rut: clientData.rut,
          phone: clientData.phone || '',
          email: clientData.email || '',
          address: clientData.address || '',
          department: clientData.department || 'General',
          isActive: clientData.is_active,
          createdAt: '',
          updatedAt: ''
        } : {
          id: id,
          name: 'Cliente no encontrado',
          rut: '',
          phone: '',
          email: '',
          address: '',
          department: 'General',
          isActive: false,
          createdAt: '',
          updatedAt: ''
        },
        purchaseOrder: service.purchase_order,
        vehicleBrand: service.vehicle_brand,
        vehicleModel: service.vehicle_model,
        licensePlate: service.license_plate,
        origin: service.origin,
        destination: service.destination,
        serviceType: service.service_types ? {
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
        } : {
          id: 'unknown',
          name: 'Tipo no especificado',
          description: '',
          basePrice: 0,
          isActive: true,
          vehicleInfoOptional: false,
          purchaseOrderRequired: false,
          originRequired: true,
          destinationRequired: true,
          craneRequired: true,
          operatorRequired: true,
          vehicleBrandRequired: true,
          vehicleModelRequired: true,
          licensePlateRequired: true,
          createdAt: '',
          updatedAt: ''
        },
        value: Number(service.value),
        custodyTotalAmount: service.custody_total_amount || 0,
        custodyMode: (service.custody_mode as "manual" | "none" | "calendar") || 'none',
        crane: service.cranes ? {
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
        } : null,
        operator: service.operators ? {
          id: service.operators.id,
          name: service.operators.name,
          rut: service.operators.rut,
          phone: service.operators.phone || '',
          operatorType: 'crane_operator' as const,
          licenseNumber: service.operators.license_number,
          isActive: service.operators.is_active,
          createdAt: '',
          updatedAt: '',
          examExpiry: ''
        } : null,
        operatorCommission: Number(service.operator_commission),
        status: service.status as Service['status'],
        observations: service.observations,
        createdAt: service.created_at,
        updatedAt: service.updated_at,
      }));

      setRequests(formattedRequests);
    } catch (error: any) {
      logger.error('Error fetching client requests:', error);
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
    totalRequestedValue: requests.reduce((sum, r) => sum + getDisplayServiceValue(r), 0),
  };

  return { 
    requests, 
    loading, 
    metrics: requestMetrics, 
    refetch: () => clientId && fetchRequestsByClient(clientId) 
  };
};
