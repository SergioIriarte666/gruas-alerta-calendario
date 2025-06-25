
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { useServiceTransformer } from './useServiceTransformer';

export const useServiceFetcher = () => {
  const [loading, setLoading] = useState(true);
  const { transformRawServiceData } = useServiceTransformer();

  const fetchServices = async (): Promise<Service[]> => {
    try {
      console.log('Fetching services...');
      setLoading(true);
      
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
          clients!inner(id, name, rut, phone, email, address, is_active, created_at, updated_at),
          cranes!inner(id, license_plate, brand, model, type, is_active, circulation_permit_expiry, insurance_expiry, technical_review_expiry, created_at, updated_at),
          operators!inner(id, name, rut, phone, license_number, is_active, exam_expiry, created_at, updated_at),
          service_types!inner(id, name, description, is_active, base_price, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
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
      const clientIds = [...new Set(services.map(s => s.client_id))];
      const craneIds = [...new Set(services.map(s => s.crane_id))];
      const operatorIds = [...new Set(services.map(s => s.operator_id))];
      const serviceTypeIds = [...new Set(services.map(s => s.service_type_id))];

      const [clientsResult, cranesResult, operatorsResult, serviceTypesResult] = await Promise.all([
        supabase.from('clients').select('*').in('id', clientIds),
        supabase.from('cranes').select('*').in('id', craneIds),
        supabase.from('operators').select('*').in('id', operatorIds),
        supabase.from('service_types').select('*').in('id', serviceTypeIds)
      ]);

      return services.map(service => ({
        ...service,
        clients: Array.isArray(clientsResult.data) ? clientsResult.data.find((c: any) => c.id === service.client_id) || null : null,
        cranes: Array.isArray(cranesResult.data) ? cranesResult.data.find((c: any) => c.id === service.crane_id) || null : null,
        operators: Array.isArray(operatorsResult.data) ? operatorsResult.data.find((o: any) => o.id === service.operator_id) || null : null,
        service_types: Array.isArray(serviceTypesResult.data) ? serviceTypesResult.data.find((st: any) => st.id === service.service_type_id) || null : null
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
