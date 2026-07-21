import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { ReportMetrics } from '@/hooks/useReports';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { toTitleCase } from '@/lib/utils';

interface ReportsDashboardProps {
  metrics: ReportMetrics;
}

const statusColors: Record<string, string> = {
  completed: 'border-success/30 bg-success/10 text-success',
  pending: 'border-warning/30 bg-warning/10 text-warning',
  in_progress: 'border-info/30 bg-info/10 text-info',
  cancelled: 'border-danger/30 bg-danger/10 text-danger',
  scheduled: 'border-primary/30 bg-primary/10 text-primary',
};

const statusLabels: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  cancelled: 'Cancelado',
  scheduled: 'Programado',
};

const rankBadgeColors = [
  'bg-warning text-warning-foreground',
  'bg-muted text-foreground',
  'bg-primary text-primary-foreground',
];

export const ReportsDashboard = ({ metrics }: ReportsDashboardProps) => {
  const maxClientRevenue = metrics.topClients.length > 0 ? metrics.topClients[0].revenue : 1;
  const maxCraneServices = metrics.craneUtilization.length > 0 ? metrics.craneUtilization[0].services : 1;

  return (
    <div className="space-y-4">

      {/* Distribución de Servicios */}
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Distribución de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.servicesByStatus.map((status) => (
              <div key={status.status} className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{status.count}</div>
                <Badge className={`${statusColors[status.status] || 'bg-muted text-foreground'} text-xs`}>
                  {statusLabels[status.status] || status.status}
                </Badge>
                <div className="text-xs text-muted-foreground">{status.percentage.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Trophy className="size-5 text-warning" />
              Top 5 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topClients.slice(0, 5).map((client, index) => (
                <div key={client.clientId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0 ${index < 3 ? rankBadgeColors[index] : 'bg-muted text-muted-foreground'}`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-sm truncate">
                          {toTitleCase(client.clientName)}
                        </div>
                        {client.department && client.department !== 'General' && (
                          <div className="text-xs text-muted-foreground truncate">{client.department}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-sm font-bold text-primary">
                        ${client.revenue.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{client.services} servicios</div>
                    </div>
                  </div>
                  <Progress 
                    value={(client.revenue / maxClientRevenue) * 100} 
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Utilización de Grúas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.craneUtilization.slice(0, 5).map((crane) => {
                const utilizationColor = crane.utilization >= 50 
                  ? 'text-success-text'
                  : crane.utilization >= 20 
                    ? 'text-warning-text'
                    : 'text-danger-text';
                
                return (
                  <div key={crane.craneId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-sm truncate">{crane.craneName}</div>
                        <div className="text-xs text-muted-foreground">{crane.services} servicios</div>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ml-2 ${utilizationColor}`}>
                        {crane.utilization.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={(crane.services / maxCraneServices) * 100} 
                      className="h-1.5"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
