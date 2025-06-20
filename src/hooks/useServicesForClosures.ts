
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useServiceTransformer } from './services/useServiceTransformer';

interface UseServicesForClosuresOptions {
  dateFrom?: Date;
  dateTo?: Date;
}

export const useServicesForClosures = (options: UseServicesForClosuresOptions = {}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();
  const { toast } = useToast();
  const { dateFrom, dateTo } = options;

  const fetchAvailableServices = async () => {
    try {
      setLoading(true);
      console.log('Fetching available services for closures with date filter:', { dateFrom, dateTo });
      
      // Build the query for completed services
      let servicesQuery = supabase
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

      // Add date range filter if provided
      if (dateFrom) {
        servicesQuery = servicesQuery.gte('service_date', dateFrom.toISOString().split('T')[0]);
      }
      if (dateTo) {
        servicesQuery = servicesQuery.lte('service_date', dateTo.toISOString().split('T')[0]);
      }

      const { data: servicesData, error: servicesError } = await servicesQuery;

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        throw servicesError;
      }

      console.log('Completed services found:', servicesData?.length);

      // Get all service IDs that are already included in closures
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select('service_id');

      if (closureError) {
        console.error('Error fetching closure services:', closureError);
        throw closureError;
      }

      // Get all service IDs that are already invoiced
      const { data: invoicedServices, error: invoiceError } = await supabase
        .from('invoice_services')
        .select('service_id');

      if (invoiceError) {
        console.error('Error fetching invoiced services:', invoiceError);
        throw invoiceError;
      }

      const usedServiceIds = new Set(closureServices?.map(cs => cs.service_id) || []);
      const invoicedServiceIds = new Set(invoicedServices?.map(is => is.service_id) || []);

      console.log('Services already in closures:', usedServiceIds.size);
      console.log('Services already invoiced:', invoicedServiceIds.size);

      // Filter out services that are already in closures OR already invoiced
      const availableServicesData = servicesData?.filter(service => 
        !usedServiceIds.has(service.id) && !invoicedServiceIds.has(service.id)
      ) || [];

      console.log('Available services for new closures:', availableServicesData.length);

      // Transform the raw data to match the Service type
      const transformedServices = transformRawServiceData(availableServicesData);
      setServices(transformedServices);
    } catch (error: any) {
      console.error('Error fetching available services for closures:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles para cierre.",
      });
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableServices();
  }, [dateFrom, dateTo]);

  return {
    services,
    loading,
    refetch: fetchAvailableServices
  };
};
