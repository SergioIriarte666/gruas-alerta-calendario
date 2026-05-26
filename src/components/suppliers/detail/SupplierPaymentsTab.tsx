import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CreditCard, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCostCategories } from '@/hooks/useCostCategories';
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
  if (status === 'paid') return 'border-success/30 bg-success/10 text-success';
  if (status === 'overdue') return 'border-danger/30 bg-danger/10 text-danger';
  if (dueDate && new Date(dueDate) < new Date()) return 'border-danger/30 bg-danger/10 text-danger';
  return 'border-warning/30 bg-warning/10 text-warning';
};

const getStatusLabel = (status: string, dueDate: string | null) => {
  if (status === 'paid') return 'Pagado';
  if (status === 'overdue') return 'Vencido';
  if (dueDate && new Date(dueDate) < new Date()) return 'Vencido';
  return 'Pendiente';
};

export const SupplierPaymentsTab: React.FC<SupplierPaymentsTabProps> = ({ payments, isLoading }) => {
  const { data: costCategories = [] } = useCostCategories();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return payments;
    const term = search.toLowerCase();
    return payments.filter(p =>
      p.description?.toLowerCase().includes(term) ||
      p.reference_number?.toLowerCase().includes(term)
    );
  }, [payments, search]);

  const totals = useMemo(() => ({
    total: payments.reduce((s, p) => s + p.amount, 0),
    paid: payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
    pending: payments.filter(p => p.status !== 'paid' && p.status !== 'cancelled').reduce((s, p) => s + p.amount, 0),
  }), [payments]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <CreditCard className="size-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sin pagos</h3>
        <p className="text-muted-foreground">No hay pagos registrados para este proveedor</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {payments.length > 3 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descripción o ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
          <span>Pagado: <strong className="text-success">{formatCurrency(totals.paid)}</strong></span>
          <span>Pendiente: <strong className="text-warning">{formatCurrency(totals.pending)}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground text-xs">Descripción</TableHead>
              <TableHead className="text-muted-foreground text-xs">Ref.</TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">Monto</TableHead>
              <TableHead className="text-muted-foreground text-xs">Vencimiento</TableHead>
              <TableHead className="text-muted-foreground text-xs">Categoría</TableHead>
              <TableHead className="text-muted-foreground text-xs">F. Pago</TableHead>
              <TableHead className="text-muted-foreground text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((payment) => (
              <TableRow key={payment.id} className="border-border">
                <TableCell className="font-medium text-foreground text-sm max-w-[200px] truncate">
                  {payment.description || '-'}
                </TableCell>
                <TableCell className="text-foreground text-sm">{payment.reference_number || '-'}</TableCell>
                <TableCell className="text-right font-bold text-primary text-sm">
                  {formatCurrency(payment.amount)}
                </TableCell>
                <TableCell className="text-foreground text-sm">
                  {payment.due_date ? format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es }) : '-'}
                </TableCell>
                <TableCell className="text-foreground text-sm">
                  {resolveSupplierPaymentCategoryLabel(payment.category, costCategories, '-')}
                </TableCell>
                <TableCell className="text-foreground text-sm">
                  {payment.paid_date ? format(new Date(payment.paid_date), 'dd/MM/yyyy', { locale: es }) : '-'}
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

      {/* Total Footer */}
      <div className="flex items-center justify-end gap-4 pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">Total:</span>
        <span className="text-base font-bold text-primary">{formatCurrency(totals.total)}</span>
      </div>
    </div>
  );
};
