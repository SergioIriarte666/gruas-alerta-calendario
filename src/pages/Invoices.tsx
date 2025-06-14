
import React, { useState } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';
import InvoicesHeader from '@/components/invoices/InvoicesHeader';
import InvoicesStats from '@/components/invoices/InvoicesStats';
import InvoicesSearch from '@/components/invoices/InvoicesSearch';
import InvoicesTable from '@/components/invoices/InvoicesTable';

const Invoices = () => {
  const { invoices, loading, createInvoice, updateInvoice, deleteInvoice, markAsPaid, getInvoiceWithDetails } = useInvoices();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  const filteredInvoices = invoices.filter(invoice => {
    const invoiceWithDetails = getInvoiceWithDetails(invoice);
    return (
      invoice.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoiceWithDetails.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

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
      
      <InvoicesSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      
      <InvoicesTable
        invoices={filteredInvoices}
        onEdit={handleEditInvoice}
        onDelete={handleDeleteInvoice}
        onMarkAsPaid={handleMarkAsPaid}
        getInvoiceWithDetails={getInvoiceWithDetails}
      />
    </div>
  );
};

export default Invoices;
