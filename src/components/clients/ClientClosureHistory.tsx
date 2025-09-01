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
  <Card className="bg-white/5 border-tms-green/30">
    <CardContent className="p-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-tms-green/10 rounded-lg">
          <Icon className="h-5 w-5 text-tms-green" />
        </div>
        <div>
          <p className="text-sm text-gray-300">{title}</p>
          <p className="text-lg font-semibold text-white">{value}</p>
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
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white">Historial de Cierres</CardTitle>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              No hay cierres registrados para este cliente.
            </div>
          ) : (
            <div className="space-y-4">
              {closures.map((closure) => (
                <div
                  key={closure.id}
                  className="border border-tms-green/30 rounded-lg p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{closure.folio}</span>
                        {getStatusBadge(closure.status)}
                      </div>
                      <div className="text-sm text-gray-300">
                        Período: {formatForDisplay(parseFromDatabase(closure.dateRange.from))} - {formatForDisplay(parseFromDatabase(closure.dateRange.to))}
                      </div>
                      <div className="text-sm text-gray-300">
                        Servicios incluidos: {closure.serviceIds.length}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {formatCurrency(closure.total)}
                      </div>
                      <div className="text-sm text-gray-300">
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