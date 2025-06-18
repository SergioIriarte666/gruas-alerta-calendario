
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useServicesForClosures = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAvailableServices = async () => {
    try {
      setLoading(true);
      console.log('Fetching available services for closures...');
      
      // First, get all completed services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          client:clients(id, name, rut),
          crane:cranes(id, license_plate, brand, model),
          operator:operators(id, name),
          service_type:service_types(id, name)
        `)
        .eq('status', 'completed')
        .order('service_date', { ascending: false });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        throw servicesError;
      }

      console.log('All completed services:', servicesData?.length);

      // Get all service IDs that are already included in closures
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select('service_id');

      if (closureError) {
        console.error('Error fetching closure services:', closureError);
        throw closureError;
      }

      const usedServiceIds = new Set(closureServices?.map(cs => cs.service_id) || []);
      console.log('Services already in closures:', usedServiceIds.size);

      // Filter out services that are already in closures
      const availableServices = servicesData?.filter(service => 
        !usedServiceIds.has(service.id)
      ) || [];

      console.log('Available services for new closures:', availableServices.length);

      setServices(availableServices);
    } catch (error: any) {
      console.error('Error fetching available services for closures:', error);
      toast.error("Error", {
        description: "No se pudieron cargar los servicios disponibles para cierre.",
      });
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableServices();
  }, []);

  return {
    services,
    loading,
    refetch: fetchAvailableServices
  };
};
