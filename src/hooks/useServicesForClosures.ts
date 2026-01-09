import { useState, useEffect, useCallback } from 'react';
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

// Interface for processed services (already in closures/invoiced)
export interface ProcessedServiceInfo {
  serviceId: string;
  serviceFolio: string;
  purchaseOrder: string | null;
  purchaseOrderNumber: string | null;
  clientName: string;
  closureId: string;
  closureFolio: string;
  invoiceId: string | null;
  invoiceFolio: string | null;
  invoiceNumeroFiscal: string | null;
  invoiceStatus: string | null;
}

export const useServicesForClosures = (options: UseServicesForClosuresOptions = {}) => {
  const [data, setData] = useState<ServicesForClosuresData>({
    availableServices: [],
    pendingServices: [],
    usedServiceIds: new Set(),
    totalCompleted: 0
  });
  const [loading, setLoading] = useState(false);
  const [processedServices, setProcessedServices] = useState<ProcessedServiceInfo[]>([]);
  const [searchingProcessed, setSearchingProcessed] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();
  const { toast } = useToast();
  const { dateFrom, dateTo } = options;
  
  // Flag to indicate if this is a global search (no date filter)
  const isGlobalSearch = !dateFrom && !dateTo;

  const fetchServicesData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching services data for closures with date filter:', { dateFrom, dateTo, isGlobalSearch });
      
      // If no dates provided, use last 90 days as default for performance
      let effectiveDateFrom = dateFrom;
      if (isGlobalSearch) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        effectiveDateFrom = ninetyDaysAgo;
        console.log('🔍 Global search mode: using last 90 days from', effectiveDateFrom);
      }
      
      // Build the query for billable services (completed and with purchase order)
      // SIMPLIFIED QUERY: Remove inner join that was filtering out services
      let billableQuery = supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!left(id, name, description, is_active)
        `)
        .in('status', ['completed', 'with_purchase_order', 'failed'])
        .order('folio', { ascending: true });

      // Build the query for pending services
      let pendingQuery = supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!left(id, name, description, is_active)
        `)
        .eq('status', 'pending')
        .order('folio', { ascending: true });

      // Add date range filter (either user-provided or 90-day default)
      if (effectiveDateFrom) {
        billableQuery = billableQuery.gte('service_date', effectiveDateFrom.toISOString().split('T')[0]);
        pendingQuery = pendingQuery.gte('service_date', effectiveDateFrom.toISOString().split('T')[0]);
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

      console.log('🔍 Billable services found (completed + with purchase order + failed):', billableServices.length);
      console.log('🔍 Raw billable services sample:', billableServices.slice(0, 2));
      console.log('🔍 Pending services found:', pendingServices.length);
      console.log('🔍 Raw pending services sample:', pendingServices.slice(0, 2));

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

  // Refetch function that forces fresh data
  const refetchWithDebug = async () => {
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

  // Search for services that are already processed (in closures/invoiced)
  const searchProcessedServices = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setProcessedServices([]);
      return;
    }

    try {
      setSearchingProcessed(true);
      console.log('🔍 [Hook] Searching processed services for:', searchTerm);

      const searchPattern = `%${searchTerm.trim()}%`;
      console.log('🔍 [Hook] Search pattern:', searchPattern);

      // Query services that are already in closures - using explicit FK relationship
      const { data: processedData, error } = await supabase
        .from('services')
        .select(`
          id,
          folio,
          purchase_order,
          purchase_order_number,
          license_plate,
          client:clients!services_client_id_fkey(id, name),
          closure_services!inner(
            closure:service_closures!inner(
              id,
              folio,
              invoice_closures!fk_invoice_closures_closure_id(
                invoice:invoices(
                  id,
                  folio,
                  numero_fiscal,
                  status
                )
              )
            )
          )
        `)
        .or(`purchase_order.ilike.${searchPattern},purchase_order_number.ilike.${searchPattern},folio.ilike.${searchPattern},license_plate.ilike.${searchPattern}`)
        .limit(10);

      if (error) {
        console.error('❌ [Hook] Error searching processed services:', error);
        setProcessedServices([]);
        return;
      }

      console.log('✅ [Hook] Processed services found:', processedData?.length || 0, processedData);

      // Transform data to ProcessedServiceInfo format
      const transformed: ProcessedServiceInfo[] = (processedData || []).map((service: any) => {
        const closureService = service.closure_services?.[0];
        const closure = closureService?.closure;
        const invoiceClosure = closure?.invoice_closures?.[0];
        const invoice = invoiceClosure?.invoice;

        return {
          serviceId: service.id,
          serviceFolio: service.folio,
          purchaseOrder: service.purchase_order,
          purchaseOrderNumber: service.purchase_order_number,
          clientName: service.client?.name || 'Cliente desconocido',
          closureId: closure?.id || '',
          closureFolio: closure?.folio || '',
          invoiceId: invoice?.id || null,
          invoiceFolio: invoice?.folio || null,
          invoiceNumeroFiscal: invoice?.numero_fiscal || null,
          invoiceStatus: invoice?.status || null
        };
      });

      setProcessedServices(transformed);
    } catch (error) {
      console.error('Error in searchProcessedServices:', error);
      setProcessedServices([]);
    } finally {
      setSearchingProcessed(false);
    }
  }, []);

  // Clear processed services
  const clearProcessedServices = useCallback(() => {
    setProcessedServices([]);
  }, []);

  return {
    services: data.availableServices,
    pendingServices: data.pendingServices,
    usedServiceIds: data.usedServiceIds,
    totalCompleted: data.totalCompleted,
    loading,
    completeService,
    completeMultipleServices,
    refetch: refetchWithDebug,
    isGlobalSearch,
    // New: processed services search
    processedServices,
    searchingProcessed,
    searchProcessedServices,
    clearProcessedServices
  };
};