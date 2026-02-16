
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { useServiceTransformer } from './useServiceTransformer';

export const useServiceFetcher = () => {
  const [loading, setLoading] = useState(true);
  const { transformRawServiceData } = useServiceTransformer();
  const MAX_ROWS = 1000;

  const fetchServices = async (): Promise<Service[]> => {
    try {
      console.log('Fetching services...');
      setLoading(true);
      
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
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS);

      if (error) {
        console.error('Error fetching services:', error);
        
        console.log('Intentando consulta simplificada...');
        const { data: simpleData, error: simpleError } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(MAX_ROWS);
          
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
          return transformRawServiceData(enrichedData);
        }
        
        throw error;
      }

      console.log('Raw services data:', data);

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('No services found');
        return [];
      }

      const formattedServices = transformRawServiceData(data);
      console.log('Formatted services:', formattedServices);
      return formattedServices;

    } catch (error: any) {
      console.error('Error in fetchServices:', error);
      
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
