
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
  );
};

export default InvoicesStats;
