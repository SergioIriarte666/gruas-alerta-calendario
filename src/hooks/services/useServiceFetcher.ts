import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { useServiceTransformer } from './useServiceTransformer';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { cacheTableData, getCachedTableData } from '@/hooks/useOfflineSync';

// Función para hidratar servicios con datos de cache
async function hydrateServicesFromCache(rawServices: any[]): Promise<any[]> {
  console.log('[Offline] Hidratando servicios con datos de cache...');
  
  // Obtener tablas relacionadas del cache
  const [clientsResult, cranesResult, operatorsResult, serviceTypesResult] = await Promise.all([
    getCachedTableData<any>('clients'),
    getCachedTableData<any>('cranes'),
    getCachedTableData<any>('operators'),
    getCachedTableData<any>('service_types')
  ]);

  const clients = clientsResult.data || [];
  const cranes = cranesResult.data || [];
  const operators = operatorsResult.data || [];
  const serviceTypes = serviceTypesResult.data || [];

  console.log('[Offline] Datos disponibles:', {
    clients: clients.length,
    cranes: cranes.length,
    operators: operators.length,
    serviceTypes: serviceTypes.length
  });

  // Crear mapas para búsqueda rápida
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const craneMap = new Map(cranes.map(c => [c.id, c]));
  const operatorMap = new Map(operators.map(o => [o.id, o]));
  const serviceTypeMap = new Map(serviceTypes.map(st => [st.id, st]));

  // Hidratar cada servicio
  return rawServices.map(service => {
    const client = clientMap.get(service.client_id);
    const thirdPartyClient = clientMap.get(service.third_party_client_id);
    const crane = craneMap.get(service.crane_id);
    const operator = operatorMap.get(service.operator_id);
    const serviceType = serviceTypeMap.get(service.service_type_id);

    // Convertir formato camelCase de cache a snake_case esperado por transformer
    const normalizedClient = client ? {
      id: client.id,
      name: client.name,
      rut: client.rut,
      phone: client.phone,
      email: client.email,
      address: client.address,
      department: client.department,
      is_active: client.isActive ?? client.is_active ?? true,
      created_at: client.createdAt || client.created_at,
      updated_at: client.updatedAt || client.updated_at
    } : null;

    const normalizedThirdPartyClient = thirdPartyClient ? {
      id: thirdPartyClient.id,
      name: thirdPartyClient.name,
      rut: thirdPartyClient.rut,
      phone: thirdPartyClient.phone,
      email: thirdPartyClient.email,
      address: thirdPartyClient.address,
      department: thirdPartyClient.department,
      is_active: thirdPartyClient.isActive ?? thirdPartyClient.is_active ?? true,
      created_at: thirdPartyClient.createdAt || thirdPartyClient.created_at,
      updated_at: thirdPartyClient.updatedAt || thirdPartyClient.updated_at
    } : null;

    const normalizedCrane = crane ? {
      id: crane.id,
      license_plate: crane.licensePlate || crane.license_plate,
      brand: crane.brand,
      model: crane.model,
      type: crane.type,
      is_active: crane.isActive ?? crane.is_active ?? true,
      circulation_permit_expiry: crane.circulationPermitExpiry || crane.circulation_permit_expiry,
      insurance_expiry: crane.insuranceExpiry || crane.insurance_expiry,
      technical_review_expiry: crane.technicalReviewExpiry || crane.technical_review_expiry,
      created_at: crane.createdAt || crane.created_at,
      updated_at: crane.updatedAt || crane.updated_at
    } : null;

    const normalizedOperator = operator ? {
      id: operator.id,
      name: operator.name,
      rut: operator.rut,
      phone: operator.phone,
      operator_type: operator.operatorType || operator.operator_type || 'crane_operator',
      department: operator.department,
      position: operator.position,
      license_number: operator.licenseNumber || operator.license_number,
      is_active: operator.isActive ?? operator.is_active ?? true,
      exam_expiry: operator.examExpiry || operator.exam_expiry,
      created_at: operator.createdAt || operator.created_at,
      updated_at: operator.updatedAt || operator.updated_at
    } : null;

    const normalizedServiceType = serviceType ? {
      id: serviceType.id,
      name: serviceType.name,
      description: serviceType.description,
      base_price: serviceType.basePrice ?? serviceType.base_price,
      is_active: serviceType.isActive ?? serviceType.is_active ?? true,
      vehicle_info_optional: serviceType.vehicleInfoOptional ?? serviceType.vehicle_info_optional,
      purchase_order_required: serviceType.purchaseOrderRequired ?? serviceType.purchase_order_required,
      origin_required: serviceType.originRequired ?? serviceType.origin_required,
      destination_required: serviceType.destinationRequired ?? serviceType.destination_required,
      crane_required: serviceType.craneRequired ?? serviceType.crane_required,
      operator_required: serviceType.operatorRequired ?? serviceType.operator_required,
      vehicle_brand_required: serviceType.vehicleBrandRequired ?? serviceType.vehicle_brand_required,
      vehicle_model_required: serviceType.vehicleModelRequired ?? serviceType.vehicle_model_required,
      license_plate_required: serviceType.licensePlateRequired ?? serviceType.license_plate_required,
      created_at: serviceType.createdAt || serviceType.created_at,
      updated_at: serviceType.updatedAt || serviceType.updated_at
    } : null;

    return {
      ...service,
      client: normalizedClient,
      third_party_client: normalizedThirdPartyClient,
      cranes: normalizedCrane,
      operators: normalizedOperator,
      service_types: normalizedServiceType
    };
  });
}

