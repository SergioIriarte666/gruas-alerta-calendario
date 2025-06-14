
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Eye, Edit, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Pagada</Badge>;
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" />Borrador</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Enviada</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Vencida</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calcular métricas
  const totalInvoices = invoices.length;
  const pendingAmount = invoices
    .filter(inv => inv.status === 'draft' || inv.status === 'sent')
    .reduce((sum, inv) => sum + inv.total, 0);
  const overdueAmount = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Facturas</h1>
          <p className="text-gray-300 mt-2">Gestiona las facturas de servicios</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-tms-green hover:bg-tms-green/90">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Total Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalInvoices}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">${pendingAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Vencidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">${overdueAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Cobradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">${paidAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por folio o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de facturas */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Lista de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Folio</TableHead>
                <TableHead className="text-gray-300">Cliente</TableHead>
                <TableHead className="text-gray-300">Fecha Emisión</TableHead>
                <TableHead className="text-gray-300">Fecha Vencimiento</TableHead>
                <TableHead className="text-gray-300">Total</TableHead>
                <TableHead className="text-gray-300">Estado</TableHead>
                <TableHead className="text-gray-300">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const invoiceWithDetails = getInvoiceWithDetails(invoice);
                return (
                  <TableRow key={invoice.id} className="border-gray-700 hover:bg-white/5">
                    <TableCell className="text-white font-medium">{invoice.folio}</TableCell>
                    <TableCell className="text-white">{invoiceWithDetails.client?.name || 'Cliente no encontrado'}</TableCell>
                    <TableCell className="text-white">{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-white">{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-white">${invoice.total.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(invoice.status === 'draft' || invoice.status === 'sent') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkAsPaid(invoice.id)}
                            className="text-green-400 hover:text-green-300"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setShowForm(true);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {filteredInvoices.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No hay facturas que coincidan con los filtros</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Invoices;
