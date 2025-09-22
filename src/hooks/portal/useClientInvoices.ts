
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

// Check if an invoice should be marked as overdue
const shouldBeOverdue = (status: string, dueDate: string): boolean => {
  if (status !== 'sent') return false;
  
  const today = new Date();
  const due = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  return due < today;
};

export const useClientInvoices = () => {
  return useQuery({
    queryKey: ['client-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, folio, issue_date, due_date, total, status, numero_fiscal')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Apply overdue detection to display correct status
      return (data as ClientInvoice[]).map(invoice => ({
        ...invoice,
        status: shouldBeOverdue(invoice.status, invoice.due_date) ? 'overdue' : invoice.status
      }));
    },
  });
};
