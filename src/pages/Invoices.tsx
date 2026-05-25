import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { usePagedInvoices, PagedInvoiceFilters } from '@/hooks/invoices/useInvoiceData';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { PaymentReconciliation } from '@/components/invoices/PaymentReconciliation';
import { InvoiceAlertsDashboard } from '@/components/invoices/InvoiceAlertsDashboard';
import { InvoiceCancellationsHistory } from '@/components/invoices/InvoiceCancellationsHistory';
import { MarkAsPaidModal } from '@/components/invoices/MarkAsPaidModal';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import InvoicesHeader from '@/components/invoices/InvoicesHeader';
import InvoicesStats from '@/components/invoices/InvoicesStats';
import InvoicesSearch from '@/components/invoices/InvoicesSearch';
import { InvoicesPipelineView } from '@/components/invoices/InvoicesPipelineView';
import InvoicesTable from '@/components/invoices/InvoicesTable';
import { InvoicesMobileView } from '@/components/invoices/InvoicesMobileView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AppPagination } from '@/components/shared/AppPagination';
import InvoiceBatchActions from '@/components/invoices/InvoiceBatchActions';
import InvoiceExportModal from '@/components/invoices/InvoiceExportModal';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { ShieldAlert } from 'lucide-react';

const INVOICE_STATUS_MAP: { [key: string]: string } = {
  all: 'Todas',
  draft: 'Borrador',
  sent: 'Enviada',
  due_this_week: 'Vence esta semana',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
};

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { useInvoiceReport } from '@/hooks/reports/useInvoiceReport';

import { getTodayLocal, getBusinessToday, safeParseDateOnly } from '@/utils/timezoneUtils';

