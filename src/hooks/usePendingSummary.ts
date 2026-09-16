import { differenceInCalendarDates } from '@/utils/calendarDate';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, parseISO } from 'date-fns';
import { getBusinessTimezone, getTodayStringInTimezone, safeParseDateOnly, safeDaysSince, isSameYearMonth } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";

const logger = createLogger("usePendingSummary");

export interface PendingServiceWithoutOC {
  id: string;
  folio: string;
  serviceDate: string;
  clientName: string;
  clientId: string;
  daysSince: number;
}

export interface PendingClosure {
  id: string;
  folio: string;
  serviceDate: string;
  clientName: string;
  daysSince: number;
}

export interface OverdueInvoice {
  id: string;
  folio: string;
  clientName: string;
  daysOverdue: number;
  total: number;
}

export interface ExpiringDocument {
  id: string;
  entityName: string;
  documentType: string;
  expiryDate: string;
  daysUntil: number;
  entityType: 'crane' | 'operator';
}

export interface UpcomingService {
  id: string;
  folio: string;
  serviceDate: string;
  clientName: string;
  daysUntil: number;
  status: string;
}

export interface PendingSummaryData {
  servicesWithoutOC: PendingServiceWithoutOC[];
  pendingClosures: PendingClosure[];
  overdueInvoices: OverdueInvoice[];
  expiringDocuments: ExpiringDocument[];
  upcomingServices: UpcomingService[];
  totalCritical: number;
  hasCriticalItems: boolean;
}

