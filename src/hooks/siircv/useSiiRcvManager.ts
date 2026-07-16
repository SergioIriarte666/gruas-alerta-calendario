import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';
import type {
  LowboyCostCandidate,
  LowboySaleCandidate,
  SiiRcvRecordFormValues,
} from '@/types/siiRcv';

const logger = createLogger('Lowboy');

const recordPayload = (values: SiiRcvRecordFormValues) => ({
  book_type: values.book_type,
  doc_type: values.doc_type,
  folio: values.folio,
  counterpart_rut: normalizeRut(values.counterpart_rut),
  counterpart_name: values.counterpart_name.trim() || null,
  doc_date: values.doc_date,
  net_amount: values.net_amount,
  exempt_amount: values.exempt_amount,
  tax_amount: values.tax_amount,
  total_amount: values.total_amount,
});

const invalidateLowboy = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['sii-rcv'] }),
    queryClient.invalidateQueries({ queryKey: ['sii-resultado'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-sales'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy-container-sales'] }),
    queryClient.invalidateQueries({ queryKey: ['lowboy', 'sale-candidates'] }),
  ]);

export function useSiiRcvManager(entityRut: string) {
  const queryClient = useQueryClient();

  const createRecord = useMutation({
    mutationFn: async (values: SiiRcvRecordFormValues) => {
      const { error } = await supabase.from('sii_rcv_records').insert({
        ...recordPayload(values),
        entity_rut: normalizeRut(entityRut),
        source: 'manual',
        content_hash: `manual:${crypto.randomUUID()}`,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLowboy(queryClient);
      toast.success('Registro creado correctamente.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible crear el registro', error);
      toast.error(error.message || 'No fue posible crear el registro.');
    },
  });

  const updateRecord = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SiiRcvRecordFormValues }) => {
      const { error } = await supabase
        .from('sii_rcv_records')
        .update(recordPayload(values))
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLowboy(queryClient);
      toast.success('Registro actualizado correctamente.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible actualizar el registro', error);
      toast.error(error.message || 'No fue posible actualizar el registro.');
    },
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sii_rcv_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLowboy(queryClient);
      toast.success('Registro eliminado.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible eliminar el registro', error);
      toast.error(error.message || 'No fue posible eliminar el registro.');
    },
  });

  const setLink = useMutation({
    mutationFn: async ({
      id,
      linkedCostId,
      linkedSaleId,
      markAsInvoiced = false,
    }: {
      id: string;
      linkedCostId?: string | null;
      linkedSaleId?: string | null;
      markAsInvoiced?: boolean;
    }) => {
      if (linkedCostId !== undefined) {
        const { error } = await supabase.from('sii_rcv_records').update({ linked_cost_id: linkedCostId }).eq('id', id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.rpc('set_lowboy_rcv_sale_link', {
        p_record_id: id,
        p_sale_id: linkedSaleId ?? null,
        p_mark_as_invoiced: markAsInvoiced,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLowboy(queryClient);
      toast.success('Vínculo actualizado.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible actualizar el vínculo', error);
      toast.error(error.message || 'No fue posible actualizar el vínculo.');
    },
  });

  return { createRecord, updateRecord, deleteRecord, setLink };
}

export function useLowboyCostCandidates(enabled: boolean) {
  return useQuery({
    queryKey: ['lowboy', 'cost-candidates'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboyCostCandidate[]> => {
      const { data, error } = await supabase
        .from('costs')
        .select('id, date, description, amount, cost_categories(name)')
        .order('date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LowboyCostCandidate[];
    },
  });
}

export function useLowboySaleCandidates(enabled: boolean, currentRecordId?: string) {
  return useQuery({
    queryKey: ['lowboy', 'sale-candidates', currentRecordId],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboySaleCandidate[]> => {
      const { data, error } = await supabase
        .from('lowboy_sales')
        .select(`
          id, client_rut, client_name, description, scheduled_date, executed_date, net_amount, status,
          linked_rcv_records:sii_rcv_records!sii_rcv_records_linked_sale_id_fkey(id, folio)
        `)
        .neq('status', 'cancelada')
        .order('scheduled_date', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as LowboySaleCandidate[]).filter((sale) =>
        sale.linked_rcv_records.length === 0 || sale.linked_rcv_records.some((record) => record.id === currentRecordId));
    },
  });
}
