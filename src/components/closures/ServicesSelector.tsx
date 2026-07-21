import { Label } from '@/components/ui/label';
import { Service } from '@/types';
import { CheckCircle } from 'lucide-react';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';
interface ServicesSelectorProps {
  services: Service[];
  loading: boolean;
  clientId: string;
  selectedServiceIds: string[];
  onServiceToggle: (serviceId: string, checked: boolean) => void;
}
const ServicesSelector = ({
  services,
  loading,
  clientId,
  selectedServiceIds,
  onServiceToggle
}: ServicesSelectorProps) => {
  const filteredServices = services.filter(service => {
    if (!clientId) return true;
    return service.client.id === clientId;
  });
  if (loading) {
    return <div className="space-y-2">
        <Label className="text-foreground">Servicios</Label>
        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-muted"></div>
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted"></div>
          </div>
        </div>
      </div>;
  }
  return <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">Servicios Disponibles para Cierre</Label>
        {selectedServiceIds.length > 0 && <div className="flex items-center gap-1 text-sm text-primary">
            <CheckCircle className="size-4" />
            <span>{selectedServiceIds.length} seleccionado{selectedServiceIds.length !== 1 ? 's' : ''}</span>
          </div>}
      </div>
      
      

      <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
        {filteredServices.length === 0 ? <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              {clientId ? `No hay servicios disponibles para este cliente en el rango de fechas seleccionado` : 'No hay servicios completados disponibles para cierre en el rango de fechas seleccionado'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Los servicios ya facturados o incluidos en cierres anteriores no aparecen aquí.
            </p>
            {services.length > 0 && clientId && <p className="mt-1 text-xs text-warning">
                Hay {services.length} servicio(s) disponible(s) para otros clientes.
                <br />
                <span className="cursor-pointer text-primary underline" onClick={() => {}}>
                  Selecciona "Todos los clientes" para incluirlos.
                </span>
              </p>}
          </div> : <div className="space-y-1">
            {filteredServices.map(service => <div key={service.id} className={`flex items-center gap-x-2 rounded px-1 py-2 transition-colors ${selectedServiceIds.includes(service.id) ? 'border border-primary/30 bg-primary-soft' : 'hover:bg-muted'}`}>
                <input type="checkbox" id={service.id} checked={selectedServiceIds.includes(service.id)} onChange={e => onServiceToggle(service.id, e.target.checked)} className="rounded text-primary" />
                <label htmlFor={service.id} className="flex-1 cursor-pointer text-sm text-foreground">
                  <div className="flex justify-between items-center">
                    <span>{service.folio} - {toTitleCase(service.client.name)}</span>
                    <span className="font-medium text-primary">${getDisplayServiceValue(service).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {service.serviceDate} • {service.licensePlate} • Status: {service.status}
                  </div>
                </label>
              </div>)}
          </div>}
      </div>

      {selectedServiceIds.length === 0 && filteredServices.length > 0}
    </div>;
};
export default ServicesSelector;
