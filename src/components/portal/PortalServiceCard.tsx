
import React from 'react';
import { ClientService } from '@/hooks/portal/useClientServices';
import { Badge } from '@/components/ui/badge';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { getServiceStatusBadge, formatCurrency, formatVehicleInfo } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

interface PortalServiceCardProps {
  service: ClientService;
}


export const PortalServiceCard: React.FC<PortalServiceCardProps> = ({ service }) => {
  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-violet-700">{service.folio}</h3>
        <div className="flex items-center gap-2">
          {getServiceStatusBadge(service.status)}
          {service.is_portal_request && (
            <Badge className="border-amber-200 bg-amber-50 text-xs text-amber-700">
              Solicitud pendiente de asignación
            </Badge>
          )}
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Fecha:</span>
          <span className="text-[#0f172a]">
            {formatForDisplay(parseFromDatabase(service.service_date))}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Tipo:</span>
          <span className="text-[#0f172a]">{service.service_type_name}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Ruta:</span>
          <span className="max-w-xs truncate text-right text-[#0f172a]" title={`${service.origin} → ${service.destination}`}>
            {service.origin} → {service.destination}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Vehículo:</span>
          <span className="text-[#0f172a]">{formatVehicleInfo(service)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Grúa:</span>
          <span className="text-[#0f172a]">{service.crane_license_plate}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-[#94a3b8]">Valor:</span>
          <span className="font-semibold text-[#0f172a]">{formatCurrency(getDisplayServiceValue(service))}</span>
        </div>
      </div>
    </div>
  );
};
