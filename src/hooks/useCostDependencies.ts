import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostDependencies {
  paymentsCount: number;
  movementsCount: number;
  partsCount: number;
}

export const useCostDependencies = (
  costId: string | null,
  supplierPaymentId?: string | null,
) => {
  const { data, isLoading } = useQuery<CostDependencies>({
    queryKey: ['cost-dependencies', costId, supplierPaymentId],
    enabled: !!costId,
    staleTime: 0,
    gcTime: 30_000,
    queryFn: async () => {
      const id = costId!;
      const paymentsQuery = supabase
        .from('supplier_payments')
        .select('id', { count: 'exact', head: true })
        .or(`cost_id.eq.${id}${supplierPaymentId ? `,id.eq.${supplierPaymentId}` : ''}`);

      const [payments, movements, parts] = await Promise.all([
        paymentsQuery,
        supabase.from('inventory_movements').select('id', { count: 'exact', head: true }).eq('cost_id', id),
        supabase.from('crane_parts').select('id', { count: 'exact', head: true }).eq('cost_id', id),
      ]);

      return {
        paymentsCount: payments.count ?? 0,
        movementsCount: movements.count ?? 0,
        partsCount: parts.count ?? 0,
      };
    },
  });

  return {
    dependencies: data ?? null,
    isLoading,
    hasRelatedData: data
      ? data.paymentsCount > 0 || data.movementsCount > 0 || data.partsCount > 0
      : false,
  };
};
