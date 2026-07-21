import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import InvoiceHistoryImport from '@/components/invoices/InvoiceHistoryImport';
import { Button } from '@/components/ui/button';
import { Plus, X, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { Invoice } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  HistoricalSalesFilters,
  FilterConfig,
} from './historical/HistoricalSalesFilters';
import { HistoricalSalesStats } from './historical/HistoricalSalesStats';
import {
  HistoricalSalesTable,
  SortConfig,
  SortKey,
} from './historical/HistoricalSalesTable';
import { EditHistoricalInvoiceModal } from './historical/EditHistoricalInvoiceModal';
import { BatchEditHistoricalInvoicesModal } from './historical/BatchEditHistoricalInvoicesModal';
import { HistoricalSalesGroupedList } from './historical/HistoricalSalesGroupedList';
import { HistoricalSalesPipelineView } from './historical/HistoricalSalesPipelineView';
import { RecentImportLogsCard } from './historical/RecentImportLogsCard';
import { LayoutList, Users, LayoutGrid } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { createLogger } from "@/lib/logger";
import { matchesSource } from './historical/useSourceFilter';
import { useHistoricalPagination } from './historical/useHistoricalPagination';
import { HistoricalPaginationControls } from './historical/HistoricalPaginationControls';

const logger = createLogger("HistoricalSales");

const STATUS_LABELS: Record<Invoice['status'], string> = {
  paid: 'Pagada',
  sent: 'Enviada',
  overdue: 'Vencida',
  draft: 'Borrador',
  cancelled: 'Anulada',
};

