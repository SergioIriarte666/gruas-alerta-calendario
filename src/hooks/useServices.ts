import { parseDateValue } from '@/utils/calendarDate';

import { Service, ServiceFormData } from '@/types';
import { useServiceFetcher } from './services/useServiceFetcher';
import { useServiceManager } from './services/useServiceManager';
import { useQueryClient } from '@tanstack/react-query';
import { refreshAllServiceData } from '@/utils/globalDataRefresh';
import { businessClock } from '@/utils/businessClock';

interface CreateServiceOptions {
  silent?: boolean;
  tolerateResourceSyncFailure?: boolean;
  skipInvalidation?: boolean;
  skipRefetch?: boolean;
}

interface UpdateServiceOptions {
  silent?: boolean;
  skipInvalidation?: boolean;
  skipRefetch?: boolean;
}

export const useServices = () => {
  const { services, loading, refetch } = useServiceFetcher();
  const { createService: createServiceMutation, updateService: updateServiceMutation, deleteService: deleteServiceMutation } = useServiceManager();
  const queryClient = useQueryClient();

  const getServicesForCosts = () => {
    const sixMonthsAgo = businessClock.todayDate();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return services
      .filter(service => {
        const serviceDate = parseDateValue(service.serviceDate);
        return serviceDate >= sixMonthsAgo;
      })
      .sort((a, b) => parseDateValue(b.serviceDate).getTime() - parseDateValue(a.serviceDate).getTime());
  };

  const createService = async (serviceData: ServiceFormData, options?: CreateServiceOptions): Promise<Service> => {
    const newService = await createServiceMutation(serviceData, options);
    if (!options?.skipRefetch) {
      await refetch();
    }
    return newService;
  };

  const updateService = async (
    id: string,
    serviceData: Partial<ServiceFormData>,
    options?: UpdateServiceOptions
  ): Promise<Service> => {
    const updatedService = await updateServiceMutation(id, serviceData, options);
    if (!options?.skipRefetch) {
      await refetch();
    }
    return updatedService;
  };

  const deleteService = async (id: string): Promise<void> => {
    await deleteServiceMutation(id);
    await refetch();
  };

  const forceGlobalRefresh = async () => {
    await refreshAllServiceData(queryClient);
    await refetch();
  };

  return {
    services,
    loading,
    createService,
    updateService,
    deleteService,
    refetch: async () => { await refetch(); },
    forceGlobalRefresh,
    getServicesForCosts
  };
};
