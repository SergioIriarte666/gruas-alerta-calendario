
import { useState, useEffect } from 'react';
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatInvoiceData, updateOverdueInvoices } from '@/utils/invoiceUtils';

export const useInvoiceData = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // Simple query without real-time subscriptions
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (
            id,
            name,
            rut,
            email,
            phone
          ),
          creator:profiles!invoices_created_by_fkey (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Get invoice_closures relationships
      const { data: closuresData, error: closuresError } = await supabase
        .from('invoice_closures')
        .select('invoice_id, closure_id');

      if (closuresError) throw closuresError;

      // Format invoices with closure relationships and detect overdue invoices
      const formattedInvoices: Invoice[] = [];
      const overdueInvoiceIds: string[] = [];

      invoicesData.forEach(invoice => {
        const closureRelation = closuresData.find(rel => rel.invoice_id === invoice.id);
        const formattedInvoice = formatInvoiceData({
          ...invoice,
          invoice_closures: closureRelation ? [{ closure_id: closureRelation.closure_id }] : []
        });
        
        // Track invoices that were updated to overdue status
        if (invoice.status === 'sent' && formattedInvoice.status === 'overdue') {
          overdueInvoiceIds.push(invoice.id);
        }
        
        formattedInvoices.push(formattedInvoice);
      });

      // Update overdue invoices in database if any were detected
      if (overdueInvoiceIds.length > 0) {
        await updateOverdueInvoices(overdueInvoiceIds);
      }

      setInvoices(formattedInvoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast.error("Error al cargar facturas", {
        description: "No se pudieron cargar las facturas. Verifica la conexión.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const addInvoice = (invoice: Invoice) => {
    setInvoices(prev => [invoice, ...prev]);
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id 
        ? { ...invoice, ...updates }
        : invoice
    ));
  };

  const removeInvoice = (id: string) => {
    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
  };

  return {
    invoices,
    loading,
    addInvoice,
    updateInvoice,
    removeInvoice,
    refetch: fetchInvoices
  };
};
