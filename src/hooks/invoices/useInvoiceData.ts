
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatInvoiceData, updateOverdueInvoices } from '@/utils/invoiceUtils';

const PAGE_SIZE = 1000;

const fetchAllInvoices = async (): Promise<any[]> => {
  const allData: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients!client_id (
          id,
          name,
          rut,
          email,
          phone,
          department
        ),
        creator:profiles!invoices_created_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return allData;
};

const fetchInvoicesFromDB = async (): Promise<Invoice[]> => {
  const invoicesData = await fetchAllInvoices();

  const invoiceIds = invoicesData.map(invoice => invoice.id);

  let closuresData: Array<{ invoice_id: string; closure_id: string }> = [];
  if (invoiceIds.length > 0) {
    // Batch closure lookups in chunks of 500
    const BATCH = 500;
    for (let i = 0; i < invoiceIds.length; i += BATCH) {
      const { data, error } = await supabase
        .from('invoice_closures')
        .select('invoice_id, closure_id')
        .in('invoice_id', invoiceIds.slice(i, i + BATCH));
      if (error) throw error;
      if (data) closuresData.push(...data);
    }
  }

  const closureByInvoiceId = new Map(
    closuresData.map(rel => [rel.invoice_id, rel.closure_id])
  );

  const formattedInvoices: Invoice[] = [];
  const overdueInvoiceIds: string[] = [];

  invoicesData.forEach(invoice => {
    const closureId = closureByInvoiceId.get(invoice.id);
    const formattedInvoice = formatInvoiceData({
      ...invoice,
      invoice_closures: closureId ? [{ closure_id: closureId }] : []
    });
    
    if (invoice.status === 'sent' && formattedInvoice.status === 'overdue') {
      overdueInvoiceIds.push(invoice.id);
    }
    
    formattedInvoices.push(formattedInvoice);
  });

  if (overdueInvoiceIds.length > 0) {
    await updateOverdueInvoices(overdueInvoiceIds);
  }

  return formattedInvoices;
};

export const useInvoiceData = () => {
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoicesFromDB,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const addInvoice = (invoice: Invoice) => {
    queryClient.setQueryData<Invoice[]>(['invoices'], (old) => 
      old ? [invoice, ...old] : [invoice]
    );
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    queryClient.setQueryData<Invoice[]>(['invoices'], (old) => 
      old ? old.map(inv => inv.id === id ? { ...inv, ...updates } : inv) : []
    );
  };

  const removeInvoice = (id: string) => {
    queryClient.setQueryData<Invoice[]>(['invoices'], (old) => 
      old ? old.filter(inv => inv.id !== id) : []
    );
  };

  return {
    invoices,
    loading,
    addInvoice,
    updateInvoice,
    removeInvoice,
    refetch: async () => { await refetch(); }
  };
};

export const usePagedInvoices = (page: number, pageSize: number) => {
  return useQuery({
    queryKey: ['invoices', 'paged', page, pageSize],
    queryFn: async (): Promise<{ invoices: Invoice[]; total: number }> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: invoicesData, error: invoicesError, count } = await supabase
        .from('invoices')
        .select(
          `
          *,
          client:clients!client_id (
            id,
            name,
            rut,
            email,
            phone,
            department
          ),
          creator:profiles!invoices_created_by_fkey (
            id,
            full_name,
            email
          )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (invoicesError) {
        console.error('Error fetching paged invoices:', invoicesError);
        toast.error('Error al cargar facturas paginadas', {
          description: 'No se pudieron cargar las facturas. Verifica la conexión.',
        });
        throw invoicesError;
      }

      const invoiceIds = (invoicesData || []).map(invoice => invoice.id);

      const { data: closuresData, error: closuresError } = await supabase
        .from('invoice_closures')
        .select('invoice_id, closure_id')
        .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['']);

      if (closuresError) {
        console.error('Error fetching invoice closures for paged invoices:', closuresError);
        throw closuresError;
      }

      const formattedInvoices: Invoice[] = [];
      const overdueInvoiceIds: string[] = [];

      (invoicesData || []).forEach(invoice => {
        const closureRelation = (closuresData || []).find(rel => rel.invoice_id === invoice.id);
        const formattedInvoice = formatInvoiceData({
          ...invoice,
          invoice_closures: closureRelation ? [{ closure_id: closureRelation.closure_id }] : [],
        });

        if (invoice.status === 'sent' && formattedInvoice.status === 'overdue') {
          overdueInvoiceIds.push(invoice.id);
        }

        formattedInvoices.push(formattedInvoice);
      });

      if (overdueInvoiceIds.length > 0) {
        await updateOverdueInvoices(overdueInvoiceIds);
      }

      const total = typeof count === 'number' ? count : formattedInvoices.length;

      return { invoices: formattedInvoices, total };
    },
    enabled: page > 0 && pageSize > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
