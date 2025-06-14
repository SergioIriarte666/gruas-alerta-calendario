
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Service } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentServicesTableProps {
  services: Service[];
}

export const RecentServicesTable = ({ services }: RecentServicesTableProps) => {
  const getStatusBadge = (status: Service['status']) => {
    const variants = {
      pending: 'status-pending',
      closed: 'status-closed',
      invoiced: 'status-invoiced'
    };

    const labels = {
      pending: 'En Curso',
      closed: 'Cerrado',
      invoiced: 'Facturado'
    };

    return (
      <Badge className={`status-badge ${variants[status]}`}>
        {labels[status]}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Truck className="w-5 h-5 text-tms-green" />
          <span>Servicios Recientes</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay servicios registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Folio</TableHead>
                  <TableHead className="text-gray-300">Fecha</TableHead>
                  <TableHead className="text-gray-300">Cliente</TableHead>
                  <TableHead className="text-gray-300">Vehículo</TableHead>
                  <TableHead className="text-gray-300">Valor</TableHead>
                  <TableHead className="text-gray-300">Estado</TableHead>
                  <TableHead className="text-gray-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className="border-gray-700 hover:bg-white/5">
                    <TableCell className="font-medium text-tms-green">
                      {service.folio}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {service.client.name}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {service.vehicleBrand} {service.vehicleModel}
                      <div className="text-sm text-gray-500">{service.licensePlate}</div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {formatCurrency(service.value)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(service.status)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-tms-green hover:text-tms-green-light">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
