import { useClientRequests } from '@/hooks/useClientRequests';
import { Client, Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, FileX, Clock, TrendingUp } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';

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

const getStatusBadge = (status: Service['status']) => {
  const statusConfig = {
    pending: { label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    cancelled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    in_progress: { label: 'En Progreso', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    completed: { label: 'Completado', className: 'bg-tms-green/20 text-tms-green border-tms-green/30' },
    invoiced: { label: 'Facturado', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  };

  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
};

export const ClientRequestHistory = ({ client }: { client: Client }) => {
  const { requests, loading, metrics } = useClientRequests(client.id);

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
      {/* Métricas de Solicitudes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={CalendarDays}
          title="Total Solicitudes"
          value={metrics.totalRequests}
        />
        <MetricCard
          icon={Clock}
          title="Pendientes"
          value={metrics.pendingRequests}
        />
        <MetricCard
          icon={FileX}
          title="Canceladas"
          value={metrics.cancelledRequests}
        />
        <MetricCard
          icon={TrendingUp}
          title="Valor Solicitado"
          value={formatCurrency(metrics.totalRequestedValue)}
        />
      </div>

      {/* Lista de Solicitudes */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Historial de Solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay solicitudes pendientes o canceladas para este cliente.
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="tms" className="whitespace-nowrap">{request.folio}</Badge>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Tipo: {request.serviceType.name}</div>
                        {shouldShowVehicleInfo(request) && (
                          <div>Vehículo: {formatVehicleInfo(request)}</div>
                        )}
                        <div>Origen: {request.origin}</div>
                        <div>Destino: {request.destination}</div>
                        {request.purchaseOrder && (
                          <div>OC: {request.purchaseOrder}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-lg font-semibold text-foreground">
                        {formatCurrency(request.value)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Solicitud: {formatForDisplay(parseFromDatabase(request.requestDate))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Servicio: {formatForDisplay(parseFromDatabase(request.serviceDate))}
                      </div>
                      {request.crane && (
                        <div className="text-xs text-muted-foreground">
                          Grúa: {request.crane.licensePlate}
                        </div>
                      )}
                      {request.operator && (
                        <div className="text-xs text-muted-foreground">
                          Operador: {request.operator.name}
                        </div>
                      )}
                    </div>
                  </div>
                  {request.observations && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Observaciones:</span> {request.observations}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};