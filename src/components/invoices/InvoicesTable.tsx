
import { CheckCircle, Edit, Trash2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice } from '@/types';

interface InvoicesTableProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  getInvoiceWithDetails: (invoice: Invoice) => any;
}

const InvoicesTable = ({ invoices, onEdit, onDelete, onMarkAsPaid, getInvoiceWithDetails }: InvoicesTableProps) => {
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

  return (
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
            {invoices.map((invoice) => {
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
                          onClick={() => onMarkAsPaid(invoice.id)}
                          className="text-green-400 hover:text-green-300"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(invoice)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(invoice.id)}
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
        
        {invoices.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No hay facturas que coincidan con los filtros</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoicesTable;
