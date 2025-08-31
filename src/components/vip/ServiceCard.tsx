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

interface ServiceCardProps {
  service: Service;
  columnColor: string;
  onUpdate: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  columnColor,
  onUpdate
}) => {
  // Calcular días desde la fecha del servicio
  const serviceDate = new Date(service.serviceDate);
  const daysSince = Math.floor((new Date().getTime() - serviceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determinar color de urgencia
  const getUrgencyColor = () => {
    if (service.status === 'invoiced' || service.status === 'completed') return 'text-gray-400';
    if (daysSince > 7) return 'text-red-400';
    if (daysSince > 3) return 'text-amber-400';
    return 'text-green-400';
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
    <Card className={`${columnColor} border-opacity-50 hover:border-opacity-75 transition-all duration-200 cursor-pointer group`}>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                {service.folio}
              </Badge>
              {service.purchaseOrderNumber && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300">
                  {service.purchaseOrderNumber}
                </Badge>
              )}
            </div>
            <h4 className="font-medium text-white text-sm truncate">
              {service.serviceType.name}
            </h4>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
          >
            <Eye className="w-3 h-3" />
          </Button>
        </div>

        {/* Service Details */}
        <div className="space-y-2 text-xs">
          {/* Date and Time */}
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="w-3 h-3" />
            <span>{format(serviceDate, 'dd/MM/yyyy', { locale: es })}</span>
            <span className={`ml-auto font-medium ${getUrgencyColor()}`}>
              {daysSince === 0 ? 'Hoy' : 
               daysSince === 1 ? 'Ayer' : 
               `${daysSince}d`}
            </span>
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-3 h-3 flex-shrink-0" />
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
            <div className="flex items-center gap-2 text-gray-300">
              <Truck className="w-3 h-3" />
              <span className="truncate">
                {service.vehicleBrand} {service.vehicleModel} • {service.licensePlate}
              </span>
            </div>
          )}

          {/* Operator */}
          {service.operator && (
            <div className="flex items-center gap-2 text-gray-300">
              <User className="w-3 h-3" />
              <span className="truncate">{service.operator.name}</span>
            </div>
          )}

          {/* Value */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-700">
            <div className="flex items-center gap-2 text-green-400">
              <DollarSign className="w-3 h-3" />
              <span className="font-medium">
                ${service.value.toLocaleString()}
              </span>
            </div>
            
            {/* Status Badge */}
            <Badge 
              variant="outline" 
              className="text-xs px-1.5 py-0.5 border-current opacity-70"
            >
              {getStatusLabel()}
            </Badge>
          </div>

          {/* Purchase Order Number (if exists) */}
          {service.purchaseOrder && (
            <div className="flex items-center gap-2 text-blue-300 bg-blue-500/10 rounded px-2 py-1">
              <FileText className="w-3 h-3" />
              <span className="text-xs">O.C: {service.purchaseOrder}</span>
            </div>
          )}

          {/* Time indicators for special states */}
          {(service.status === 'quoted' || service.status === 'purchase_order_pending') && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 rounded px-2 py-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                {service.status === 'quoted' ? 'Esperando respuesta' : 'Esperando orden de compra'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};