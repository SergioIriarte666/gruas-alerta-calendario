
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Service } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { Eye, Truck, Calendar, User, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { toTitleCase } from '@/lib/utils';

interface RecentServicesTableProps {
  services: Service[];
  onViewDetails: (serviceId: string) => void;
}

export const RecentServicesTable = ({ services, onViewDetails }: RecentServicesTableProps) => {
  const isMobile = useIsMobile();

  const renderMobileView = () => (
    <div className="space-y-3 p-3">
      {services.map((service) => (
        <Card key={service.id} className="border-border/70 bg-background/70 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Badge variant="outline" className="border-primary/20 bg-primary/10 font-medium text-primary">
                  #{service.folio}
                </Badge>
              </div>
              {getServiceStatusBadge(service.status)}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center text-foreground">
                <Calendar className="size-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                {formatForDisplay(service.serviceDate)}
              </div>
              <div className="flex items-center text-foreground">
                <User className="size-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{service.client?.name ? toTitleCase(service.client.name) : 'N/A'}</span>
              </div>
              <div className="flex items-center font-semibold text-primary">
                <DollarSign className="size-3.5 mr-2 flex-shrink-0" />
                {formatCurrency(getDisplayServiceValue(service))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => onViewDetails(service.id)}
            >
              <Eye className="size-4 mr-1" />
              Ver detalles
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Card className="dashboard-panel border-border/70 bg-card/80 shadow-sm">
      <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-4"}>
        <CardTitle className={`flex items-center gap-x-3 text-foreground ${isMobile ? 'text-base' : 'text-xl'}`}>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Truck className={`${isMobile ? 'size-4' : 'size-5'}`} />
          </div>
          <span>Servicios Recientes</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "p-0" : "p-0"}>
        {services.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="mb-4 inline-flex rounded-2xl bg-muted p-4">
              <Truck className="mx-auto size-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">No hay servicios registrados</p>
            <p className="mt-2 text-sm text-muted-foreground">Los servicios aparecerán aquí una vez que se registren.</p>
          </div>
        ) : isMobile ? (
          renderMobileView()
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead className="px-6 py-4 font-semibold text-foreground">Folio</TableHead>
                  <TableHead className="py-4 font-semibold text-foreground">Fecha</TableHead>
                  <TableHead className="py-4 font-semibold text-foreground">Cliente</TableHead>
                  <TableHead className="py-4 font-semibold text-foreground">Vehículo</TableHead>
                  <TableHead className="py-4 font-semibold text-foreground">Valor</TableHead>
                  <TableHead className="py-4 font-semibold text-foreground">Estado</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className="border-border/60 transition-colors hover:bg-accent/20">
                    <TableCell className="px-6 py-4 font-medium text-primary">
                      #{service.folio}
                    </TableCell>
                    <TableCell className="py-4 text-foreground">
                      {formatForDisplay(service.serviceDate)}
                    </TableCell>
                    <TableCell className="py-4 text-foreground">
                      <div className="font-medium">{service.client?.name ? toTitleCase(service.client.name) : 'N/A'}</div>
                    </TableCell>
                    <TableCell className="py-4 text-foreground">
                      <div className="font-medium">{formatVehicleInfo(service)}</div>
                    </TableCell>
                    <TableCell className="py-4 text-foreground">
                      <span className="font-semibold">{formatCurrency(getDisplayServiceValue(service))}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {getServiceStatusBadge(service.status)}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary transition-colors hover:bg-primary/10 hover:text-primary"
                        onClick={() => onViewDetails(service.id)}
                        title="Ver detalles del servicio"
                      >
                        <Eye className="size-4" />
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
