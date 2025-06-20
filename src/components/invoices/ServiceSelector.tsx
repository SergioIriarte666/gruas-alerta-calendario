
import { Label } from '@/components/ui/label';
import { Service } from '@/types';
import { useServicesForInvoices } from '@/hooks/useServicesForInvoices';

interface ServiceSelectorProps {
  selectedServiceIds: string[];
  onServiceToggle: (serviceId: string) => void;
}

const ServiceSelector = ({ selectedServiceIds, onServiceToggle }: ServiceSelectorProps) => {
  const { services, loading } = useServicesForInvoices();

  if (loading) {
    return (
      <div>
        <Label className="text-gray-300">Servicios a Facturar</Label>
        <div className="mt-2 bg-white/5 border border-gray-700 rounded-lg p-4">
          <p className="text-gray-400 text-center py-4">Cargando servicios disponibles...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-gray-300">Servicios a Facturar</Label>
      <div className="mt-2 max-h-60 overflow-y-auto border border-gray-700 rounded-lg p-4 bg-white/5">
        {services.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No hay servicios completados disponibles para facturación</p>
        ) : (
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                className={`flex items-center justify-between p-3 border border-gray-700 rounded cursor-pointer hover:bg-white/10 ${
                  selectedServiceIds.includes(service.id) ? 'bg-tms-green/20 border-tms-green' : ''
                }`}
                onClick={() => onServiceToggle(service.id)}
              >
                <div>
                  <p className="font-medium text-white">{service.folio}</p>
                  <p className="text-sm text-gray-300">{service.client.name}</p>
                  <p className="text-sm text-gray-400">{service.serviceDate}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">${service.value.toLocaleString()}</p>
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={() => onServiceToggle(service.id)}
                    className="mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {services.length > 0 && (
        <p className="text-sm text-gray-400 mt-2">
          {services.length} servicio{services.length !== 1 ? 's' : ''} disponible{services.length !== 1 ? 's' : ''} para facturación
        </p>
      )}
    </div>
  );
};

export default ServiceSelector;
