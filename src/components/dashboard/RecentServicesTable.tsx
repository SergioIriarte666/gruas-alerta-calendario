
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Service } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { Eye, Truck, Calendar, User, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shouldShowVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';

interface RecentServicesTableProps {
  services: Service[];
  onViewDetails: (serviceId: string) => void;
}

export const RecentServicesTable = ({ services, onViewDetails }: RecentServicesTableProps) => {
  const isMobile = useIsMobile();

  const renderMobileView = () => (
    <div className="space-y-3 p-3">
      {services.map((service) => (
        <Card key={service.id} className="border">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Badge variant="outline" className="text-tms-green border-tms-green/50 font-medium">
                  #{service.folio}
                </Badge>
              </div>
              {getServiceStatusBadge(service.status)}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center text-foreground">
                <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                {formatForDisplay(service.serviceDate)}
              </div>
              <div className="flex items-center text-foreground">
                <User className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{service.client?.name ?? 'N/A'}</span>
              </div>
              <div className="flex items-center text-tms-green font-semibold">
                <DollarSign className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                {formatCurrency(getDisplayServiceValue(service))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-tms-green hover:text-tms-green hover:bg-tms-green/10"
              onClick={() => onViewDetails(service.id)}
            >
              <Eye className="w-4 h-4 mr-1" />
              Ver detalles
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-4"}>
        <CardTitle className={`flex items-center space-x-3 text-black ${isMobile ? 'text-base' : 'text-xl'}`}>
          <div className="p-2 bg-tms-green/10 rounded-lg">
            <Truck className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-tms-green`} />
          </div>
          <span>Servicios Recientes</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "p-0" : "p-0"}>
        {services.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="p-4 bg-gray-50 rounded-xl inline-block mb-4">
              <Truck className="w-12 h-12 mx-auto text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg">No hay servicios registrados</p>
            <p className="text-gray-500 text-sm mt-2">Los servicios aparecerán aquí una vez que se registren</p>
          </div>
        ) : isMobile ? (
          renderMobileView()
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
                      {formatForDisplay(service.serviceDate)}
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      <div className="font-medium">{service.client?.name ?? 'N/A'}</div>
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      {shouldShowVehicleInfo(service) ? (
                        <div className="space-y-1">
                          <div className="font-medium">{service.vehicleBrand} {service.vehicleModel}</div>
                          <div className="text-sm text-gray-500 font-mono">{service.licensePlate}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">No aplica</div>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-700 py-4">
                      <span className="font-semibold">{formatCurrency(getDisplayServiceValue(service))}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {getServiceStatusBadge(service.status)}
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
