import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface SupplierInvoice {
  id: string;
  invoice_number: string;
  issue_date: string | null;
  due_date: string | null;
  amount: number;
  balance: number;
  status: string;
}

interface SupplierDocumentsTabProps {
  invoices: SupplierInvoice[];
  isLoading: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-600 text-white';
    case 'partial':
      return 'bg-yellow-600 text-white';
    case 'pending':
      return 'bg-blue-600 text-white';
    case 'overdue':
      return 'bg-red-600 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'paid':
      return 'Pagado';
    case 'partial':
      return 'Parcial';
    case 'pending':
      return 'Pendiente';
    case 'overdue':
      return 'Vencido';
    default:
      return status;
  }
};

export const SupplierDocumentsTab: React.FC<SupplierDocumentsTabProps> = ({ invoices, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sin documentos</h3>
        <p className="text-muted-foreground">
          No hay facturas o documentos registrados para este proveedor
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-muted-foreground">N° Factura</TableHead>
            <TableHead className="text-muted-foreground">Fecha Emisión</TableHead>
            <TableHead className="text-muted-foreground">Vencimiento</TableHead>
            <TableHead className="text-muted-foreground text-right">Monto Total</TableHead>
            <TableHead className="text-muted-foreground text-right">Saldo</TableHead>
            <TableHead className="text-muted-foreground">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="border-border">
              <TableCell className="font-medium text-foreground">
                {invoice.invoice_number}
              </TableCell>
              <TableCell className="text-foreground">
                {invoice.issue_date 
                  ? format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: es })
                  : '-'
                }
              </TableCell>
              <TableCell className="text-foreground">
                {invoice.due_date 
                  ? format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: es })
                  : '-'
                }
              </TableCell>
              <TableCell className="text-right text-foreground font-medium">
                {formatCurrency(invoice.amount)}
              </TableCell>
              <TableCell className="text-right text-foreground">
                {formatCurrency(invoice.balance)}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(invoice.status)}>
                  {getStatusLabel(invoice.status)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
