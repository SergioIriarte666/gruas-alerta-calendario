import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client, TripVehicleDraft } from '@/types';
import { VehicleSection } from './VehicleSection';
import { useTripChildren, useTripParent } from '@/hooks/services/useTripServices';
import { formatCurrency, getServiceStatusBadge } from '@/utils/statusHelpers';
import { toTitleCase } from '@/lib/utils';
import { AlertTriangle, Car, CornerDownRight, Layers, Plus, Trash2, Loader2 } from 'lucide-react';

export const createTripVehicleDraft = (clientId = ''): TripVehicleDraft => ({
  id: crypto.randomUUID(),
  clientId,
  folio: '',
  licensePlate: '',
  vehicleBrand: '',
  vehicleModel: '',
  purchaseOrder: '',
  incidentNumber: '',
  value: 0,
});

/** Valor del viaje = suma de los valores de los vehículos (el padre lleva 0). */
export const getTripTotalValue = (vehicles: TripVehicleDraft[] | undefined): number =>
  (vehicles ?? []).reduce((total, vehicle) => total + (Number(vehicle.value) || 0), 0);

/** Clientes distintos entre los vehículos (2+ = viaje multicliente). */
export const getTripDistinctClientIds = (vehicles: TripVehicleDraft[] | undefined): string[] =>
  [...new Set((vehicles ?? []).map(vehicle => vehicle.clientId).filter(Boolean))];