const Invoices = () => {
  const { invoices, loading, createInvoice, updateInvoice, deleteInvoice, markAsPaid, getInvoiceWithDetails, refetch } = useInvoices();
  const isMobile = useIsMobile();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const statusFromQuery = queryParams.get('status');
  const tabFromQuery = queryParams.get('tab') || 'invoices';

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusFromQuery || 'all');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [preselectedClosureId, setPreselectedClosureId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(tabFromQuery);
  const [sortField, setSortField] = useState<string>('issueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [markAsPaidInvoice, setMarkAsPaidInvoice] = useState<Invoice | null>(null);
  const batchProgress = useBatchProgress();
  const ITEMS_PER_PAGE = 10;
  
  // State for reinforced delete dialog (password-based)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteVerifying, setDeleteVerifying] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteFolio, setPendingDeleteFolio] = useState<string>('');
  const [pendingBatchDeleteIds, setPendingBatchDeleteIds] = useState<string[]>([]);
  
  // Use a delayed state for showing form when navigating from closures to allow UI to breathe
  const [isFormReady, setIsFormReady] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    data: pagedData,
    isLoading: loadingPaged,
  } = usePagedInvoices(currentPage, ITEMS_PER_PAGE, {
    searchTerm: debouncedSearch,
    statusFilter,
    sortField,
    sortDirection,
  });

  // Check for preselected closure from navigation state
  useEffect(() => {
    if (location.state?.preselectedClosureId) {
      console.log('Invoices page - Preselected closure detected:', location.state.preselectedClosureId);
      setPreselectedClosureId(location.state.preselectedClosureId);
      
      const timer = setTimeout(() => {
        setShowForm(true);
        setIsFormReady(true);
      }, 100);
      
      window.history.replaceState({}, document.title);
      
      return () => clearTimeout(timer);
    } else {
      setIsFormReady(true);
    }
  }, [location.state]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [debouncedSearch, statusFilter]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [currentPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
    setSelectedInvoiceIds([]);
  };

  // Use paged data directly - search/filter/sort is handled server-side
  const paginatedInvoices = pagedData?.invoices || [];
  const totalPages = pagedData
    ? Math.max(1, Math.ceil(pagedData.total / ITEMS_PER_PAGE))
    : 1;
  
  // For stats and batch operations, use the full filtered set info
  const filteredInvoices = paginatedInvoices;

  const handleCreateInvoice = async (data: any) => {
    try {
      const newInvoice = await createInvoice(data);
      setShowForm(false);
      setPreselectedClosureId(null);

      // Si la factura se creó como pagada, registrar el pago automáticamente
      if (data.status === 'paid' && newInvoice?.id) {
        try {
          const paymentDate = data.paymentDate || data.issueDate || getTodayLocal();
          await markAsPaid(newInvoice.id, paymentDate);
        } catch (payError) {
          console.error('Error registering automatic payment:', payError);
          toast.warning("Factura creada", {
            description: "La factura se creó pero no se pudo registrar el pago automático.",
          });
          return;
        }
      }

      toast.success("Factura creada", {
        description: "La factura ha sido creada exitosamente.",
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const handleUpdateInvoice = async (data: any) => {
    if (editingInvoice) {
      try {
        console.log('Invoices page - Updating invoice:', editingInvoice.id, 'with data:', data);
        await updateInvoice(editingInvoice.id, data);
        setEditingInvoice(null);
        setShowForm(false);
        setPreselectedClosureId(null);
        // Don't show success toast here as it's handled in the operations hook
        console.log('Invoices page - Invoice updated successfully');
      } catch (error) {
        console.error('Invoices page - Error updating invoice:', error);
        // Error toast is handled in the operations hook
      }
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    const isHistorical = invoice?.folio?.startsWith('HIST-');
    
    if (isHistorical) {
      // Históricas: confirmación simple
      if (window.confirm('¿Está seguro de que desea eliminar esta factura histórica?')) {
        try {
          await deleteInvoice(id, { force: true });
          toast.success("Factura eliminada", {
            description: "La factura histórica ha sido eliminada.",
          });
        } catch (error) {
          console.error('Error deleting invoice:', error);
        }
      }
    } else {
      // Protegidas: diálogo reforzado
      setPendingDeleteId(id);
      setPendingDeleteFolio(invoice?.folio || '');
      setPendingBatchDeleteIds([]);
      setDeletePassword('');
      setDeleteError('');
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmProtectedDelete = async () => {
    try {
      if (!deletePassword.trim()) {
        setDeleteError('Ingrese su contraseña');
        return;
      }
      setDeleteVerifying(true);
      setDeleteError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No se pudo obtener el email del usuario');
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (error) {
        setDeleteError('Contraseña incorrecta');
        setDeleteVerifying(false);
        return;
      }
      setDeleteVerifying(false);
      if (pendingDeleteId) {
        // Single delete
        await deleteInvoice(pendingDeleteId, { force: true });
        toast.success("Factura eliminada", {
          description: "La factura ha sido eliminada exitosamente.",
        });
      } else if (pendingBatchDeleteIds.length > 0) {
        // Batch delete of protected invoices
        batchProgress.start('Eliminando Facturas Protegidas', pendingBatchDeleteIds.length);
        let errorCount = 0;
        for (let i = 0; i < pendingBatchDeleteIds.length; i++) {
          const id = pendingBatchDeleteIds[i];
          const inv = invoices.find(inv => inv.id === id);
          batchProgress.update(i + 1, inv?.folio || id);
          try {
            await deleteInvoice(id, { force: true });
          } catch (err) {
            errorCount++;
          }
        }
        setSelectedInvoiceIds([]);
        if (errorCount === 0) {
          batchProgress.complete();
        } else {
          batchProgress.error(`${errorCount} factura(s) con error`);
        }
      }
    } catch (error) {
      console.error('Error deleting protected invoice:', error);
    } finally {
      setDeleteDialogOpen(false);
      setDeletePassword('');
      setDeleteError('');
      setPendingDeleteId(null);
      setPendingBatchDeleteIds([]);
    }
  };

  const handleMarkAsPaid = (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice) {
      setMarkAsPaidInvoice(invoice);
    }
  };

  const handleConfirmMarkAsPaid = async (invoiceId: string, paymentDate: string) => {
    await markAsPaid(invoiceId, paymentDate);
    setTimeout(() => {
      refetch();
    }, 500);
    toast.success("Factura marcada como pagada", {
      description: "El estado de la factura ha sido actualizado.",
    });
  };

  const handleEditInvoice = (invoice: Invoice) => {
    console.log('Starting invoice edit for:', invoice.folio);
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleRefresh = () => {
    console.log('Refreshing invoices data...');
    refetch();
  };

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds(prev => [...prev, invoiceId]);
    } else {
      setSelectedInvoiceIds(prev => prev.filter(id => id !== invoiceId));
    }
  };

  const handleSelectAllToggle = (checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds(paginatedInvoices.map(inv => inv.id));
    } else {
      setSelectedInvoiceIds([]);
    }
  };

  const handleBatchMarkAsPaid = async (invoiceIds: string[]) => {
    batchProgress.start('Marcando como Pagadas', invoiceIds.length);
    let errorCount = 0;
    
    try {
      for (let i = 0; i < invoiceIds.length; i++) {
        const id = invoiceIds[i];
        const invoice = invoices.find(inv => inv.id === id);
        batchProgress.update(i + 1, invoice?.folio || id);
        try {
          await markAsPaid(id);
        } catch (err) {
          errorCount++;
        }
      }
      setSelectedInvoiceIds([]);
      setTimeout(() => {
        refetch();
      }, 500);
      
      if (errorCount === 0) {
        batchProgress.complete();
      } else {
        batchProgress.error(`${errorCount} factura(s) con error`);
      }
    } catch (error) {
      console.error('Error marking invoices as paid:', error);
      batchProgress.error('Error al procesar');
    }
  };

  const handleBatchDelete = async (invoiceIds: string[]) => {
    // Separar históricas de protegidas
    const historicalIds = invoiceIds.filter(id => {
      const inv = invoices.find(i => i.id === id);
      return inv?.folio?.startsWith('HIST-');
    });
    const protectedIds = invoiceIds.filter(id => {
      const inv = invoices.find(i => i.id === id);
      return !inv?.folio?.startsWith('HIST-');
    });

    // Eliminar históricas directamente
    if (historicalIds.length > 0) {
      batchProgress.start('Eliminando Facturas Históricas', historicalIds.length);
      let errorCount = 0;
      for (let i = 0; i < historicalIds.length; i++) {
        const id = historicalIds[i];
        const invoice = invoices.find(inv => inv.id === id);
        batchProgress.update(i + 1, invoice?.folio || id);
        try {
          await deleteInvoice(id, { force: true });
        } catch (err) {
          errorCount++;
        }
      }
      if (errorCount === 0) {
        batchProgress.complete();
      } else {
        batchProgress.error(`${errorCount} factura(s) con error`);
      }
    }

    // Protegidas: requieren confirmación reforzada
    if (protectedIds.length > 0) {
      const protectedFolios = protectedIds.map(id => {
        const inv = invoices.find(i => i.id === id);
        return inv?.folio || '';
      }).filter(Boolean);
      setPendingDeleteId(null);
      setPendingDeleteFolio(protectedFolios.join(', '));
      setPendingBatchDeleteIds(protectedIds);
      setDeletePassword('');
      setDeleteError('');
      setDeleteDialogOpen(true);
    } else {
      setSelectedInvoiceIds([]);
    }
  };

  const handleBatchExport = async (invoiceIds: string[]) => {
    const invoicesToExport = invoices.filter(inv => invoiceIds.includes(inv.id));

    if (invoicesToExport.length === 0) {
      toast.error('Sin facturas seleccionadas', {
        description: 'Seleccione al menos una factura para exportar.',
      });
      return;
    }

    const issueDates = invoicesToExport
      .map(invoice => invoice.issueDate)
      .filter((value): value is string => Boolean(value))
      .sort();

    await handleExportInvoiceReport('excel', {
      dateFrom: issueDates[0],
      dateTo: issueDates[issueDates.length - 1],
      status: invoicesToExport.length === 1 ? invoicesToExport[0].status : undefined,
      clientName: invoicesToExport.length === 1 ? invoicesToExport[0].client?.name : undefined,
    });
  };

  const handleClearSelection = () => {
    setSelectedInvoiceIds([]);
  };

  const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
  const selectedInvoiceMetrics = useMemo(() => {
    const totalInvoiced = selectedInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = selectedInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
    const pendingAmount = selectedInvoices.reduce((sum, inv) => sum + Number(inv.remainingAmount || 0), 0);
    const overdueInvoices = selectedInvoices.filter(inv => inv.status === 'overdue').length;

    return {
      totalInvoiced,
      totalPaid,
      pendingAmount,
      overdueInvoices,
    };
  }, [selectedInvoices]);
  const { handleExportInvoiceReport } = useInvoiceReport({
    invoices: selectedInvoices,
    metrics: selectedInvoiceMetrics,
  });

  // Calculate metrics for export
  const metrics = useMemo(() => {
    const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => {
      if (inv.status === 'paid') {
        return sum + Number(inv.total || 0);
      }
      return sum;
    }, 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const overdueInvoices = filteredInvoices.filter(inv => {
      if (inv.status === 'paid' || !inv.dueDate) return false;
      const today = safeParseDateOnly(getBusinessToday());
      const dueDate = safeParseDateOnly(inv.dueDate);
      return dueDate < today;
    }).length;

    return {
      totalInvoiced,
      totalPaid,
      pendingAmount,
      overdueInvoices
    };
  }, [filteredInvoices]);

  if (showForm && isFormReady) {
    return (
      <div className="space-y-6">
        <ErrorBoundary name="InvoiceForm">
          <InvoiceForm
            invoice={editingInvoice}
            preselectedClosureId={preselectedClosureId}
            onSubmit={editingInvoice ? handleUpdateInvoice : handleCreateInvoice}
            onCancel={() => {
              setShowForm(false);
              setEditingInvoice(null);
              setPreselectedClosureId(null);
              setIsFormReady(false);
            }}
            isLoading={false}
          />
        </ErrorBoundary>
      </div>
    );
  }

  if (showForm && !isFormReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Preparando formulario...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando facturas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 max-w-5xl mx-auto bg-card border-border gap-1">
          <TabsTrigger value="invoices" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Facturas</span>
            <span className="sm:hidden">Fact.</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Alertas
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Conciliación</span>
            <span className="sm:hidden">Conc.</span>
          </TabsTrigger>
          <TabsTrigger value="cancellations" className="text-xs sm:text-sm text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Anulaciones</span>
            <span className="sm:hidden">Anul.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          <InvoicesHeader 
            onCreateInvoice={() => setShowForm(true)} 
            onOpenExportModal={() => setExportModalOpen(true)}
          />
          
          <InvoicesStats invoices={invoices.filter(inv => !inv.folio.startsWith('HIST-'))} />
          
          <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} items-center gap-4`}>
            <div className="flex-grow w-full">
              <InvoicesSearch
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </div>
            <div className="overflow-x-auto w-full">
              <div className="flex items-center gap-x-1 bg-muted p-1 rounded-lg whitespace-nowrap">
                {Object.entries(INVOICE_STATUS_MAP).map(([statusKey, statusValue]) => (
                  <Button
                    key={statusKey}
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStatusFilter(statusKey); setCurrentPage(1); }}
                    className={cn(
                      'capitalize text-muted-foreground hover:text-foreground px-3 py-1 text-sm flex-shrink-0',
                      statusFilter === statusKey && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {statusValue}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {selectedInvoiceIds.length > 0 && (
            <InvoiceBatchActions
              selectedInvoices={selectedInvoices}
              onMarkAsPaid={handleBatchMarkAsPaid}
              onDelete={handleBatchDelete}
              onExport={handleBatchExport}
              onClearSelection={handleClearSelection}
            />
          )}
          
          {isMobile ? (
            <InvoicesMobileView
              invoices={paginatedInvoices}
              onEdit={handleEditInvoice}
              onDelete={handleDeleteInvoice}
              onMarkAsPaid={handleMarkAsPaid}
              getInvoiceWithDetails={getInvoiceWithDetails}
              onRefresh={handleRefresh}
            />
          ) : (
            <InvoicesTable
              invoices={paginatedInvoices}
              onEdit={handleEditInvoice}
              onDelete={handleDeleteInvoice}
              onMarkAsPaid={handleMarkAsPaid}
              getInvoiceWithDetails={getInvoiceWithDetails}
              onRefresh={handleRefresh}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              selectedInvoiceIds={selectedInvoiceIds}
              onInvoiceToggle={handleInvoiceToggle}
              onSelectAllToggle={handleSelectAllToggle}
            />
          )}

          <AppPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6">
          <InvoicesPipelineView
            invoices={invoices}
            loading={loading}
            onEdit={handleEditInvoice}
            onDelete={handleDeleteInvoice}
            onMarkAsPaid={handleMarkAsPaid}
            onView={handleEditInvoice}
            getInvoiceWithDetails={getInvoiceWithDetails}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <InvoiceAlertsDashboard />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentReconciliation onClose={() => setActiveTab('invoices')} />
        </TabsContent>

        <TabsContent value="cancellations">
          <InvoiceCancellationsHistory />
        </TabsContent>
      </Tabs>

      <InvoiceExportModal 
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        initialInvoices={filteredInvoices}
      />

      <BatchProgressModal
        state={batchProgress.state}
        onClose={batchProgress.close}
      />

      <MarkAsPaidModal
        invoice={markAsPaidInvoice}
        isOpen={!!markAsPaidInvoice}
        onClose={() => setMarkAsPaidInvoice(null)}
        onConfirm={handleConfirmMarkAsPaid}
      />

      {/* Diálogo de confirmación reforzada (con contraseña) para facturas protegidas */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              Eliminar factura protegida
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {pendingBatchDeleteIds.length > 0
                  ? `Está a punto de eliminar ${pendingBatchDeleteIds.length} factura(s) de la aplicación. Esto revertirá los cierres y servicios asociados.`
                  : `Está a punto de eliminar la factura ${pendingDeleteFolio}. Esto revertirá los cierres y servicios asociados.`
                }
              </p>
              <p className="font-medium text-destructive">
                Esta acción NO se puede deshacer.
              </p>
              <div className="pt-2">
                <label className="text-sm text-muted-foreground">Ingrese su contraseña para confirmar:</label>
                <Input
                  value={deletePassword}
                  onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                  placeholder="Contraseña"
                  type="password"
                  className="mt-1"
                  autoFocus
                />
                {deleteError && <p className="text-xs text-destructive mt-1">{deleteError}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeletePassword('');
              setDeleteError('');
              setPendingDeleteId(null);
              setPendingBatchDeleteIds([]);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmProtectedDelete}
              disabled={deleteVerifying || !deletePassword.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleteVerifying ? 'Verificando...' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;
