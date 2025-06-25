
import { useUser } from '@/contexts/UserContext';
import { useOperatorServices } from './useOperatorServices';
import { Service } from '@/types';
import { useMemo } from 'react';

export const useOperatorServicesTabs = () => {
  const { user } = useUser();
  const { data: allServices, isLoading, error, refetch } = useOperatorServices(user?.id);

  const serviceTabs = useMemo(() => {
    if (!allServices) {
      return {
        asignados: [],
        activos: [],
        completados: []
      };
    }

    return {
      asignados: allServices.filter((service: Service) => service.status === 'pending'),
      activos: allServices.filter((service: Service) => service.status === 'in_progress'),
      completados: allServices.filter((service: Service) => service.status === 'completed')
    };
  }, [allServices]);

  return {
    serviceTabs,
    isLoading,
    error,
    refetch,
    totalCount: allServices?.length || 0
  };
};
