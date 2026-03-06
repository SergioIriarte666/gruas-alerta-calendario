import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePurchaseInvoices, usePurchaseInvoiceItems } from '@/hooks/usePurchaseInvoices';
import { usePurchaseExport } from '@/hooks/finance/usePurchaseExport';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit, Upload, X, MoreHorizontal, Check, Download, FileSpreadsheet, FileText, LayoutList, LayoutGrid } from 'lucide-react';
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
import { CreateHistoricalPurchaseModal } from './historical/CreateHistoricalPurchaseModal';
import { EditHistoricalPurchaseModal } from './historical/EditHistoricalPurchaseModal';
import { BatchEditHistoricalPurchasesModal } from './historical/BatchEditHistoricalPurchasesModal';
import { ReceiveInventoryModal } from './historical/ReceiveInventoryModal';
import PurchaseHistoryImport from './historical/PurchaseHistoryImport';
import { HistoricalPurchasesPipelineView } from './historical/HistoricalPurchasesPipelineView';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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

export const HistoricalPurchases = () => {
  const { invoices, isDeleting, deleteInvoice, updateInvoice, createInvoice } = usePurchaseInvoices();
  const { data: invoiceItemsMap } = usePurchaseInvoiceItems();
  const { exportToExcel, exportToPDF } = usePurchaseExport();
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoiceWithDetails | null>(null);
  const [receivingInventoryInvoice, setReceivingInventoryInvoice] = useState<SupplierInvoiceWithDetails | null>(null);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');

  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => selectedIds.includes(inv.id)),
    [invoices, selectedIds]
  );

  // Filter State
  const [filters, setFilters] = useState<PurchaseFilterConfig>({
    dateFrom: undefined,
    dateTo: undefined,
    supplierName: '',
    invoiceNumber: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
    productName: '',
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
      supplierName: '',
      invoiceNumber: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
      productName: '',
    });
  };

  const handleFilterChange = (newFilters: PurchaseFilterConfig) => {
    setFilters(newFilters);
  };

  // Memoized Data
  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];

    // Apply Filters
    if (filters.dateFrom) {
      const fromTime = filters.dateFrom.getTime();
      result = result.filter((inv) => new Date(inv.issue_date).getTime() >= fromTime);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toTime = toDate.getTime();
      result = result.filter((inv) => new Date(inv.issue_date).getTime() <= toTime);
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
        const descLower = (inv.description || '').toLowerCase();
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

    // Apply Sort
    result.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      if (sortConfig.key === 'supplier') {
        valA = a.supplier?.name?.toLowerCase() || '';
        valB = b.supplier?.name?.toLowerCase() || '';
      } else if (sortConfig.key === 'issue_date' || sortConfig.key === 'due_date') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, filters, sortConfig]);

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

  const handleSaveInvoice = async (id: string, updates: any) => {
    try {
      await updateInvoice({ id, data: updates });
      toast.success('Factura actualizada correctamente');
      setEditingInvoice(null);
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Error al actualizar la factura');
    }
  };

  const handleBatchSave = async (id: string, updates: any) => {
    // This is called for each invoice in the batch
    await updateInvoice({ id, data: updates });
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
      console.error('Error deleting invoice(s):', error);
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

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAndSortedInvoices.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  }, [filteredAndSortedInvoices]);

  const handleBatchUpdateStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    
    try {
      const promises = selectedIds.map(id => updateInvoice({ id, data: { status } }));
      await Promise.all(promises);
      toast.success(`${selectedIds.length} facturas actualizadas correctamente`);
      setSelectedIds([]);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const handleCreateInvoice = async (data: any) => {
    try {
      await createInvoice(data);
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Error creating invoice:', error);
      // Toast is handled by the hook
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Histórico de Compras</h2>
          <p className="text-muted-foreground">
            Gestiona y visualiza el historial de facturas de compra y proveedores.
          </p>
        </div>
        <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToExcel(filteredAndSortedInvoices)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToPDF(filteredAndSortedInvoices)}>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Factura
            </Button>
        </div>
      </div>

      <HistoricalPurchasesStats invoices={filteredAndSortedInvoices} />

      <div className="flex justify-end">
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
                  <LayoutList className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Tabla</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="pipeline" aria-label="Pipeline por proveedor" className="px-3">
                  <LayoutGrid className="h-4 w-4" />
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
      ) : (
        <HistoricalPurchasesTable
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
      )}

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-foreground text-background px-4 py-3 rounded-full shadow-xl flex items-center gap-4 border border-border/10">
            <div className="flex items-center gap-2 px-2">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                {selectedIds.length}
              </span>
              <span className="font-medium text-sm whitespace-nowrap">seleccionados</span>
            </div>
            
            <div className="h-4 w-px bg-background/20" />
            
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 gap-2"
              onClick={() => setIsBatchEditOpen(true)}
            >
              <Edit className="h-4 w-4" />
              Editar Lote
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-2"
              onClick={confirmBatchDelete}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8 gap-2">
                  <MoreHorizontal className="h-4 w-4" />
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
              className="h-8 w-8 text-background hover:bg-background/20 hover:text-background rounded-full ml-1"
              onClick={() => setSelectedIds([])}
              title="Cancelar selección"
            >
              <X className="h-4 w-4" />
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
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
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
