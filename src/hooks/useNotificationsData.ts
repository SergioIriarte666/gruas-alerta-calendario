
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
  
  // Thresholds for different alert types
  const serviceClosureThreshold = addDays(today, -30); // 30 days ago
  const closureInvoiceThreshold = addDays(today, -15); // 15 days ago
  const criticalServiceThreshold = addDays(today, -60); // 60 days ago
  const urgentDocumentThreshold = addDays(today, 7); // 7 days ahead
  const warningDocumentThreshold = addDays(today, 30); // 30 days ahead

  const notifications: Omit<Notification, 'read'>[] = [];

  // 1A. Services today/tomorrow (urgent)
  const { data: urgentServices } = await supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .in('status', ['pending', 'in_progress'])
    .gte('service_date', format(today, 'yyyy-MM-dd'))
    .lte('service_date', format(tomorrow, 'yyyy-MM-dd'));

  (urgentServices || []).forEach((service: any) => {
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

  // 1B. Services this week (informative)
  const { data: weekServices } = await supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .in('status', ['pending', 'in_progress'])
    .gt('service_date', format(tomorrow, 'yyyy-MM-dd'))
    .lte('service_date', format(nextWeek, 'yyyy-MM-dd'));

  (weekServices || []).forEach((service: any) => {
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

  // 2A. Facturas vencidas usando la nueva función que detecta automáticamente
  try {
    const { data: overdueData, error: overdueError } = await supabase.rpc('get_overdue_invoices_for_alerts');
    
    if (overdueError) {
      console.error('Error fetching overdue invoices:', overdueError);
    } else if (overdueData && overdueData.length > 0) {
      overdueData.forEach((invoice: any) => {
        notifications.push({
          id: `invoice-overdue-${invoice.id}`,
          title: 'Factura Vencida',
          message: `Factura ${invoice.folio} de ${invoice.client_name} está vencida por ${invoice.days_overdue} días. Total: $${invoice.total.toLocaleString()}`,
          type: 'error',
          timestamp: parseISO(invoice.due_date),
          actionType: 'navigate',
          actionUrl: '/invoices',
          actionData: { 
            entityId: invoice.id,
            filter: 'overdue'
          },
        });
      });
    }
  } catch (error) {
    console.error('Error in overdue invoices detection:', error);
  }

  // 2B. Facturas próximas a vencer (usando la nueva función RPC)
  try {
    const { data: invoicesDueSoon, error: dueSoonError } = await supabase.rpc('get_invoices_due_soon', { days_ahead: 7 });
    
    if (dueSoonError) {
      console.error('Error fetching invoices due soon:', dueSoonError);
    } else if (invoicesDueSoon && invoicesDueSoon.length > 0) {
      invoicesDueSoon.forEach((invoice: any) => {
        const urgencyLevel = invoice.days_until_due <= 2 ? 'error' : 'warning';
        notifications.push({
          id: `invoice-due-soon-${invoice.id}`,
          title: invoice.days_until_due <= 2 ? 'Factura Vence Muy Pronto' : 'Factura Vence Pronto',
          message: `Factura ${invoice.folio} de ${invoice.client_name} vence en ${invoice.days_until_due} días. Total: $${invoice.total.toLocaleString()}`,
          type: urgencyLevel,
          timestamp: parseISO(invoice.due_date),
          actionType: 'navigate',
          actionUrl: '/invoices',
          actionData: { 
            entityId: invoice.id,
            filter: 'sent'
          },
        });
      });
    }
  } catch (error) {
    console.error('Error in due soon invoices detection:', error);
  }

  // 2C. Old draft invoices (more than 30 days)
  const oldDraftThreshold = addDays(today, -30);
  const { data: oldDraftInvoices } = await supabase
    .from('invoices')
    .select('id, folio, created_at, client:clients(name)')
    .eq('status', 'draft')
    .lte('created_at', format(oldDraftThreshold, 'yyyy-MM-dd'));

  (oldDraftInvoices || []).forEach((invoice: any) => {
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

  // 3A. Expiring crane documents (with urgency levels)
  const { data: expiringCranes } = await supabase
    .from('cranes')
    .select('id, license_plate, circulation_permit_expiry, insurance_expiry, technical_review_expiry')
    .eq('is_active', true)
    .or(`circulation_permit_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},insurance_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},technical_review_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')}`);

  (expiringCranes || []).forEach((crane: any) => {
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

  // 3B. Expiring operator exams
  const { data: expiringOperators } = await supabase
    .from('operators')
    .select('id, name, exam_expiry')
    .eq('is_active', true)
    .lte('exam_expiry', format(alertDateLimit, 'yyyy-MM-dd'));

  (expiringOperators || []).forEach((operator: any) => {
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

  // 4. Services completed >30 days without closure
  // Get all service IDs that are already in closures
  const { data: closedServiceIds } = await supabase
    .from('closure_services')
    .select('service_id');
  
  const closedIds = (closedServiceIds || []).map(item => item.service_id);
  
  let pendingServicesQuery = supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .eq('status', 'completed')
    .lte('service_date', format(serviceClosureThreshold, 'yyyy-MM-dd'));
  
  if (closedIds.length > 0) {
    pendingServicesQuery = pendingServicesQuery.not('id', 'in', `(${closedIds.join(',')})`);
  }
  
  const { data: pendingServices } = await pendingServicesQuery;

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

  // 5. Critical services >60 days without closure
  let criticalServicesQuery = supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .eq('status', 'completed')
    .lte('service_date', format(criticalServiceThreshold, 'yyyy-MM-dd'));
  
  if (closedIds.length > 0) {
    criticalServicesQuery = criticalServicesQuery.not('id', 'in', `(${closedIds.join(',')})`);
  }
  
  const { data: criticalServices } = await criticalServicesQuery;

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

  // 6. Closures >15 days without invoicing
  // Get all closure IDs that are already invoiced
  const { data: invoicedClosureIds } = await supabase
    .from('invoice_closures')
    .select('closure_id');
  
  const invoicedIds = (invoicedClosureIds || []).map(item => item.closure_id);
  
  let pendingClosuresQuery = supabase
    .from('service_closures')
    .select('id, folio, created_at, total, client:clients(name)')
    .eq('status', 'closed')
    .lte('created_at', format(closureInvoiceThreshold, 'yyyy-MM-dd'));
  
  if (invoicedIds.length > 0) {
    pendingClosuresQuery = pendingClosuresQuery.not('id', 'in', `(${invoicedIds.join(',')})`);
  }
  
  const { data: pendingClosures } = await pendingClosuresQuery;

  (pendingClosures || []).forEach((closure: any) => {
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
