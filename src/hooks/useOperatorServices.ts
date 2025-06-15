
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
    console.log('🔍 Step 1: Getting user session and checking auth');
    const { data: session } = await supabase.auth.getSession();
    console.log('🔍 Session status:', session?.session ? 'authenticated' : 'not authenticated');
    
    console.log('🔍 Step 2: Getting operator by user_id:', userId);
    
    // Primero obtener el operator_id del usuario actual
    const { data: operatorData, error: operatorError } = await supabase
      .from('operators')
      .select('id, name, rut, user_id')
      .eq('user_id', userId)
      .single();

    console.log('🔍 Operator query result:', { operatorData, operatorError });

    if (operatorError) {
      console.error('❌ Error finding operator:', operatorError);
      if (operatorError.code === 'PGRST116') {
        console.log('❌ No operator found for user ID:', userId);
        return [];
      }
      throw operatorError;
    }

    if (!operatorData) {
      console.log('❌ No operator data found for user:', userId);
      return [];
    }

    console.log('✅ Found operator:', operatorData);

    console.log('🔍 Step 3: Getting services for operator_id:', operatorData.id);
    
    // Ahora usar una consulta más específica con la nueva política RLS
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
      dataCount: data?.length || 0,
      error,
      rawDataSample: data?.slice(0, 2) || []
    });

    if (error) {
      console.error('❌ Error fetching operator services:', error);
      throw new Error(`Error fetching services: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No services found for operator:', operatorData.id);
      console.log('⚠️ This could be normal if no services are assigned yet');
      return [];
    }

    console.log('🔍 Step 4: Transforming service data...');
    const transformedServices = transformRawServiceData(data);
    console.log('✅ Transformed services:', transformedServices.length, 'services');
    console.log('✅ Service folios:', transformedServices.map(s => s.folio));
    
    return transformedServices;

  } catch (error: any) {
    console.error('❌ Error in fetchOperatorServices:', error);
    throw error;
  }
};

export const useOperatorServices = () => {
  const { transformRawServiceData } = useServiceTransformer();
  const { user } = useUser();

  console.log('🔍 useOperatorServices - User context:', {
    userId: user?.id,
    userEmail: user?.email,
    userRole: user?.role
  });

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ['operatorServices', user?.id],
    queryFn: () => fetchOperatorServices(transformRawServiceData, user?.id),
    enabled: !!user?.id,
    retry: 2,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  console.log('🔍 useOperatorServices - Query result:', { 
    servicesCount: services?.length || 0, 
    isLoading, 
    error: error?.message || 'no error',
    enabled: !!user?.id
  });

  return { services, isLoading, error, refetch };
};
