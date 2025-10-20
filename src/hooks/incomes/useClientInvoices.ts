import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useClientInvoices = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-invoices-pending', clientId],
    queryFn: async () => {
      if (!clientId || clientId === 'none') return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select('id, folio, numero_fiscal, total, paid_amount, remaining_amount, status, issue_date, due_date')
        .eq('client_id', clientId)
        .in('status', ['sent', 'partial', 'overdue'])
        .order('issue_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && clientId !== 'none',
  });
};
