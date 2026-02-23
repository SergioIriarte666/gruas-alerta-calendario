
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice } from '@/types';

interface InvoicesStatsProps {
  invoices: Invoice[];
}

const InvoicesStats = ({ invoices }: InvoicesStatsProps) => {
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{totalInvoices}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">${pendingAmount.toLocaleString()}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Vencidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">${overdueAmount.toLocaleString()}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Cobradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">${paidAmount.toLocaleString()}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesStats;
