
import { useUser } from '@/contexts/UserContext';
import { useOperatorServices } from './useOperatorServices';
import { Service } from '@/types';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createLogger } from "@/lib/logger";
import { operatorServiceKeys, operatorServicesKeys } from './operatorServicesQueryKeys';


const logger = createLogger("useOperatorServicesTabs");
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
        queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
        queryClient.invalidateQueries({ queryKey: operatorServiceKeys.all }),
        refetch()
      ]);
    } catch (error) {
      logger.error('Error refreshing data:', error);
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
