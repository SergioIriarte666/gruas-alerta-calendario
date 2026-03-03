import { Label } from '@/components/ui/label';
import { Service } from '@/types';
import { CheckCircle } from 'lucide-react';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
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
        <Label className="text-gray-300">Servicios</Label>
        <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-white/5">
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>;
  }
  return <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Servicios Disponibles para Cierre</Label>
        {selectedServiceIds.length > 0 && <div className="flex items-center gap-1 text-sm text-tms-green">
            <CheckCircle className="h-4 w-4" />
            <span>{selectedServiceIds.length} seleccionado{selectedServiceIds.length !== 1 ? 's' : ''}</span>
          </div>}
      </div>
      
      

      <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-white/5">
        {filteredServices.length === 0 ? <div className="text-center py-4">
            <p className="text-gray-400 text-sm">
              {clientId ? `No hay servicios disponibles para este cliente en el rango de fechas seleccionado` : 'No hay servicios completados disponibles para cierre en el rango de fechas seleccionado'}
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Los servicios ya facturados o incluidos en cierres anteriores no aparecen aquí.
            </p>
            {services.length > 0 && clientId && <p className="text-yellow-400 text-xs mt-1">
                Hay {services.length} servicio(s) disponible(s) para otros clientes.
                <br />
                <span className="text-blue-400 cursor-pointer underline" onClick={() => {}}>
                  Selecciona "Todos los clientes" para incluirlos.
                </span>
              </p>}
          </div> : <div className="space-y-1">
            {filteredServices.map(service => <div key={service.id} className={`flex items-center space-x-2 py-2 px-1 rounded transition-colors ${selectedServiceIds.includes(service.id) ? 'bg-tms-green/10 border border-tms-green/30' : 'hover:bg-white/5'}`}>
                <input type="checkbox" id={service.id} checked={selectedServiceIds.includes(service.id)} onChange={e => onServiceToggle(service.id, e.target.checked)} className="text-tms-green rounded" />
                <label htmlFor={service.id} className="text-sm text-gray-300 flex-1 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <span>{service.folio} - {service.client.name}</span>
                    <span className="font-medium text-tms-green">${getDisplayServiceValue(service).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-500">
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