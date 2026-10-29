import { useEffect, useState } from 'react';
import { Service } from '@/types';
import type { ServiceTreeRow } from '@/hooks/services/useServicesPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Trash2, Truck, Check, Calendar, MapPin, User, DollarSign, Ban, Layers, CornerDownRight, ChevronDown, ChevronRight } from 'lucide-react';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useUser } from '@/contexts/UserContext';
import { formatVehicleInfo, getServiceStatusBadge } from '@/utils/statusHelpers';
import { ServiceValueWithProfit } from './ServiceValueWithProfit';
import { useServiceCostTotals, type ServiceCostTotalsData } from '@/hooks/services/useServiceCostTotals';
import { toTitleCase } from '@/lib/utils';

type SortField = 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status';

interface ServiceActions {
  onViewDetails: (service: Service) => void;
  onEdit?: (service: Service) => void;
  onDelete?: (service: Service) => void;
  onCloseService?: (service: Service) => void;
  /** Castigo formal (incobrable). Solo se pasa para admin. */
  onWriteOff?: (service: Service) => void;
}

interface ServicesMobileViewProps extends ServiceActions {
  /** Filas de primer nivel; un viaje trae sus vehículos en subRows. */
  services: ServiceTreeRow[];
  /** Viajes que deben abrirse porque un filtro/búsqueda calzó con un hijo. */
  autoExpandedIds?: string[];
  hasInitialServices: boolean;
  onAddNewService?: () => void;
  sortField?: SortField | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: SortField) => void;
}

