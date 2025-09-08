import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useServiceTransformer } from './services/useServiceTransformer';

interface UseServicesForClosuresOptions {
  dateFrom?: Date;
  dateTo?: Date;
}

interface ServicesForClosuresData {
  availableServices: Service[];
  pendingServices: Service[];
  usedServiceIds: Set<string>;
  totalCompleted: number;
}

export const useServicesForClosures = (options: UseServicesForClosuresOptions = {}) => {
  const [data, setData] = useState<ServicesForClosuresData>({
    availableServices: [],
    pendingServices: [],
    usedServiceIds: new Set(),
    totalCompleted: 0
  });
  const [loading, setLoading] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();
  const { toast } = useToast();
  const { dateFrom, dateTo } = options;

  const fetchServicesData = async () => {
    try {
      setLoading(true);
      console.log('Fetching services data for closures with date filter:', { dateFrom, dateTo });
      
      // Build the query for billable services (completed and with purchase order)
      let billableQuery = supabase
        .from('services')
        .select(`
          *,
          clients!inner(id, name, rut, phone, email, address, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
        `)
        .in('status', ['completed', 'with_purchase_order'])
        .order('folio', { ascending: true });

      // Build the query for pending services
      let pendingQuery = supabase
        .from('services')
        .select(`
          *,
          clients!inner(id, name, rut, phone, email, address, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
        `)
        .eq('status', 'pending')
        .order('folio', { ascending: true });

      // Add date range filter if provided
      if (dateFrom) {
        billableQuery = billableQuery.gte('service_date', dateFrom.toISOString().split('T')[0]);
        pendingQuery = pendingQuery.gte('service_date', dateFrom.toISOString().split('T')[0]);
      }
      if (dateTo) {
        billableQuery = billableQuery.lte('service_date', dateTo.toISOString().split('T')[0]);
        pendingQuery = pendingQuery.lte('service_date', dateTo.toISOString().split('T')[0]);
      }

      const [billableResult, pendingResult] = await Promise.all([
        billableQuery,
        pendingQuery
      ]);

      if (billableResult.error) {
        console.error('Error fetching billable services:', billableResult.error);
        throw billableResult.error;
      }

      if (pendingResult.error) {
        console.error('Error fetching pending services:', pendingResult.error);
        throw pendingResult.error;
      }

      const billableServices = billableResult.data || [];
      const pendingServices = pendingResult.data || [];

      console.log('Billable services found (completed + with purchase order):', billableServices.length);
      console.log('Pending services found:', pendingServices.length);

      // Get all service IDs that are already included in closures
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select('service_id');

      if (closureError) {
        console.error('Error fetching closure services:', closureError);
      }

      const usedServiceIds = new Set(closureServices?.map(cs => cs.service_id) || []);
      console.log('Services already in closures:', usedServiceIds.size);

      // Filter out services that are already in closures
      const availableBillableServices = billableServices.filter(service => {
        const isInClosure = usedServiceIds.has(service.id);
        const isAvailable = !isInClosure;
        
        console.log(`Service ${service.folio} (${service.id}): status=${service.status}, inClosure=${isInClosure}, available=${isAvailable}`);
        
        return isAvailable;
      });

      console.log('Available billable services for new closures:', availableBillableServices.length);

      // Transform the raw data to match the Service type
      const transformedBillable = transformRawServiceData(availableBillableServices);
      const transformedPending = transformRawServiceData(pendingServices);
      
      // Debug logging for service 3027694-3 after transformation
      const targetService = transformedBillable.find(s => s.folio === '3027694-3') || transformedPending.find(s => s.folio === '3027694-3');
      if (targetService) {
        console.log('🔍 USESERVICESFORCLOSURES DEBUG - Service 3027694-3 after transformation:', {
          folio: targetService.folio,
          hasExcess: targetService.hasExcess,
          clientCoveredAmount: targetService.clientCoveredAmount,
          value: targetService.value,
          fromAvailable: transformedBillable.find(s => s.folio === '3027694-3') !== undefined
        });
      }

      setData({
        availableServices: transformedBillable,
        pendingServices: transformedPending,
        usedServiceIds,
        totalCompleted: billableServices.length
      });
    } catch (error: any) {
      console.error('Error fetching services data for closures:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles para cierre.",
      });
      setData({
        availableServices: [],
        pendingServices: [],
        usedServiceIds: new Set(),
        totalCompleted: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const completeService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .eq('id', serviceId);

      if (error) throw error;

      // Refresh data after completing service
      await fetchServicesData();
      
      toast({
        type: "success",
        title: "Servicio completado",
        description: "El servicio ha sido marcado como completado.",
      });
    } catch (error: any) {
      console.error('Error completing service:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo completar el servicio.",
      });
    }
  };

  const completeMultipleServices = async (serviceIds: string[]) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .in('id', serviceIds);

      if (error) throw error;

      // Refresh data after completing services
      await fetchServicesData();
      
      toast({
        type: "success",
        title: "Servicios completados",
        description: `${serviceIds.length} servicio(s) han sido marcados como completados.`,
      });
    } catch (error: any) {
      console.error('Error completing services:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron completar los servicios.",
      });
    }
  };

  useEffect(() => {
    fetchServicesData();
  }, [dateFrom, dateTo]);

  // Add refetch with debug logging and force fresh data
  const refetchWithDebug = async () => {
    console.log('🔄 FORCING DATA REFRESH - Invalidating cache and refetching...');
    setLoading(true);
    // Clear current data to force fresh fetch
    setData({
      availableServices: [],
      pendingServices: [],
      usedServiceIds: new Set(),
      totalCompleted: 0
    });
    await fetchServicesData();
  };

  return {
    services: data.availableServices,
    pendingServices: data.pendingServices,
    usedServiceIds: data.usedServiceIds,
    totalCompleted: data.totalCompleted,
    loading,
    completeService,
    completeMultipleServices,
    refetch: refetchWithDebug
  };
};