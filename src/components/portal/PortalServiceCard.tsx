
import React from 'react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { getServiceStatusBadge, formatCurrency, shouldShowVehicleInfo, formatVehicleInfo } from '@/utils/statusHelpers';

interface PortalServiceCardProps {
  service: any;
}


export const PortalServiceCard: React.FC<PortalServiceCardProps> = ({ service }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-tms-green">{service.folio}</h3>
        {getServiceStatusBadge(service.status)}
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Fecha:</span>
          <span className="text-white">
            {formatForDisplay(parseFromDatabase(service.service_date))}
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
        
        {shouldShowVehicleInfo(service) && (
          <div className="flex justify-between">
            <span className="text-gray-400">Vehículo:</span>
            <span className="text-white">{formatVehicleInfo(service)}</span>
          </div>
        )}
        
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
