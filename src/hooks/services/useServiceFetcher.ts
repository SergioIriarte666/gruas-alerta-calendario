import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { useServiceTransformer } from './useServiceTransformer';

export const useServiceFetcher = () => {
  const [loading, setLoading] = useState(true);
  const { transformRawServiceData } = useServiceTransformer();

  const fetchServices = async (): Promise<Service[]> => {
    try {
      console.log('Fetching services with joins...');
      setLoading(true);
      
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          clients(id, name, rut, phone, email, address, is_active),
          cranes(id, license_plate, brand, model, type, is_active),
          operators(id, name, rut, phone, license_number, is_active),
          service_types(id, name, description, is_active)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching services:', error);
        throw error;
      }

      console.log('Raw services data:', data);

      if (!data || data.length === 0) {
        console.log('No services found');
        return [];
      }

      const formattedServices = transformRawServiceData(data);
      console.log('Formatted services:', formattedServices);
      return formattedServices;

    } catch (error: any) {
      console.error('Error in fetchServices:', error);
      toast.error("Error", {
        description: "No se pudieron cargar los servicios.",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchServices,
    loading
  };
};
