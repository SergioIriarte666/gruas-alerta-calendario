import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatForDatabase, formatForDisplay } from '@/utils/timezoneUtils';

export interface DailyReportData {
  selectedDate: string;
  services: {
    scheduled: any[];
    pending: any[];
    overdue: any[];
    nextWeek: any[];
    total: number;
  };
  calendar: {
    events: any[];
    maintenances: any[];
    inspections: any[];
    meetings: any[];
    total: number;
  };
  financial: {
    invoicesDue: any[];
    invoicesOverdue: any[];
    paymentsToMake: any[];
    paymentsPending: any[];
    invoicesToIssue: any[];
    totalDue: number;
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
    completionRate: number;
    alerts: number;
  };
}

const fetchDailyReportData = async (selectedDate: string): Promise<DailyReportData> => {
  const dateForDB = formatForDatabase(new Date(selectedDate));
  const nextWeekDate = new Date(selectedDate);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekForDB = formatForDatabase(nextWeekDate);

  // Fetch services data
  const [servicesRes, calendarRes, invoicesRes, paymentsRes, cranesRes, operatorsRes, alertsRes] = await Promise.all([
    // Servicios del día, pendientes y próximos
    supabase.from('services').select(`
      id, folio, service_date, status, value,
      client:clients(id, name),
      operator:operators(id, name),
      crane:cranes(id, brand, model),
      service_type:service_types(name)
    `).or(`service_date.eq.${dateForDB},status.eq.pending,status.eq.in_progress`),

    // Eventos del calendario
    supabase.from('calendar_events').select(`
      id, title, date, start_time, end_time, type, status,
      client:clients(name),
      operator:operators(name),
      crane:cranes(brand, model)
    `).eq('date', dateForDB),

    // Facturas con vencimiento hoy o vencidas
    supabase.from('invoices').select(`
      id, folio, due_date, total, status, paid_amount,
      client:clients(name)
    `).or(`due_date.eq.${dateForDB},due_date.lt.${dateForDB}`).eq('status', 'sent'),

    // Pagos programados
    supabase.from('scheduled_payments').select(`
      id, amount, scheduled_date, status, payment_method,
      supplier_invoice:supplier_invoices(invoice_number, supplier_name)
    `).eq('scheduled_date', dateForDB),

    // Estado de grúas
    supabase.from('cranes').select(`
      id, brand, model, license_plate, is_active,
      technical_review_expiry, insurance_expiry, circulation_permit_expiry
    `),

    // Operadores y asignaciones
    supabase.from('operators').select(`
      id, name, is_active,
      services!inner(id, service_date, status)
    `).eq('services.service_date', dateForDB),

    // Alertas de documentos próximos a vencer
    supabase.from('document_alerts').select(`
      id, document_type, alert_days,
      crane:cranes(brand, model, technical_review_expiry, insurance_expiry, circulation_permit_expiry)
    `).eq('is_active', true)
  ]);

  // Process services
  const allServices = servicesRes.data || [];
  const scheduled = allServices.filter(s => s.service_date === dateForDB && (s.status === 'pending' || s.status === 'in_progress'));
  const pending = allServices.filter(s => s.status === 'pending');
  const overdue = allServices.filter(s => s.service_date < dateForDB && s.status !== 'completed');
  
  // Get next week services
  const nextWeekRes = await supabase.from('services').select(`
    id, folio, service_date, status,
    client:clients(name)
  `).gte('service_date', dateForDB).lte('service_date', nextWeekForDB);
  
  const nextWeek = nextWeekRes.data || [];

  // Process calendar events
  const events = calendarRes.data || [];
  const calendarData = {
    events: events.filter(e => e.type === 'meeting' || e.type === 'other'),
    maintenances: events.filter(e => e.type === 'maintenance'),
    inspections: events.filter(e => e.type === 'service'),
    meetings: events.filter(e => e.type === 'meeting'),
    total: events.length
  };

  // Process financial data
  const invoices = invoicesRes.data || [];
  const invoicesDue = invoices.filter(i => i.due_date === dateForDB);
  const invoicesOverdue = invoices.filter(i => i.due_date < dateForDB);
  const totalDue = invoicesDue.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);
  const totalOverdue = invoicesOverdue.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);

  // Process payments
  const payments = paymentsRes.data || [];
  
  // Get services ready for invoicing
  const invoicesToIssueRes = await supabase.from('services').select(`
    id, folio, value, service_date,
    client:clients(name)
  `).eq('status', 'completed').is('invoice_id', null).lte('service_date', dateForDB);

  // Process cranes and alerts
  const cranes = cranesRes.data || [];
  const today = new Date();
  const alertDays = 30; // días de alerta por defecto

  const documentAlerts = cranes.filter(crane => {
    const techReview = new Date(crane.technical_review_expiry);
    const insurance = new Date(crane.insurance_expiry);
    const permit = new Date(crane.circulation_permit_expiry);
    
    const daysDiff = (date: Date) => Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff(techReview) <= alertDays || 
           daysDiff(insurance) <= alertDays || 
           daysDiff(permit) <= alertDays;
  });

  // Process operators
  const operators = operatorsRes.data || [];
  const assigned = operators.filter(o => o.services.length > 0).length;
  const available = operators.filter(o => o.is_active && o.services.length === 0).length;

  // Calculate summary
  const criticalTasks = overdue.length + invoicesOverdue.length + documentAlerts.length;
  const totalTasks = scheduled.length + pending.length + events.length + invoicesDue.length + payments.length;
  const completionRate = totalTasks > 0 ? ((totalTasks - criticalTasks) / totalTasks) * 100 : 100;

  return {
    selectedDate: formatForDisplay(new Date(selectedDate)),
    services: {
      scheduled,
      pending,
      overdue,
      nextWeek,
      total: scheduled.length + pending.length
    },
    calendar: calendarData,
    financial: {
      invoicesDue,
      invoicesOverdue,
      paymentsToMake: payments,
      paymentsPending: payments.filter(p => p.status === 'pending'),
      invoicesToIssue: invoicesToIssueRes.data || [],
      totalDue,
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
        assignments: operators.filter(o => o.services.length > 0)
      },
      documentAlerts
    },
    summary: {
      criticalTasks,
      totalTasks,
      completionRate,
      alerts: documentAlerts.length
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