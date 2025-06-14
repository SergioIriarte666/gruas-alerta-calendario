
import { Client, Service } from '@/types';
import { useClientServices } from '@/hooks/useClientServices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Truck, DollarSign, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
}

const MetricCard = ({ icon: Icon, title, value }: MetricCardProps) => (
  <div className="glass-card p-4 rounded-lg flex items-center space-x-4">
    <div className="p-3 bg-white/10 rounded-full">
      <Icon className="w-6 h-6 text-tms-green" />
    </div>
    <div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
};

const getStatusBadge = (status: Service['status']) => {
  const statusConfig = {
    pending: { label: 'Pendiente', className: 'bg-yellow-500/80 text-white' },
    in_progress: { label: 'En Progreso', className: 'bg-blue-500/80 text-white' },
    completed: { label: 'Completado', className: 'bg-green-500/80 text-white' },
    cancelled: { label: 'Cancelado', className: 'bg-red-500/80 text-white' }
  };
  const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };
  return <Badge className={`${config.className} border-none`}>{config.label}</Badge>;
};

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
      
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Historial de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No hay servicios para este cliente.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-gray-300">Folio</TableHead>
                    <TableHead className="text-gray-300">Fecha</TableHead>
                    <TableHead className="text-gray-300">Vehículo</TableHead>
                    <TableHead className="text-gray-300">Ruta</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map(service => (
                    <TableRow key={service.id} className="border-gray-700">
                      <TableCell className="font-medium text-tms-green">{service.folio}</TableCell>
                      <TableCell className="text-gray-300">{format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}</TableCell>
                      <TableCell className="text-gray-300">{service.vehicleBrand} {service.vehicleModel} ({service.licensePlate})</TableCell>
                      <TableCell className="text-gray-300 max-w-xs truncate">{service.origin} → {service.destination}</TableCell>
                      <TableCell className="text-gray-300 font-semibold">{formatCurrency(service.value)}</TableCell>
                      <TableCell>
                        {getStatusBadge(service.status)}
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
