
import { useState } from 'react';
import { enhancedSupabase } from '@/integrations/supabase/enhancedClient';
import { Service } from '@/types';
import { toast } from 'sonner';
import { useServiceTransformer } from './useServiceTransformer';

export const useServiceFetcher = () => {
  const [loading, setLoading] = useState(true);
  const { transformRawServiceData } = useServiceTransformer();
  const supabase = enhancedSupabase.getClient();

  const fetchServices = async (): Promise<Service[]> => {
    try {
      console.log('Fetching services with enhanced error handling...');
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

      const result = await enhancedSupabase.query(
        () => supabase
          .from('services')
          .select(`
            *,
            clients!inner(id, name, rut, phone, email, address, is_active),
            cranes!inner(id, license_plate, brand, model, type, is_active),
            operators!inner(id, name, rut, phone, license_number, is_active),
            service_types!inner(id, name, description, is_active)
          `)
          .order('created_at', { ascending: false }),
        'fetch services with relations'
      );

      if (result.error) {
        console.error('Error fetching services:', result.error);
        
        // Intentar con una consulta más simple si falla la compleja
        console.log('Intentando consulta simplificada...');
        const simpleResult = await enhancedSupabase.query(
          () => supabase
            .from('services')
            .select('*')
            .order('created_at', { ascending: false }),
          'fetch services simple'
        );
          
        if (simpleResult.error) {
          console.error('Error en consulta simplificada:', simpleResult.error);
          toast.error("Error de acceso", {
            description: "No se pudieron cargar los servicios. Verifica los permisos.",
          });
          return [];
        }

        console.log('Consulta simplificada exitosa, obteniendo datos relacionados...');
        if (simpleResult.data && simpleResult.data.length > 0) {
          const enrichedData = await enrichServicesData(simpleResult.data);
          return transformRawServiceData(enrichedData);
        }
        
        throw result.error;
      }

      console.log('Raw services data:', result.data);

      if (!result.data || result.data.length === 0) {
        console.log('No services found');
        return [];
      }

      const formattedServices = transformRawServiceData(result.data);
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

      const [clients, cranes, operators, serviceTypes] = await Promise.all([
        enhancedSupabase.query(() => supabase.from('clients').select('*').in('id', clientIds), 'fetch clients for services'),
        enhancedSupabase.query(() => supabase.from('cranes').select('*').in('id', craneIds), 'fetch cranes for services'),
        enhancedSupabase.query(() => supabase.from('operators').select('*').in('id', operatorIds), 'fetch operators for services'),
        enhancedSupabase.query(() => supabase.from('service_types').select('*').in('id', serviceTypeIds), 'fetch service types for services')
      ]);

      return services.map(service => ({
        ...service,
        clients: clients.data?.find(c => c.id === service.client_id) || null,
        cranes: cranes.data?.find(c => c.id === service.crane_id) || null,
        operators: operators.data?.find(o => o.id === service.operator_id) || null,
        service_types: serviceTypes.data?.find(st => st.id === service.service_type_id) || null
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
