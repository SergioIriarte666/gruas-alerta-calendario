
import { Client, Invoice as InvoiceType } from '@/types';
import { useClientInvoices } from '@/hooks/useClientInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, DollarSign, FileWarning, FileCheck2 } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { InvoiceReportExport } from './InvoiceReportExport';
import { toTitleCase } from '@/lib/utils';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
}

const MetricCard = ({ icon: Icon, title, value }: MetricCardProps) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4">
      <div className="flex items-center gap-x-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
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
    draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground' },
    sent: { label: 'Enviada', className: 'bg-info text-info-foreground' },
    paid: { label: 'Pagada', className: 'bg-success text-success-foreground' },
    overdue: { label: 'Vencida', className: 'bg-warning text-warning-foreground' },
    cancelled: { label: 'Anulada', className: 'bg-danger text-danger-foreground' }
  };
  const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-muted text-muted-foreground' };
  return <Badge className={`${config.className} border-none`}>{config.label}</Badge>;
};

export const ClientInvoicing = ({ client }: { client: Client }) => {
  const { invoices, loading, metrics } = useClientInvoices(client.id);

  if (loading) return <div className="text-center p-8 text-muted-foreground">Cargando facturación...</div>;

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={FileText} title="Total Facturado" value={formatCurrency(metrics.totalInvoiced)} />
        <MetricCard icon={FileCheck2} title="Total Pagado" value={formatCurrency(metrics.totalPaid)} />
        <MetricCard icon={DollarSign} title="Monto Pendiente" value={formatCurrency(metrics.pendingAmount)} />
        <MetricCard icon={FileWarning} title="Facturas Vencidas" value={metrics.overdueInvoices} />
      </div>

      <div className="flex justify-end mb-4">
        <InvoiceReportExport 
          clientId={client.id}
          clientName={toTitleCase(client.name)}
          invoices={invoices}
          metrics={metrics}
        />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay facturas para este cliente.</div>
          ) : (
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Folio</TableHead>
                    <TableHead className="text-muted-foreground">F. Emisión</TableHead>
                    <TableHead className="text-muted-foreground">F. Venc.</TableHead>
                    <TableHead className="text-muted-foreground">Total</TableHead>
                    <TableHead className="text-muted-foreground">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(invoice => (
                    <TableRow key={invoice.id} className="border-border">
                      <TableCell className="font-medium"><Badge variant="tms" className="whitespace-nowrap">{invoice.folio}</Badge></TableCell>
                      <TableCell className="text-foreground">{formatForDisplay(parseFromDatabase(invoice.issueDate))}</TableCell>
                      <TableCell className="text-foreground">{formatForDisplay(parseFromDatabase(invoice.dueDate))}</TableCell>
                      <TableCell className="text-foreground font-semibold">{formatCurrency(invoice.total)}</TableCell>
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
