
import React from 'react';
import { useClientInvoices } from '@/hooks/portal/useClientInvoices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const statusConfig: { [key: string]: { label: string; className: string } } = {
    paid: { label: 'Pagada', className: 'bg-green-500' },
    sent: { label: 'Enviada', className: 'bg-blue-500' },
    draft: { label: 'Borrador', className: 'bg-gray-500' },
    overdue: { label: 'Vencida', className: 'bg-red-500' },
    cancelled: { label: 'Cancelada', className: 'bg-gray-500' },
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-500' };
  return <Badge className={`${config.className} text-white`}>{config.label}</Badge>;
};

const PortalInvoices = () => {
  const { data: invoices, isLoading, isError, error } = useClientInvoices();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-gray-700" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-900/20 rounded-lg">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-white">Error al cargar facturas</h3>
          <p className="text-red-400">{error?.message || 'Ocurrió un error inesperado.'}</p>
        </div>
      );
    }

    if (!invoices || invoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800/50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-white">Sin facturas</h3>
          <p className="text-gray-400">No hemos encontrado facturas asociadas a su cuenta.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-gray-800/50">
              <TableHead className="text-gray-300">Folio</TableHead>
              <TableHead className="text-gray-300">Fecha Emisión</TableHead>
              <TableHead className="text-gray-300">Fecha Vencimiento</TableHead>
              <TableHead className="text-gray-300 text-right">Total</TableHead>
              <TableHead className="text-gray-300 text-center">Estado</TableHead>
              <TableHead className="text-gray-300 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="border-gray-700 hover:bg-gray-800/50">
                <TableCell className="font-medium text-tms-green">{invoice.folio}</TableCell>
                <TableCell className="text-gray-300">
                  {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell className="text-gray-300">
                  {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell className="text-gray-300 font-semibold text-right">
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                    title="Descargar factura"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const totalPorPagar = invoices?.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0) || 0;
  const totalVencido = invoices?.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0) || 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Mis Facturas</h1>
        {invoices && (
          <Badge variant="outline" className="text-tms-green border-tms-green">
            {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Resumen de facturas */}
      {invoices && invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400">Total por Pagar</h3>
            <p className="text-xl font-bold text-yellow-500">{formatCurrency(totalPorPagar)}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400">Total Vencido</h3>
            <p className="text-xl font-bold text-red-500">{formatCurrency(totalVencido)}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400">Total Facturas</h3>
            <p className="text-xl font-bold text-white">{invoices.length}</p>
          </div>
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default PortalInvoices;
