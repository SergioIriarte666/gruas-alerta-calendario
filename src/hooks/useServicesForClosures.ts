import { useState, useEffect, useCallback, useRef } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';

import { toLocalDateString } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServicesForClosures");
interface UseServicesForClosuresOptions {
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  enabled?: boolean;
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
  const { toast } = useToast();
  const { dateFrom, dateTo, searchTerm = '', enabled = true } = options;
  
  // Flag to indicate if this is a global search (no date filter)
  const isGlobalSearch = !dateFrom && !dateTo;

  const fetchIdRef = useRef(0);

  const fetchServicesData = async () => {
    const fetchId = ++fetchIdRef.current;

    try {
      setLoading(true);

      const normalizedSearch = searchTerm.trim();
      const hasSearch = normalizedSearch.length > 0;
      const safeSearchTerm = normalizedSearch.replace(/,/g, ' ');
      const searchPattern = `%${safeSearchTerm}%`;
      const serviceSearchFilter = `purchase_order.ilike.${searchPattern},purchase_order_number.ilike.${searchPattern},folio.ilike.${searchPattern},license_plate.ilike.${searchPattern},vehicle_brand.ilike.${searchPattern},vehicle_model.ilike.${searchPattern},origin.ilike.${searchPattern},destination.ilike.${searchPattern}`;

      const baseServiceSelect = `
        id,
        folio,
        request_date,
        service_date,
        client_id,
        purchase_order,
        purchase_order_number,
        quote_number,
        vehicle_brand,
        vehicle_model,
        license_plate,
        origin,
        destination,
        value,
        operator_commission,
        status,
        has_excess,
        client_covered_amount,
        excess_amount,
        custody_mode,
        custody_total_amount,
        custody_days,
        custody_daily_rate,
        custody_start_date,
        custody_end_date,
        created_by,
        created_at,
        updated_at,
        client:clients!services_client_id_fkey(id, name),
        third_party_client:clients!services_third_party_client_id_fkey(id, name)
      `;

      let billableQuery = supabase
        .from('services')
        .select(baseServiceSelect)
        .in('status', ['completed', 'with_purchase_order', 'failed']);

      let pendingQuery = supabase
        .from('services')
        .select(baseServiceSelect)
        .eq('status', 'pending');

      // Add explicit date range filter only when the user selects dates
      if (dateFrom) {
        billableQuery = billableQuery.gte('service_date', toLocalDateString(dateFrom));
        pendingQuery = pendingQuery.gte('service_date', toLocalDateString(dateFrom));
      }
      if (dateTo) {
        billableQuery = billableQuery.lte('service_date', toLocalDateString(dateTo));
        pendingQuery = pendingQuery.lte('service_date', toLocalDateString(dateTo));
      }

      // In global mode, avoid loading massive datasets until user searches
      if (isGlobalSearch && !hasSearch) {
        billableQuery = billableQuery.order('service_date', { ascending: false }).limit(80);
        pendingQuery = pendingQuery.order('service_date', { ascending: false }).limit(40);
      } else {
        billableQuery = billableQuery.order('service_date', { ascending: false }).limit(180);
        pendingQuery = pendingQuery.order('service_date', { ascending: false }).limit(80);
      }

      // Server-side search for heavy datasets
      if (hasSearch) {
        billableQuery = billableQuery.or(serviceSearchFilter);
        pendingQuery = pendingQuery.or(serviceSearchFilter);
      }

      const [billableResult, pendingResult] = await Promise.all([
        billableQuery,
        pendingQuery
      ]);

      if (billableResult.error) {
        logger.error('Error fetching billable services:', billableResult.error);
        throw billableResult.error;
      }

      if (pendingResult.error) {
        logger.error('Error fetching pending services:', pendingResult.error);
        throw pendingResult.error;
      }

      const billableServices = billableResult.data || [];
      const pendingServices = pendingResult.data || [];


      // Get only service IDs from the current candidate set that are already included in closures
      const currentBillableIds = billableServices.map(service => service.id);
      let usedServiceIds = new Set<string>();

      if (currentBillableIds.length > 0) {
        const { data: closureServices, error: closureError } = await supabase
          .from('closure_services')
          .select('service_id')
          .in('service_id', currentBillableIds);

        if (closureError) {
          logger.error('Error fetching closure services:', closureError);
        }

        usedServiceIds = new Set(closureServices?.map(cs => cs.service_id) || []);
      }

      // Filter out services that are already in closures
      const availableBillableServices = billableServices.filter(service => !usedServiceIds.has(service.id));

      const nowIso = new Date().toISOString();
      const mapServiceForClosure = (item: any): Service => ({
        id: item.id,
        folio: item.folio || 'Sin folio',
        requestDate: item.request_date || item.service_date || nowIso,
        serviceDate: item.service_date || item.request_date || nowIso,
        client: {
          id: item.client?.id || item.third_party_client?.id || item.client_id || '',
          name: item.client?.name || item.third_party_client?.name || 'Cliente no disponible',
          rut: '',
          phone: '',
          email: '',
          address: '',
          department: '',
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        purchaseOrder: item.purchase_order || '',
        purchaseOrderNumber: item.purchase_order_number || '',
        quoteNumber: item.quote_number || '',
        vehicleBrand: item.vehicle_brand || '',
        vehicleModel: item.vehicle_model || '',
        licensePlate: item.license_plate || '',
        origin: item.origin || '',
        destination: item.destination || '',
        serviceType: {
          id: '',
          name: 'Tipo no disponible',
          description: '',
          basePrice: 0,
          isActive: true,
          vehicleInfoOptional: false,
          purchaseOrderRequired: false,
          originRequired: true,
          destinationRequired: true,
          craneRequired: false,
          operatorRequired: false,
          vehicleBrandRequired: false,
          vehicleModelRequired: false,
          licensePlateRequired: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        value: Number(item.value || 0),
        crane: null,
        operator: null,
        operatorCommission: Number(item.operator_commission || 0),
        status: item.status || 'pending',
        observations: '',
        hasExcess: Boolean(item.has_excess),
        clientCoveredAmount: item.client_covered_amount ?? null,
        excessAmount: Number(item.excess_amount || 0),
        custodyMode: item.custody_mode || 'none',
        custodyTotalAmount: parseFloat(item.custody_total_amount) || 0,
        custodyDays: item.custody_days || 0,
        custodyDailyRate: parseFloat(item.custody_daily_rate) || 0,
        custodyStartDate: item.custody_start_date || null,
        custodyEndDate: item.custody_end_date || null,
        createdAt: item.created_at || nowIso,
        updatedAt: item.updated_at || nowIso,
        createdBy: item.created_by || undefined,
      });

      const transformedBillable = availableBillableServices.map(mapServiceForClosure);
      const transformedPending = pendingServices.map(mapServiceForClosure);

      if (fetchId !== fetchIdRef.current) return;

      setData({
        availableServices: transformedBillable,
        pendingServices: transformedPending,
        usedServiceIds,
        totalCompleted: billableServices.length
      });
    } catch (error: any) {
      logger.error('Error fetching services data for closures:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles para cierre.",
      });
      if (fetchId === fetchIdRef.current) {
        setData({
          availableServices: [],
          pendingServices: [],
          usedServiceIds: new Set(),
          totalCompleted: 0
        });
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
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
      logger.error('Error completing service:', error);
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
      logger.error('Error completing services:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron completar los servicios.",
      });
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchServicesData();
  }, [dateFrom, dateTo, searchTerm, enabled]);

  // Refetch function that forces fresh data
  const refetchWithDebug = async () => {
    if (!enabled) return;

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
      const searchPattern = `%${searchTerm.trim()}%`;

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
                invoice:invoices!fk_invoice_closures_invoice_id(
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
        logger.error('❌ [Hook] Error searching processed services:', error);
        setProcessedServices([]);
        return;
      }

      

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
      logger.error('Error in searchProcessedServices:', error);
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