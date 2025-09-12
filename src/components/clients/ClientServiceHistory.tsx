
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
  <Card className="bg-white/5 border-tms-green/30">
    <CardContent className="p-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-tms-green/10 rounded-lg">
          <Icon className="h-5 w-5 text-tms-green" />
        </div>
        <div>
          <p className="text-sm text-white/80">{title}</p>
          <p className="text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);


export const ClientServiceHistory = ({ client }: { client: Client }) => {
  const { services, loading, metrics } = useClientServices(client.id);

  if (loading) return <div className="text-center p-8 text-white">Cargando historial de servicios...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard icon={Truck} title="Servicios Totales" value={metrics.totalServices} />
        <MetricCard icon={DollarSign} title="Total Gastado" value={formatCurrency(metrics.totalBilled)} />
        <MetricCard icon={Hash} title="Gasto Promedio" value={formatCurrency(metrics.averageTicket)} />
      </div>
      
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white">Historial de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-white/80">No hay servicios para este cliente.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                  <TableHead className="text-white/80">Folio</TableHead>
                  <TableHead className="text-white/80">Fecha</TableHead>
                  <TableHead className="text-white/80">Vehículo</TableHead>
                  <TableHead className="text-white/80">Ruta</TableHead>
                  <TableHead className="text-white/80">Valor</TableHead>
                  <TableHead className="text-white/80">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map(service => (
                    <TableRow key={service.id} className="border-gray-700">
                      <TableCell className="font-medium"><Badge variant="tms" className="whitespace-nowrap">{service.folio}</Badge></TableCell>
                      <TableCell className="text-white/80">{formatForDisplay(parseFromDatabase(service.serviceDate))}</TableCell>
                      <TableCell className="text-white/80">{formatVehicleInfo(service)}</TableCell>
                      <TableCell className="text-white/80 max-w-xs truncate">{service.origin} → {service.destination}</TableCell>
                      <TableCell className="text-white/80 font-semibold">{formatCurrency(service.value)}</TableCell>
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
