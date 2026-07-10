import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type {
  LowboyCostCandidate,
  LowboyServiceCandidate,
  SiiRcvRecordFormValues,
} from '@/types/siiRcv';

const logger = createLogger('Lowboy');

const recordPayload = (values: SiiRcvRecordFormValues) => ({
  book_type: values.book_type,
  doc_type: values.doc_type,
  folio: values.folio,
  counterpart_rut: values.counterpart_rut.trim(),
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
  ]);

export function useSiiRcvManager(entityRut: string) {
  const queryClient = useQueryClient();

  const createRecord = useMutation({
    mutationFn: async (values: SiiRcvRecordFormValues) => {
      const { error } = await supabase.from('sii_rcv_records').insert({
        ...recordPayload(values),
        entity_rut: entityRut.trim(),
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
      linkedServiceId,
    }: {
      id: string;
      linkedCostId?: string | null;
      linkedServiceId?: string | null;
    }) => {
      const update = linkedCostId !== undefined
        ? { linked_cost_id: linkedCostId }
        : { linked_service_id: linkedServiceId ?? null };
      const { error } = await supabase.from('sii_rcv_records').update(update).eq('id', id);
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

export function useLowboyServiceCandidates(enabled: boolean) {
  return useQuery({
    queryKey: ['lowboy', 'service-candidates'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<LowboyServiceCandidate[]> => {
      const { data, error } = await supabase
        .from('services')
        .select('id, folio, service_date, value, client:clients!services_client_id_fkey(id, name)')
        .order('service_date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LowboyServiceCandidate[];
    },
  });
}
