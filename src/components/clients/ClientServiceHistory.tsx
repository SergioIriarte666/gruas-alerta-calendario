
import { Client, Service } from '@/types';
import { useClientServices } from '@/hooks/useClientServices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Truck, DollarSign, Hash } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { getServiceStatusBadge, formatCurrency, formatVehicleInfo } from '@/utils/statusHelpers';

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


export const ClientServiceHistory = ({ client }: { client: Client }) => {
  const { services, loading, metrics } = useClientServices(client.id);

  if (loading) return <div className="text-center p-8 text-muted-foreground">Cargando historial de servicios...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard icon={Truck} title="Servicios Totales" value={metrics.totalServices} />
        <MetricCard icon={DollarSign} title="Total Gastado" value={formatCurrency(metrics.totalBilled)} />
        <MetricCard icon={Hash} title="Gasto Promedio" value={formatCurrency(metrics.averageTicket)} />
      </div>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Historial de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay servicios para este cliente.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Folio</TableHead>
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">Vehículo</TableHead>
                  <TableHead className="text-muted-foreground">Ruta</TableHead>
                  <TableHead className="text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map(service => (
                    <TableRow key={service.id} className="border-border">
                      <TableCell className="font-medium"><Badge variant="tms" className="whitespace-nowrap">{service.folio}</Badge></TableCell>
                      <TableCell className="text-foreground">{formatForDisplay(parseFromDatabase(service.serviceDate))}</TableCell>
                      <TableCell className="text-foreground">{formatVehicleInfo(service)}</TableCell>
                      <TableCell className="text-foreground max-w-xs truncate">{service.origin} → {service.destination}</TableCell>
                      <TableCell className="text-foreground font-semibold">{formatCurrency(service.value)}</TableCell>
                      <TableCell>
                        {getServiceStatusBadge(service.status)}
                      </TableCell>
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