const fetchPendingSummary = async (): Promise<PendingSummaryData> => {
  // Use business timezone as single source of truth
  const businessTz = await getBusinessTimezone();
  const todayStr = getTodayStringInTimezone(businessTz);
  const today = safeParseDateOnly(todayStr);
  const closureThreshold = addDays(today, -30);

  const { data: companyData } = await supabase.from('company_data').select('alert_days').maybeSingle();
  const alertDays = companyData?.alert_days ?? 30;
  const alertDateLimit = addDays(today, alertDays);

  const [
    servicesWithoutOCRes,
    completedOldRes,
    overdueRes,
    expiringCranesRes,
    expiringOperatorsRes,
    upcomingServicesRes
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(id, name, billing_type)')
      .eq('status', 'completed')
      .or('purchase_order.is.null,purchase_order.eq.')
      .or('purchase_order_number.is.null,purchase_order_number.eq.')
      .order('service_date', { ascending: true })
      .order('service_date', { ascending: true })
      .limit(200),
    supabase
      .from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(id, name)')
      .eq('status', 'completed')
      .lte('service_date', format(closureThreshold, 'yyyy-MM-dd'))
      .order('service_date', { ascending: true }),
    supabase.rpc('get_overdue_invoices_for_alerts'),
    supabase
      .from('cranes')
      .select('id, license_plate, circulation_permit_expiry, insurance_expiry, technical_review_expiry')
      .eq('is_active', true)
      .or(`circulation_permit_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},insurance_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},technical_review_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')}`),
    supabase
      .from('operators')
      .select('id, name, exam_expiry')
      .eq('is_active', true)
      .lte('exam_expiry', format(alertDateLimit, 'yyyy-MM-dd')),
    supabase
      .from('services')
      .select('id, folio, service_date, status, client:clients!services_client_id_fkey(id, name)')
      .gte('service_date', todayStr)
      .in('status', ['pending', 'quoted', 'purchase_order_pending', 'with_purchase_order', 'in_progress'])
      .order('service_date', { ascending: true })
      .limit(100)
  ]);

  // Helper: hide monthly-billing services only if they belong to the current month (safe date-only)
  const isCurrentMonthMonthly = (service: any) => {
    if (service.client?.billing_type !== 'monthly') return false;
    return isSameYearMonth(service.service_date, todayStr);
  };

  // Process services without OC (exclude current-month monthly billing clients)
  const servicesWithoutOC: PendingServiceWithoutOC[] = (servicesWithoutOCRes.data || [])
    .filter((s: any) => !isCurrentMonthMonthly(s))
    .map((s: any) => ({
    id: s.id,
    folio: s.folio,
    serviceDate: s.service_date,
    clientName: s.client?.name ?? 'N/A',
    clientId: s.client?.id ?? '',
    daysSince: safeDaysSince(s.service_date, todayStr),
  }));

  // Process pending closures with targeted closure_links query
  const completedOldIds = (completedOldRes.data || []).map((item: any) => item.id);
  let closedIds = new Set<string>();

  if (completedOldIds.length > 0) {
    const { data: closureLinks, error: closureLinksError } = await supabase
      .from('closure_services')
      .select('service_id')
      .in('service_id', completedOldIds);

    if (closureLinksError) {
      logger.error('[usePendingSummary] Error consultando closure_services para cierres pendientes:', closureLinksError);
    } else {
      closedIds = new Set((closureLinks || []).map((item: any) => item.service_id));
    }
  }

  const pendingClosures: PendingClosure[] = (completedOldRes.data || [])
    .filter((s: any) => !closedIds.has(s.id))
    .map((s: any) => ({
      id: s.id,
      folio: s.folio,
      serviceDate: s.service_date,
      clientName: s.client?.name ?? 'N/A',
      daysSince: safeDaysSince(s.service_date, todayStr),
    }));

  // Process overdue invoices
  const overdueInvoices: OverdueInvoice[] = (!overdueRes.error && overdueRes.data || []).map((inv: any) => ({
    id: inv.id,
    folio: inv.folio,
    clientName: inv.client_name,
    daysOverdue: inv.days_overdue,
    total: inv.total,
  }));

  // Process upcoming services (programmed for today and the future)
  const upcomingServices: UpcomingService[] = (upcomingServicesRes.data || []).map((s: any) => ({
    id: s.id,
    folio: s.folio,
    serviceDate: s.service_date,
    clientName: s.client?.name ?? 'N/A',
    daysUntil: -safeDaysSince(s.service_date, todayStr),
    status: s.status,
  }));

  // Process expiring documents
  const expiringDocuments: ExpiringDocument[] = [];
  
  (expiringCranesRes.data || []).forEach((crane: any) => {
    const checks = [
      { type: 'Permiso de Circulación', date: crane.circulation_permit_expiry },
      { type: 'Seguro', date: crane.insurance_expiry },
      { type: 'Revisión Técnica', date: crane.technical_review_expiry },
    ];
    checks.forEach(check => {
      if (check.date) {
        const expiryDate = parseISO(check.date);
        const daysUntil = differenceInCalendarDates(expiryDate, today);
        if (daysUntil <= alertDays) {
          expiringDocuments.push({
            id: crane.id,
            entityName: crane.license_plate,
            documentType: check.type,
            expiryDate: check.date,
            daysUntil,
            entityType: 'crane',
          });
        }
      }
    });
  });

  (expiringOperatorsRes.data || []).forEach((op: any) => {
    if (op.exam_expiry) {
      const expiryDate = parseISO(op.exam_expiry);
      const daysUntil = differenceInCalendarDates(expiryDate, today);
      if (daysUntil <= alertDays) {
        expiringDocuments.push({
          id: op.id,
          entityName: op.name,
          documentType: 'Examen Médico',
          expiryDate: op.exam_expiry,
          daysUntil,
          entityType: 'operator',
        });
      }
    }
  });

  // Upcoming services count as critical only when imminent (<= 3 days)
  const urgentUpcoming = upcomingServices.filter(s => s.daysUntil <= 3).length;
  const totalCritical = servicesWithoutOC.length + pendingClosures.length + overdueInvoices.length + urgentUpcoming;

  return {
    servicesWithoutOC,
    pendingClosures,
    overdueInvoices,
    expiringDocuments,
    upcomingServices,
    totalCritical,
    hasCriticalItems: totalCritical > 0 || expiringDocuments.some(d => d.daysUntil <= 7),
  };
};

export const usePendingSummary = () => {
  return useQuery({
    queryKey: ['pendingSummary'],
    queryFn: fetchPendingSummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
