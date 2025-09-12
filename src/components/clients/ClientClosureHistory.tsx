import { useClientClosures } from '@/hooks/useClientClosures';
import { Client, ServiceClosure } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, FileText, TrendingUp, Package } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
}

const MetricCard = ({ icon: Icon, title, value }: MetricCardProps) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
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
    minimumFractionDigits: 0,
  }).format(amount);
};

const getStatusBadge = (status: ServiceClosure['status']) => {
  const statusConfig = {
    open: { label: 'Abierto', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    closed: { label: 'Cerrado', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    invoiced: { label: 'Facturado', className: 'bg-tms-green/20 text-tms-green border-tms-green/30' },
  };

  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
};

export const ClientClosureHistory = ({ client }: { client: Client }) => {
  const { closures, loading, metrics } = useClientClosures(client.id);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas de Cierres */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Package}
          title="Total Cierres"
          value={metrics.totalClosures}
        />
        <MetricCard
          icon={TrendingUp}
          title="Valor Total"
          value={formatCurrency(metrics.totalAmount)}
        />
        <MetricCard
          icon={FileText}
          title="Cerrados"
          value={metrics.closedClosures}
        />
        <MetricCard
          icon={CalendarDays}
          title="Facturados"
          value={metrics.invoicedClosures}
        />
      </div>

      {/* Lista de Cierres */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Historial de Cierres</CardTitle>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay cierres registrados para este cliente.
            </div>
          ) : (
            <div className="space-y-4">
              {closures.map((closure) => (
                <div
                  key={closure.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="tms" className="whitespace-nowrap">{closure.folio}</Badge>
                        {getStatusBadge(closure.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Período: {formatForDisplay(parseFromDatabase(closure.dateRange.from))} - {formatForDisplay(parseFromDatabase(closure.dateRange.to))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Servicios incluidos: {closure.serviceIds.length}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-foreground">
                        {formatCurrency(closure.total)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatForDisplay(parseFromDatabase(closure.createdAt))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};