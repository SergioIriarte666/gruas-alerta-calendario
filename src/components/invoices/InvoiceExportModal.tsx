import { toLocalDateString } from '@/utils/timezoneUtils';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInvoiceReport } from '@/hooks/reports/useInvoiceReport';
import InvoiceExportFilters from './InvoiceExportFilters';
import InvoiceExportPreview from './InvoiceExportPreview';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { businessClock } from '@/utils/businessClock';

interface InvoiceExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialInvoices?: any[];
  initialClientId?: string;
}

export interface InvoiceExportFiltersState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientId: string;
  status: string;
  includePaymentHistory: boolean;
  groupByMonth: boolean;
  includeNotes: boolean;
  format: 'pdf' | 'excel';
}

const INVOICE_SELECT = `
  *,
  client:clients!client_id (
    id,
    name,
    rut,
    email,
    phone,
    department
  )
`;

const fetchFilteredInvoices = async (filters: {
  dateFrom?: Date;
  dateTo?: Date;
  clientId?: string;
  status?: string;
}): Promise<Invoice[]> => {
  let query = supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .not('folio', 'like', 'HIST-%')
    .order('created_at', { ascending: false });

  if (filters.dateFrom) {
    query = query.gte('issue_date', toLocalDateString(filters.dateFrom));
  }
  if (filters.dateTo) {
    query = query.lte('issue_date', toLocalDateString(filters.dateTo));
  }
  if (filters.clientId && filters.clientId !== '') {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.filter('status', 'eq', filters.status);
  }

  // Fetch up to 2000 invoices for export
  const allData: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await query.range(from, to);
    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return allData as Invoice[];
};

const InvoiceExportModal = ({ 
  open, 
  onOpenChange, 
  initialInvoices: _initialInvoices = [],
  initialClientId = ''
}: InvoiceExportModalProps) => {
  const [filters, setFilters] = useState<InvoiceExportFiltersState>({
    dateFrom: undefined,
    dateTo: undefined,
    clientId: initialClientId,
    status: 'all',
    includePaymentHistory: false,
    groupByMonth: false,
    includeNotes: false,
    format: 'pdf'
  });

  // Reset clientId when initialClientId changes
  useEffect(() => {
    if (initialClientId) {
      setFilters(prev => ({ ...prev, clientId: initialClientId }));
    }
  }, [initialClientId]);

  // Reset filters when modal opens
  useEffect(() => {
    if (open) {
      setFilters(prev => ({
        ...prev,
        dateFrom: undefined,
        dateTo: undefined,
        status: 'all',
        clientId: initialClientId,
      }));
    }
  }, [open, initialClientId]);

  // Fetch invoices from Supabase with current filters
  const {
    data: filteredInvoices = [],
    isLoading: isLoadingInvoices,
  } = useQuery({
    queryKey: ['invoice-export', filters.dateFrom, filters.dateTo, filters.clientId, filters.status],
    queryFn: () => fetchFilteredInvoices({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      clientId: filters.clientId,
      status: filters.status,
    }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeInvoices = filteredInvoices.filter(inv => inv.status !== 'cancelled');
    const totalInvoiced = activeInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = activeInvoices.reduce((sum, inv) => {
      if (inv.status === 'paid') {
        return sum + Number(inv.total || 0);
      }
      return sum;
    }, 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const overdueInvoices = activeInvoices.filter(inv => inv.status === 'overdue').length;
    
    return {
      totalInvoiced,
      totalPaid,
      pendingAmount,
      overdueInvoices
    };
  }, [filteredInvoices]);

  const { handleExportInvoiceReport } = useInvoiceReport({ 
    invoices: filteredInvoices,
    metrics 
  });

  const handleExport = async () => {
    if (filteredInvoices.length === 0) {
      toast.error('Sin resultados', {
        description: 'No se encontraron facturas con los filtros seleccionados'
      });
      return;
    }

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      toast.error('Error de validación', {
        description: 'La fecha "Desde" no puede ser mayor que la fecha "Hasta"'
      });
      return;
    }

    await handleExportInvoiceReport(filters.format, {
      clientId: filters.clientId || undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      dateFrom: filters.dateFrom ? toLocalDateString(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? toLocalDateString(filters.dateTo) : undefined,
      includePaymentHistory: filters.includePaymentHistory
    });

    onOpenChange(false);
  };

  const handleFilterChange = (key: keyof InvoiceExportFiltersState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleQuickFilter = (days: number | 'all') => {
    const today = businessClock.todayDate();
    if (days === 'all') {
      setFilters(prev => ({ ...prev, dateFrom: undefined, dateTo: undefined }));
    } else {
      const from = new Date(today);
      from.setDate(today.getDate() - days);
      setFilters(prev => ({ ...prev, dateFrom: from, dateTo: today }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-dialog max-w-2xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Exportar Informe de Facturas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
          <InvoiceExportFilters 
            filters={filters}
            onFilterChange={handleFilterChange}
            onQuickFilter={handleQuickFilter}
          />

          <InvoiceExportPreview 
            invoiceCount={filteredInvoices.length}
            totalAmount={metrics.totalInvoiced}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            clientId={filters.clientId}
            status={filters.status}
            isLoading={isLoadingInvoices}
          />
        </div>

        <DialogFooter className="shrink-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleExport}
            disabled={isLoadingInvoices || filteredInvoices.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            Generar Informe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceExportModal;