interface ServiceCardProps extends ServiceActions {
  service: ServiceTreeRow;
  costTotals?: ServiceCostTotalsData;
  costsError: boolean;
  isAdmin: boolean;
  /** Vehículo anidado bajo su viaje. */
  nested?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

const ServiceCard = ({
  service,
  costTotals,
  costsError,
  isAdmin,
  nested = false,
  expanded = false,
  onToggleExpanded,
  onViewDetails,
  onEdit,
  onDelete,
  onCloseService,
  onWriteOff,
}: ServiceCardProps) => {
  const isInvoiced = service.status === 'invoiced';
  const trip = service.isTripParent ? costTotals?.parents?.[service.id] : undefined;
  const childInfo = service.tripParentId ? costTotals?.children?.[service.id] : undefined;
  const childCount = service.subRows?.length ?? trip?.vehicleCount ?? 0;
  const tripPlates = service.subRows?.length
    ? service.subRows.map(child => child.licensePlate).filter(Boolean)
    : (trip?.children.map(child => child.childLicensePlate).filter(Boolean) ?? []);

  return (
    <Card className={nested ? 'glass-card border-l-2 border-l-primary/30' : 'glass-card'}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <Badge variant="tms" className="whitespace-nowrap" title={`Folio: ${service.folio}`}>#{service.folio}</Badge>
              {service.isTripParent && (
                <Badge variant="secondary" className="gap-1 whitespace-nowrap text-xs font-normal">
                  <Layers className="size-3" />
                  Viaje · {childCount} vehículo{childCount === 1 ? '' : 's'}
                </Badge>
              )}
              {service.tripParentId && (
                <Badge variant="outline" className="gap-1 whitespace-nowrap text-xs font-normal text-muted-foreground">
                  <CornerDownRight className="size-3" />
                  Viaje {childInfo?.parentFolio ?? '…'}
                </Badge>
              )}
            </div>
            {trip && trip.clientCount > 1 ? (
              <>
                <p className="text-foreground font-medium">Varios ({trip.clientCount})</p>
                <p className="text-muted-foreground text-sm">Viaje multicliente</p>
              </>
            ) : (
              <>
                <p className="text-foreground font-medium">{toTitleCase(service.client.name)}</p>
                <p className="text-muted-foreground text-sm">{service.client.department} • {service.client.rut}</p>
              </>
            )}
          </div>
          {getServiceStatusBadge(service.status)}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-foreground text-sm">
            <Calendar className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
            <span>{formatForDisplay(service.serviceDate)}</span>
          </div>

          <div className="flex items-center text-foreground text-sm">
            <Truck className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
            <span>{service.isTripParent ? (tripPlates.length > 0 ? tripPlates.join(' · ') : 'Sin vehículos') : formatVehicleInfo(service)}</span>
          </div>

          <div className="flex items-start text-foreground text-sm">
            <MapPin className="size-4 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="truncate">{service.origin}</div>
              <div className="text-muted-foreground text-xs">→ {service.destination}</div>
            </div>
          </div>

          <div className="flex items-center text-foreground text-sm">
            <User className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
            <span>{service.operator?.name || 'Sin asignar'} • {service.crane?.licensePlate || 'Sin grúa'}</span>
          </div>

          <div className="flex items-center text-primary text-sm font-semibold">
            <DollarSign className="size-4 mr-2 flex-shrink-0" />
            <ServiceValueWithProfit
              service={service}
              totalCost={costTotals?.totals?.[service.id]}
              isError={costsError}
              tripValue={service.isTripParent ? (trip?.tripValue ?? 0) : undefined}
              allocatedCost={childInfo?.allocatedAmount}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-success/30 bg-success-soft text-foreground hover:bg-success-soft/80"
              onClick={() => onCloseService(service)}
            >
              <Check className="size-4 mr-1" />
              Cerrar
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-primary/30 bg-primary-soft text-foreground hover:bg-primary-soft/80"
            onClick={() => onViewDetails(service)}
          >
            <Eye className="size-4 mr-1" />
            Ver
          </Button>

          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className={`flex-1 ${isInvoiced && !isAdmin
                ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                : "border-info/30 bg-info-soft text-foreground hover:bg-info-soft/80"}`}
              onClick={() => onEdit(service)}
              disabled={isInvoiced && !isAdmin}
            >
              <Edit className="size-4 mr-1" />
              Editar
            </Button>
          )}

          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className={`${isInvoiced
                ? "cursor-not-allowed border-border bg-muted px-3 text-muted-foreground"
                : "border-danger/30 bg-danger-soft px-3 text-foreground hover:bg-danger-soft/80"}`}
              onClick={isInvoiced ? undefined : () => onDelete(service)}
              disabled={isInvoiced}
            >
              <Trash2 className="size-4" />
            </Button>
          )}

          {onWriteOff && service.status === 'completed' && (
            <Button
              variant="outline"
              size="sm"
              className="border-dashed border-danger/40 bg-danger/5 px-3 text-danger hover:bg-danger/15"
              onClick={() => onWriteOff(service)}
              title="Castigar servicio (incobrable)"
            >
              <Ban className="size-4" />
            </Button>
          )}
        </div>

        {service.isTripParent && childCount > 0 && onToggleExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-center text-primary"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="size-4 mr-1" /> : <ChevronRight className="size-4 mr-1" />}
            {expanded ? 'Ocultar servicios' : `Ver ${childCount} servicio${childCount === 1 ? '' : 's'}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export const ServicesMobileView = ({
  services,
  autoExpandedIds,
  hasInitialServices,
  onViewDetails,
  onEdit,
  onDelete,
  onWriteOff,
  onCloseService,
  onAddNewService,
  sortField: _sortField,
  sortDirection: _sortDirection,
  onSort: _onSort,
}: ServicesMobileViewProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  // Colapsado por defecto; vive solo mientras la página está montada.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const autoExpandedKey = (autoExpandedIds ?? []).join('|');
  useEffect(() => {
    if (!autoExpandedKey) return;
    setExpandedIds(prev => {
      const next = new Set(prev);
      for (const id of autoExpandedKey.split('|')) next.add(id);
      return next;
    });
  }, [autoExpandedKey]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPageServiceIds = services.flatMap(service => [service.id, ...(service.subRows ?? []).map(child => child.id)]);
  const { data: costTotals, isError: costsError } = useServiceCostTotals(allPageServiceIds);

  if (services.length === 0) {
    return (
      <div className=" text-center py-12">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary-soft">
          <Truck className="size-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {!hasInitialServices ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
        </h3>
        <p className="text-muted-foreground mb-6">
          {!hasInitialServices
            ? 'Comienza agregando tu primer servicio de grúa'
            : 'Intenta ajustar los filtros de búsqueda'
          }
        </p>
        {!hasInitialServices && onAddNewService && (
          <Button 
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onAddNewService}
            title="Crear el primer servicio"
          >
            <Plus className="size-4 mr-2" />
            Crear Primer Servicio
          </Button>
        )}
      </div>
    );
  }

  const actions: ServiceActions = { onViewDetails, onEdit, onDelete, onCloseService, onWriteOff };

  return (
    <div className=" space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <Truck className="mr-2 size-5 text-primary" />
          Servicios ({allPageServiceIds.length})
        </h3>
      </div>

      {services.map((service) => {
        const children = service.subRows ?? [];
        const isExpanded = expandedIds.has(service.id);
        return (
          <div key={service.id} className="space-y-2">
            <ServiceCard
              service={service}
              costTotals={costTotals}
              costsError={costsError}
              isAdmin={isAdmin}
              expanded={isExpanded}
              onToggleExpanded={children.length > 0 ? () => toggleExpanded(service.id) : undefined}
              {...actions}
            />
            {isExpanded && children.length > 0 && (
              <div className="ml-4 space-y-2">
                {children.map((child) => (
                  <ServiceCard
                    key={child.id}
                    service={child}
                    costTotals={costTotals}
                    costsError={costsError}
                    isAdmin={isAdmin}
                    nested
                    {...actions}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
