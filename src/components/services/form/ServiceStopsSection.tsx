import { useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Route, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { OriginLocationField } from '@/components/services/OriginLocationField';
import type { ServiceStopDraft, ServiceStopType } from '@/types';

const STOP_TYPE_LABELS: Record<ServiceStopType, string> = {
  pickup: 'Recogida',
  dropoff: 'Entrega',
  waypoint: 'Parada intermedia',
  final: 'Destino final',
};

interface ServiceStopsSectionProps {
  stops: ServiceStopDraft[];
  /** Setter de estado del padre (updates funcionales, ver updateStop). */
  onStopsChange: Dispatch<SetStateAction<ServiceStopDraft[]>>;
  /** Departamento del cliente: acota la búsqueda híbrida de direcciones. */
  department?: string | null;
  canEditCatalog?: boolean;
  disabled?: boolean;
}

/**
 * Editor de paradas para servicios multidestino (ej: Taxi con itinerario
 * Base → Vallenar → Mantos de Oro → Copiapó). Disponible para cualquier tipo
 * de servicio; el seguimiento público calcula el ETA hacia la próxima parada
 * no alcanzada. Reordenamiento con botones subir/bajar (sin drag & drop).
 */
export const ServiceStopsSection = ({
  stops,
  onStopsChange,
  department,
  canEditCatalog = false,
  disabled = false,
}: ServiceStopsSectionProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(stops.length > 0);

  // SIEMPRE updates funcionales: OriginLocationField dispara onChange +
  // onCoordsChange en el MISMO evento de tecleo; con updates derivados de la
  // prop `stops` (stale dentro del evento), el segundo set pisaba al primero
  // y el input de dirección quedaba mudo (bug real de producción).
  const updateStop = (id: string, patch: Partial<ServiceStopDraft>) => {
    onStopsChange((prev) => prev.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  };

  const addStop = () => {
    onStopsChange((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: '',
        address: '',
        lat: null,
        lng: null,
        stopType: 'waypoint',
      },
    ]);
  };

  const removeStop = (id: string) => {
    onStopsChange((prev) => prev.filter((stop) => stop.id !== id));
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    onStopsChange((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const reordered = [...prev];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-l-4 border-l-info bg-info/5 transition-all duration-200 animate-fade-in">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 px-3 sm:px-6">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
              <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0 bg-info/10 text-info">
                <Route className="size-5" />
              </div>
              <span className="font-semibold text-foreground">Paradas del recorrido</span>
              {stops.length > 0 && (
                <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded flex-shrink-0">
                  {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
                </span>
              )}
              <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
              <ChevronDown
                className={cn('ml-auto size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 px-3 sm:px-6">
            <p className="text-xs text-muted-foreground">
              Itinerario con múltiples destinos en un solo servicio. El seguimiento público
              mostrará el tiempo de llegada a la próxima parada pendiente.
            </p>

            {stops.map((stop, index) => (
              <div
                key={stop.id}
                className="space-y-3 rounded-lg border border-border/70 bg-background/60 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-info/10 text-xs font-semibold text-info">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {stop.label.trim() || `Parada ${index + 1}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => moveStop(index, -1)}
                    disabled={disabled || index === 0}
                    title="Subir parada"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => moveStop(index, 1)}
                    disabled={disabled || index === stops.length - 1}
                    title="Bajar parada"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-danger hover:text-danger"
                    onClick={() => removeStop(stop.id)}
                    disabled={disabled}
                    title="Eliminar parada"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className={cn('gap-3', isMobile ? 'flex flex-col' : 'grid grid-cols-2')}>
                  <div className="space-y-1.5">
                    <Label htmlFor={`stop-label-${stop.id}`}>Nombre de la parada</Label>
                    <Input
                      id={`stop-label-${stop.id}`}
                      value={stop.label}
                      onChange={(event) => updateStop(stop.id, { label: event.target.value })}
                      placeholder="Ej: Recogida Vallenar"
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={stop.stopType}
                      onValueChange={(value) => updateStop(stop.id, { stopType: value as ServiceStopType })}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STOP_TYPE_LABELS) as ServiceStopType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {STOP_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Dirección</Label>
                  <OriginLocationField
                    value={stop.address}
                    onChange={(value) => updateStop(stop.id, { address: value })}
                    coords={{ lat: stop.lat, lng: stop.lng, catalogId: null }}
                    onCoordsChange={(coords) => updateStop(stop.id, { lat: coords.lat, lng: coords.lng })}
                    department={department}
                    canEditCatalog={canEditCatalog}
                    placeholder="Dirección de la parada"
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStop}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              <Plus className="size-4" />
              Agregar parada
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
