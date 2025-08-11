
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ClientInvoice {
  id: string;
  folio: string;
  issue_date: string;
  due_date: string;
  total: number;
  status: string;
  numero_fiscal?: string;
}

export const useClientInvoices = () => {
  return useQuery({
    queryKey: ['client-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, folio, issue_date, due_date, total, status, numero_fiscal')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ClientInvoice[];
    },
  });
};
