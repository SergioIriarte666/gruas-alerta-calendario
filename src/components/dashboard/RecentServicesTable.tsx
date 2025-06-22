
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Service, ServiceStatus } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentServicesTableProps {
  services: Service[];
  onViewDetails: (serviceId: string) => void;
}

export const RecentServicesTable = ({ services, onViewDetails }: RecentServicesTableProps) => {
  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'pending':
      case 'in_progress':
        return <Badge className="bg-amber-500 hover:bg-amber-500/80 text-white font-semibold">En Curso</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500 hover:bg-emerald-500/80 text-white font-semibold">Completado</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500 hover:bg-red-500/80 text-white font-semibold">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-3 text-black text-xl">
          <div className="p-2 bg-tms-green/10 rounded-lg">
            <Truck className="w-6 h-6 text-tms-green" />
          </div>
          <span>Servicios Recientes</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {services.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="p-4 bg-gray-50 rounded-xl inline-block mb-4">
              <Truck className="w-12 h-12 mx-auto text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg">No hay servicios registrados</p>
            <p className="text-gray-500 text-sm mt-2">Los servicios aparecerán aquí una vez que se registren</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50/50">
                  <TableHead className="text-gray-700 font-semibold py-4 px-6">Folio</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4">Fecha</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4">Cliente</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4">Vehículo</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4">Valor</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4">Estado</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4 px-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className="border-gray-200 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-medium text-tms-green py-4 px-6">
                      {service.folio}
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      {service.serviceDate ? format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      <div className="font-medium">{service.client?.name ?? 'N/A'}</div>
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      <div className="space-y-1">
                        <div className="font-medium">{service.vehicleBrand} {service.vehicleModel}</div>
                        <div className="text-sm text-gray-500 font-mono">{service.licensePlate}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      <span className="font-semibold">{formatCurrency(service.value)}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(service.status)}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-tms-green hover:text-tms-green hover:bg-tms-green/10 transition-colors"
                        onClick={() => onViewDetails(service.id)}
                        title="Ver detalles del servicio"
                      >
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
