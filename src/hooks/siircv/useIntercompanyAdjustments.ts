import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

const logger = createLogger('IntercompanySeparation');

export type IntercompanyAdjustmentRow = Database['public']['Tables']['intercompany_adjustments']['Row'];
export type IntercompanyDirection = 'lowboy_to_g5n' | 'g5n_to_lowboy';

export type IntercompanyAdjustmentFormValues = {
  adjustment_date: string;
  amount: number;
  direction: IntercompanyDirection;
  description: string;
  reference?: string | null;
};

export type IntercompanyBalance = {
  financedInRange: number;
  financedTotal: number;
  adjustmentsNet: number;
  balanceOwed: number;
};

async function fetchFinancedTotal(desde?: string, hasta?: string): Promise<number> {
  let query = supabase
    .from('costs')
    .select('amount')
    .eq('entity', 'lowboy')
    .eq('paid_by', 'gruas_5_norte');
  if (desde) query = query.gte('date', desde);
  if (hasta) query = query.lte('date', hasta);
  const { data, error } = await query;
  if (error) {
    logger.error('Error fetching financed total', error);
    throw error;
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export function useIntercompanyAdjustments() {
  return useQuery({
    queryKey: ['intercompany-adjustments'],
    staleTime: 60_000,
    queryFn: async (): Promise<IntercompanyAdjustmentRow[]> => {
      const { data, error } = await supabase
        .from('intercompany_adjustments')
        .select('*')
        .order('adjustment_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('Error fetching intercompany_adjustments', error);
        throw error;
      }
      return data ?? [];
    },
  });
}

export function useIntercompanyBalance(desde: string, hasta: string) {
  const adjustmentsQuery = useIntercompanyAdjustments();

  return useQuery({
    queryKey: ['intercompany-balance', desde, hasta, adjustmentsQuery.dataUpdatedAt],
    enabled: !adjustmentsQuery.isLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<IntercompanyBalance> => {
      const [financedInRange, financedTotal] = await Promise.all([
        fetchFinancedTotal(desde, hasta),
        fetchFinancedTotal(),
      ]);

      const adjustments = adjustmentsQuery.data ?? [];
      const adjustmentsNet = adjustments.reduce((sum, adj) => {
        const amount = Number(adj.amount);
        return adj.direction === 'lowboy_to_g5n' ? sum + amount : sum - amount;
      }, 0);

      return {
        financedInRange,
        financedTotal,
        adjustmentsNet,
        balanceOwed: financedTotal - adjustmentsNet,
      };
    },
  });
}

export function useCreateIntercompanyAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: IntercompanyAdjustmentFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('intercompany_adjustments').insert({
        adjustment_date: values.adjustment_date,
        amount: values.amount,
        direction: values.direction,
        description: values.description.trim(),
        reference: values.reference?.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intercompany-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['intercompany-balance'] });
      toast.success('Abono registrado correctamente.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible crear el abono', error);
      toast.error(error.message || 'No fue posible registrar el abono.');
    },
  });
}

export function useDeleteIntercompanyAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intercompany_adjustments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intercompany-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['intercompany-balance'] });
      toast.success('Abono eliminado.');
    },
    onError: (error: Error) => {
      logger.error('No fue posible eliminar el abono', error);
      toast.error(error.message || 'No fue posible eliminar el abono.');
    },
  });
}
