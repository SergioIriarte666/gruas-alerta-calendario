import React from "react";
import { ClientService } from "@/hooks/portal/useClientServices";
import { Badge } from "@/components/ui/badge";
import { formatForDisplay, parseFromDatabase } from "@/utils/timezoneUtils";
import {
  getServiceStatusBadge,
  formatCurrency,
  formatVehicleInfo,
} from "@/utils/statusHelpers";
import { getDisplayServiceValue } from "@/utils/serviceValueCalculations";

interface PortalServiceCardProps {
  service: ClientService;
}

export const PortalServiceCard: React.FC<PortalServiceCardProps> = ({
  service,
}) => {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-primary">{service.folio}</h3>
        <div className="flex items-center gap-2">
          {getServiceStatusBadge(service.status)}
          {service.is_portal_request && (
            <Badge className="border-warning/30 bg-warning-soft text-xs text-warning-text">
              Solicitud pendiente de asignación
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fecha:</span>
          <span className="text-foreground">
            {formatForDisplay(parseFromDatabase(service.service_date))}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo:</span>
          <span className="text-foreground">{service.service_type_name}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Ruta:</span>
          <span
            className="max-w-xs truncate text-right text-foreground"
            title={`${service.origin} → ${service.destination}`}
          >
            {service.origin} → {service.destination}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Vehículo:</span>
          <span className="text-foreground">{formatVehicleInfo(service)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Grúa:</span>
          <span className="text-foreground">{service.crane_license_plate}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor:</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(getDisplayServiceValue(service))}
          </span>
        </div>
      </div>
    </div>
  );
};
