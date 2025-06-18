
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useServiceTransformer } from './services/useServiceTransformer';

export const useServicesForClosures = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();

  const fetchAvailableServices = async () => {
    try {
      setLoading(true);
      console.log('Fetching available services for closures...');
      
      // First, get all completed services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          clients!inner(id, name, rut, phone, email, address, is_active),
          cranes!inner(id, license_plate, brand, model, type, is_active),
          operators!inner(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
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
      const availableServicesData = servicesData?.filter(service => 
        !usedServiceIds.has(service.id)
      ) || [];

      console.log('Available services for new closures:', availableServicesData.length);

      // Transform the raw data to match the Service type
      const transformedServices = transformRawServiceData(availableServicesData);
      setServices(transformedServices);
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
