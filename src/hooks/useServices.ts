
import { useState, useEffect } from 'react';
import { Service, ServiceFormData } from '@/types';
import { useServiceFetcher } from './services/useServiceFetcher';
import { useServiceManager } from './services/useServiceManager';
import { useQueryClient } from '@tanstack/react-query';
import { refreshAllServiceData } from '@/utils/globalDataRefresh';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const { fetchServices, loading } = useServiceFetcher();
  const { createService: createServiceMutation, updateService: updateServiceMutation, deleteService: deleteServiceMutation } = useServiceManager();
  const queryClient = useQueryClient();

  const loadServices = async () => {
    const loadedServices = await fetchServices();
    setServices(loadedServices);
  };

  useEffect(() => {
    loadServices();

    // Listen for invoice events to refresh services
    const handleInvoiceEvent = () => {
      refreshAllServiceData(queryClient);
      loadServices();
    };

    // Listen for global refresh events
    const handleGlobalRefresh = () => {
      loadServices();
    };

    window.addEventListener('invoice-created', handleInvoiceEvent);
    window.addEventListener('invoice-deleted', handleInvoiceEvent);
    window.addEventListener('global-data-refresh', handleGlobalRefresh);

    return () => {
      window.removeEventListener('invoice-created', handleInvoiceEvent);
      window.removeEventListener('invoice-deleted', handleInvoiceEvent);
      window.removeEventListener('global-data-refresh', handleGlobalRefresh);
    };
  }, [queryClient]);

  // Nueva función para obtener servicios filtrados para dropdown de costos
  const getServicesForCosts = () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return services
      .filter(service => {
        const serviceDate = new Date(service.serviceDate);
        return serviceDate >= sixMonthsAgo;
      })
      .sort((a, b) => {
        const dateA = new Date(a.serviceDate);
        const dateB = new Date(b.serviceDate);
        return dateB.getTime() - dateA.getTime(); // Orden descendente (más recientes primero)
      });
  };

  const createService = async (serviceData: ServiceFormData): Promise<Service> => {
    const newService = await createServiceMutation(serviceData);
    await loadServices();
    return newService;
  };

  const updateService = async (id: string, serviceData: Partial<ServiceFormData>): Promise<Service> => {
    const updatedService = await updateServiceMutation(id, serviceData);
    await loadServices();
    return updatedService;
  };

  const deleteService = async (id: string): Promise<void> => {
    await deleteServiceMutation(id);
    setServices(prev => prev.filter(service => service.id !== id));
  };

  const forceGlobalRefresh = async () => {
    await refreshAllServiceData(queryClient);
    await loadServices();
  };

  return {
    services,
    loading,
    createService,
    updateService,
    deleteService,
    refetch: loadServices,
    forceGlobalRefresh,
    getServicesForCosts
  };
};