import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { PaymentReconciliation } from '@/components/invoices/PaymentReconciliation';
import { PaymentHistory } from '@/components/invoices/PaymentHistory';
import { InvoiceAlertsDashboard } from '@/components/invoices/InvoiceAlertsDashboard';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import InvoicesHeader from '@/components/invoices/InvoicesHeader';
import InvoicesStats from '@/components/invoices/InvoicesStats';
import InvoicesSearch from '@/components/invoices/InvoicesSearch';
import { InvoicesPipelineView } from '@/components/invoices/InvoicesPipelineView';
import InvoicesTable from '@/components/invoices/InvoicesTable';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AppPagination } from '@/components/shared/AppPagination';
import InvoiceBatchActions from '@/components/invoices/InvoiceBatchActions';
import InvoiceExportModal from '@/components/invoices/InvoiceExportModal';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

const INVOICE_STATUS_MAP: { [key: string]: string } = {
  all: 'Todas',
  draft: 'Borrador',
  sent: 'Enviada',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
};

const Invoices = () => {
  const { invoices, loading, createInvoice, updateInvoice, deleteInvoice, markAsPaid, getInvoiceWithDetails, refetch } = useInvoices();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const statusFromQuery = queryParams.get('status');
  const tabFromQuery = queryParams.get('tab') || 'invoices';

  const [searchTerm, setSearchTerm] = useState('');
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
  const batchProgress = useBatchProgress();
  const ITEMS_PER_PAGE = 10;

  // Check for preselected closure from navigation state
  useEffect(() => {
    if (location.state?.preselectedClosureId) {
      setPreselectedClosureId(location.state.preselectedClosureId);
      setShowForm(true);
      // Clear the state to prevent it from persisting on page refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [searchTerm, statusFilter]);

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
    setCurrentPage(1); // Reset to first page when sorting
    setSelectedInvoiceIds([]); // Clear selection when sorting
  };

  const filteredInvoices = invoices.filter(invoice => {
    const invoiceWithDetails = getInvoiceWithDetails(invoice);
    const matchesSearch = (
      invoice.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoiceWithDetails.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.numeroFiscal && invoice.numeroFiscal.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'folio':
        aValue = a.folio || '';
        bValue = b.folio || '';
        break;
      case 'numeroFiscal':
        aValue = a.numeroFiscal || '';
        bValue = b.numeroFiscal || '';
        break;
      case 'client':
        const aClient = getInvoiceWithDetails(a).client?.name || '';
        const bClient = getInvoiceWithDetails(b).client?.name || '';
        aValue = aClient;
        bValue = bClient;
        break;
      case 'issueDate':
        aValue = new Date(a.issueDate || 0);
        bValue = new Date(b.issueDate || 0);
        break;
      case 'dueDate':
        aValue = new Date(a.dueDate || 0);
        bValue = new Date(b.dueDate || 0);
        break;
      case 'daysUntilDue':
        const aDue = new Date(a.dueDate || 0);
        const bDue = new Date(b.dueDate || 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        aDue.setHours(0, 0, 0, 0);
        bDue.setHours(0, 0, 0, 0);
        aValue = Math.floor((aDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        bValue = Math.floor((bDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        break;
      case 'total':
        aValue = Number(a.total) || 0;
        bValue = Number(b.total) || 0;
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreateInvoice = async (data: any) => {
    try {
      await createInvoice(data);
      setShowForm(false);
      setPreselectedClosureId(null);
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
    if (window.confirm('¿Está seguro de que desea eliminar esta factura?')) {
      try {
        await deleteInvoice(id);
        toast.success("Factura eliminada", {
          description: "La factura ha sido eliminada exitosamente.",
        });
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      await markAsPaid(id);
      // Manual refresh after marking as paid
      setTimeout(() => {
        refetch();
      }, 500);
      toast.success("Factura marcada como pagada", {
        description: "El estado de la factura ha sido actualizado.",
      });
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
    }
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
    batchProgress.start('Eliminando Facturas', invoiceIds.length);
    let errorCount = 0;
    
    try {
      for (let i = 0; i < invoiceIds.length; i++) {
        const id = invoiceIds[i];
        const invoice = invoices.find(inv => inv.id === id);
        batchProgress.update(i + 1, invoice?.folio || id);
        try {
          await deleteInvoice(id);
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
    } catch (error) {
      console.error('Error deleting invoices:', error);
      batchProgress.error('Error al eliminar');
    }
  };

  const handleBatchExport = (invoiceIds: string[]) => {
    // TODO: Implement batch export functionality
    toast.success(`Exportando ${invoiceIds.length} facturas...`);
  };

  const handleClearSelection = () => {
    setSelectedInvoiceIds([]);
  };

  const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(inv.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;

    return {
      totalInvoiced,
      totalPaid,
      pendingAmount,
      overdueInvoices
    };
  }, [filteredInvoices]);

  if (showForm) {
    return (
      <div className="space-y-6">
        <InvoiceForm
          invoice={editingInvoice}
          preselectedClosureId={preselectedClosureId}
          onSubmit={editingInvoice ? handleUpdateInvoice : handleCreateInvoice}
          onCancel={() => {
            setShowForm(false);
            setEditingInvoice(null);
            setPreselectedClosureId(null);
          }}
        />
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
        <TabsList className="grid w-full grid-cols-5 max-w-3xl mx-auto bg-card border-border">
          <TabsTrigger value="invoices" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Facturas
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Alertas
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Conciliación
          </TabsTrigger>
          <TabsTrigger value="history" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          <InvoicesHeader 
            onCreateInvoice={() => setShowForm(true)} 
            onOpenExportModal={() => setExportModalOpen(true)}
          />
          
          <InvoicesStats invoices={invoices} />
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-grow">
              <InvoicesSearch
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </div>
            <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
              {Object.entries(INVOICE_STATUS_MAP).map(([statusKey, statusValue]) => (
                <Button
                  key={statusKey}
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter(statusKey)}
                  className={cn(
                    'capitalize text-muted-foreground hover:text-foreground px-3 py-1 text-sm',
                    statusFilter === statusKey && 'bg-primary text-primary-foreground'
                  )}
                >
                  {statusValue}
                </Button>
              ))}
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

        <TabsContent value="history">
          <PaymentHistory />
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
    </div>
  );
};

export default Invoices;
