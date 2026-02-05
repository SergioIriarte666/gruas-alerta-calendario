import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { resolveSupplierPaymentCategoryLabel } from '@/utils/suppliers/resolveSupplierPaymentCategory';
interface SupplierPayment {
  id: string;
  description: string | null;
  reference_number: string | null;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  category: string | null;
}

interface SupplierPaymentsTabProps {
  payments: SupplierPayment[];
  isLoading: boolean;
}

const getStatusColor = (status: string, dueDate: string | null) => {
  if (status === 'paid') return 'bg-green-600 text-white';
  if (status === 'overdue') return 'bg-red-600 text-white';
  
  // Check if pending but overdue
  if (dueDate && new Date(dueDate) < new Date()) {
    return 'bg-red-600 text-white';
  }
  
  return 'bg-yellow-600 text-white';
};

const getStatusLabel = (status: string, dueDate: string | null) => {
  if (status === 'paid') return 'Pagado';
  if (status === 'overdue') return 'Vencido';
  
  if (dueDate && new Date(dueDate) < new Date()) {
    return 'Vencido';
  }
  
  return 'Pendiente';
};

const getPaymentTypeLabel = (type: string | null) => {
  if (!type) return '-';
  switch (type) {
    case 'transfer': return 'Transferencia';
    case 'check': return 'Cheque';
    case 'cash': return 'Efectivo';
    case 'credit_card': return 'Tarjeta';
    case 'factura': return 'Factura';
    case 'boleta': return 'Boleta';
    default: return type;
  }
};

export const SupplierPaymentsTab: React.FC<SupplierPaymentsTabProps> = ({ payments, isLoading }) => {
  const { data: costCategories = [] } = useCostCategories();
  const { categories: supplierCategories = [] } = useSupplierCategoryManager();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sin pagos</h3>
        <p className="text-muted-foreground">
          No hay pagos registrados para este proveedor
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-muted-foreground">Descripción</TableHead>
            <TableHead className="text-muted-foreground">Referencia</TableHead>
            <TableHead className="text-muted-foreground text-right">Monto</TableHead>
            <TableHead className="text-muted-foreground">Vencimiento</TableHead>
            <TableHead className="text-muted-foreground">Categoría</TableHead>
            <TableHead className="text-muted-foreground">F. Pago</TableHead>
            <TableHead className="text-muted-foreground">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id} className="border-border">
              <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                {payment.description || '-'}
              </TableCell>
              <TableCell className="text-foreground">
                {payment.reference_number || '-'}
              </TableCell>
              <TableCell className="text-right text-foreground font-medium">
                {formatCurrency(payment.amount)}
              </TableCell>
              <TableCell className="text-foreground">
                {payment.due_date 
                  ? format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es })
                  : '-'
                }
              </TableCell>
              <TableCell className="text-foreground">
                {resolveSupplierPaymentCategoryLabel(payment.category, {
                  supplierCategories,
                  costCategories,
                  fallback: '-',
                })}
              </TableCell>
              <TableCell className="text-foreground">
                {payment.paid_date 
                  ? format(new Date(payment.paid_date), 'dd/MM/yyyy', { locale: es })
                  : '-'
                }
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(payment.status, payment.due_date)}>
                  {getStatusLabel(payment.status, payment.due_date)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
