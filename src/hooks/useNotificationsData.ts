
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Notification } from '@/contexts/NotificationContext';
import { addDays, startOfToday, isBefore, parseISO, format } from 'date-fns';

const fetchNotificationsData = async (): Promise<Omit<Notification, 'read'>[]> => {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);

  const { data: companyData } = await supabase.from('company_data').select('alert_days').maybeSingle();
  const alertDays = companyData?.alert_days ?? 30;
  const alertDateLimit = addDays(today, alertDays);

  const notifications: Omit<Notification, 'read'>[] = [];

  // 1. Upcoming services for today/tomorrow
  const { data: upcomingServices } = await supabase
    .from('services')
    .select('id, folio, service_date, client:clients(name)')
    .in('status', ['pending', 'in_progress'])
    .gte('service_date', format(today, 'yyyy-MM-dd'))
    .lte('service_date', format(tomorrow, 'yyyy-MM-dd'));

  (upcomingServices || []).forEach((service: any) => {
    notifications.push({
      id: `service-upcoming-${service.id}`,
      title: 'Servicio Programado',
      message: `Servicio ${service.folio} para ${service.client?.name ?? 'N/A'}.`,
      type: 'info',
      timestamp: parseISO(service.service_date),
      actionType: 'navigate',
      actionUrl: '/services',
      actionData: { entityId: service.id },
    });
  });

  // 2. Overdue invoices
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, folio, due_date, client:clients(name)')
    .eq('status', 'overdue');

  (overdueInvoices || []).forEach((invoice: any) => {
    notifications.push({
      id: `invoice-overdue-${invoice.id}`,
      title: 'Factura Vencida',
      message: `Factura ${invoice.folio} de ${invoice.client?.name ?? 'N/A'} está vencida.`,
      type: 'warning',
      timestamp: parseISO(invoice.due_date),
      actionType: 'navigate',
      actionUrl: '/invoices',
      actionData: { entityId: invoice.id },
    });
  });

  // 3. Expiring crane documents
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
        if (isBefore(expiryDate, alertDateLimit) && isBefore(today, expiryDate)) {
          notifications.push({
            id: `crane-expiry-${crane.id}-${check.type.replace(/\s+/g, '-')}`,
            title: 'Documento por Vencer',
            message: `${check.type} de grúa ${crane.license_plate} vence pronto.`,
            type: 'warning',
            timestamp: expiryDate,
            actionType: 'navigate',
            actionUrl: '/cranes',
            actionData: { entityId: crane.id },
          });
        }
      }
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