export const useServiceFetcher = () => {
  const [loading, setLoading] = useState(true);
  const { transformRawServiceData } = useServiceTransformer();
  const { effectiveIsOnline } = useOfflineMode();

  const fetchServices = async (): Promise<Service[]> => {
    try {
      console.log('Fetching services... Online:', effectiveIsOnline);
      setLoading(true);

      // Si estamos offline, intentar obtener del cache local con hidratación
      if (!effectiveIsOnline) {
        console.log('[Offline] Intentando obtener servicios del cache local...');
        try {
          const { data: cachedData, updatedAt } = await getCachedTableData<any>('services');
          if (cachedData && cachedData.length > 0) {
            console.log(`[Offline] Encontrados ${cachedData.length} servicios en cache (actualizado: ${new Date(updatedAt || 0).toLocaleString()})`);
            
            // Hidratar servicios con datos de tablas relacionadas
            const hydratedServices = await hydrateServicesFromCache(cachedData);
            const formattedServices = transformRawServiceData(hydratedServices);
            
            toast.info('Modo Offline', {
              description: `Mostrando ${formattedServices.length} servicios del cache local`
            });
            return formattedServices;
          } else {
            console.log('[Offline] No hay datos en cache local');
            toast.warning('Sin datos offline', {
              description: 'No hay servicios guardados localmente'
            });
            return [];
          }
        } catch (cacheError) {
          console.error('[Offline] Error leyendo cache:', cacheError);
          return [];
        }
      }
      
      // Verificar autenticación primero
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('Usuario no autenticado');
        toast.error("Error de autenticación", {
          description: "Necesitas iniciar sesión para ver los servicios.",
        });
        return [];
      }

      console.log('Usuario autenticado:', user.id);

      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department, is_active, created_at, updated_at),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, department, is_active, created_at, updated_at),
          cranes(id, license_plate, brand, model, type, is_active, circulation_permit_expiry, insurance_expiry, technical_review_expiry, created_at, updated_at),
          operators(id, name, rut, phone, license_number, is_active, exam_expiry, created_at, updated_at),
          service_types!inner(id, name, description, is_active, base_price, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at),
          creator:profiles!services_created_by_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching services:', error);
        
        // Intentar con una consulta más simple si falla la compleja
        console.log('Intentando consulta simplificada...');
        const { data: simpleData, error: simpleError } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (simpleError) {
          console.error('Error en consulta simplificada:', simpleError);
          toast.error("Error de acceso", {
            description: "No se pudieron cargar los servicios. Verifica los permisos.",
          });
          return [];
        }

        console.log('Consulta simplificada exitosa, obteniendo datos relacionados...');
        if (simpleData && Array.isArray(simpleData) && simpleData.length > 0) {
          const enrichedData = await enrichServicesData(simpleData);
          
          // Guardar en cache para uso offline
          await cacheTableData('services', enrichedData);
          console.log('[Cache] Servicios guardados en cache local');
          
          return transformRawServiceData(enrichedData);
        }
        
        throw error;
      }

      console.log('Raw services data:', data);

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('No services found');
        return [];
      }

      // Guardar en cache para uso offline
      await cacheTableData('services', data);
      console.log('[Cache] Servicios guardados en cache local');

      const formattedServices = transformRawServiceData(data);
      console.log('Formatted services:', formattedServices);
      return formattedServices;

    } catch (error: any) {
      console.error('Error in fetchServices:', error);
      
      // Proporcionar mensajes de error más específicos
      if (error.code === 'PGRST116') {
        toast.error("Error de permisos", {
          description: "No tienes permisos para acceder a los servicios.",
        });
      } else if (error.code === '42501') {
        toast.error("Error de seguridad", {
          description: "Problema con las políticas de seguridad de la base de datos.",
        });
      } else {
        toast.error("Error", {
          description: "No se pudieron cargar los servicios. Intenta nuevamente.",
        });
      }
      return [];
    } finally {
      setLoading(false);
    }
  };

  const enrichServicesData = async (services: any[]) => {
    try {
      const clientIds = [...new Set([...services.map(s => s.client_id).filter(id => id !== null), ...services.map(s => s.third_party_client_id).filter(id => id !== null)])];
      const craneIds = [...new Set(services.map(s => s.crane_id).filter(id => id !== null))];
      const operatorIds = [...new Set(services.map(s => s.operator_id).filter(id => id !== null))];
      const serviceTypeIds = [...new Set(services.map(s => s.service_type_id).filter(id => id !== null))];
      const creatorIds = [...new Set(services.map(s => s.created_by).filter(id => id !== null))];

      const [clientsResult, cranesResult, operatorsResult, serviceTypesResult, creatorsResult] = await Promise.all([
        clientIds.length > 0 ? supabase.from('clients').select('id, name, rut, phone, email, address, department, is_active, created_at, updated_at').in('id', clientIds) : { data: [] },
        craneIds.length > 0 ? supabase.from('cranes').select('*').in('id', craneIds) : { data: [] },
        operatorIds.length > 0 ? supabase.from('operators').select('*').in('id', operatorIds) : { data: [] },
        serviceTypeIds.length > 0 ? supabase.from('service_types').select('*').in('id', serviceTypeIds) : { data: [] },
        creatorIds.length > 0 ? supabase.from('profiles').select('id, full_name, email').in('id', creatorIds) : { data: [] }
      ]);

      return services.map(service => ({
        ...service,
        client: Array.isArray(clientsResult.data) ? clientsResult.data.find((c: any) => c.id === service.client_id) || null : null,
        third_party_client: Array.isArray(clientsResult.data) ? clientsResult.data.find((c: any) => c.id === service.third_party_client_id) || null : null,
        cranes: Array.isArray(cranesResult.data) ? cranesResult.data.find((c: any) => c.id === service.crane_id) || null : null,
        operators: Array.isArray(operatorsResult.data) ? operatorsResult.data.find((o: any) => o.id === service.operator_id) || null : null,
        service_types: Array.isArray(serviceTypesResult.data) ? serviceTypesResult.data.find((st: any) => st.id === service.service_type_id) || null : null,
        creator: Array.isArray(creatorsResult.data) ? creatorsResult.data.find((cr: any) => cr.id === service.created_by) || null : null
      }));
    } catch (error) {
      console.error('Error enriching services data:', error);
      return services;
    }
  };

  return {
    fetchServices,
    loading
  };
};
