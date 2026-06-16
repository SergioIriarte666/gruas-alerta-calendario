import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useSupplierPaymentStats');

export interface SupplierPaymentStat {
  supplier_id: string;
  total_payments: number;
  pending_amount: number;
  overdue_count: number;
}

export const useSupplierPaymentStats = () => {
  return useQuery({
    queryKey: ['supplier-payment-stats'],
    queryFn: async (): Promise<Record<string, SupplierPaymentStat>> => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('supplier_id, status, amount');

      if (error) throw error;

      const stats: Record<string, SupplierPaymentStat> = {};

      (data || []).forEach((p) => {
        if (!p.supplier_id) return;
        if (!stats[p.supplier_id]) {
          stats[p.supplier_id] = {
            supplier_id: p.supplier_id,
            total_payments: 0,
            pending_amount: 0,
            overdue_count: 0,
          };
        }
        const s = stats[p.supplier_id];
        s.total_payments++;
        if (p.status === 'pending') s.pending_amount += p.amount || 0;
        if (p.status === 'overdue') {
          s.overdue_count++;
          s.pending_amount += p.amount || 0;
        }
      });

      return stats;
    },
    staleTime: 2 * 60 * 1000,
  });
};
