
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useServiceTransformer } from './services/useServiceTransformer';

export const useServicesForInvoices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();
  const { toast } = useToast();

  const fetchAvailableServicesForInvoices = async () => {
    try {
      setLoading(true);
      console.log('Fetching services available for invoicing...');
      
      // Obtener servicios completados que NO estén facturados (status != 'invoiced')
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          clients!inner(id, name, rut, phone, email, address, is_active),
          cranes!inner(id, license_plate, brand, model, type, is_active),
          operators!inner(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
        `)
        .eq('status', 'completed')  // Solo servicios completados
        .order('service_date', { ascending: false });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        throw servicesError;
      }

      console.log('Available services for invoicing (completed, not invoiced):', servicesData?.length);
      console.log('Available service folios:', servicesData?.map(s => s.folio).join(', '));

      const transformedServices = transformRawServiceData(servicesData || []);
      setServices(transformedServices);
    } catch (error: any) {
      console.error('Error fetching available services for invoices:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles para facturación.",
      });
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableServicesForInvoices();
  }, []);

  return {
    services,
    loading,
    refetch: fetchAvailableServicesForInvoices
  };
};
