import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatForDatabase, formatForDisplay, getWeekStart, getCurrentChileDate } from '@/utils/timezoneUtils';

export interface DailyReportData {
  selectedDate: string;
  services: {
    scheduled: any[];
    pending: any[];
    overdue: any[];
    overdueWithoutPO: any[];
    nextWeek: any[];
    completed: any[];
    total: number;
  };
  calendar: {
    events: any[];
    maintenances: any[];
    inspections: any[];
    meetings: any[];
    weekEvents: any[];
    total: number;
  };
  financial: {
    invoicesDue: any[];
    invoicesDueWeek: any[];
    invoicesOverdue: any[];
    paymentsToMake: any[];
    paymentsWeek: any[];
    paymentsPending: any[];
    invoicesToIssue: any[];
    supplierPayments: {
      dueToday: any[];
      overdue: any[];
      dueThisWeek: any[];
      totalDueToday: number;
      totalOverdue: number;
      totalDueWeek: number;
    };
    totalDue: number;
    totalDueWeek: number;
    totalOverdue: number;
  };
  operations: {
    cranes: {
      active: number;
      maintenance: number;
      alerts: any[];
    };
    operators: {
      assigned: number;
      available: number;
      assignments: any[];
    };
    documentAlerts: any[];
  };
  summary: {
    criticalTasks: number;
    totalTasks: number;
    totalTasksWeek: number;
    completionRate: number;
    completedToday: number;
    alerts: number;
    urgentAlerts: number;
  };
}

