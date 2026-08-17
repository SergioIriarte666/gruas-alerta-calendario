import { businessClock } from '@/utils/businessClock';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';

import { toLocalDateString } from '@/utils/timezoneUtils';
import {
  completeServiceByFolio,
  completeServicesByFolio,
  type ServiceCloseTarget,
} from '@/utils/serviceCompletion';
import { createLogger } from "@/lib/logger";
import {
  CLOSURE_CANDIDATE_STATUSES,
  ClosureValueType,
  EXCESS_ROW_SUFFIX,
  getClosureValueKey,
  isClosureValueAvailable,
} from '@/utils/closureBilling';


const logger = createLogger("useServicesForClosures");
interface UseServicesForClosuresOptions {
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  enabled?: boolean;
}

export { EXCESS_ROW_SUFFIX } from '@/utils/closureBilling';

export interface ClosureServiceRow extends Service {
  _closureType?: ClosureValueType;
  _closureAmount?: number;
  // Presente si el servicio tiene una disputa abierta: no debe ser seleccionable para cierre.
  _disputeReason?: string;
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
        third_party_client_id,
        client:clients!services_client_id_fkey(id, name, rut),
        third_party_client:clients!services_third_party_client_id_fkey(id, name, rut)
      `;

      let billableQuery = supabase
        .from('services')
        .select(baseServiceSelect)
        .in('status', [...CLOSURE_CANDIDATE_STATUSES]);

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


      // Get service+value_type pairs from the current candidate set already included in closures.
      // Un servicio con excedente puede estar usado como 'covered' en un cierre y seguir
      // disponible como 'excess' para otro (y viceversa).
      const currentBillableIds = billableServices.map(service => service.id);
      const usedServiceIds = new Set<string>();
      const usedKeys = new Set<string>();

      if (currentBillableIds.length > 0) {
        const { data: closureServices, error: closureError } = await supabase
          .from('closure_services')
          .select('service_id, value_type')
          .in('service_id', currentBillableIds);

        if (closureError) {
          logger.error('Error fetching closure services:', closureError);
        }

        (closureServices || []).forEach((cs: any) => {
          usedServiceIds.add(cs.service_id);
          usedKeys.add(getClosureValueKey(cs.service_id, cs.value_type || 'covered'));
        });
      }

      // Servicios con disputa abierta: se muestran deshabilitados con aviso, no se excluyen
      // de la lista (a diferencia de usedKeys) para que el usuario vea por qué no puede elegirlos.
      const disputedByServiceId = new Map<string, string>();
      if (currentBillableIds.length > 0) {
        const { data: openDisputes, error: disputesError } = await supabase
          .from('service_disputes')
          .select('service_id, description')
          .eq('status', 'open')
          .in('service_id', currentBillableIds);

        if (disputesError) {
          logger.warn('Error fetching open disputes for closures:', disputesError);
        } else {
          (openDisputes || []).forEach((d: any) => disputedByServiceId.set(d.service_id, d.description));
        }
      }

      const nowIso = businessClock.nowISO();
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

      // Expande servicios con excedente + tercero pagador en dos filas virtuales:
      // una 'covered' (cliente principal, monto cubierto) y una 'excess'
      // (tercero pagador, excedente). La fila excess usa id virtual `${id}::excess`.
      const expandServiceRows = (item: any): ClosureServiceRow[] => {
        const base = mapServiceForClosure(item) as ClosureServiceRow;
        const excessAmount = Number(item.excess_amount || 0);
        const canSplit = Boolean(item.has_excess && item.third_party_client_id && excessAmount > 0);
        const disputeReason = disputedByServiceId.get(item.id);

        if (!canSplit) {
          return [{ ...base, _disputeReason: disputeReason }];
        }

        const coveredRow: ClosureServiceRow = {
          ...base,
          client: {
            ...base.client,
            id: item.client?.id || item.client_id || '',
            name: item.client?.name || 'Cliente no disponible',
            rut: item.client?.rut || '',
          },
          _closureType: 'covered',
          _closureAmount: Number(item.client_covered_amount || 0),
          _disputeReason: disputeReason,
        };

        const excessRow: ClosureServiceRow = {
          ...base,
          id: `${item.id}${EXCESS_ROW_SUFFIX}`,
          client: {
            ...base.client,
            id: item.third_party_client?.id || item.third_party_client_id,
            name: item.third_party_client?.name || 'Tercero excedente',
            rut: item.third_party_client?.rut || '',
          },
          // La fila excedente se comporta como servicio simple por su monto excedente
          // para que totales y visualización usen excess_amount.
          value: excessAmount,
          hasExcess: false,
          clientCoveredAmount: null,
          excessAmount: 0,
          custodyTotalAmount: 0,
          _closureType: 'excess',
          _closureAmount: excessAmount,
          _disputeReason: disputeReason,
        };

        return [
          coveredRow,
          excessRow,
        ];
      };

      const transformedBillable = billableServices
        .flatMap(item => expandServiceRows(item).filter(row =>
          isClosureValueAvailable({
            serviceId: item.id,
            status: item.status,
            hasExcess: Boolean(item.has_excess),
            thirdPartyClientId: item.third_party_client_id,
            excessAmount: Number(item.excess_amount || 0),
            valueType: row._closureType || 'covered',
            usedKeys,
          })
        ));
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

  const completeService = async (target: ServiceCloseTarget) => {
    try {
      await completeServiceByFolio(target);

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
        description: error?.message || "No se pudo completar el servicio.",
      });
    }
  };

  const completeMultipleServices = async (targets: ServiceCloseTarget[]) => {
    const { successCount, errorCount, firstError } = await completeServicesByFolio(targets);

    // Refresh data after completing services
    await fetchServicesData();

    if (errorCount === 0) {
      toast({
        type: "success",
        title: "Servicios completados",
        description: `${successCount} servicio(s) han sido marcados como completados.`,
      });
    } else if (successCount === 0) {
      logger.error('Error completing services:', firstError);
      toast({
        type: "error",
        title: "Error",
        description: firstError || "No se pudieron completar los servicios.",
      });
    } else {
      logger.error('Error completing some services:', firstError);
      toast({
        type: "warning",
        title: `${successCount} completado(s), ${errorCount} con error`,
        description: firstError || undefined,
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
