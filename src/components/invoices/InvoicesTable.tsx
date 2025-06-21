
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, DollarSign, FileText, CheckCircle } from 'lucide-react';
import { Invoice } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoicesTableProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  getInvoiceWithDetails: (invoice: Invoice) => any;
}

const getStatusBadge = (status: string) => {
  const statusConfig = {
    draft: { label: 'Borrador', className: 'bg-gray-600 text-white' },
    sent: { label: 'Enviada', className: 'bg-blue-600 text-white' },
    paid: { label: 'Pagada', className: 'bg-tms-green text-black' },
    overdue: { label: 'Vencida', className: 'bg-red-600 text-white' },
    cancelled: { label: 'Anulada', className: 'bg-gray-800 text-gray-300' },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  return <Badge className={config.className}>{config.label}</Badge>;
};

const InvoicesTable = ({ 
  invoices, 
  onEdit, 
  onDelete, 
  onMarkAsPaid, 
  getInvoiceWithDetails 
}: InvoicesTableProps) => {
  if (invoices.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay facturas</h3>
          <p className="text-gray-400">
            No se encontraron facturas que coincidan con los filtros aplicados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">Facturas ({invoices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-white">Folio</th>
                <th className="text-left py-3 px-4 font-medium text-white">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-white">Fecha Emisión</th>
                <th className="text-left py-3 px-4 font-medium text-white">Fecha Vencimiento</th>
                <th className="text-left py-3 px-4 font-medium text-white">Total</th>
                <th className="text-left py-3 px-4 font-medium text-white">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const invoiceWithDetails = getInvoiceWithDetails(invoice);
                return (
                  <tr key={invoice.id} className="border-b border-gray-800 hover:bg-white/5">
                    <td className="py-3 px-4 text-white font-medium">{invoice.folio}</td>
                    <td className="py-3 px-4 text-white">
                      {invoiceWithDetails.client?.name || 'Cliente no encontrado'}
                    </td>
                    <td className="py-3 px-4 text-white">
                      {format(new Date(invoice.issueDate), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="py-3 px-4 text-white">
                      {format(new Date(invoice.dueDate), 'dd/MM/yyyy', { locale: es })}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      ${invoice.total.toLocaleString('es-CL')}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(invoice)}
                          className="text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50"
                          title="Editar factura"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {invoice.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onMarkAsPaid(invoice.id)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/50"
                            title="Marcar como pagada"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(invoice.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50"
                          title="Eliminar factura"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoicesTable;