const formatPercent = (ratio: number) =>
  `${(ratio * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;

interface TripVehiclesSectionProps {
  vehicles: TripVehicleDraft[];
  onVehiclesChange: (vehicles: TripVehicleDraft[]) => void;
  clients: Client[];
  disabled?: boolean;
  errorMessage?: string;
}

/**
 * Lista de vehículos de un viaje multi-vehículo (Grupaje Lowboy). Cada fila
 * se convierte en un servicio hijo con su propio folio, cliente, valor, O.C.
 * y N° de siniestro. El % de costos es el prorrateo ponderado por valor que
 * calcula la vista trip_cost_allocations; aquí solo se anticipa en vivo.
 */
export const TripVehiclesSection = ({
  vehicles,
  onVehiclesChange,
  clients,
  disabled = false,
  errorMessage,
}: TripVehiclesSectionProps) => {
  const total = getTripTotalValue(vehicles);
  const activeClients = useMemo(() => clients.filter(client => client.isActive), [clients]);

  const updateVehicle = (id: string, patch: Partial<TripVehicleDraft>) => {
    onVehiclesChange(vehicles.map(vehicle => (vehicle.id === id ? { ...vehicle, ...patch } : vehicle)));
  };

  const addVehicle = () => {
    const previousClient = vehicles[vehicles.length - 1]?.clientId ?? '';
    onVehiclesChange([...vehicles, createTripVehicleDraft(previousClient)]);
  };

  const removeVehicle = (id: string) => {
    if (vehicles.length <= 1) return;
    onVehiclesChange(vehicles.filter(vehicle => vehicle.id !== id));
  };

  return (
    <div className="space-y-4">
      {vehicles.map((vehicle, index) => {
        const share = total > 0 ? (Number(vehicle.value) || 0) / total : 1 / vehicles.length;
        return (
          <div key={vehicle.id} className="rounded-lg border border-border/70 bg-background/60 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="font-medium">Vehículo {index + 1}</span>
                <Badge variant="outline" className="text-xs font-normal" title="Parte de los costos del viaje que absorbe este vehículo">
                  {formatPercent(share)} de los costos
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeVehicle(vehicle.id)}
                disabled={disabled || vehicles.length <= 1}
                title={vehicles.length <= 1 ? 'El viaje necesita al menos un vehículo' : 'Quitar vehículo'}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente <span className="text-destructive">*</span></Label>
                <Select
                  value={vehicle.clientId}
                  onValueChange={(value) => updateVehicle(vehicle.id, { clientId: value })}
                  disabled={disabled}
                >
                  <SelectTrigger className={!vehicle.clientId ? 'border-destructive/50' : ''}>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col py-0.5">
                          <span className="font-medium">{toTitleCase(client.name)}</span>
                          {client.department && client.department !== 'General' && (
                            <span className="text-xs text-primary">{client.department}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Folio <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
                <Input
                  value={vehicle.folio}
                  onChange={(e) => updateVehicle(vehicle.id, { folio: e.target.value })}
                  placeholder="Automático (SRV-)"
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío para folio correlativo, o escribe el N° de asistencia del cliente.
                </p>
              </div>
            </div>

            <VehicleSection
              vehicleBrand={vehicle.vehicleBrand}
              onVehicleBrandChange={(value) => updateVehicle(vehicle.id, { vehicleBrand: value })}
              vehicleModel={vehicle.vehicleModel}
              onVehicleModelChange={(value) => updateVehicle(vehicle.id, { vehicleModel: value })}
              licensePlate={vehicle.licensePlate}
              onLicensePlateChange={(value) => updateVehicle(vehicle.id, { licensePlate: value })}
              vehicleBrandRequired={false}
              vehicleModelRequired={false}
              licensePlateRequired
              disabled={disabled}
              licensePlateError={!vehicle.licensePlate?.trim()}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>N° O.C. <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
                <Input
                  value={vehicle.purchaseOrder}
                  onChange={(e) => updateVehicle(vehicle.id, { purchaseOrder: e.target.value })}
                  placeholder="Ej: OC-4520281594"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>N° Siniestro <span className="text-muted-foreground text-xs">(Opcional)</span></Label>
                <Input
                  value={vehicle.incidentNumber}
                  onChange={(e) => updateVehicle(vehicle.id, { incidentNumber: e.target.value })}
                  placeholder="Ej: 123456"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (CLP) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={vehicle.value || ''}
                  onChange={(e) => updateVehicle(vehicle.id, { value: Number(e.target.value) || 0 })}
                  placeholder="1000000"
                  disabled={disabled}
                  className={`font-semibold ${!(Number(vehicle.value) > 0) ? 'border-destructive/50' : ''}`}
                />
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addVehicle} disabled={disabled} className="flex items-center gap-1.5">
        <Plus className="size-4" /> Agregar vehículo
      </Button>

      {errorMessage && (
        <p className="flex items-start gap-1 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">Valor total del viaje</p>
          <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(total)}</p>
          <p className="text-xs text-muted-foreground">{vehicles.length} vehículo{vehicles.length === 1 ? '' : 's'} · suma de los valores por patente</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/70 p-4">
          <p className="text-sm font-medium">Prorrateo ponderado por valor</p>
          <p className="text-xs text-muted-foreground">
            Los costos y la comisión se cargan al viaje y se reparten a cada vehículo según su valor.
            La utilidad de cada vehículo descuenta su parte.
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <Layers className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Al guardar se crea 1 viaje + {vehicles.length} servicio{vehicles.length === 1 ? '' : 's'} (un folio por patente).
          Cada vehículo se factura por separado a su cliente; el viaje no entra a cierres.
        </span>
      </p>
    </div>
  );
};

interface TripChildrenReadOnlyProps {
  parentId: string;
  /** Muestra valor, O.C., siniestro y prorrateo (vista admin). */
  showFinancials?: boolean;
  onOpenChild?: (childId: string) => void;
}

/** Vehículos (hijos) de un viaje existente, solo lectura. */
export const TripChildrenReadOnly = ({ parentId, showFinancials = true, onOpenChild }: TripChildrenReadOnlyProps) => {
  const { data: children = [], isLoading } = useTripChildren(parentId);
  const total = children.reduce((sum, child) => sum + child.value, 0);
  const distinctClients = new Set(children.map(child => child.clientId)).size;

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando vehículos del viaje…
      </p>
    );
  }

  if (children.length === 0) {
    return <p className="text-sm text-muted-foreground">Este viaje no tiene vehículos asociados.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="gap-1 border-trip/30 bg-trip-soft text-trip-text">
          <Layers className="size-3" /> {children.length} vehículo{children.length === 1 ? '' : 's'}
        </Badge>
        {distinctClients > 1 && <Badge variant="outline">Multicliente ({distinctClients})</Badge>}
        {showFinancials && (
          <span className="text-muted-foreground">Valor del viaje: <strong className="text-foreground tabular-nums">{formatCurrency(total)}</strong></span>
        )}
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {children.map((child) => (
          <div key={child.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <Car className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenChild ? (
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => onOpenChild(child.id)}>
                      {child.folio}
                    </button>
                  ) : (
                    <span className="font-medium">{child.folio}</span>
                  )}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold tracking-wider">{child.licensePlate || '—'}</span>
                  {getServiceStatusBadge(child.status)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[child.vehicleBrand, child.vehicleModel].filter(Boolean).join(' ')}
                  {child.clientName ? ` · ${toTitleCase(child.clientName)}` : ''}
                  {child.purchaseOrder ? ` · O.C. ${child.purchaseOrder}` : ''}
                  {child.incidentNumber ? ` · Siniestro ${child.incidentNumber}` : ''}
                </div>
              </div>
            </div>
            {showFinancials && (
              <div className="text-right tabular-nums">
                <div className="font-medium">{formatCurrency(child.value)}</div>
                <div className="text-xs text-muted-foreground" title="Parte de los costos del viaje que absorbe este vehículo">
                  {formatPercent(child.weight)} · {formatCurrency(child.allocatedAmount)} prorrateados
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Banner "Parte del viaje …" para un servicio hijo. */
export const TripParentBanner = ({ parentId }: { parentId: string }) => {
  const { data: parent } = useTripParent(parentId);
  return (
    <div className="flex items-center gap-2 rounded-md border border-trip/30 bg-trip-soft/40 px-3 py-2 text-sm">
      <CornerDownRight className="size-4 shrink-0 text-trip-text" />
      <span>
        Parte del viaje <strong>{parent?.folio ?? '…'}</strong>. Los datos operativos, costos y comisión del viaje se
        editan en el servicio padre; aquí solo lo propio del vehículo (valor, O.C., siniestro).
      </span>
    </div>
  );
};
