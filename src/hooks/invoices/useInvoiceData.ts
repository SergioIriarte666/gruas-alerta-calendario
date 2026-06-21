
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatInvoiceData, updateOverdueInvoices } from '@/utils/invoiceUtils';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("useInvoiceData");
const PAGE_SIZE = 1000;

const fetchAllInvoices = async (excludeHistorical: boolean): Promise<any[]> => {
  const allData: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
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
      `);

    if (excludeHistorical) {
      query = query.not('folio', 'like', 'HIST-%');
    }

    const { data, error } = await query
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

const fetchInvoicesFromDB = async (excludeHistorical: boolean): Promise<Invoice[]> => {
  const invoicesData = await fetchAllInvoices(excludeHistorical);

  const invoiceIds = invoicesData.map(invoice => invoice.id);

  const closuresData: Array<{ invoice_id: string; closure_id: string }> = [];
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
    
    if (invoice.status !== 'cancelled' && invoice.status !== 'overdue' && formattedInvoice.status === 'overdue') {
      overdueInvoiceIds.push(invoice.id);
    }
    
    formattedInvoices.push(formattedInvoice);
  });

  if (overdueInvoiceIds.length > 0) {
    await updateOverdueInvoices(overdueInvoiceIds);
  }

  return formattedInvoices;
};

export interface UseInvoiceDataOptions {
  /**
   * Excluye facturas importadas como histórico (folio LIKE 'HIST-%').
   * Usado por la página de Facturas (operación corriente), que no debe
   * mezclar papelería histórica con las facturas del día a día.
   * El módulo de Históricos (HistoricalSales/HistoricalResults) y Reportes
   * necesitan verlas, así que el default es incluirlas todas.
   */
  excludeHistorical?: boolean;
}

export const useInvoiceData = (options?: UseInvoiceDataOptions) => {
  const queryClient = useQueryClient();
  const excludeHistorical = options?.excludeHistorical ?? false;
  const queryKey = ['invoices', { excludeHistorical }];

  const { data: invoices = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchInvoicesFromDB(excludeHistorical),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const addInvoice = (invoice: Invoice) => {
    queryClient.setQueryData<Invoice[]>(queryKey, (old) =>
      old ? [invoice, ...old] : [invoice]
    );
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    queryClient.setQueryData<Invoice[]>(queryKey, (old) =>
      old ? old.map(inv => inv.id === id ? { ...inv, ...updates } : inv) : []
    );
  };

  const removeInvoice = (id: string) => {
    queryClient.setQueryData<Invoice[]>(queryKey, (old) =>
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

export interface PagedInvoiceFilters {
  searchTerm?: string;
  statusFilter?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export const usePagedInvoices = (page: number, pageSize: number, filters?: PagedInvoiceFilters) => {
  const searchTerm = filters?.searchTerm || '';
  const statusFilter = filters?.statusFilter || 'all';
  const sortField = filters?.sortField || 'issueDate';
  const sortDirection = filters?.sortDirection || 'desc';

  return useQuery({
    queryKey: ['invoices', 'paged', page, pageSize, searchTerm, statusFilter, sortField, sortDirection],
    queryFn: async (): Promise<{ invoices: Invoice[]; total: number }> => {
      // If searching, we need to fetch matching invoices across ALL records
      // We'll use a broader fetch and then paginate client-side
      const isSearching = searchTerm.trim() !== '';
      const isFiltering = statusFilter !== 'all';
      const needsClientSidePagination = isSearching || isFiltering;

      let query = supabase
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
        .not('folio', 'like', 'HIST-%');

      // Apply status filter server-side when possible
      if (statusFilter !== 'all' && statusFilter !== 'due_this_week') {
        query = query.eq('status', statusFilter as any);
      }

      // Determine sort column for DB
      let dbSortColumn = 'created_at';
      if (sortField === 'folio') dbSortColumn = 'folio';
      else if (sortField === 'numeroFiscal') dbSortColumn = 'numero_fiscal';
      else if (sortField === 'issueDate') dbSortColumn = 'issue_date';
      else if (sortField === 'dueDate') dbSortColumn = 'due_date';
      else if (sortField === 'total') dbSortColumn = 'total';
      else if (sortField === 'status') dbSortColumn = 'status';

      query = query.order(dbSortColumn, { ascending: sortDirection === 'asc' });

      if (needsClientSidePagination) {
        // Fetch more records for client-side filtering (search + pagination)
        // We fetch up to 5000 to cover search across all records
        query = query.range(0, 4999);
      } else {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data: invoicesData, error: invoicesError, count } = await query;

      if (invoicesError) {
        logger.error('Error fetching paged invoices:', invoicesError);
        toast.error('Error al cargar facturas paginadas', {
          description: 'No se pudieron cargar las facturas. Verifica la conexión.',
        });
        throw invoicesError;
      }

      const invoiceIds = (invoicesData || []).map(invoice => invoice.id);

      const closuresData: Array<{ invoice_id: string; closure_id: string }> = [];
      if (invoiceIds.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < invoiceIds.length; i += BATCH) {
          const { data, error } = await supabase
            .from('invoice_closures')
            .select('invoice_id, closure_id')
            .in('invoice_id', invoiceIds.slice(i, i + BATCH));
          if (error) {
            logger.error('Error fetching invoice closures:', error);
          } else if (data) {
            closuresData.push(...data);
          }
        }
      }

      const formattedInvoices: Invoice[] = [];
      const overdueInvoiceIds: string[] = [];

      (invoicesData || []).forEach(invoice => {
        const closureRelation = closuresData.find(rel => rel.invoice_id === invoice.id);
        const formattedInvoice = formatInvoiceData({
          ...invoice,
          invoice_closures: closureRelation ? [{ closure_id: closureRelation.closure_id }] : [],
        });

        if (invoice.status !== 'cancelled' && invoice.status !== 'overdue' && formattedInvoice.status === 'overdue') {
          overdueInvoiceIds.push(invoice.id);
        }

        formattedInvoices.push(formattedInvoice);
      });

      if (overdueInvoiceIds.length > 0) {
        await updateOverdueInvoices(overdueInvoiceIds);
      }

      // Apply client-side search filtering
      let filtered = formattedInvoices;
      if (isSearching) {
        const search = searchTerm.toLowerCase().trim();
        filtered = filtered.filter(invoice => {
          const clientName = invoice.client?.name || '';
          return (
            invoice.folio.toLowerCase().includes(search) ||
            clientName.toLowerCase().includes(search) ||
            (invoice.numeroFiscal && invoice.numeroFiscal.toLowerCase().includes(search))
          );
        });
      }

      // Apply due_this_week filter client-side
      if (statusFilter === 'due_this_week') {
        const today = businessClock.todayDate();
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        filtered = filtered.filter(inv => {
          if (inv.status === 'paid' || inv.status === 'cancelled') return false;
          if (!inv.dueDate) return false;
          const due = new Date(inv.dueDate);
          return due >= monday && due <= sunday;
        });
      }

      const total = needsClientSidePagination ? filtered.length : (typeof count === 'number' ? count : filtered.length);

      // Apply client-side pagination when searching/filtering
      const result = needsClientSidePagination
        ? filtered.slice((page - 1) * pageSize, page * pageSize)
        : filtered;

      return { invoices: result, total };
    },
    enabled: page > 0 && pageSize > 0,
    staleTime: 30 * 1000, // shorter stale time for search queries
    gcTime: 2 * 60 * 1000,
  });
};
