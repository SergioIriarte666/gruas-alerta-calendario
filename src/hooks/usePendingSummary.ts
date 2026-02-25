
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfToday, parseISO, isBefore } from 'date-fns';

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

export interface PendingSummaryData {
  servicesWithoutOC: PendingServiceWithoutOC[];
  pendingClosures: PendingClosure[];
  overdueInvoices: OverdueInvoice[];
  expiringDocuments: ExpiringDocument[];
  totalCritical: number;
  hasCriticalItems: boolean;
}

const fetchPendingSummary = async (): Promise<PendingSummaryData> => {
  const today = startOfToday();
  const closureThreshold = addDays(today, -30);

  const { data: companyData } = await supabase.from('company_data').select('alert_days').maybeSingle();
  const alertDays = companyData?.alert_days ?? 30;
  const alertDateLimit = addDays(today, alertDays);

  const [
    servicesWithoutOCRes,
    closedServiceIdsRes,
    completedOldRes,
    overdueRes,
    expiringCranesRes,
    expiringOperatorsRes
  ] = await Promise.all([
    // Services completed without purchase order (exclude monthly billing clients)
    supabase
      .from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(id, name, billing_type)')
      .eq('status', 'completed')
      .or('purchase_order.is.null,purchase_order.eq.')
      .or('purchase_order_number.is.null,purchase_order_number.eq.')
      .order('service_date', { ascending: true })
      .limit(200),
    // Closed service IDs
    supabase.from('closure_services').select('service_id'),
    // Old completed services for closure check
    supabase
      .from('services')
      .select('id, folio, service_date, client:clients!services_client_id_fkey(id, name)')
      .eq('status', 'completed')
      .lte('service_date', format(closureThreshold, 'yyyy-MM-dd'))
      .order('service_date', { ascending: true }),
    // Overdue invoices
    supabase.rpc('get_overdue_invoices_for_alerts'),
    // Expiring crane docs
    supabase
      .from('cranes')
      .select('id, license_plate, circulation_permit_expiry, insurance_expiry, technical_review_expiry')
      .eq('is_active', true)
      .or(`circulation_permit_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},insurance_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')},technical_review_expiry.lte.${format(alertDateLimit, 'yyyy-MM-dd')}`),
    // Expiring operator exams
    supabase
      .from('operators')
      .select('id, name, exam_expiry')
      .eq('is_active', true)
      .lte('exam_expiry', format(alertDateLimit, 'yyyy-MM-dd'))
  ]);

  // Process services without OC (exclude monthly billing clients)
  const servicesWithoutOC: PendingServiceWithoutOC[] = (servicesWithoutOCRes.data || [])
    .filter((s: any) => s.client?.billing_type !== 'monthly')
    .map((s: any) => ({
    id: s.id,
    folio: s.folio,
    serviceDate: s.service_date,
    clientName: s.client?.name ?? 'N/A',
    clientId: s.client?.id ?? '',
    daysSince: Math.floor((today.getTime() - new Date(s.service_date).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // Process pending closures
  const closedIds = new Set((closedServiceIdsRes.data || []).map((item: any) => item.service_id));
  const pendingClosures: PendingClosure[] = (completedOldRes.data || [])
    .filter((s: any) => !closedIds.has(s.id))
    .map((s: any) => ({
      id: s.id,
      folio: s.folio,
      serviceDate: s.service_date,
      clientName: s.client?.name ?? 'N/A',
      daysSince: Math.floor((today.getTime() - new Date(s.service_date).getTime()) / (1000 * 60 * 60 * 24)),
    }));

  // Process overdue invoices
  const overdueInvoices: OverdueInvoice[] = (!overdueRes.error && overdueRes.data || []).map((inv: any) => ({
    id: inv.id,
    folio: inv.folio,
    clientName: inv.client_name,
    daysOverdue: inv.days_overdue,
    total: inv.total,
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
        const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
      const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

  const totalCritical = servicesWithoutOC.length + pendingClosures.length + overdueInvoices.length;

  return {
    servicesWithoutOC,
    pendingClosures,
    overdueInvoices,
    expiringDocuments,
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