const fetchDailyReportData = async (selectedDate: string): Promise<DailyReportData> => {
  const dateForDB = formatForDatabase(new Date(selectedDate));
  
  // Usar funciones de zona horaria para cálculos de semana
  const currentWeekStart = getWeekStart(new Date(selectedDate));
  const currentWeekEnd = new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const nextWeekEnd = new Date(currentWeekEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch services data - expandir rango para incluir semana actual y próxima
  const [servicesRes, calendarRes, invoicesRes, paymentsRes, supplierPaymentsRes, cranesRes, operatorsRes] = await Promise.all([
    // Servicios - incluir semana actual y próxima
    supabase.from('services').select(`
      id, folio, service_date, status, value, purchase_order_number,
      client:clients!services_client_id_fkey(id, name),
      operator:operators(id, name),
      crane:cranes(id, brand, model),
      service_type:service_types(name)
    `).gte('service_date', formatForDatabase(currentWeekStart))
      .lte('service_date', formatForDatabase(nextWeekEnd)),

    // Eventos del calendario - incluir semana actual y próxima para mejor visibilidad
    supabase.from('calendar_events').select(`
      id, title, date, start_time, end_time, type, status, description,
      client:clients(name),
      operator:operators(name),
      crane:cranes(brand, model)
    `).gte('date', formatForDatabase(currentWeekStart))
      .lte('date', formatForDatabase(nextWeekEnd)),

    // Facturas - próximas 30 días y vencidas
    supabase.from('invoices').select(`
      id, folio, due_date, total, status, paid_amount,
      client:clients(name)
    `).lte('due_date', formatForDatabase(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)))
      .eq('status', 'sent'),

    // Pagos programados - próximos 15 días
    supabase.from('scheduled_payments').select(`
      id, amount, scheduled_date, status, payment_method,
      supplier_invoice:supplier_invoices(invoice_number, supplier_name)
    `).gte('scheduled_date', dateForDB)
      .lte('scheduled_date', formatForDatabase(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000))),

    // Pagos a proveedores - próximos 30 días y vencidos (ampliado para debugging)
    supabase.from('supplier_payments').select(`
      id, amount, due_date, status, description, category, reference_number,
      supplier_id,
      suppliers(id, name, category, rut, email, phone, contact_name)
    `).in('status', ['pending', 'overdue'])
      .lte('due_date', formatForDatabase(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))),

    // Estado de grúas
    supabase.from('cranes').select(`
      id, brand, model, license_plate, is_active,
      technical_review_expiry, insurance_expiry, circulation_permit_expiry
    `),

    // Operadores - todos activos
    supabase.from('operators').select(`
      id, name, is_active
    `).eq('is_active', true)
  ]);

  // Process services with better categorization
  const allServices = servicesRes.data || [];
  const selectedDateObj = new Date(selectedDate);
  
  const scheduled = allServices.filter(s => 
    s.service_date === dateForDB && ['pending', 'in_progress'].includes(s.status)
  );
  const completed = allServices.filter(s => 
    s.service_date === dateForDB && s.status === 'completed'
  );
  const pending = allServices.filter(s => s.status === 'pending');
  
  // Separar servicios completados pendientes de facturación en dos categorías
  const pendingInvoicingWithPO: any[] = [];
  const pendingInvoicingWithoutPO: any[] = [];
  
  // Batch query: obtener todos los service_id ya facturados de una vez
  const completedServiceIds = allServices
    .filter(s => s.status === 'completed')
    .map(s => s.id);

  const { data: invoicedServicesData } = completedServiceIds.length > 0
    ? await supabase
        .from('invoice_services')
        .select('service_id')
        .in('service_id', completedServiceIds)
    : { data: [] };

  const invoicedServiceIds = new Set(
    (invoicedServicesData || []).map((is: any) => is.service_id)
  );

  // Filtrar en memoria
  for (const service of allServices) {
    if (service.status === 'completed' && !invoicedServiceIds.has(service.id)) {
      if (service.purchase_order_number) {
        pendingInvoicingWithPO.push(service);
      } else {
        pendingInvoicingWithoutPO.push(service);
      }
    }
  }
  const nextWeek = allServices.filter(s => {
    const serviceDate = new Date(s.service_date);
    const nextWeekStart = new Date(selectedDateObj);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekEnd = new Date(selectedDateObj);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    return serviceDate >= nextWeekStart && serviceDate <= nextWeekEnd;
  });

  // Process calendar events with better filtering
  const events = calendarRes.data || [];
  const todayEvents = events.filter(e => e.date === dateForDB);
  const weekEvents = events.filter(e => e.date !== dateForDB);
  
  const calendarData = {
    events: todayEvents,
    maintenances: todayEvents.filter(e => e.type === 'maintenance'),
    inspections: todayEvents.filter(e => e.type === 'service'),
    meetings: todayEvents.filter(e => e.type === 'meeting'),
    weekEvents: weekEvents,
    total: todayEvents.length
  };

  // Process financial data with better categorization
  const invoices = invoicesRes.data || [];
  const currentDate = getCurrentChileDate();
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const invoicesDueToday = invoices.filter(i => i.due_date === dateForDB);
  const invoicesDueThisWeek = invoices.filter(i => {
    const dueDate = new Date(i.due_date);
    return dueDate > currentDate && dueDate <= new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  const invoicesOverdue = invoices.filter(i => new Date(i.due_date) < currentDate);
  
  const totalDueToday = invoicesDueToday.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);
  const totalDueWeek = invoicesDueThisWeek.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);
  const totalOverdue = invoicesOverdue.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);

  // Process payments
  const payments = paymentsRes.data || [];
  const paymentsToday = payments.filter(p => p.scheduled_date === dateForDB);
  const paymentsWeek = payments.filter(p => p.scheduled_date !== dateForDB);

  // Process supplier payments
  const supplierPayments = supplierPaymentsRes.data || [];
  
  const supplierPaymentsDueToday = supplierPayments.filter(sp => sp.due_date === dateForDB);
  const supplierPaymentsOverdue = supplierPayments.filter(sp => new Date(sp.due_date) < currentDate);
  const supplierPaymentsDueWeek = supplierPayments.filter(sp => {
    const dueDate = new Date(sp.due_date);
    return dueDate > currentDate && dueDate <= new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  
  const supplierTotalDueToday = supplierPaymentsDueToday.reduce((sum, sp) => sum + (sp.amount || 0), 0);
  const supplierTotalOverdue = supplierPaymentsOverdue.reduce((sum, sp) => sum + (sp.amount || 0), 0);
  const supplierTotalDueWeek = supplierPaymentsDueWeek.reduce((sum, sp) => sum + (sp.amount || 0), 0);
  
  // Get services ready for invoicing including failed services
  const invoicesToIssueRes = await supabase
    .from('services')
    .select(`
      id, folio, value, service_date, client_id
    `)
    .in('status', ['completed', 'failed'])
    .lte('service_date', dateForDB);

  // Get unique client IDs and fetch clients separately
  const serviceClientIds = [...new Set(invoicesToIssueRes.data?.map(s => s.client_id).filter(Boolean) || [])];
  const clientsRes = serviceClientIds.length > 0 
    ? await supabase.from('clients').select('id, name').in('id', serviceClientIds)
    : { data: [] };
  
  const clientsMap = new Map<string, any>();
  if (clientsRes.data) {
    for (const client of clientsRes.data) {
      clientsMap.set(client.id, client);
    }
  }

  // Batch query: obtener todos los service_id facturados de una vez
  const allInvoiceServiceIds = (invoicesToIssueRes.data || []).map(s => s.id);
  const { data: invoicedServices2 } = allInvoiceServiceIds.length > 0
    ? await supabase
        .from('invoice_services')
        .select('service_id')
        .in('service_id', allInvoiceServiceIds)
    : { data: [] };

  const invoicedSet2 = new Set(
    (invoicedServices2 || []).map((is: any) => is.service_id)
  );

  // Filtrar en memoria
  const filteredServices = (invoicesToIssueRes.data || [])
    .filter(service => !invoicedSet2.has(service.id))
    .map(service => ({
      ...service,
      client: clientsMap.get(service.client_id) ? {
        id: clientsMap.get(service.client_id).id,
        name: clientsMap.get(service.client_id).name
      } : null
    }));

  // Process cranes and generate detailed alerts
  const cranes = cranesRes.data || [];
  const alertDays = 30; // días de alerta por defecto
  const todayDate = getCurrentChileDate();

  const documentAlerts = cranes.reduce((alerts: any[], crane) => {
    const techReview = new Date(crane.technical_review_expiry);
    const insurance = new Date(crane.insurance_expiry);
    const permit = new Date(crane.circulation_permit_expiry);
    
    const getDaysDiff = (date: Date) => Math.ceil((date.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const checkDocument = (expiryDate: Date, docType: string, docName: string) => {
      const daysDiff = getDaysDiff(expiryDate);
      if (daysDiff <= alertDays) {
        const urgency = daysDiff <= 0 ? 'VENCIDO' : daysDiff <= 7 ? 'CRÍTICO' : daysDiff <= 15 ? 'URGENTE' : 'PRÓXIMO';
        const daysText = daysDiff <= 0 ? `${Math.abs(daysDiff)} días vencido` : `${daysDiff} días restantes`;
        
        alerts.push({
          type: docType,
          message: `${docName} de ${crane.brand} ${crane.model} (${crane.license_plate})`,
          description: `${urgency}: ${daysText}`,
          priority: urgency,
          daysRemaining: daysDiff,
          crane: `${crane.brand} ${crane.model}`,
          licensePlate: crane.license_plate,
          expiryDate: expiryDate.toISOString().split('T')[0]
        });
      }
    };

    checkDocument(techReview, 'REVISIÓN TÉCNICA', 'Revisión Técnica');
    checkDocument(insurance, 'SEGURO', 'Seguro Obligatorio');
    checkDocument(permit, 'PERMISO', 'Permiso de Circulación');

    return alerts;
  }, []);

  // Ordenar alertas por urgencia (más urgentes primero)
  documentAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

  // Process operators with real assignments
  const operators = operatorsRes.data || [];
  const assignedOperators = scheduled.reduce((acc, service) => {
    if (service.operator?.id && !acc.includes(service.operator.id)) {
      acc.push(service.operator.id);
    }
    return acc;
  }, [] as string[]);
  
  const assigned = assignedOperators.length;
  const available = operators.length - assigned;

  // Calculate improved summary metrics (priorizar servicios sin O.C.)
  const criticalTasks = pendingInvoicingWithoutPO.length + invoicesOverdue.length + supplierPaymentsOverdue.length + documentAlerts.filter(a => a.priority === 'VENCIDO' || a.priority === 'CRÍTICO').length;
  const completedToday = completed.length;
  const totalTasksToday = scheduled.length + todayEvents.length + invoicesDueToday.length + paymentsToday.length;
  const totalTasksWeek = allServices.length + events.length + invoices.length + payments.length;
  
  // Mejorar cálculo de tasa de completitud
  const completionRate = totalTasksToday > 0 ? 
    Math.max(0, Math.min(100, (completedToday / (completedToday + scheduled.length)) * 100)) : 
    (totalTasksWeek > criticalTasks ? 85 : 60); // Estimación basada en alertas

  return {
    selectedDate: formatForDisplay(new Date(selectedDate)),
    services: {
      scheduled,
      pending,
      overdue: pendingInvoicingWithPO,
      overdueWithoutPO: pendingInvoicingWithoutPO,
      nextWeek,
      completed,
      total: scheduled.length + pending.length + completed.length
    },
    calendar: calendarData,
    financial: {
      invoicesDue: invoicesDueToday,
      invoicesDueWeek: invoicesDueThisWeek,
      invoicesOverdue,
      paymentsToMake: paymentsToday,
      paymentsWeek: paymentsWeek,
      paymentsPending: payments.filter(p => p.status === 'pending'),
      invoicesToIssue: filteredServices,
      supplierPayments: {
        dueToday: supplierPaymentsDueToday,
        overdue: supplierPaymentsOverdue,
        dueThisWeek: supplierPaymentsDueWeek,
        totalDueToday: supplierTotalDueToday,
        totalOverdue: supplierTotalOverdue,
        totalDueWeek: supplierTotalDueWeek
      },
      totalDue: totalDueToday,
      totalDueWeek: totalDueWeek,
      totalOverdue
    },
    operations: {
      cranes: {
        active: cranes.filter(c => c.is_active).length,
        maintenance: cranes.filter(c => !c.is_active).length,
        alerts: documentAlerts
      },
      operators: {
        assigned,
        available,
        assignments: assignedOperators.map(id => operators.find(o => o.id === id)).filter(Boolean)
      },
      documentAlerts
    },
    summary: {
      criticalTasks,
      totalTasks: totalTasksToday,
      totalTasksWeek,
      completionRate,
      completedToday,
      alerts: documentAlerts.length,
      urgentAlerts: documentAlerts.filter(a => a.priority === 'VENCIDO' || a.priority === 'CRÍTICO').length
    }
  };
};

export const useDailyReport = (selectedDate: string) => {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dailyReport', selectedDate],
    queryFn: () => fetchDailyReportData(selectedDate),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  useEffect(() => {
    const handleChanges = (payload: any) => {
      console.log('Daily report real-time change:', payload);
      queryClient.invalidateQueries({ queryKey: ['dailyReport', selectedDate] });
    };

    const channel = supabase
      .channel('daily-report-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_payments' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payments' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cranes' }, handleChanges)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedDate]);

  return {
    data: data ?? null,
    loading: isLoading,
    error,
    refetch
  };
};