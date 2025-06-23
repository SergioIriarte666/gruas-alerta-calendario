
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './services/useServiceTransformer';
import { toast } from 'sonner';

const fetchOperatorServices = async (operatorId: string): Promise<any[]> => {
  try {
    console.log('Fetching services for operator:', operatorId);
    
    const { data: services, error } = await supabase
      .from('services')
      .select(`
        *,
        clients (*),
        service_types (*),
        cranes (*),
        operators (*)
      `)
      .eq('operator_id', operatorId)
      .in('status', ['pending', 'in_progress'])
      .order('service_date', { ascending: true });

    if (error) {
      console.error('Error fetching operator services:', error);
      throw new Error(`Error al obtener servicios: ${error.message}`);
    }

    console.log('Operator services fetched successfully:', services?.length || 0, 'services');
    return services || [];
  } catch (error: any) {
    console.error('Unexpected error in fetchOperatorServices:', error);
    throw error;
  }
};

export const useOperatorServices = (operatorId?: string) => {
  const { transformRawServiceData } = useServiceTransformer();

  return useQuery<Service[], Error>({
    queryKey: ['operator-services', operatorId],
    queryFn: () => fetchOperatorServices(operatorId!),
    enabled: !!operatorId,
    select: (data) => {
      try {
        return transformRawServiceData(data).filter(Boolean) as Service[];
      } catch (error) {
        console.error('Error transforming operator services:', error);
        return [];
      }
    },
    retry: (failureCount, error) => {
      console.log(`Operator services query retry attempt ${failureCount}:`, error.message);
      if (error.message.includes('permission')) {
        toast.error('Error de permisos', {
          description: 'No tienes acceso a estos servicios. Contacta al administrador.',
        });
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    meta: {
      onError: (error: Error) => {
        console.error('Operator services query error:', error);
        toast.error('Error al cargar servicios', {
          description: 'No se pudieron cargar los servicios asignados. Por favor, intenta recargar la página.',
        });
      },
    },
  });
};
