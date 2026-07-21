import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePurchaseInvoices, usePurchaseInvoiceItems } from '@/hooks/usePurchaseInvoices';
import { usePurchaseExport } from '@/hooks/finance/usePurchaseExport';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit, X, MoreHorizontal, Download, FileSpreadsheet, FileText, LayoutList, LayoutGrid, Users } from 'lucide-react';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HistoricalPurchasesFilters,
  PurchaseFilterConfig,
} from './historical/HistoricalPurchasesFilters';
import { HistoricalPurchasesStats } from './historical/HistoricalPurchasesStats';
import {
  HistoricalPurchasesTable,
  PurchaseSortConfig,
  PurchaseSortKey,
} from './historical/HistoricalPurchasesTable';
import { HistoricalPurchasesGroupedList } from './historical/HistoricalPurchasesGroupedList';
import { CreateHistoricalPurchaseModal } from './historical/CreateHistoricalPurchaseModal';
import { EditHistoricalPurchaseModal } from './historical/EditHistoricalPurchaseModal';
import { BatchEditHistoricalPurchasesModal } from './historical/BatchEditHistoricalPurchasesModal';
import { ReceiveInventoryModal } from './historical/ReceiveInventoryModal';
import PurchaseHistoryImport from './historical/PurchaseHistoryImport';
import { HistoricalPurchasesPipelineView } from './historical/HistoricalPurchasesPipelineView';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { RecentImportLogsCard } from './historical/RecentImportLogsCard';
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
import { createLogger } from "@/lib/logger";
import { matchesSource, SOURCE_FILTER_OPTIONS } from './historical/useSourceFilter';
import { format } from 'date-fns';
import { useHistoricalPagination } from './historical/useHistoricalPagination';
import { HistoricalPaginationControls } from './historical/HistoricalPaginationControls';

const logger = createLogger("HistoricalPurchases");

