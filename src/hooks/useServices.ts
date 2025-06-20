
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { useServiceFetcher } from './services/useServiceFetcher';
import { useServiceMutations } from './services/useServiceMutations';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const { fetchServices, loading } = useServiceFetcher();
  const { createService: createServiceMutation, updateService: updateServiceMutation, deleteService: deleteServiceMutation } = useServiceMutations();

  const loadServices = async () => {
    const loadedServices = await fetchServices();
    setServices(loadedServices);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const createService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> & { folio: string }) => {
    const newService = await createServiceMutation(serviceData);
    setServices(prev => [newService, ...prev]);
    return newService;
  };

  const updateService = async (id: string, serviceData: Partial<Service>) => {
    const updatedData = await updateServiceMutation(id, serviceData);
    setServices(prev => prev.map(service => 
      service.id === id 
        ? { ...service, ...updatedData }
        : service
    ));
    // Force refresh to ensure data consistency
    await loadServices();
  };

  const deleteService = async (id: string) => {
    await deleteServiceMutation(id);
    setServices(prev => prev.filter(service => service.id !== id));
  };

  return {
    services,
    loading,
    createService,
    updateService,
    deleteService,
    refetch: loadServices
  };
};
