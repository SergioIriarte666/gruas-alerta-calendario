import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useSmartPaymentData');

export interface PendingInvoiceSummary {
  id: string;
  folio: string;
  numero_fiscal?: string;
  total: number;
  /** IVA débito fiscal de la factura (para el indicador "IVA a separar" del F29). */
  vat: number;
  remaining_amount: number;
  due_date: string;
  status: string;
}

export const usePendingClientInvoices = (clientId: string | null) => {
  return useQuery<PendingInvoiceSummary[]>({
    queryKey: ['pending-client-invoices', clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, folio, numero_fiscal, total, vat, remaining_amount, due_date, status')
        .eq('client_id', clientId!)
        .in('status', ['draft', 'sent', 'overdue', 'partial'])
        .not('folio', 'like', 'HIST-%')
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true });

      if (error) {
        logger.error('Error fetching pending client invoices:', error);
        throw error;
      }
      return (data ?? []) as PendingInvoiceSummary[];
    },
  });
};

export const useDuplicatePaymentCheck = (
  clientId: string,
  amount: string,
  paymentDate: string,
) => {
  const enabled = !!clientId && !!amount && !!paymentDate && parseFloat(amount) > 0;

  return useQuery<string>({
    queryKey: ['duplicate-payment-check', clientId, amount, paymentDate],
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, payment_date, status')
        .eq('client_id', clientId)
        .eq('amount', parseFloat(amount))
        .eq('payment_date', paymentDate)
        .gte(
          'created_at',
          businessClock.format(Date.now() - 24 * 60 * 60 * 1000, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        );

      if (error) {
        logger.error('Error checking duplicates:', error);
        return '';
      }
      if (data && data.length > 0) {
        const formatted = new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
        }).format(parseFloat(amount));
        return `⚠️ Ya existe un pago similar por ${formatted} del ${paymentDate}`;
      }
      return '';
    },
  });
};