export const HistoricalSales = () => {
  const { invoices, refetch, updateInvoice, deleteInvoice } = useInvoices();
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grouped' | 'pipeline'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Real-time subscription
  useEffect(() => {
    logger.debug('Setting up real-time subscription for historical sales...');
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
          logger.debug('Real-time update received:', payload);
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
    searchTerm: '',
    clientName: '',
    folio: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
    source: 'all',
  });

  // Los IDs seleccionados nunca deben sobrevivir a un cambio de alcance.
  useEffect(() => {
    setSelectedIds([]);
  }, [filters, viewMode]);

  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'folio',
    direction: 'asc',
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
      searchTerm: '',
      clientName: '',
      folio: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
      source: 'all',
    });
  };

  // Memoized Data
  const filteredAndSortedInvoices = useMemo(() => {
    // 1. All invoices (historical + app-created)
    let result = [...invoices];

    const toLocalDateKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const invoiceDateKey = (value: string) => (value || '').slice(0, 10);

    // 2. Apply search term (searches across client, folio, N° fiscal)
    if (filters.searchTerm) {
      const query = filters.searchTerm.toLowerCase();
      result = result.filter((inv) =>
        inv.client?.name?.toLowerCase().includes(query) ||
        inv.folio.toLowerCase().includes(query) ||
        inv.numeroFiscal?.toLowerCase().includes(query) ||
        inv.productServiceDescription.toLowerCase().includes(query)
      );
    }

    // 3. Apply specific filters
    if (filters.dateFrom) {
      const fromKey = toLocalDateKey(filters.dateFrom);
      result = result.filter((inv) => invoiceDateKey(inv.issueDate) >= fromKey);
    }
    if (filters.dateTo) {
      const toKey = toLocalDateKey(filters.dateTo);
      result = result.filter((inv) => invoiceDateKey(inv.issueDate) <= toKey);
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
    result = result.filter((inv) => matchesSource(inv.source, filters.source));

    // 3. Apply Sort
    result.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      // Handle special fields
      if (sortConfig.key === 'client') {
        valA = a.client?.name?.toLowerCase() || '';
        valB = b.client?.name?.toLowerCase() || '';
      } else if (sortConfig.key === 'issueDate') {
        valA = invoiceDateKey(String(valA || ''));
        valB = invoiceDateKey(String(valB || ''));
      } else if (sortConfig.key === 'folio') {
        // Sort by numeroFiscal numerically when available
        const numA = parseInt((a.numeroFiscal || a.folio).replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b.numeroFiscal || b.folio).replace(/\D/g, ''), 10) || 0;
        valA = numA;
        valB = numB;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, filters, sortConfig]);

  // Paginación local: solo aplica a la vista de tabla (las vistas agrupada/pipeline
  // organizan los datos de otra forma y se dejan sin paginar).
  const pagination = useHistoricalPagination({
    resetKey: JSON.stringify(filters) + sortConfig.key + sortConfig.direction,
  });
  const paginatedInvoices = useMemo(
    () => pagination.paginate(filteredAndSortedInvoices),
    [filteredAndSortedInvoices, pagination.paginate]
  );

  const handleUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    await updateInvoice(id, updates, { protectSystemStatus: true });
  };

  const handleBatchUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    await updateInvoice(id, updates, { silent: true, protectSystemStatus: true });
  };

  // Selection Handlers
  const handleSelectId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => 
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  }, []);

  const handleSelectAll = useCallback((ids: string[], checked: boolean) => {
    if (checked) {
      // Add only unique IDs
      setSelectedIds((prev) => {
        const uniqueIds = new Set([...prev, ...ids]);
        return Array.from(uniqueIds);
      });
    } else {
      // Remove specified IDs
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    }
  }, []);

  const handleBatchUpdateStatus = async (status: Invoice['status']) => {
    if (selectedIds.length === 0) return;

    // Defensa en profundidad: una acción desde Históricos nunca debe alcanzar
    // facturas del sistema ni IDs que quedaron ocultos por un cambio de filtro.
    const filteredIdSet = new Set(filteredAndSortedInvoices.map((invoice) => invoice.id));
    const historicalIds = selectedIds.filter((id) => {
      if (!filteredIdSet.has(id)) return false;
      const invoice = invoices.find((candidate) => candidate.id === id);
      return invoice?.source === 'historico' || invoice?.folio.startsWith('HIST-');
    });
    const protectedCount = selectedIds.length - historicalIds.length;

    if (historicalIds.length === 0) {
      toast.error('No hay facturas históricas válidas en la selección', {
        description: 'Las facturas del sistema están protegidas contra cambios masivos desde este módulo.',
      });
      setSelectedIds([]);
      return;
    }

    const count = historicalIds.length;
    const previousStatusFilter = filters.status;
    const toastId = toast.loading(`Actualizando ${count} facturas...`);

    try {
      await Promise.all(historicalIds.map((id) => updateInvoice(
        id,
        { status },
        { silent: true, protectSystemStatus: true }
      )));

      const clearedIncompatibleFilter = previousStatusFilter !== 'all' && previousStatusFilter !== status;
      if (clearedIncompatibleFilter) {
        setFilters((current) => ({ ...current, status: 'all' }));
      }
      setSelectedIds([]);

      toast.success(`${count} facturas cambiadas a “${STATUS_LABELS[status]}”`, {
        id: toastId,
        description: protectedCount > 0
          ? `${protectedCount} factura(s) del sistema fueron protegidas y no se modificaron.`
          : clearedIncompatibleFilter
            ? 'Se retiró el filtro de estado para mostrar las facturas actualizadas.'
            : 'El nuevo estado ya se refleja en la tabla.',
      });
    } catch (error) {
      logger.error('Error updating invoice status batch:', error);
      toast.error('No se pudo completar el cambio de estado', {
        id: toastId,
        description: 'Revisa los registros e intenta nuevamente.',
      });
    }
  };

  const handleBatchComplete = ({ status }: { status?: Invoice['status']; processed: number }) => {
    if (status && filters.status !== 'all' && filters.status !== status) {
      setFilters((current) => ({ ...current, status: 'all' }));
    }
    setSelectedIds([]);
  };

  const confirmDelete = (id: string) => {
    setInvoiceToDelete(id);
    setIsBatchDelete(false);
    setDeleteDialogOpen(true);
  };

  const confirmBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBatchDelete(true);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (isBatchDelete) {
        const count = selectedIds.length;
        await Promise.all(selectedIds.map((id) => deleteInvoice(id)));
        toast.success(`${count} facturas eliminadas correctamente`);
        setSelectedIds([]);
      } else if (invoiceToDelete) {
        await deleteInvoice(invoiceToDelete);
        toast.success('Factura eliminada correctamente');
      }
    } catch (error: any) {
      logger.error('Error deleting invoice(s):', error);
      if (error?.code === 'PROTECTED_INVOICE') {
        toast.error('Factura protegida', {
          description: 'Esta factura fue creada en la app y requiere confirmación reforzada para ser eliminada.',
        });
      } else {
        toast.error('No se pudo eliminar', {
          description: 'Ocurrió un error al intentar eliminar la(s) factura(s). Intenta nuevamente.',
        });
      }
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      setIsBatchDelete(false);
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <RecentImportLogsCard
          importType="sale"
          accentClassName="text-primary"
          title="Últimas importaciones"
        />
        <Button
          onClick={() => setImportHistoryOpen(true)}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="mr-2 size-4" />
          Importar Histórico
        </Button>
      </div>

      <HistoricalSalesStats invoices={filteredAndSortedInvoices} />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center flex-wrap">
          <HistoricalSalesFilters
            filters={filters}
            onFilterChange={setFilters}
            onClearFilters={handleClearFilters}
          />
          
          <TooltipProvider>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as any)}
              className="bg-muted/50 p-1 rounded-lg border"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="table" aria-label="Vista tabla" className="px-3">
                    <LayoutList className="size-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Tabla</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="grouped" aria-label="Agrupado por cliente" className="px-3">
                    <Users className="size-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Agrupado por cliente</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="pipeline" aria-label="Pipeline por cliente" className="px-3">
                    <LayoutGrid className="size-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Pipeline por cliente</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </TooltipProvider>
        </div>

        {viewMode === 'pipeline' ? (
          <HistoricalSalesPipelineView
            invoices={filteredAndSortedInvoices}
            onEdit={setEditingInvoice}
            onDelete={confirmDelete}
          />
        ) : (
          <div className="rounded-md border bg-card">
            {viewMode === 'grouped' ? (
              <HistoricalSalesGroupedList
                invoices={filteredAndSortedInvoices}
                sortConfig={sortConfig}
                onSort={handleSort}
                onEdit={setEditingInvoice}
                onDelete={confirmDelete}
                selectedIds={selectedIds}
                onSelectId={handleSelectId}
                onSelectAll={handleSelectAll}
              />
            ) : (
              <>
                <HistoricalSalesTable
                  invoices={paginatedInvoices}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  onEdit={setEditingInvoice}
                  onDelete={confirmDelete}
                  selectedIds={selectedIds}
                  onSelectId={handleSelectId}
                  onSelectAll={(_ids, checked) => handleSelectAll(paginatedInvoices.map(i => i.id), checked)}
                />
                <HistoricalPaginationControls
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  totalPages={pagination.getTotalPages(filteredAndSortedInvoices.length)}
                  rangeLabel={pagination.getRangeLabel(filteredAndSortedInvoices.length)}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && createPortal(
        <div className="fixed left-1/2 top-1/2 z-[100] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-primary-soft/95 px-3 py-2.5 text-foreground shadow-2xl shadow-primary/20 backdrop-blur-sm sm:gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className="min-w-6 rounded-full bg-primary px-2 py-0.5 text-center text-xs font-bold text-primary-foreground">
                {selectedIds.length}
              </span>
              <span className="whitespace-nowrap text-sm font-medium">
                seleccionados
              </span>
              <span className="hidden whitespace-nowrap text-xs text-foreground/70 lg:inline">
                de {filteredAndSortedInvoices.length} registros filtrados
              </span>
            </div>
            
            <div className="hidden h-5 w-px bg-border sm:block" />
            
            <Button 
              variant="outline"
              size="sm" 
              className="h-8 gap-2"
              onClick={() => setBatchEditOpen(true)}
            >
              <Edit2 className="size-4" />
              Editar Lote
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-2"
              onClick={confirmBatchDelete}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <MoreHorizontal className="size-4" />
                  Estado
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('paid')}>
                  Marcar como Pagada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('sent')}>
                  Marcar como Enviada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('overdue')}>
                  Marcar como Vencida
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('draft')}>
                  Marcar como Borrador
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('cancelled')} className="text-destructive focus:text-destructive">
                  Marcar como Anulada
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-1 size-8 rounded-full text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
              onClick={() => setSelectedIds([])}
              title="Cancelar selección"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>,
        document.body
      )}

      <InvoiceHistoryImport
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        onImportComplete={() => {
          refetch();
          pagination.setPage(1);
        }}
      />

      <EditHistoricalInvoiceModal
        invoice={editingInvoice}
        isOpen={!!editingInvoice}
        onClose={() => setEditingInvoice(null)}
        onSave={handleUpdateInvoice}
      />

      <BatchEditHistoricalInvoicesModal
        selectedInvoices={filteredAndSortedInvoices.filter(i => selectedIds.includes(i.id))}
        isOpen={batchEditOpen}
        onClose={() => setBatchEditOpen(false)}
        onSave={handleBatchUpdateInvoice}
        onComplete={handleBatchComplete}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {isBatchDelete
                ? `Estás a punto de eliminar ${selectedIds.length} facturas. Esta acción no se puede deshacer.`
                : 'Estás a punto de eliminar esta factura. Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
