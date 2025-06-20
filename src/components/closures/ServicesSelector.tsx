
import { Label } from '@/components/ui/label';
import { Service } from '@/types';

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
  console.log('ServicesSelector render - services:', services.length, 'loading:', loading);

  const filteredServices = services.filter(service => {
    if (!clientId) return true;
    return service.client.id === clientId;
  });

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="text-gray-300">Servicios</Label>
        <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-white/5">
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-gray-300">Servicios Disponibles para Cierre</Label>
      <div className="text-xs text-gray-400 mb-2">
        Solo se muestran servicios completados del rango de fechas seleccionado que no han sido incluidos en cierres anteriores ni facturados
      </div>
      <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-white/5">
        {filteredServices.length === 0 ? (
          <p className="text-gray-400 text-sm">
            {clientId 
              ? 'No hay servicios disponibles para este cliente en el rango de fechas seleccionado' 
              : 'No hay servicios completados disponibles para cierre en el rango de fechas seleccionado'
            }
          </p>
        ) : (
          filteredServices.map((service) => (
            <div key={service.id} className="flex items-center space-x-2 py-1">
              <input
                type="checkbox"
                id={service.id}
                checked={selectedServiceIds.includes(service.id)}
                onChange={(e) => onServiceToggle(service.id, e.target.checked)}
                className="text-tms-green"
              />
              <label htmlFor={service.id} className="text-sm text-gray-300 flex-1">
                <div className="flex justify-between items-center">
                  <span>{service.folio} - {service.client.name}</span>
                  <span className="font-medium">${service.value.toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {service.serviceDate} • {service.licensePlate}
                </div>
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ServicesSelector;
