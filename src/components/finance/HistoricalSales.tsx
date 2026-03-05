import { useState, useMemo, useEffect } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import InvoiceHistoryImport from '@/components/invoices/InvoiceHistoryImport';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Invoice } from '@/types';
import {
  HistoricalSalesFilters,
  FilterConfig,
} from './historical/HistoricalSalesFilters';
import {
  HistoricalSalesTable,
  SortConfig,
  SortKey,
} from './historical/HistoricalSalesTable';
import { EditHistoricalInvoiceModal } from './historical/EditHistoricalInvoiceModal';
import { HistoricalSalesGroupedList } from './historical/HistoricalSalesGroupedList';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toTitleCase } from '@/lib/utils';

const HISTORICAL_NOTE = 'Importación historial';

export const HistoricalSales = () => {
  const { invoices, refetch, updateInvoice } = useInvoices();
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isGroupedByClient, setIsGroupedByClient] = useState(false);

  // Real-time subscription
  useEffect(() => {
    console.log('Setting up real-time subscription for historical sales...');
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Filter State
  const [filters, setFilters] = useState<FilterConfig>({
    dateFrom: undefined,
    dateTo: undefined,
    clientName: '',
    folio: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
  });

  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'issueDate',
    direction: 'desc',
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      dateFrom: undefined,
      dateTo: undefined,
      clientName: '',
      folio: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
    });
  };

  // Memoized Data
  const filteredAndSortedInvoices = useMemo(() => {
    // 1. Base Filter (Historical only)
    let result = invoices.filter((inv) =>
      inv.notes?.startsWith(HISTORICAL_NOTE)
    );

    // 2. Apply Filters
    if (filters.dateFrom) {
      const fromTime = filters.dateFrom.getTime();
      result = result.filter((inv) => new Date(inv.issueDate).getTime() >= fromTime);
    }
    if (filters.dateTo) {
      // Set to end of day
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toTime = toDate.getTime();
      result = result.filter((inv) => new Date(inv.issueDate).getTime() <= toTime);
    }
    if (filters.clientName) {
      const query = filters.clientName.toLowerCase();
      result = result.filter((inv) =>
        inv.client?.name?.toLowerCase().includes(query)
      );
    }
    if (filters.folio) {
      const query = filters.folio.toLowerCase();
      result = result.filter((inv) => inv.folio.toLowerCase().includes(query));
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((inv) => inv.status === filters.status);
    }
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      if (!isNaN(min)) result = result.filter((inv) => inv.total >= min);
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      if (!isNaN(max)) result = result.filter((inv) => inv.total <= max);
    }

    // 3. Apply Sort
    result.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      // Handle special fields
      if (sortConfig.key === 'client') {
        valA = a.client?.name?.toLowerCase() || '';
        valB = b.client?.name?.toLowerCase() || '';
      } else if (sortConfig.key === 'issueDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, filters, sortConfig]);

  const handleUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    await updateInvoice(id, updates);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-medium leading-none">Gestión Histórica</h3>
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedInvoices.length} registros encontrados
          </p>
        </div>
        <Button onClick={() => setImportHistoryOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Importar Histórico
        </Button>
      </div>

      <Separator />

      <HistoricalSalesFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div className="flex items-center space-x-2">
        <Switch
          id="group-by-client"
          checked={isGroupedByClient}
          onCheckedChange={setIsGroupedByClient}
        />
        <Label htmlFor="group-by-client">Agrupar por cliente</Label>
      </div>

      {isGroupedByClient ? (
        <HistoricalSalesGroupedList
          invoices={filteredAndSortedInvoices}
          sortConfig={sortConfig}
          onSort={handleSort}
          onEdit={setEditingInvoice}
        />
      ) : (
        <HistoricalSalesTable
          invoices={filteredAndSortedInvoices}
          sortConfig={sortConfig}
          onSort={handleSort}
          onEdit={setEditingInvoice}
        />
      )}

      <InvoiceHistoryImport
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        onImportComplete={() => refetch()}
      />

      <EditHistoricalInvoiceModal
        invoice={editingInvoice}
        isOpen={!!editingInvoice}
        onClose={() => setEditingInvoice(null)}
        onSave={handleUpdateInvoice}
      />
    </div>
  );
};
