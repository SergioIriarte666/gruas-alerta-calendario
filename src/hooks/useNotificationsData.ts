
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Notification } from '@/types/notifications';
import { addDays, startOfToday, isBefore, parseISO, format } from 'date-fns';

const fetchNotificationsData = async (): Promise<Omit<Notification, 'read'>[]> => {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  const { data: companyData } = await supabase.from('company_data').select('alert_days').maybeSingle();
  const alertDays = companyData?.alert_days ?? 30;
  const alertDateLimit = addDays(today, alertDays);
  
  const serviceClosureThreshold = addDays(today, -30);
  const closureInvoiceThreshold = addDays(today, -15);
  const criticalServiceThreshold = addDays(today, -60);

  const notifications: Omit<Notification, 'read'>[] = [];

  // Execute all independent queries in parallel
  const [
    urgentServicesRes,
    weekServicesRes,
    overdueRes,
    dueSoonRes,
    oldDraftInvoicesRes,
    expiringCranesRes,
    expiringOperatorsRes,
    closedServiceIdsRes,
    invoicedClosureIdsRes
  ] = await Promise.all([
    // 1A. Services today/tomorrow
    supabase
      .from('services')
      .select('id, folio, service_date, client:clients(name)')
      .in('status', ['pending', 'in_progress'])
      .gte('service_date', format(today, 'yyyy-MM-dd'))
      .lte('service_date', format(tomorrow, 'yyyy-MM-dd')),
    // 1B. Services this week
    supabase
      .from('services')
      .select('id, folio, service_date, client:clients(name)')
      .in('status', ['pending', 'in_progress'])
      .gt('service_date', format(tomorrow, 'yyyy-MM-dd'))
      .lte('service_date', format(nextWeek, 'yyyy-MM-dd')),
    // 2A. Overdue invoices
    supabase.rpc('get_overdue_invoices_for_alerts'),
    // 2B. Invoices due soon
    supabase.rpc('get_invoices_due_soon', { days_ahead: 7 }),
    // 2C. Old draft invoices
    supabase
      .from('invoices')
      .select('id, folio, created_at, client:clients(name)')
      .eq('status', 'draft')
      .lte('created_at', format(addDays(today, -30), 'yyyy-MM-dd')),
    // 3A. Expiring crane documents
    supabase
      .from('cranes')
      .select('id, license_plate, circulation_permit_expiry, insurance_expiry, technical_review_expiry')
      .eq('is_active', true)
      .or(`circulation_permit_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},insurance_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},technical_review_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')}`),
    // 3B. Expiring operator exams
    supabase
      .from('operators')
      .select('id, name, exam_expiry')
      .eq('is_active', true)
      .lte('exam_expiry', format(alertDateLimit, 'yyyy-MM-dd')),
    // 4. Closed service IDs
    supabase
      .from('closure_services')
      .select('service_id'),
    // 6. Invoiced closure IDs
    supabase
      .from('invoice_closures')
      .select('closure_id')
  ]);

  // Process urgent services
  (urgentServicesRes.data || []).forEach((service: any) => {
    const isToday = service.service_date === format(today, 'yyyy-MM-dd');
    notifications.push({
      id: `service-urgent-${service.id}`,
      title: isToday ? 'Servicio Hoy' : 'Servicio Mañana',
      message: `Servicio ${service.folio} para ${service.client?.name ?? 'N/A'}.`,
      type: isToday ? 'error' : 'warning',
      timestamp: parseISO(service.service_date),
      actionType: 'navigate',
      actionUrl: '/services',
      actionData: { entityId: service.id },
    });
  });

  // Process week services
  (weekServicesRes.data || []).forEach((service: any) => {
    notifications.push({
      id: `service-week-${service.id}`,
      title: 'Servicio Esta Semana',
      message: `Servicio ${service.folio} para ${service.client?.name ?? 'N/A'} programado esta semana.`,
      type: 'info',
      timestamp: parseISO(service.service_date),
      actionType: 'navigate',
      actionUrl: '/services',
      actionData: { entityId: service.id },
    });
  });

  // Process overdue invoices
  if (!overdueRes.error && overdueRes.data && overdueRes.data.length > 0) {
    overdueRes.data.forEach((invoice: any) => {
      notifications.push({
        id: `invoice-overdue-${invoice.id}`,
        title: 'Factura Vencida',
        message: `Factura ${invoice.folio} de ${invoice.client_name} está vencida por ${invoice.days_overdue} días. Total: $${invoice.total.toLocaleString()}`,
        type: 'error',
        timestamp: parseISO(invoice.due_date),
        actionType: 'navigate',
        actionUrl: '/invoices',
        actionData: { entityId: invoice.id, filter: 'overdue' },
      });
    });
  }

  // Process invoices due soon
  if (!dueSoonRes.error && dueSoonRes.data && dueSoonRes.data.length > 0) {
    dueSoonRes.data.forEach((invoice: any) => {
      const urgencyLevel = invoice.days_until_due <= 2 ? 'error' : 'warning';
      notifications.push({
        id: `invoice-due-soon-${invoice.id}`,
        title: invoice.days_until_due <= 2 ? 'Factura Vence Muy Pronto' : 'Factura Vence Pronto',
        message: `Factura ${invoice.folio} de ${invoice.client_name} vence en ${invoice.days_until_due} días. Total: $${invoice.total.toLocaleString()}`,
        type: urgencyLevel,
        timestamp: parseISO(invoice.due_date),
        actionType: 'navigate',
        actionUrl: '/invoices',
        actionData: { entityId: invoice.id, filter: 'sent' },
      });
    });
  }

  // Process old draft invoices
  (oldDraftInvoicesRes.data || []).forEach((invoice: any) => {
    const daysSince = Math.floor((today.getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `invoice-old-draft-${invoice.id}`,
      title: 'Factura Borrador Antigua',
      message: `Factura ${invoice.folio} de ${invoice.client?.name ?? 'N/A'} lleva ${daysSince} días en borrador.`,
      type: 'info',
      timestamp: parseISO(invoice.created_at),
      actionType: 'navigate',
      actionUrl: '/invoices',
      actionData: { entityId: invoice.id },
    });
  });

  // Process expiring crane documents
  (expiringCranesRes.data || []).forEach((crane: any) => {
    const checks = [
      { type: 'Permiso de Circulación', date: crane.circulation_permit_expiry },
      { type: 'Seguro', date: crane.insurance_expiry },
      { type: 'Revisión Técnica', date: crane.technical_review_expiry },
    ];

    checks.forEach(check => {
      if (check.date) {
        const expiryDate = parseISO(check.date);
        if (isBefore(today, expiryDate) || expiryDate.toDateString() === today.toDateString()) {
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          let alertType: 'error' | 'warning' | 'info' = 'info';
          let title = 'Documento por Vencer';
          
          if (daysUntilExpiry <= 7) {
            alertType = 'error';
            title = daysUntilExpiry <= 0 ? 'Documento Vencido' : 'Documento Vence Esta Semana';
          } else if (daysUntilExpiry <= 30) {
            alertType = 'warning';
            title = 'Documento Vence Este Mes';
          }

          notifications.push({
            id: `crane-expiry-${crane.id}-${check.type.replace(/\s+/g, '-')}`,
            title,
            message: `${check.type} de grúa ${crane.license_plate} ${daysUntilExpiry <= 0 ? 'está vencido' : `vence en ${daysUntilExpiry} días`}.`,
            type: alertType,
            timestamp: expiryDate,
            actionType: 'navigate',
            actionUrl: '/cranes',
            actionData: { entityId: crane.id },
          });
        }
      }
    });
  });

  // Process expiring operator exams
  (expiringOperatorsRes.data || []).forEach((operator: any) => {
    const expiryDate = parseISO(operator.exam_expiry);
    if (isBefore(today, expiryDate) || expiryDate.toDateString() === today.toDateString()) {
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let alertType: 'error' | 'warning' | 'info' = 'info';
      let title = 'Examen por Vencer';
      
      if (daysUntilExpiry <= 7) {
        alertType = 'error';
        title = daysUntilExpiry <= 0 ? 'Examen Vencido' : 'Examen Vence Esta Semana';
      } else if (daysUntilExpiry <= 30) {
        alertType = 'warning';
        title = 'Examen Vence Este Mes';
      }

      notifications.push({
        id: `operator-exam-${operator.id}`,
        title,
        message: `Examen médico de ${operator.name} ${daysUntilExpiry <= 0 ? 'está vencido' : `vence en ${daysUntilExpiry} días`}.`,
        type: alertType,
        timestamp: expiryDate,
        actionType: 'navigate',
        actionUrl: '/operators',
        actionData: { entityId: operator.id },
      });
    }
  });

  // 4. Services completed >30 days without closure (depends on closedServiceIds)
  const closedIds = (closedServiceIdsRes.data || []).map(item => item.service_id);
  
  let pendingServicesQuery = supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .eq('status', 'completed')
    .lte('service_date', format(serviceClosureThreshold, 'yyyy-MM-dd'));
  
  if (closedIds.length > 0) {
    pendingServicesQuery = pendingServicesQuery.not('id', 'in', `(${closedIds.join(',')})`);
  }

  // 5. Critical services >60 days (also depends on closedIds)
  let criticalServicesQuery = supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .eq('status', 'completed')
    .lte('service_date', format(criticalServiceThreshold, 'yyyy-MM-dd'));
  
  if (closedIds.length > 0) {
    criticalServicesQuery = criticalServicesQuery.not('id', 'in', `(${closedIds.join(',')})`);
  }

  // 6. Closures >15 days without invoicing (depends on invoicedClosureIds)
  const invoicedIds = (invoicedClosureIdsRes.data || []).map(item => item.closure_id);
  
  let pendingClosuresQuery = supabase
    .from('service_closures')
    .select('id, folio, created_at, total, client:clients(name)')
    .eq('status', 'closed')
    .lte('created_at', format(closureInvoiceThreshold, 'yyyy-MM-dd'));
  
  if (invoicedIds.length > 0) {
    pendingClosuresQuery = pendingClosuresQuery.not('id', 'in', `(${invoicedIds.join(',')})`);
  }

  // Execute dependent queries in parallel
  const [pendingServicesRes, criticalServicesRes, pendingClosuresRes] = await Promise.all([
    pendingServicesQuery,
    criticalServicesQuery,
    pendingClosuresQuery
  ]);

  const pendingServices = pendingServicesRes.data;
  if (pendingServices && pendingServices.length > 0) {
    notifications.push({
      id: 'services-pending-closure',
      title: 'Servicios Pendientes de Cierre',
      message: `${pendingServices.length} servicios completados hace más de 30 días necesitan ser incluidos en un cierre.`,
      type: 'warning',
      timestamp: new Date(),
      actionType: 'navigate',
      actionUrl: '/closures',
      actionData: { filter: 'pending-services' },
    });
  }

  const criticalServices = criticalServicesRes.data;
  if (criticalServices && criticalServices.length > 0) {
    notifications.push({
      id: 'services-critical-old',
      title: 'Servicios Muy Antiguos Sin Cierre',
      message: `${criticalServices.length} servicios de hace más de 60 días requieren atención urgente.`,
      type: 'error',
      timestamp: new Date(),
      actionType: 'navigate',
      actionUrl: '/closures',
      actionData: { filter: 'critical-services' },
    });
  }

  (pendingClosuresRes.data || []).forEach((closure: any) => {
    const daysSince = Math.floor((today.getTime() - new Date(closure.created_at).getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `closure-pending-invoice-${closure.id}`,
      title: 'Cierre Pendiente de Facturación',
      message: `Cierre ${closure.folio} (${closure.client?.name ?? 'Todos los clientes'}) cerrado hace ${daysSince} días necesita ser facturado.`,
      type: 'error',
      timestamp: parseISO(closure.created_at),
      actionType: 'navigate',
      actionUrl: '/invoices',
      actionData: { entityId: closure.id },
    });
  });
  
  return notifications.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const useNotificationsData = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['notificationsData'],
    queryFn: fetchNotificationsData,
    staleTime: 5 * 60 * 1000,
  });

  if (error) {
    console.error('Error loading notifications data:', error);
  }

  return {
    notifications: data ?? [],
    loading: isLoading,
  };
};
