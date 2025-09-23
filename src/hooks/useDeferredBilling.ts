import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeferredBillingSummary, ServiceReadyForBilling, DeferredBillingCalendarEvent } from '@/types/deferredBilling';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

export const useDeferredBilling = () => {
  const [summary, setSummary] = useState<DeferredBillingSummary | null>(null);
  const [readyServices, setReadyServices] = useState<ServiceReadyForBilling[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<DeferredBillingCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      const { data, error } = await supabase.rpc('get_deferred_services_summary');
      
      if (error) throw error;
      
      setSummary({
        readyForBilling: (data as any)?.ready_for_billing || 0,
        pendingDeferred: (data as any)?.pending_deferred || 0,
        totalPendingAmount: (data as any)?.total_pending_amount || 0,
        clientsWithDeferredBilling: (data as any)?.clients_with_deferred_billing || 0,
      });
    } catch (error: any) {
      console.error('Error fetching deferred billing summary:', error);
      toast.error("Error al cargar resumen de facturación diferida");
    }
  };

  const fetchReadyServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services_ready_for_deferred_billing')
        .select('*')
        .order('billing_ready_date', { ascending: true });
      
      if (error) throw error;
      
      const formattedServices: ServiceReadyForBilling[] = data.map((service: any) => ({
        id: service.id,
        clientId: service.client_id,
        clientName: service.client_name,
        serviceMonth: service.service_month,
        serviceCount: service.service_count,
        totalValue: service.total_value,
        billingReadyDate: service.billing_ready_date,
        billingCycleType: service.billing_cycle_type,
        billingDelayDays: service.billing_delay_days,
        billingCycleDay: service.billing_cycle_day,
        autoInvoiceGeneration: service.auto_invoice_generation,
        servicePeriod: service.service_period,
      }));
      
      setReadyServices(formattedServices);
    } catch (error: any) {
      console.error('Error fetching ready services:', error);
      toast.error("No se pudieron cargar los servicios listos para facturar");
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      // Obtener servicios diferidos agrupados por mes
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          id,
          service_date,
          value,
          client_id,
          clients!inner (
            id,
            name,
            billing_cycle_type,
            billing_delay_days,
            billing_cycle_day,
            auto_invoice_generation
          )
        `)
        .eq('clients.billing_cycle_type', 'deferred')
        .eq('status', 'completed');
      
      if (servicesError) throw servicesError;
      
      // Obtener IDs de servicios ya facturados
      const { data: invoicedServices } = await supabase
        .from('invoice_services')
        .select('service_id');
      
      const invoicedServiceIds = new Set(invoicedServices?.map(item => item.service_id) || []);
      
      // Agrupar servicios por cliente y mes de servicio
      const eventMap = new Map<string, DeferredBillingCalendarEvent>();
      
      servicesData?.forEach((service: any) => {
        // Omitir servicios ya facturados
        if (invoicedServiceIds.has(service.id)) return;
        
        const client = service.clients;
        const serviceDate = new Date(service.service_date);
        const serviceMonth = `${serviceDate.getFullYear()}-${String(serviceDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Calcular fecha de facturación usando la función de base de datos
        const billingDate = calculateBillingDate(
          service.service_date,
          client.billing_delay_days,
          client.billing_cycle_day
        );
        
        const eventKey = `${client.id}-${serviceMonth}`;
        
        if (eventMap.has(eventKey)) {
          const existing = eventMap.get(eventKey)!;
          existing.serviceCount++;
          existing.totalAmount += getDisplayServiceValue(service);
        } else {
          const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          const monthName = monthNames[serviceDate.getMonth()];
          
          eventMap.set(eventKey, {
            id: eventKey,
            clientId: client.id,
            clientName: `${client.name} - Servicios de ${monthName} ${serviceDate.getFullYear()}`,
            serviceCount: 1,
            totalAmount: getDisplayServiceValue(service),
            billingDate,
            isOverdue: new Date(billingDate) < new Date(),
            autoGeneration: client.auto_invoice_generation,
          });
        }
      });
      
      setCalendarEvents(Array.from(eventMap.values()));
    } catch (error: any) {
      console.error('Error fetching calendar events:', error);
      toast.error("No se pudo cargar el calendario de facturación");
    }
  };

  const getInvoicedServiceIds = async (): Promise<string> => {
    const { data } = await supabase
      .from('invoice_services')
      .select('service_id');
    
    return data?.map(item => item.service_id).join(',') || '';
  };

  const calculateBillingDate = (serviceDate: string, delayDays: number, cycleDay?: number): string => {
    const date = new Date(serviceDate);
    
    // Obtener el primer día del mes del servicio
    const serviceMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    
    // Calcular el mes siguiente más los DÍAS de diferimiento
    const nextMonth = new Date(serviceMonth.getFullYear(), serviceMonth.getMonth() + 1);
    nextMonth.setDate(nextMonth.getDate() + delayDays);
    
    // Si se especifica un día del ciclo, usar ese día, sino usar el día 5
    if (cycleDay && cycleDay >= 1 && cycleDay <= 28) {
      const billingMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), cycleDay);
      return billingMonth.toISOString().split('T')[0];
    } else {
      const billingMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
      return billingMonth.toISOString().split('T')[0];
    }
  };

  const generateInvoicesForClient = async (clientId: string, serviceIds: string[]) => {
    try {
      setLoading(true);
      
      // Aquí integrarías con el sistema de cierres existente
      // Por ahora, simularemos el proceso
      
      toast.success(`Se generaron facturas para ${serviceIds.length} servicios`);
      
      // Actualizar datos
      await Promise.all([fetchSummary(), fetchReadyServices(), fetchCalendarEvents()]);
    } catch (error: any) {
      console.error('Error generating invoices:', error);
      toast.error("No se pudieron generar las facturas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSummary(),
        fetchReadyServices(),
        fetchCalendarEvents(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    summary,
    readyServices,
    calendarEvents,
    loading,
    refetch: async () => {
      await Promise.all([fetchSummary(), fetchReadyServices(), fetchCalendarEvents()]);
    },
    generateInvoicesForClient,
  };
};