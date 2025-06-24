
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PortalServiceCardProps {
  service: any;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const statusConfig: { [key: string]: { label: string; className: string } } = {
    pending: { label: 'Pendiente', className: 'bg-yellow-500' },
    in_progress: { label: 'En Progreso', className: 'bg-blue-500' },
    completed: { label: 'Completado', className: 'bg-green-500' },
    cancelled: { label: 'Cancelado', className: 'bg-red-500' },
    invoiced: { label: 'Facturado', className: 'bg-purple-500' },
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-500' };

  return <Badge className={`${config.className} text-white`}>{config.label}</Badge>;
};

export const PortalServiceCard: React.FC<PortalServiceCardProps> = ({ service }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-tms-green">{service.folio}</h3>
        {getStatusBadge(service.status)}
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Fecha:</span>
          <span className="text-white">
            {format(new Date(service.service_date), 'dd/MM/yyyy', { locale: es })}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Tipo:</span>
          <span className="text-white">{service.service_type_name}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Ruta:</span>
          <span className="text-white text-right max-w-xs truncate" title={`${service.origin} → ${service.destination}`}>
            {service.origin} → {service.destination}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Grúa:</span>
          <span className="text-white">{service.crane_license_plate}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Operador:</span>
          <span className="text-white">{service.operator_name}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Valor:</span>
          <span className="text-white font-semibold">{formatCurrency(service.value)}</span>
        </div>
      </div>
    </div>
  );
};
