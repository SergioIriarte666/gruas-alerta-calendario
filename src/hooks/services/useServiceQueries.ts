import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';

// Función para transformar datos de Supabase a Service
const transformToService = (data: any): Service => {
  console.log('🔄 [TRANSFORM] Transforming service data:', {
    folio: data.folio,
    crane: data.crane,
    operator: data.operator,
    service_resources: data.service_resources
  });

  // Buscar operador principal en service_resources primero
  let primaryOperator = null;
  let primaryCrane = null;
  
  if (data.service_resources && data.service_resources.length > 0) {
    // Buscar operador principal
    const primaryOperatorResource = data.service_resources.find(
      (resource: any) => resource.resource_type === 'operator' && resource.is_primary
    );
    
    if (primaryOperatorResource && primaryOperatorResource.operator) {
      primaryOperator = primaryOperatorResource.operator;
    } else {
      // Si no hay operador principal marcado, tomar el primero
      const firstOperatorResource = data.service_resources.find(
        (resource: any) => resource.resource_type === 'operator'
      );
      if (firstOperatorResource && firstOperatorResource.operator) {
        primaryOperator = firstOperatorResource.operator;
      }
    }

    // Buscar grúa principal
    const primaryCraneResource = data.service_resources.find(
      (resource: any) => resource.resource_type === 'crane' && resource.is_primary
    );
    
    if (primaryCraneResource && primaryCraneResource.crane) {
      primaryCrane = primaryCraneResource.crane;
    } else {
      // Si no hay grúa principal marcada, tomar la primera
      const firstCraneResource = data.service_resources.find(
        (resource: any) => resource.resource_type === 'crane'
      );
      if (firstCraneResource && firstCraneResource.crane) {
        primaryCrane = firstCraneResource.crane;
      }
    }
  }

  // Fallback a los campos legacy si no se encontró en service_resources
  const finalOperator = primaryOperator || data.operator;
  const finalCrane = primaryCrane || data.crane;

  console.log('✅ [TRANSFORM] Final values:', {
    folio: data.folio,
    finalCrane: finalCrane?.licensePlate,
    finalOperator: finalOperator?.name
  });

  return {
    id: data.id,
    folio: data.folio,
    requestDate: data.request_date,
    serviceDate: data.service_date,
    client: data.client,
    purchaseOrder: data.purchase_order,
    vehicleBrand: data.vehicle_brand,
    vehicleModel: data.vehicle_model,
    licensePlate: data.license_plate,
    origin: data.origin,
    destination: data.destination,
    serviceType: data.serviceType,
    value: data.value,
    crane: finalCrane,
    operator: finalOperator,
    operatorCommission: data.operator_commission,
    status: data.status,
    observations: data.observations,
    hasExcess: data.has_excess,
    clientCoveredAmount: data.client_covered_amount,
    excessAmount: data.excess_amount,
    invoiceFolio: data.invoice_folio,
    invoiceNumeroFiscal: data.invoice_numero_fiscal,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

// ⚡ HOOK SIMPLE PARA CONSULTAS DE SERVICIOS
export const useServiceQueries = () => {
  // Fetch todos los servicios
  const useAllServices = () => {
    return useQuery({
      queryKey: ['services'],
      queryFn: async (): Promise<Service[]> => {
        console.log('🔍 [QUERY] Obteniendo todos los servicios');
        
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            client:clients!services_client_id_fkey(*),
            third_party_client:clients!services_third_party_client_id_fkey(*),
            crane:cranes(*),
            operator:operators(*),
            serviceType:service_types(*),
            service_resources!service_resources_service_id_fkey(
              id,
              resource_type,
              operator_id,
              crane_id,
              is_primary,
              commission_amount,
              operator:operators(*),
              crane:cranes(*)
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ [QUERY] Error al obtener servicios:', error);
          throw new Error(error.message);
        }

        console.log('✅ [QUERY] Servicios obtenidos:', data?.length || 0);
        return data?.map(transformToService) || [];
      },
      staleTime: 30000, // 30 segundos
      refetchOnWindowFocus: false,
    });
  };

  // Fetch servicio por ID
  const useServiceById = (id: string) => {
    return useQuery({
      queryKey: ['services', id],
      queryFn: async (): Promise<Service | null> => {
        if (!id) return null;
        
        console.log('🔍 [QUERY] Obteniendo servicio por ID:', id);
        
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            client:clients!services_client_id_fkey(*),
            third_party_client:clients!services_third_party_client_id_fkey(*),
            crane:cranes(*),
            operator:operators(*),
            serviceType:service_types(*),
            service_resources!service_resources_service_id_fkey(
              id,
              resource_type,
              operator_id,
              crane_id,
              is_primary,
              commission_amount,
              operator:operators(*),
              crane:cranes(*)
            )
          `)
          .eq('id', id)
          .single();

        if (error) {
          console.error('❌ [QUERY] Error al obtener servicio:', error);
          throw new Error(error.message);
        }

        console.log('✅ [QUERY] Servicio obtenido:', data?.folio);
        return data ? transformToService(data) : null;
      },
      enabled: !!id,
      staleTime: 30000, // 30 segundos
      refetchOnWindowFocus: false,
    });
  };

  // Fetch servicios por operador
  const useServicesByOperator = (operatorId: string) => {
    return useQuery({
      queryKey: ['operatorServices', operatorId],
      queryFn: async (): Promise<Service[]> => {
        if (!operatorId) return [];
        
        console.log('🔍 [QUERY] Obteniendo servicios por operador:', operatorId);
        
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            client:clients!services_client_id_fkey(*),
            third_party_client:clients!services_third_party_client_id_fkey(*),
            crane:cranes(*),
            operator:operators(*),
            serviceType:service_types(*)
          `)
          .eq('operator_id', operatorId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ [QUERY] Error al obtener servicios del operador:', error);
          throw new Error(error.message);
        }

        console.log('✅ [QUERY] Servicios del operador obtenidos:', data?.length || 0);
        return data?.map(transformToService) || [];
      },
      enabled: !!operatorId,
      staleTime: 30000, // 30 segundos
      refetchOnWindowFocus: false,
    });
  };

  return {
    useAllServices,
    useServiceById,
    useServicesByOperator
  };
};