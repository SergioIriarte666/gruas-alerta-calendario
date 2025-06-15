
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';
import { useUser } from '@/contexts/UserContext';

const fetchOperatorServices = async (transformRawServiceData: (data: any[]) => Service[], userId?: string): Promise<Service[]> => {
  console.log('🔍 fetchOperatorServices - Starting with userId:', userId);
  
  if (!userId) {
    console.log('❌ No user ID provided, returning empty array');
    return [];
  }

  try {
    console.log('🔍 Step 1: Getting operator by user_id:', userId);
    
    // Primero obtener el operator_id del usuario actual
    const { data: operatorData, error: operatorError } = await supabase
      .from('operators')
      .select('id, name, rut')
      .eq('user_id', userId)
      .single();

    console.log('🔍 Operator query result:', { operatorData, operatorError });

    if (operatorError) {
      console.error('❌ Error finding operator:', operatorError);
      if (operatorError.code === 'PGRST116') {
        console.log('❌ No operator found for user ID:', userId);
      }
      return [];
    }

    if (!operatorData) {
      console.log('❌ No operator data found for user:', userId);
      return [];
    }

    console.log('✅ Found operator:', operatorData);

    console.log('🔍 Step 2: Getting services for operator_id:', operatorData.id);
    
    // Luego obtener los servicios asignados a este operador
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        clients(id, name, rut, phone, email, address, is_active),
        cranes(id, license_plate, brand, model, type, is_active),
        operators(id, name, rut, phone, license_number, is_active),
        service_types(id, name, description, is_active)
      `)
      .eq('operator_id', operatorData.id)
      .in('status', ['pending', 'in_progress'])
      .order('service_date', { ascending: true });

    console.log('🔍 Services query result:', { 
      data: data?.length ? `${data.length} services found` : 'No services found', 
      error,
      rawData: data 
    });

    if (error) {
      console.error('❌ Error fetching operator services:', error);
      throw new Error(`Error fetching services: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No services found for operator:', operatorData.id);
      return [];
    }

    console.log('🔍 Step 3: Transforming service data...');
    const transformedServices = transformRawServiceData(data);
    console.log('✅ Transformed services:', transformedServices.length, 'services');
    
    return transformedServices;

  } catch (error: any) {
    console.error('❌ Error in fetchOperatorServices:', error);
    throw error;
  }
};

export const useOperatorServices = () => {
  const { transformRawServiceData } = useServiceTransformer();
  const { user } = useUser();

  console.log('🔍 useOperatorServices - User context:', user);

  const { data: services, isLoading, error } = useQuery({
    queryKey: ['operatorServices', user?.id],
    queryFn: () => fetchOperatorServices(transformRawServiceData, user?.id),
    enabled: !!user?.id,
    retry: 1,
    staleTime: 30000, // 30 seconds
  });

  console.log('🔍 useOperatorServices - Query result:', { 
    services: services?.length || 0, 
    isLoading, 
    error: error?.message || 'no error'
  });

  return { services, isLoading, error };
};
