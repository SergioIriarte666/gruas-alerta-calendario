
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { businessClock } from '@/utils/businessClock';

export interface ClientInvoice {
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

// Fuente única de verdad del dinero que el cliente adeuda. Una factura "por
// pagar" es toda la que está emitida y sin pagar: eso incluye las vencidas
// (una factura vencida es, por definición, por pagar). El dashboard y la
// página de Facturas deben usar exactamente esta definición para no mostrar
// dos cifras distintas bajo la misma etiqueta.
export const getClientOpenBalance = (
  invoices?: ClientInvoice[] | null,
): number =>
  (invoices ?? [])
    .filter((invoice) => invoice.status === "sent" || invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.total, 0);

export const getClientOverdueTotal = (
  invoices?: ClientInvoice[] | null,
): number =>
  (invoices ?? [])
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.total, 0);

// Check if an invoice should be marked as overdue
const shouldBeOverdue = (status: string, dueDate: string): boolean => {
  if (status !== 'sent') return false;
  
  const today = businessClock.todayDate();
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
        .not('folio', 'ilike', 'HIST-%')
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
