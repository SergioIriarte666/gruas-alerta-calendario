import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceDispute, DisputeType } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceDisputes');

const DISPUTE_SELECT = `
  id, service_id, dispute_type, description, disputed_amount, reference_doc,
  status, resolution_notes, created_by, created_at, resolved_by, resolved_at,
  creator:profiles!service_disputes_created_by_fkey(full_name, email),
  resolver:profiles!service_disputes_resolved_by_fkey(full_name, email)
`;

const mapDispute = (row: any): ServiceDispute => ({
  id: row.id,
  serviceId: row.service_id,
  disputeType: row.dispute_type,
  description: row.description,
  disputedAmount: row.disputed_amount != null ? Number(row.disputed_amount) : null,
  referenceDoc: row.reference_doc || null,
  status: row.status,
  resolutionNotes: row.resolution_notes || null,
  createdBy: row.created_by || null,
  createdByName: row.creator?.full_name || row.creator?.email || undefined,
  createdAt: row.created_at,
  resolvedBy: row.resolved_by || null,
  resolvedByName: row.resolver?.full_name || row.resolver?.email || undefined,
  resolvedAt: row.resolved_at || null,
});

// Disputas abiertas para un conjunto de servicios — usado para reagrupar el
// Pipeline en el grupo virtual "En Disputa" (queryKey propia, independiente
// del fetcher de servicios).
export const useOpenServiceDisputes = (serviceIds: string[]) => {
  const sortedIds = useMemo(() => [...new Set(serviceIds)].sort(), [serviceIds.join(',')]);

  const { data, isLoading } = useQuery({
    queryKey: ['service-disputes-open', sortedIds],
    queryFn: async () => {
      if (sortedIds.length === 0) return [];
      const { data, error } = await supabase
        .from('service_disputes')
        .select(DISPUTE_SELECT)
        .eq('status', 'open')
        .in('service_id', sortedIds);

      if (error) {
        logger.error('Error fetching open disputes:', error);
        throw error;
      }
      return (data || []).map(mapDispute);
    },
    enabled: sortedIds.length > 0,
    staleTime: 30 * 1000,
  });

  const openDisputes = useMemo(() => data || [], [data]);
  const openDisputesByServiceId = useMemo(() => {
    const map = new Map<string, ServiceDispute>();
    openDisputes.forEach(d => map.set(d.serviceId, d));
    return map;
  }, [openDisputes]);

  return { openDisputes, openDisputesByServiceId, loading: isLoading };
};

// Historial completo (abiertas y resueltas) de un servicio, para la sección
// "Disputas" del detalle de servicio.
export const useServiceDisputeHistory = (serviceId: string | null | undefined) => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['service-disputes', serviceId],
    queryFn: async () => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from('service_disputes')
        .select(DISPUTE_SELECT)
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching dispute history:', error);
        throw error;
      }
      return (data || []).map(mapDispute);
    },
    enabled: Boolean(serviceId),
  });

  return { disputes: data || [], loading: isLoading, refetch };
};

export interface MarkDisputeInput {
  serviceId: string;
  disputeType: DisputeType;
  description: string;
  disputedAmount?: number;
  referenceDoc?: string;
}

export const useServiceDisputeActions = () => {
  const queryClient = useQueryClient();

  const invalidate = (serviceId: string) => {
    queryClient.invalidateQueries({ queryKey: ['service-disputes-open'] });
    queryClient.invalidateQueries({ queryKey: ['service-disputes', serviceId] });
  };

  const markDispute = useCallback(async (input: MarkDisputeInput) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('service_disputes').insert({
      service_id: input.serviceId,
      dispute_type: input.disputeType,
      description: input.description,
      disputed_amount: input.disputedAmount ?? null,
      reference_doc: input.referenceDoc || null,
      created_by: user?.id || null,
    });

    if (error) {
      if ((error as any).code === '23505') {
        toast.error('Este servicio ya tiene una disputa abierta');
      } else {
        logger.error('Error marking service dispute:', error);
        toast.error('No se pudo marcar el servicio en disputa');
      }
      throw error;
    }

    invalidate(input.serviceId);
    toast.success('Servicio marcado en disputa');
  }, [queryClient]);

  const resolveDispute = useCallback(async (disputeId: string, serviceId: string, resolutionNotes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('service_disputes')
      .update({
        status: 'resolved',
        resolution_notes: resolutionNotes,
        resolved_by: user?.id || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', disputeId);

    if (error) {
      logger.error('Error resolving service dispute:', error);
      toast.error('No se pudo resolver la disputa');
      throw error;
    }

    invalidate(serviceId);
    toast.success('Disputa resuelta');
  }, [queryClient]);

  return { markDispute, resolveDispute };
};
