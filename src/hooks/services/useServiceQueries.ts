import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';

// Función para transformar datos de Supabase a Service
const transformToService = (data: any): Service => {
  console.log('🔄 [TRANSFORM] Transforming service data:', {
    folio: data.folio,
    crane_id: data.crane_id,
    operator_id: data.operator_id,
    crane: data.crane?.license_plate || 'No crane data',
    operator: data.operator?.name || 'No operator data',
    service_resources_count: data.service_resources?.length || 0
  });
  
  // Buscar operador principal en service_resources
  let primaryOperator = data.operator; // Legacy fallback
  
  if (data.service_resources && data.service_resources.length > 0) {
    const primaryResource = data.service_resources.find(
      (resource: any) => resource.resource_type === 'operator' && resource.is_primary
    );
    
    if (primaryResource && primaryResource.operator) {
      console.log('✅ [TRANSFORM] Found primary operator from service_resources:', primaryResource.operator.name);
      primaryOperator = primaryResource.operator;
    } else {
      // Si no hay operador principal marcado, tomar el primero
      const firstOperatorResource = data.service_resources.find(
        (resource: any) => resource.resource_type === 'operator'
      );
      if (firstOperatorResource && firstOperatorResource.operator) {
        console.log('✅ [TRANSFORM] Found first operator from service_resources:', firstOperatorResource.operator.name);
        primaryOperator = firstOperatorResource.operator;
      }
    }
  }
  
  if (!primaryOperator && data.operator) {
    console.log('✅ [TRANSFORM] Using legacy operator:', data.operator.name);
  }
  
  if (!primaryOperator) {
    console.log('⚠️ [TRANSFORM] No operator found for service:', data.folio);
  }
  
  if (!data.crane) {
    console.log('⚠️ [TRANSFORM] No crane found for service:', data.folio);
  }

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
    crane: data.crane,
    operator: primaryOperator,
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
            client:clients!client_id(*),
            third_party_client:clients!third_party_client_id(*),
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
              operator:operators(*)
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
            client:clients!client_id(*),
            third_party_client:clients!third_party_client_id(*),
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
              operator:operators(*)
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
            client:clients!client_id(*),
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