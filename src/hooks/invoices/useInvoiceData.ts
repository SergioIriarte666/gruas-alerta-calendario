
import { useState, useEffect } from 'react';
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatInvoiceData } from '@/utils/invoiceUtils';

export const useInvoiceData = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // First get invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Then get invoice_closures relationships
      const { data: closuresData, error: closuresError } = await supabase
        .from('invoice_closures')
        .select('invoice_id, closure_id');

      if (closuresError) throw closuresError;

      // Format invoices with closure relationships
      const formattedInvoices: Invoice[] = invoicesData.map(invoice => {
        const closureRelation = closuresData.find(rel => rel.invoice_id === invoice.id);
        return formatInvoiceData({
          ...invoice,
          invoice_closures: closureRelation ? [{ closure_id: closureRelation.closure_id }] : []
        });
      });

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
