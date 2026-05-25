import React from 'react';
import { Service } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  MapPin, 
  Truck, 
  DollarSign, 
  Clock,
  User,
  FileText,
  Eye
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

interface ServiceCardProps {
  service: Service;
  onUpdate: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onUpdate
}) => {
  // Calcular días desde la fecha del servicio
  const serviceDate = new Date(service.serviceDate);
  const daysSince = Math.floor((new Date().getTime() - serviceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determinar color de urgencia
  const getUrgencyColor = () => {
    if (service.status === 'invoiced' || service.status === 'completed') return 'text-muted-foreground';
    if (daysSince > 7) return 'text-destructive';
    if (daysSince > 3) return 'text-foreground';
    return 'text-foreground';
  };

  const getStatusLabel = () => {
    const labels = {
      'quoted': 'Cotizado',
      'purchase_order_pending': 'Esperando O.C.',
      'pending': 'Programado',
      'in_progress': 'En Progreso',
      'completed': 'Completado',
      'invoiced': 'Facturado',
      'cancelled': 'Cancelado'
    };
    return labels[service.status] || service.status;
  };

  return (
    <Card className="bg-card border hover:border-foreground/20 transition-all duration-200 cursor-pointer group">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                {service.folio}
              </Badge>
              {service.purchaseOrderNumber && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5 font-semibold">
                  {service.purchaseOrderNumber}
                </Badge>
              )}
            </div>
            <h4 className="font-medium text-foreground text-sm truncate">
              {service.serviceType.name}
            </h4>
          </div>
          <div className="flex gap-1">
            {service.status === 'purchase_order_pending' && !service.purchaseOrderNumber && (
              <Button 
                variant="ghost" 
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  // Trigger purchase order registration
                }}
              >
                <FileText className="size-3" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
            >
              <Eye className="size-3" />
            </Button>
          </div>
        </div>

        {/* Service Details */}
        <div className="space-y-2 text-xs">
          {/* Date and Time */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-3" />
            <span>{format(serviceDate, 'dd/MM/yyyy', { locale: es })}</span>
            <span className={`ml-auto font-medium ${getUrgencyColor()}`}>
              {daysSince === 0 ? 'Hoy' : 
               daysSince === 1 ? 'Ayer' : 
               `${daysSince}d`}
            </span>
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-3 flex-shrink-0" />
            <div className="truncate">
              <span className="truncate">{service.origin}</span>
              {service.destination !== service.origin && (
                <>
                  <span className="mx-1">→</span>
                  <span className="truncate">{service.destination}</span>
                </>
              )}
            </div>
          </div>

          {/* Vehicle Info */}
          {(service.vehicleBrand || service.licensePlate) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="size-3" />
              <span className="truncate">
                {service.vehicleBrand} {service.vehicleModel} • {service.licensePlate}
              </span>
            </div>
          )}

          {/* Operator */}
          {service.operator && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="size-3" />
              <span className="truncate">{service.operator.name}</span>
            </div>
          )}

          {/* Value */}
          <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-2 text-foreground">
            <DollarSign className="size-3" />
            <span className="font-medium">
              ${getDisplayServiceValue(service).toLocaleString()}
            </span>
          </div>
            
            {/* Status Badge */}
            <Badge 
              variant="secondary" 
              className="text-xs px-1.5 py-0.5 opacity-70"
            >
              {getStatusLabel()}
            </Badge>
          </div>

          {/* Purchase Order Number (if exists) */}
          {service.purchaseOrder && (
            <div className="flex items-center gap-2 bg-secondary text-secondary-foreground rounded px-2 py-1">
              <FileText className="size-3" />
              <span className="text-xs font-semibold">O.C: {service.purchaseOrder}</span>
            </div>
          )}

          {/* Quote Number (if exists) */}
          {service.quoteNumber && (
            <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded px-2 py-1">
              <FileText className="size-3" />
              <span className="text-xs font-semibold">COT: {service.quoteNumber}</span>
            </div>
          )}

          {/* Time indicators for special states */}
          {(service.status === 'quoted' || service.status === 'purchase_order_pending') && (
            <div className="flex items-center gap-2 bg-accent text-accent-foreground rounded px-2 py-1">
              <Clock className="size-3" />
              <span className="text-xs font-medium">
                {service.status === 'quoted' ? 'Esperando respuesta' : 'Esperando orden de compra'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};