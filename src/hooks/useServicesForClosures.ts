
import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useServicesForClosures = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchServicesForClosures = async () => {
    try {
      console.log('Fetching services for closures (simplified)...');
      setLoading(true);
      
      // Fetch only essential data for closures to improve performance
      const { data, error } = await supabase
        .from('services')
        .select(`
          id,
          folio,
          service_date,
          value,
          status,
          clients!inner(id, name),
          service_types!inner(id, name)
        `)
        .eq('status', 'closed')
        .order('service_date', { ascending: false })
        .limit(100); // Limit results for better performance

      if (error) {
        console.error('Error fetching services for closures:', error);
        throw error;
      }

      console.log('Services for closures fetched:', data?.length || 0);

      if (!data || data.length === 0) {
        console.log('No closed services found for closures');
        setServices([]);
        return;
      }

      const formattedServices: Service[] = data.map(service => ({
        id: service.id,
        folio: service.folio,
        serviceDate: service.service_date,
        value: Number(service.value),
        status: service.status as Service['status'],
        client: {
          id: service.clients.id,
          name: service.clients.name,
          rut: '',
          phone: '',
          email: '',
          address: '',
          isActive: true,
          createdAt: '',
          updatedAt: ''
        },
        serviceType: {
          id: service.service_types.id,
          name: service.service_types.name,
          description: '',
          isActive: true,
          createdAt: '',
          updatedAt: ''
        },
        // Minimal required fields for closures
        requestDate: service.service_date,
        purchaseOrder: '',
        vehicleBrand: '',
        vehicleModel: '',
        licensePlate: '',
        origin: '',
        destination: '',
        crane: {
          id: '',
          licensePlate: '',
          brand: '',
          model: '',
          type: 'mobile',
          isActive: true,
          createdAt: '',
          updatedAt: '',
          circulationPermitExpiry: '',
          insuranceExpiry: '',
          technicalReviewExpiry: ''
        },
        operator: {
          id: '',
          name: '',
          rut: '',
          phone: '',
          licenseNumber: '',
          isActive: true,
          createdAt: '',
          updatedAt: '',
          examExpiry: ''
        },
        operatorCommission: 0,
        observations: '',
        createdAt: '',
        updatedAt: ''
      }));

      console.log('Formatted services for closures:', formattedServices.length);
      setServices(formattedServices);
    } catch (error: any) {
      console.error('Error in fetchServicesForClosures:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios para cierres.",
        variant: "destructive",
      });
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesForClosures();
  }, []);

  return {
    services,
    loading,
    refetch: fetchServicesForClosures
  };
};
