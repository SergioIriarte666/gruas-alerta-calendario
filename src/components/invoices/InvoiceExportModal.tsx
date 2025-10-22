import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInvoiceReport } from '@/hooks/reports/useInvoiceReport';
import InvoiceExportFilters from './InvoiceExportFilters';
import InvoiceExportPreview from './InvoiceExportPreview';
import { toast } from 'sonner';

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

const InvoiceExportModal = ({ 
  open, 
  onOpenChange, 
  initialInvoices = [],
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

  // Filter invoices based on selected filters
  const filteredInvoices = useMemo(() => {
    let filtered = [...initialInvoices];

    if (filters.dateFrom) {
      filtered = filtered.filter(inv => 
        inv.issue_date && new Date(inv.issue_date) >= filters.dateFrom!
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(inv => 
        inv.issue_date && new Date(inv.issue_date) <= filters.dateTo!
      );
    }

    if (filters.clientId) {
      filtered = filtered.filter(inv => inv.client_id === filters.clientId);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(inv => inv.status === filters.status);
    }

    return filtered;
  }, [initialInvoices, filters.dateFrom, filters.dateTo, filters.clientId, filters.status]);

  // Calculate metrics
  const metrics = useMemo(() => {
    return {
      totalInvoiced: filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0),
      totalPaid: filteredInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0),
      pendingAmount: filteredInvoices.reduce((sum, inv) => sum + Number(inv.remaining_amount || 0), 0),
      overdueInvoices: filteredInvoices.filter(inv => inv.status === 'overdue').length
    };
  }, [filteredInvoices]);

  const { handleExportInvoiceReport } = useInvoiceReport({ 
    invoices: filteredInvoices,
    metrics 
  });

  const handleExport = async () => {
    // Validations
    if (!filters.dateFrom || !filters.dateTo) {
      toast.error('Error de validación', {
        description: 'Debes seleccionar un rango de fechas'
      });
      return;
    }

    if (filters.dateFrom > filters.dateTo) {
      toast.error('Error de validación', {
        description: 'La fecha "Desde" no puede ser mayor que la fecha "Hasta"'
      });
      return;
    }

    if (filteredInvoices.length === 0) {
      toast.error('Sin resultados', {
        description: 'No se encontraron facturas con los filtros seleccionados'
      });
      return;
    }

    await handleExportInvoiceReport(filters.format, {
      clientId: filters.clientId || undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
      includePaymentHistory: filters.includePaymentHistory
    });

    onOpenChange(false);
  };

  const handleFilterChange = (key: keyof InvoiceExportFiltersState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleQuickFilter = (days: number | 'all') => {
    const today = new Date();
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Exportar Informe de Facturas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
          />
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleExport}
            disabled={!filters.dateFrom || !filters.dateTo}
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
