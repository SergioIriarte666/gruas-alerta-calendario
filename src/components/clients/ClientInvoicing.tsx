
import { Client, Invoice as InvoiceType } from '@/types';
import { useClientInvoices } from '@/hooks/useClientInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, DollarSign, FileWarning, FileCheck2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
}

const MetricCard = ({ icon: Icon, title, value }: MetricCardProps) => (
  <div className="glass-card p-4 rounded-lg flex items-center space-x-4">
    <div className="p-3 bg-white/10 rounded-full">
      <Icon className="w-6 h-6 text-tms-green" />
    </div>
    <div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
};

const getStatusBadge = (status: InvoiceType['status']) => {
  const statusConfig = {
    draft: { label: 'Borrador', className: 'bg-gray-500/80 text-white' },
    sent: { label: 'Enviada', className: 'bg-blue-500/80 text-white' },
    paid: { label: 'Pagada', className: 'bg-green-500/80 text-white' },
    overdue: { label: 'Vencida', className: 'bg-orange-500/80 text-white' },
    cancelled: { label: 'Anulada', className: 'bg-red-500/80 text-white' }
  };
  const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };
  return <Badge className={`${config.className} border-none`}>{config.label}</Badge>;
};

export const ClientInvoicing = ({ client }: { client: Client }) => {
  const { invoices, loading, metrics } = useClientInvoices(client.id);

  if (loading) return <div className="text-center p-8 text-white">Cargando facturación...</div>;

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={FileText} title="Total Facturado" value={formatCurrency(metrics.totalInvoiced)} />
        <MetricCard icon={FileCheck2} title="Total Pagado" value={formatCurrency(metrics.totalPaid)} />
        <MetricCard icon={DollarSign} title="Monto Pendiente" value={formatCurrency(metrics.pendingAmount)} />
        <MetricCard icon={FileWarning} title="Facturas Vencidas" value={metrics.overdueInvoices} />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No hay facturas para este cliente.</div>
          ) : (
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-gray-300">Folio</TableHead>
                    <TableHead className="text-gray-300">F. Emisión</TableHead>
                    <TableHead className="text-gray-300">F. Venc.</TableHead>
                    <TableHead className="text-gray-300">Total</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(invoice => (
                    <TableRow key={invoice.id} className="border-gray-700">
                      <TableCell className="font-medium text-tms-green">{invoice.folio}</TableCell>
                      <TableCell className="text-gray-300">{format(new Date(invoice.issueDate), 'dd/MM/yy', { locale: es })}</TableCell>
                      <TableCell className="text-gray-300">{format(new Date(invoice.dueDate), 'dd/MM/yy', { locale: es })}</TableCell>
                      <TableCell className="text-gray-300 font-semibold">{formatCurrency(invoice.total)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