export const HistoricalPurchases = () => {
  const { invoices, isDeleting: _isDeleting, deleteInvoice, updateInvoice, createInvoice } = usePurchaseInvoices();
  const { data: invoiceItemsMap } = usePurchaseInvoiceItems();
  const { exportToExcel, exportToPDF } = usePurchaseExport();
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoiceWithDetails | null>(null);
  const [receivingInventoryInvoice, setReceivingInventoryInvoice] = useState<SupplierInvoiceWithDetails | null>(null);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchEditMode, setBatchEditMode] = useState<'general' | 'description'>('general');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grouped' | 'pipeline'>('table');

  const _selectedInvoices = useMemo(
    () => invoices.filter((inv) => selectedIds.includes(inv.id)),
    [invoices, selectedIds]
  );

  // Filter State
  const [filters, setFilters] = useState<PurchaseFilterConfig>({
    dateFrom: undefined,
    dateTo: undefined,
    searchTerm: '',
    supplierName: '',
    invoiceNumber: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
    productName: '',
    source: 'all',
  });

  // Sort State
  const [sortConfig, setSortConfig] = useState<PurchaseSortConfig>({
    key: 'issue_date',
    direction: 'desc',
  });

  const handleSort = (key: PurchaseSortKey) => {
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
      supplierName: '',
      invoiceNumber: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
      productName: '',
      source: 'all',
    });
  };

  // Memoized Data
  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];

    const toLocalDateKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const invoiceDateKey = (value: string) => (value || '').slice(0, 10);

    // Apply Filters
    if (filters.searchTerm) {
      const query = filters.searchTerm.toLowerCase();
      result = result.filter((inv) =>
        inv.supplier?.name?.toLowerCase().includes(query) ||
        inv.invoice_number.toLowerCase().includes(query) ||
        (inv.product_service_description || inv.description || '').toLowerCase().includes(query)
      );
    }
    if (filters.dateFrom) {
      const fromKey = toLocalDateKey(filters.dateFrom);
      result = result.filter((inv) => invoiceDateKey(inv.issue_date) >= fromKey);
    }
    if (filters.dateTo) {
      const toKey = toLocalDateKey(filters.dateTo);
      result = result.filter((inv) => invoiceDateKey(inv.issue_date) <= toKey);
    }
    if (filters.supplierName) {
      const query = filters.supplierName.toLowerCase();
      result = result.filter((inv) =>
        inv.supplier?.name?.toLowerCase().includes(query)
      );
    }
    if (filters.invoiceNumber) {
      const query = filters.invoiceNumber.toLowerCase();
      result = result.filter((inv) => inv.invoice_number.toLowerCase().includes(query));
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter((inv) => inv.status === filters.status);
    }
    if (filters.productName) {
      const queryParts = filters.productName.toLowerCase().split(/\s+/).filter(Boolean);
      
      result = result.filter((inv) => {
        // Check description
        const descLower = (inv.product_service_description || inv.description || '').toLowerCase();
        const inDescription = queryParts.every(part => descLower.includes(part));
        if (inDescription) return true;
        
        // Check linked inventory items
        if (invoiceItemsMap) {
          // Normalize reference document to match map keys
          const normalizedRef = inv.invoice_number.trim().toUpperCase();
          
          // Try to find by supplier_id + invoice_number
          const key = inv.supplier_id 
            ? `${inv.supplier_id}-${normalizedRef}`
            : normalizedRef;
            
          const items = invoiceItemsMap[key];
          if (items) {
            // Check if ANY item matches ALL query parts
            const hasMatch = items.some(item => {
              const itemLower = item.toLowerCase();
              return queryParts.every(part => itemLower.includes(part));
            });
            if (hasMatch) return true;
          }
          
          // Fallback: try just invoice_number (normalized) if supplier match failed
          const itemsByFolio = invoiceItemsMap[normalizedRef];
          if (itemsByFolio) {
            const hasMatch = itemsByFolio.some(item => {
              const itemLower = item.toLowerCase();
              return queryParts.every(part => itemLower.includes(part));
            });
            if (hasMatch) return true;
          }
        }
        
        return false;
      });
    }
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      if (!isNaN(min)) result = result.filter((inv) => inv.amount >= min);
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      if (!isNaN(max)) result = result.filter((inv) => inv.amount <= max);
    }
    result = result.filter((inv) => matchesSource(inv.source, filters.source));

    // Apply Sort
    result.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      if (sortConfig.key === 'supplier') {
        valA = a.supplier?.name?.toLowerCase() || '';
        valB = b.supplier?.name?.toLowerCase() || '';
      } else if (sortConfig.key === 'issue_date' || sortConfig.key === 'due_date') {
        valA = (String(valA || '')).slice(0, 10);
        valB = (String(valB || '')).slice(0, 10);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, filters, sortConfig]);

  const exportMeta = useMemo(() => ({
    periodLabel: filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy') : '...'} - ${filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy') : '...'}`
      : 'Todos los períodos',
    sourceLabel: SOURCE_FILTER_OPTIONS.find((o) => o.value === filters.source)?.label || 'Todos',
  }), [filters.dateFrom, filters.dateTo, filters.source]);

  // Paginación local: solo aplica a la vista de tabla.
  const pagination = useHistoricalPagination({
    resetKey: JSON.stringify(filters) + sortConfig.key + sortConfig.direction,
  });
  const paginatedInvoices = useMemo(
    () => pagination.paginate(filteredAndSortedInvoices),
    [filteredAndSortedInvoices, pagination.paginate]
  );

  // Delete Handlers
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

  const _handleSaveInvoice = async (id: string, updates: any) => {
    try {
      await updateInvoice({ id, data: updates });
      toast.success('Factura actualizada correctamente');
      setEditingInvoice(null);
    } catch (error) {
      logger.error('Error updating invoice:', error);
      toast.error('Error al actualizar la factura');
    }
  };

  const _handleBatchSave = async (id: string, updates: any) => {
    // This is called for each invoice in the batch
    await updateInvoice({ id, data: updates, suppressToast: true });
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

  // Selection Handlers
  const handleSelectId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => 
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  }, []);

  const handleSelectAll = useCallback((ids: string[], checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    }
  }, []);

  const handleBatchUpdateStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    
    try {
      const promises = selectedIds.map(id => updateInvoice({ id, data: { status }, suppressToast: true }));
      await Promise.all(promises);
      toast.success(`${selectedIds.length} facturas actualizadas correctamente`);
      setSelectedIds([]);
    } catch (error) {
      logger.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const handleCreateInvoice = async (data: any) => {
    try {
      await createInvoice(data);
      setIsCreateOpen(false);
    } catch (error) {
      logger.error('Error creating invoice:', error);
      // Toast is handled by the hook
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-wrap items-center justify-stretch gap-2 sm:justify-end">
        <RecentImportLogsCard
          importType="purchase"
          accentClassName="text-success"
          title="Últimas importaciones"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex-1 sm:flex-none">
              <Download className="mr-2 size-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToExcel(filteredAndSortedInvoices, 'reporte-compras', exportMeta)}>
              <FileSpreadsheet className="mr-2 size-4" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToPDF(filteredAndSortedInvoices, 'reporte-compras', exportMeta)}>
              <FileText className="mr-2 size-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => setIsImportOpen(true)} className="flex-1 bg-success text-success-foreground hover:bg-success/90 sm:flex-none">
          <Plus className="mr-2 size-4" />
          Importar Histórico
        </Button>
        <Button onClick={() => setIsCreateOpen(true)} className="flex-1 sm:flex-none">
          <Plus className="mr-2 size-4" />
          Nueva Factura
        </Button>
      </div>

      <HistoricalPurchasesStats invoices={filteredAndSortedInvoices} />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center flex-wrap">
          <HistoricalPurchasesFilters
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
                  <ToggleGroupItem value="grouped" aria-label="Agrupado por proveedor" className="px-3">
                    <Users className="size-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Agrupado por proveedor</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="pipeline" aria-label="Pipeline por proveedor" className="px-3">
                    <LayoutGrid className="size-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Pipeline por proveedor</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </TooltipProvider>
        </div>

        {viewMode === 'pipeline' ? (
          <HistoricalPurchasesPipelineView
            invoices={filteredAndSortedInvoices}
            onEdit={(inv) => setEditingInvoice(inv)}
            onDelete={confirmDelete}
          />
        ) : viewMode === 'grouped' ? (
          <div className="rounded-md border bg-card">
            <HistoricalPurchasesGroupedList
              invoices={filteredAndSortedInvoices}
              invoiceItemsMap={invoiceItemsMap}
              sortConfig={sortConfig}
              onSort={handleSort}
              onEdit={(inv) => setEditingInvoice(inv)}
              onDelete={confirmDelete}
              onReceiveInventory={setReceivingInventoryInvoice}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectAll={handleSelectAll}
            />
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <HistoricalPurchasesTable
              invoices={paginatedInvoices}
              invoiceItemsMap={invoiceItemsMap}
              sortConfig={sortConfig}
              onSort={handleSort}
              onEdit={(inv) => setEditingInvoice(inv)}
              onDelete={confirmDelete}
              onReceiveInventory={setReceivingInventoryInvoice}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectAll={(_ids, checked) => handleSelectAll(filteredAndSortedInvoices.map(i => i.id), checked)}
            />
            <HistoricalPaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.getTotalPages(filteredAndSortedInvoices.length)}
              rangeLabel={pagination.getRangeLabel(filteredAndSortedInvoices.length)}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
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
              onClick={() => {
                setBatchEditMode('general');
                setIsBatchEditOpen(true);
              }}
            >
              <Edit className="size-4" />
              Editar Lote
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => {
                setBatchEditMode('description');
                setIsBatchEditOpen(true);
              }}
            >
              <FileText className="size-4" />
              Editar glosa
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
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('pending')}>
                  Marcar como Pendiente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBatchUpdateStatus('overdue')}>
                  Marcar como Vencida
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente 
              {isBatchDelete ? ` ${selectedIds.length} facturas seleccionadas` : ' la factura seleccionada'} 
              de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger text-danger-foreground hover:bg-danger/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditHistoricalPurchaseModal
        invoice={editingInvoice}
        open={!!editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
      />

      <CreateHistoricalPurchaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreateInvoice}
      />

      <ReceiveInventoryModal
        invoice={receivingInventoryInvoice}
        isOpen={!!receivingInventoryInvoice}
        onClose={() => setReceivingInventoryInvoice(null)}
      />

      <BatchEditHistoricalPurchasesModal
        selectedIds={selectedIds}
        open={isBatchEditOpen}
        onOpenChange={setIsBatchEditOpen}
        onSuccess={() => setSelectedIds([])}
        initialAction={batchEditMode === 'description' ? 'update_description' : 'update_status'}
        lockAction={batchEditMode === 'description'}
      />

      <PurchaseHistoryImport
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={() => {
          setIsImportOpen(false);
        }}
      />
    </div>
  );
};
