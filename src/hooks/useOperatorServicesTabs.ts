
import { useUser } from '@/contexts/UserContext';
import { useOperatorServices } from './useOperatorServices';
import { Service } from '@/types';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useOperatorServicesTabs = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: allServices, isLoading, error, refetch } = useOperatorServices(user?.id);

  const serviceTabs = useMemo(() => {
    if (!allServices) {
      return {
        asignados: [],
        activos: [],
        pendientes_entrega: [],
        completados: []
      };
    }

    return {
      asignados: allServices.filter((service: Service) => service.status === 'pending'),
      activos: allServices.filter((service: Service) => service.status === 'in_progress'),
      pendientes_entrega: allServices.filter((service: Service) => service.status === 'inspection_completed'),
      completados: allServices.filter((service: Service) => service.status === 'completed')
    };
  }, [allServices]);

  const refreshAllData = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
        queryClient.invalidateQueries({ queryKey: ['operator-services'] }),
        queryClient.invalidateQueries({ queryKey: ['operatorService'] }),
        refetch()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return {
    serviceTabs,
    isLoading,
    error,
    refetch,
    refreshAllData,
    totalCount: allServices?.length || 0
  };
};
