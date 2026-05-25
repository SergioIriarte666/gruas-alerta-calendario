import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

interface HistoricalPurchasesStatsProps {
  invoices: SupplierInvoiceWithDetails[];
}

export const HistoricalPurchasesStats = ({ invoices }: HistoricalPurchasesStatsProps) => {
  const stats = {
    totalCount: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
    pendingAmount: invoices
      .filter((inv) => inv.status === 'pending' || inv.status === 'draft')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0),
    overdueAmount: invoices
      .filter((inv) => inv.status === 'overdue')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0),
    paidAmount: invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0),
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
          <CreditCard className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCount}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(stats.totalAmount)} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendiente de Pago</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</div>
          <p className="text-xs text-muted-foreground">
            Por pagar
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Vencido</CardTitle>
          <AlertCircle className="size-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdueAmount)}</div>
          <p className="text-xs text-muted-foreground">
            Requiere atención
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pagado</CardTitle>
          <CheckCircle2 className="size-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidAmount)}</div>
          <p className="text-xs text-muted-foreground">
            Completado
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
