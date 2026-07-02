import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DisputeType, DisputeStatus } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DisputesReport');

export interface DisputesReportFilters {
  dateFrom: string; // yyyy-MM-dd
  dateTo: string; // yyyy-MM-dd
  clientId: string; // 'all' o uuid
  status: 'all' | DisputeStatus;
  disputeType: DisputeType | 'all';
}

export interface DisputeReportRow {
  id: string;
  serviceId: string;
  serviceFolio: string;
  serviceValue: number;
  clientId: string | null;
  clientName: string;
  disputeType: DisputeType;
  description: string;
  disputedAmount: number | null;
  referenceDoc: string | null;
  status: DisputeStatus;
  resolutionNotes: string | null;
  createdAt: string;
  createdByName?: string;
  resolvedAt: string | null;
  resolvedByName?: string;
}

const DISPUTES_REPORT_SELECT = `
  id, service_id, dispute_type, description, disputed_amount, reference_doc,
  status, resolution_notes, created_by, created_at, resolved_by, resolved_at,
  services!inner(id, folio, value, client_id, clients!services_client_id_fkey(id, name)),
  creator:profiles!service_disputes_created_by_fkey(full_name, email),
  resolver:profiles!service_disputes_resolved_by_fkey(full_name, email)
`;

const mapRow = (row: any): DisputeReportRow => ({
  id: row.id,
  serviceId: row.service_id,
  serviceFolio: row.services?.folio || 'N/A',
  serviceValue: Number(row.services?.value || 0),
  clientId: row.services?.client_id || row.services?.clients?.id || null,
  clientName: row.services?.clients?.name || 'Cliente desconocido',
  disputeType: row.dispute_type,
  description: row.description,
  disputedAmount: row.disputed_amount != null ? Number(row.disputed_amount) : null,
  referenceDoc: row.reference_doc || null,
  status: row.status,
  resolutionNotes: row.resolution_notes || null,
  createdAt: row.created_at,
  createdByName: row.creator?.full_name || row.creator?.email || undefined,
  resolvedAt: row.resolved_at || null,
  resolvedByName: row.resolver?.full_name || row.resolver?.email || undefined,
});

export const useDisputesReport = (filters: DisputesReportFilters) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['disputes-report', filters],
    queryFn: async () => {
      let query = supabase
        .from('service_disputes')
        .select(DISPUTES_REPORT_SELECT)
        .gte('created_at', `${filters.dateFrom}T00:00:00`)
        .lte('created_at', `${filters.dateTo}T23:59:59`);

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.disputeType !== 'all') {
        query = query.eq('dispute_type', filters.disputeType);
      }
      if (filters.clientId !== 'all') {
        query = query.eq('services.client_id', filters.clientId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching disputes report:', error);
        throw error;
      }

      return (data || []).map(mapRow);
    },
    staleTime: 5 * 60 * 1000,
  });

  return { rows: data || [], loading: isLoading, error, refetch };
};
