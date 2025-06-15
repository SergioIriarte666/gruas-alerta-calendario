
import React from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Calendar, MapPin, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface AssignedServiceCardProps {
  service: Service;
}

export const AssignedServiceCard = ({ service }: AssignedServiceCardProps) => {
  const getStatusChip = (status: Service['status']) => {
    switch(status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300">Pendiente</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300">En Progreso</span>;
      default:
        return null;
    }
  }

  return (
    <Link to={`/operator/service/${service.id}/inspect`} className="block">
      <Card className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold text-tms-green">Folio: {service.folio}</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusChip(service.status)}
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Truck className="w-4 h-4 text-gray-400" />
            <span>{service.serviceType?.name ?? 'Tipo de servicio no especificado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-400" />
            <span>{service.client?.name ?? 'Cliente no especificado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{format(new Date(service.serviceDate), "eeee, dd 'de' MMMM", { locale: es })}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-400" />
            <div className="text-sm">
              <p><span className="font-semibold">Origen:</span> {service.origin}</p>
              <p><span className="font-semibold">Destino:</span> {service.destination}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
