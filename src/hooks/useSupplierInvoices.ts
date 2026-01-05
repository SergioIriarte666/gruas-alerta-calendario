import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SupplierInvoice {
  id: string;
  supplier_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  currency: string | null;
  status: string | null;
  description: string | null;
  tax_amount: number | null;
  net_amount: number;
  payment_terms: number | null;
  paid_amount: number | null;
  balance: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupplierInvoiceWithSupplier extends SupplierInvoice {
  supplier?: {
    id: string;
    name: string;
  } | null;
}

export const useSupplierInvoices = (supplierId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all invoices or filter by supplier
  const invoicesQuery = useQuery({
    queryKey: ['supplier-invoices', supplierId],
    queryFn: async (): Promise<SupplierInvoiceWithSupplier[]> => {
      let query = supabase
        .from('supplier_invoices')
        .select(`
          *,
          supplier:suppliers!inner(id, name)
        `)
        .order('due_date', { ascending: true });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform the data to match our interface
      return (data || []).map(item => ({
        ...item,
        supplier: Array.isArray(item.supplier) ? item.supplier[0] : item.supplier
      })) as SupplierInvoiceWithSupplier[];
    }
  });

  // Get pending invoices for a specific supplier
  const pendingInvoicesQuery = useQuery({
    queryKey: ['supplier-invoices-pending', supplierId],
    queryFn: async (): Promise<SupplierInvoice[]> => {
      if (!supplierId) return [];

      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', supplierId)
        .neq('status', 'paid')
        .gt('balance', 0)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return (data || []) as SupplierInvoice[];
    },
    enabled: !!supplierId
  });

  // Update invoice paid_amount when a payment is made
  const updateInvoicePaidAmount = useMutation({
    mutationFn: async ({ invoiceId, paymentAmount }: { invoiceId: string; paymentAmount: number }) => {
      // Get current invoice
      const { data: invoice, error: fetchError } = await supabase
        .from('supplier_invoices')
        .select('paid_amount, amount')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;

      const currentPaidAmount = invoice.paid_amount || 0;
      const newPaidAmount = currentPaidAmount + paymentAmount;
      const newStatus = newPaidAmount >= invoice.amount ? 'paid' : 'partial';

      const { data, error } = await supabase
        .from('supplier_invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices-pending'] });
    },
    onError: (error) => {
      console.error('Error updating invoice:', error);
      toast.error('Error al actualizar la factura');
    }
  });

  return {
    invoices: invoicesQuery.data || [],
    pendingInvoices: pendingInvoicesQuery.data || [],
    isLoading: invoicesQuery.isLoading,
    isPendingLoading: pendingInvoicesQuery.isLoading,
    error: invoicesQuery.error,
    updateInvoicePaidAmount: updateInvoicePaidAmount.mutate,
    refetch: () => {
      invoicesQuery.refetch();
      pendingInvoicesQuery.refetch();
    }
  };
};
