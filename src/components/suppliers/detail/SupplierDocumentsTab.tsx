import { businessClock } from '@/utils/businessClock';

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Search } from 'lucide-react';
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
    case 'paid': return 'border-success/30 bg-success/10 text-success';
    case 'partial': return 'border-warning/30 bg-warning/10 text-warning';
    case 'pending': return 'border-info/30 bg-info/10 text-info';
    case 'overdue': return 'border-danger/30 bg-danger/10 text-danger';
    default: return 'border-border/70 bg-muted/40 text-muted-foreground';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'paid': return 'Pagado';
    case 'partial': return 'Parcial';
    case 'pending': return 'Pendiente';
    case 'overdue': return 'Vencido';
    default: return status;
  }
};

export const SupplierDocumentsTab: React.FC<SupplierDocumentsTabProps> = ({ invoices, isLoading }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const term = search.toLowerCase();
    return invoices.filter(i => i.invoice_number.toLowerCase().includes(term));
  }, [invoices, search]);

  const totals = useMemo(() => ({
    amount: invoices.reduce((s, i) => s + i.amount, 0),
    balance: invoices.reduce((s, i) => s + i.balance, 0),
  }), [invoices]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sin documentos</h3>
        <p className="text-muted-foreground">No hay facturas o documentos registrados para este proveedor</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {invoices.length > 3 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar N° factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
          <span>Saldo pendiente: <strong className="text-warning">{formatCurrency(totals.balance)}</strong></span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground text-xs">N° Factura</TableHead>
              <TableHead className="text-muted-foreground text-xs">Emisión</TableHead>
              <TableHead className="text-muted-foreground text-xs">Vencimiento</TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">Monto</TableHead>
              <TableHead className="text-muted-foreground text-xs text-right">Saldo</TableHead>
              <TableHead className="text-muted-foreground text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((invoice) => (
              <TableRow key={invoice.id} className="border-border">
                <TableCell className="font-medium text-foreground text-sm">{invoice.invoice_number}</TableCell>
                <TableCell className="text-foreground text-sm">
                  {invoice.issue_date ? businessClock.format(invoice.issue_date, 'dd/MM/yyyy', { locale: es }) : '-'}
                </TableCell>
                <TableCell className="text-foreground text-sm">
                  {invoice.due_date ? businessClock.format(invoice.due_date, 'dd/MM/yyyy', { locale: es }) : '-'}
                </TableCell>
                <TableCell className="text-right font-bold text-primary text-sm">
                  {formatCurrency(invoice.amount)}
                </TableCell>
                <TableCell className="text-right text-foreground text-sm">{formatCurrency(invoice.balance)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(invoice.status)}>{getStatusLabel(invoice.status)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Total Footer */}
      <div className="flex items-center justify-end gap-4 pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground">Total:</span>
        <span className="text-base font-bold text-primary">{formatCurrency(totals.amount)}</span>
      </div>
    </div>
  );
};
