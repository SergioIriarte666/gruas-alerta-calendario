import React from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Calendar, MapPin, User, ChevronRight, CheckCircle, Play, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
interface AssignedServiceCardProps {
  service: Service;
  showDeliveryAction?: boolean;
}
export const AssignedServiceCard = ({
  service,
  showDeliveryAction = false
}: AssignedServiceCardProps) => {
  const getStatusChip = (status: Service['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">Pendiente</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">En Progreso</span>;
      case 'inspection_completed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">Listo para Entrega</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Completado</span>;
      default:
        return null;
    }
  };
  const isCompleted = service.status === 'completed';
  const isActive = service.status === 'in_progress';
  const isPending = service.status === 'pending';
  const isReadyForDelivery = service.status === 'inspection_completed';

  // Si el servicio está completado, renderizar sin enlace
  if (isCompleted) {
    return <Card className="bg-card/60 border-border text-foreground opacity-80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold text-primary">Folio: {service.folio}</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusChip(service.status)}
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span>{service.serviceType?.name ?? 'Tipo de servicio no especificado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{service.client?.name ?? 'Cliente no especificado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{format(new Date(service.serviceDate), "eeee, dd 'de' MMMM", {
              locale: es
            })}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm">
              <p><span className="font-semibold">Origen:</span> {service.origin}</p>
              <p><span className="font-semibold">Destino:</span> {service.destination}</p>
            </div>
          </div>
          <div className="text-center text-sm text-emerald-500 font-medium mt-4">
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Servicio finalizado
          </div>
        </CardContent>
      </Card>;
  }

  // Si el servicio está activo (en progreso), renderizar sin enlace
  if (isActive) {
    return <Card className="bg-card/80 border-border text-foreground">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold text-primary">Folio: {service.folio}</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusChip(service.status)}
            <Play className="w-5 h-5 text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span>{service.serviceType?.name ?? 'Tipo de servicio no especificado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{service.client?.name ?? 'Cliente no especificado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{format(new Date(service.serviceDate), "eeee, dd 'de' MMMM", {
              locale: es
            })}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm">
              <p><span className="font-semibold">Origen:</span> {service.origin}</p>
              <p><span className="font-semibold">Destino:</span> {service.destination}</p>
            </div>
          </div>
          <div className="text-center text-sm text-blue-600 font-medium mt-4">
            <Play className="w-4 h-4 inline mr-2" />
            Servicio en progreso
          </div>
        </CardContent>
      </Card>;
  }

  // Para servicios listos para entrega
  if (isReadyForDelivery && showDeliveryAction) {
    return <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <Card className="bg-card border-accent/30 text-foreground hover:bg-card/70 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold text-primary">Folio: {service.folio}</CardTitle>
            <div className="flex items-center gap-2">
              {getStatusChip(service.status)}
              <Package className="w-5 h-5 text-orange-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span>{service.serviceType?.name ?? 'Tipo de servicio no especificado'}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{service.client?.name ?? 'Cliente no especificado'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(new Date(service.serviceDate), "eeee, dd 'de' MMMM", {
                locale: es
              })}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                <p><span className="font-semibold">Origen:</span> {service.origin}</p>
                <p><span className="font-semibold">Destino:</span> {service.destination}</p>
              </div>
            </div>
            <div className="text-center text-sm text-accent font-medium mt-4 p-2 bg-accent/10 rounded">
              <Package className="w-4 h-4 inline mr-2" />
              Hacer clic para completar entrega
            </div>
          </CardContent>
        </Card>
      </Link>;
  }

  // Solo para servicios pendientes, mostrar el enlace a inspección
  if (isPending) {
    return <Link to={`/operator/service/${service.id}/inspection`} className="block">
        <Card className="bg-card border-border text-foreground hover:bg-card/70 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold text-foreground">Folio: {service.folio}</CardTitle>
            <div className="flex items-center gap-2">
              {getStatusChip(service.status)}
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span>{service.serviceType?.name ?? 'Tipo de servicio no especificado'}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{service.client?.name ?? 'Cliente no especificado'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(new Date(service.serviceDate), "eeee, dd 'de' MMMM", {
                locale: es
              })}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                <p><span className="font-semibold">Origen:</span> {service.origin}</p>
                <p><span className="font-semibold">Destino:</span> {service.destination}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>;
  }

  // Fallback para cualquier otro estado (no debería ocurrir)
  return <Card className="bg-card border-border text-foreground">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold text-primary">Folio: {service.folio}</CardTitle>
        <div className="flex items-center gap-2">
          {getStatusChip(service.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
          <Truck className="w-4 h-4 text-muted-foreground" />
          <span>{service.serviceType?.name ?? 'Tipo de servicio no especificado'}</span>
        </div>
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <span>{service.client?.name ?? 'Cliente no especificado'}</span>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{format(new Date(service.serviceDate), "eeee, dd 'de' MMMM", {
            locale: es
          })}</span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm">
            <p><span className="font-semibold">Origen:</span> {service.origin}</p>
            <p><span className="font-semibold">Destino:</span> {service.destination}</p>
          </div>
        </div>
      </CardContent>
    </Card>;
};