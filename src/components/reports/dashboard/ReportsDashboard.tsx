import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { ReportMetrics } from '@/hooks/useReports';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ReportsDashboardProps {
  metrics: ReportMetrics;
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  scheduled: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

const statusLabels: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  cancelled: 'Cancelado',
  scheduled: 'Programado',
};

const rankBadgeColors = [
  'bg-yellow-500 text-white',
  'bg-gray-400 text-white',
  'bg-amber-700 text-white',
];

export const ReportsDashboard = ({ metrics }: ReportsDashboardProps) => {
  const maxClientRevenue = metrics.topClients.length > 0 ? metrics.topClients[0].revenue : 1;
  const maxCraneServices = metrics.craneUtilization.length > 0 ? metrics.craneUtilization[0].services : 1;

  return (
    <div className="space-y-4">

      {/* Distribución de Servicios */}
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="text-foreground">Distribución de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.servicesByStatus.map((status) => (
              <div key={status.status} className="text-center p-4 bg-muted/50 rounded-lg space-y-2">
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
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Top 5 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topClients.slice(0, 5).map((client, index) => (
                <div key={client.clientId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${index < 3 ? rankBadgeColors[index] : 'bg-muted text-muted-foreground'}`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-sm truncate">
                          {client.clientName}
                        </div>
                        {client.department && client.department !== 'General' && (
                          <div className="text-xs text-muted-foreground truncate">{client.department}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-sm font-bold text-violet-600 dark:text-violet-400">
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

        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">Utilización de Grúas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.craneUtilization.slice(0, 5).map((crane) => {
                const utilizationColor = crane.utilization >= 50 
                  ? 'text-green-600 dark:text-green-400' 
                  : crane.utilization >= 20 
                    ? 'text-yellow-600 dark:text-yellow-400' 
                    : 'text-red-600 dark:text-red-400';
                
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
