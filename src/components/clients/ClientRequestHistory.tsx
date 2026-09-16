import { useClientRequests } from '@/hooks/useClientRequests';
import { Client, Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, FileX, Clock, TrendingUp } from 'lucide-react';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { formatVehicleInfo } from '@/utils/statusHelpers';

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
    minimumFractionDigits: 0,
  }).format(amount);
};

const getStatusBadge = (status: Service['status']) => {
  const statusConfig = {
    pending: { label: 'Pendiente', className: 'border-warning/30 bg-warning-soft text-warning' },
    cancelled: { label: 'Cancelado', className: 'border-danger/30 bg-danger-soft text-danger' },
    in_progress: { label: 'En Progreso', className: 'border-info/30 bg-info-soft text-info' },
    completed: { label: 'Completado', className: 'border-success/30 bg-success-soft text-success' },
    invoiced: { label: 'Facturado', className: 'border-primary/30 bg-primary-soft text-primary' },
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
          <div className="mb-4 h-4 w-1/4 rounded bg-muted"></div>
          <div className="space-y-2">
            <div className="h-4 rounded bg-muted"></div>
            <div className="h-4 w-3/4 rounded bg-muted"></div>
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
                        <div>Vehículo: {formatVehicleInfo(request)}</div>
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
                        Solicitud: {formatForDisplay(request.requestDate)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Servicio: {formatForDisplay(request.serviceDate)}
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
