
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceType {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useServiceTypes = () => {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServiceTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error loading service types:', error);
        return;
      }

      const formattedServiceTypes: ServiceType[] = (data || []).map(serviceType => ({
        id: serviceType.id,
        name: serviceType.name,
        description: serviceType.description,
        basePrice: serviceType.base_price,
        isActive: serviceType.is_active,
        createdAt: serviceType.created_at,
        updatedAt: serviceType.updated_at
      }));

      setServiceTypes(formattedServiceTypes);
    } catch (error) {
      console.error('Error loading service types:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceTypes();
  }, []);

  return {
    serviceTypes,
    loading,
    loadServiceTypes
  };
};
