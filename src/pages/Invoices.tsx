import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';
import InvoicesHeader from '@/components/invoices/InvoicesHeader';
import InvoicesStats from '@/components/invoices/InvoicesStats';
import InvoicesSearch from '@/components/invoices/InvoicesSearch';
import InvoicesTable from '@/components/invoices/InvoicesTable';
import { Button } from '@/components/ui/button';
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
  const { invoices, loading, createInvoice, updateInvoice, deleteInvoice, markAsPaid, getInvoiceWithDetails } = useInvoices();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const statusFromQuery = queryParams.get('status');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusFromQuery || 'all');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredInvoices = invoices.filter(invoice => {
    const invoiceWithDetails = getInvoiceWithDetails(invoice);
    const matchesSearch = (
      invoice.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoiceWithDetails.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreateInvoice = (data: any) => {
    createInvoice(data);
    setShowForm(false);
    toast({
      title: "Factura creada",
      description: "La factura ha sido creada exitosamente.",
    });
  };

  const handleUpdateInvoice = (data: any) => {
    if (editingInvoice) {
      updateInvoice(editingInvoice.id, data);
      setEditingInvoice(null);
      setShowForm(false);
      toast({
        title: "Factura actualizada",
        description: "La factura ha sido actualizada exitosamente.",
      });
    }
  };

  const handleDeleteInvoice = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta factura?')) {
      deleteInvoice(id);
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido eliminada exitosamente.",
      });
    }
  };

  const handleMarkAsPaid = (id: string) => {
    markAsPaid(id);
    toast({
      title: "Factura marcada como pagada",
      description: "El estado de la factura ha sido actualizado.",
    });
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <InvoiceForm
          invoice={editingInvoice}
          onSubmit={editingInvoice ? handleUpdateInvoice : handleCreateInvoice}
          onCancel={() => {
            setShowForm(false);
            setEditingInvoice(null);
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
      />

      <AppPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default Invoices;
