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
import InvoicesTable from '@/components/invoices/InvoicesTable';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AppPagination } from '@/components/shared/AppPagination';

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

  const filteredInvoices = invoices.filter(invoice => {
    const invoiceWithDetails = getInvoiceWithDetails(invoice);
    const matchesSearch = (
      invoice.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoiceWithDetails.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.numeroFiscal && invoice.numeroFiscal.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
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
        <div className="text-white">Cargando facturas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto bg-white/10 backdrop-blur-sm border-white/20">
              <TabsTrigger value="invoices" className="text-white data-[state=active]:bg-white/20">
                Facturas
              </TabsTrigger>
              <TabsTrigger value="alerts" className="text-white data-[state=active]:bg-white/20">
                Alertas
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-white data-[state=active]:bg-white/20">
                Conciliación
              </TabsTrigger>
              <TabsTrigger value="history" className="text-white data-[state=active]:bg-white/20">
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
          
          <InvoicesTable
            invoices={paginatedInvoices}
            onEdit={handleEditInvoice}
            onDelete={handleDeleteInvoice}
            onMarkAsPaid={handleMarkAsPaid}
            getInvoiceWithDetails={getInvoiceWithDetails}
            onRefresh={handleRefresh}
          />

          <AppPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
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
