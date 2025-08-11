
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
    console.log('🔄 Loading services from Supabase...');
    const loadedServices = await fetchServices();
    console.log(`📊 Loaded ${loadedServices.length} services from database`);
    setServices(loadedServices);
  };

  useEffect(() => {
    loadServices();

    // Listen for invoice events to refresh services
    const handleInvoiceEvent = () => {
      console.log('Invoice event detected, refreshing all service data...');
      refreshAllServiceData(queryClient);
      loadServices();
    };

    // Listen for global refresh events
    const handleGlobalRefresh = () => {
      console.log('Global refresh event detected, reloading services...');
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
    console.log('🎯 useServices: Creating service with data:', serviceData.folio);
    
    const newService = await createServiceMutation(serviceData);
    console.log('✅ useServices: Service created successfully, updating local state:', newService.folio);
    
    // Update local state immediately
    setServices(prev => [newService, ...prev]);
    
    // Force refresh from database after a short delay to ensure consistency
    setTimeout(async () => {
      console.log('🔄 useServices: Force refreshing services after creation...');
      await loadServices();
    }, 1000);
    
    return newService;
  };

  const updateService = async (id: string, serviceData: Partial<ServiceFormData>): Promise<Service> => {
    const updatedService = await updateServiceMutation(id, serviceData);
    setServices(prev => prev.map(service => 
      service.id === id 
        ? updatedService
        : service
    ));
    // Force refresh to ensure data consistency
    await loadServices();
    return updatedService;
  };

  const deleteService = async (id: string): Promise<void> => {
    await deleteServiceMutation(id);
    setServices(prev => prev.filter(service => service.id !== id));
  };

  const forceGlobalRefresh = async () => {
    console.log('🔄 Forzando refresh global desde useServices...');
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