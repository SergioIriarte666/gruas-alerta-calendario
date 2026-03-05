import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Truck, FileText } from 'lucide-react';
import { ReportMetrics } from '@/hooks/useReports';
import { toTitleCase } from '@/lib/utils';

interface DetailTablesProps {
  metrics: ReportMetrics;
}

export const DetailTables = ({ metrics }: DetailTablesProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Top clientes */}
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Top Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.topClients.map((client, index) => (
            <div key={client.clientId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-foreground">{toTitleCase(client.clientName)}{client.department ? ` — ${client.department}` : ''}</p>
                <p className="text-sm text-foreground">{client.services} servicios</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-green-400">${client.revenue.toLocaleString()}</p>
                <p className="text-xs text-foreground">#{index + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Recursos activos */}
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Recursos Activos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-400 mr-3" />
              <span className="text-foreground">Clientes Activos</span>
            </div>
            <span className="font-medium text-blue-400">{metrics.activeClients}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center">
              <Truck className="w-5 h-5 text-green-400 mr-3" />
              <span className="text-foreground">Grúas Activas</span>
            </div>
            <span className="font-medium text-green-400">{metrics.activeCranes}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-yellow-400 mr-3" />
              <span className="text-foreground">Operadores Activos</span>
            </div>
            <span className="font-medium text-yellow-400">{metrics.activeOperators}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);