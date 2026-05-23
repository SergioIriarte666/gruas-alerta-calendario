
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

interface ClientInvoice {
  id: string;
  folio: string;
  issue_date: string;
  due_date: string;
  total: number;
  status: string;
  numero_fiscal?: string;
  subtotal: number;
  vat: number;
  payment_date?: string | null;
  remaining_amount?: number | null;
  notes?: string | null;
  product_service_description?: string | null;
  client?: {
    id: string;
    name: string;
    rut?: string | null;
    email?: string | null;
  } | null;
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
  const { user, loading } = useUser();

  return useQuery({
    queryKey: ['client-invoices', user?.client_id],
    enabled: !loading,
    queryFn: async () => {
      if (!user?.client_id) {
        return [];
      }

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          folio,
          issue_date,
          due_date,
          total,
          subtotal,
          vat,
          status,
          numero_fiscal,
          payment_date,
          remaining_amount,
          notes,
          product_service_description,
          client:clients(id, name, rut, email)
        `)
        .eq('client_id', user.client_id)
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
