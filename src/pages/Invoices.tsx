import React, { useState, useEffect } from 'react';
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
    try {
      for (const id of invoiceIds) {
        await markAsPaid(id);
      }
      setSelectedInvoiceIds([]);
      setTimeout(() => {
        refetch();
      }, 500);
      toast.success(`${invoiceIds.length} facturas marcadas como pagadas`);
    } catch (error) {
      console.error('Error marking invoices as paid:', error);
    }
  };

  const handleBatchDelete = async (invoiceIds: string[]) => {
    try {
      for (const id of invoiceIds) {
        await deleteInvoice(id);
      }
      setSelectedInvoiceIds([]);
      toast.success(`${invoiceIds.length} facturas eliminadas`);
    } catch (error) {
      console.error('Error deleting invoices:', error);
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
          <InvoicesHeader onCreateInvoice={() => setShowForm(true)} />
          
          <InvoicesStats invoices={invoices} />
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-grow">
              <InvoicesSearch
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </div>
            <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-lg">
              {Object.entries(INVOICE_STATUS_MAP).map(([statusKey, statusValue]) => (
                <Button
                  key={statusKey}
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter(statusKey)}
                  className={cn(
                    'capitalize text-gray-300 hover:text-white px-3 py-1 text-sm',
                    statusFilter === statusKey && 'bg-tms-green text-white hover:bg-tms-green-dark'
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
    </div>
  );
};

export default Invoices;
