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
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_services(service_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedInvoices: Invoice[] = data.map(formatInvoiceData);

      setInvoices(formattedInvoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast.error("Error", {
        description: "No se pudieron cargar las facturas.",
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
