import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Service } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, CheckCircle, Clock, AlertTriangle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';

interface EnhancedServicesSelectorProps {
  services: Service[];
  pendingServices: Service[];
  loading: boolean;
  clientId: string;
  selectedServiceIds: string[];
  onServiceToggle: (serviceId: string, checked: boolean) => void;
  onCompleteService: (serviceId: string) => void;
  onCompleteMultipleServices: (serviceIds: string[]) => void;
  totalCompleted: number;
  usedServiceIds: Set<string>;
}

const EnhancedServicesSelector = ({
  services,
  pendingServices,
  loading,
  clientId,
  selectedServiceIds,
  onServiceToggle,
  onCompleteService,
  onCompleteMultipleServices,
  totalCompleted,
  usedServiceIds
}: EnhancedServicesSelectorProps) => {
  const [showPending, setShowPending] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  console.log('EnhancedServicesSelector render - services:', services.length, 'pendingServices:', pendingServices.length, 'loading:', loading, 'clientId:', clientId);
  
  // Debug logging for specific service 3027694-3
  const targetService = services.find(s => s.folio === '3027694-3') || pendingServices.find(s => s.folio === '3027694-3');
  if (targetService) {
    console.log('🔍 COMPONENT DEBUG - Service 3027694-3 found in EnhancedServicesSelector:', {
      folio: targetService.folio,
      hasExcess: targetService.hasExcess,
      clientCoveredAmount: targetService.clientCoveredAmount,
      value: targetService.value,
      custodyMode: targetService.custodyMode,
      custodyTotalAmount: targetService.custodyTotalAmount,
      calculatedValue: getServiceValueForClosure(targetService)
    });
  }

  const filteredServices = services.filter(service => {
    if (!clientId) return true;
    return service.client.id === clientId;
  });

  const filteredPendingServices = pendingServices.filter(service => {
    if (!clientId) return true;
    return service.client.id === clientId;
  });

  const handlePendingToggle = (serviceId: string, checked: boolean) => {
    setSelectedPendingIds(prev => 
      checked 
        ? [...prev, serviceId]
        : prev.filter(id => id !== serviceId)
    );
  };

  const handleCompleteSelected = () => {
    if (selectedPendingIds.length > 0) {
      onCompleteMultipleServices(selectedPendingIds);
      setSelectedPendingIds([]);
    }
  };

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

  const getStatusMessage = () => {
    if (filteredServices.length === 0 && filteredPendingServices.length === 0) {
      return {
        type: 'info' as const,
        title: 'No hay servicios en el rango de fechas',
        description: 'No se encontraron servicios completados ni pendientes para el período seleccionado.',
        suggestions: [
          'Amplía el rango de fechas',
          'Verifica que existan servicios en el sistema',
          'Selecciona "Todos los clientes" si buscas servicios de otros clientes'
        ]
      };
    }

    if (filteredServices.length === 0 && filteredPendingServices.length > 0) {
      return {
        type: 'warning' as const,
        title: 'Solo hay servicios pendientes',
        description: `Se encontraron ${filteredPendingServices.length} servicio(s) pendiente(s) que pueden ser completados.`,
        suggestions: [
          'Completa los servicios pendientes para incluirlos en el cierre',
          'Amplía el rango de fechas para incluir más servicios',
          'Verifica el estado de los servicios en el sistema'
        ]
      };
    }

    if (filteredServices.length > 0 && totalCompleted > filteredServices.length) {
      const alreadyUsed = totalCompleted - filteredServices.length;
      return {
        type: 'success' as const,
        title: `${filteredServices.length} servicio(s) disponible(s)`,
        description: `${alreadyUsed} servicio(s) ya están incluidos en otros cierres.`,
        suggestions: []
      };
    }

    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Servicios para Cierre</Label>
        {selectedServiceIds.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-tms-green">
            <CheckCircle className="h-4 w-4" />
            <span>{selectedServiceIds.length} seleccionado{selectedServiceIds.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <Alert className={`border-${statusMessage.type === 'warning' ? 'yellow' : statusMessage.type === 'success' ? 'green' : 'blue'}-500/50 bg-${statusMessage.type === 'warning' ? 'yellow' : statusMessage.type === 'success' ? 'green' : 'blue'}-500/10`}>
          <div className="flex items-start gap-2">
            {statusMessage.type === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
            ) : (
              <InfoIcon className="h-4 w-4 text-blue-400 mt-0.5" />
            )}
            <div className="flex-1">
              <AlertDescription className={`text-${statusMessage.type === 'warning' ? 'yellow' : statusMessage.type === 'success' ? 'green' : 'blue'}-200`}>
                <div className="font-medium">{statusMessage.title}</div>
                <div className="text-sm mt-1">{statusMessage.description}</div>
                {statusMessage.suggestions.length > 0 && (
                  <ul className="text-xs mt-2 space-y-1">
                    {statusMessage.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-current rounded-full"></span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Pending Services Section */}
      {filteredPendingServices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-400" />
              <Label className="text-gray-300">Servicios Pendientes</Label>
              <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                {filteredPendingServices.length}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPending(!showPending)}
              className="text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
            >
              {showPending ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          {showPending && (
            <div className="space-y-2">
              <div className="max-h-32 overflow-y-auto border border-yellow-500/30 rounded-md p-2 bg-yellow-500/5">
                <div className="space-y-1">
                  {filteredPendingServices.map(service => (
                    <div key={service.id} className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-yellow-500/10">
                      <input
                        type="checkbox"
                        id={`pending-${service.id}`}
                        checked={selectedPendingIds.includes(service.id)}
                        onChange={(e) => handlePendingToggle(service.id, e.target.checked)}
                        className="text-yellow-500 rounded"
                      />
                      <label htmlFor={`pending-${service.id}`} className="text-sm text-gray-300 flex-1 cursor-pointer">
                     <div className="flex justify-between items-center">
                          <span>{service.folio} - {service.client.name}</span>
                          <span className="font-medium text-yellow-400">${getServiceValueForClosure(service).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {service.serviceDate} • {service.licensePlate}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedPendingIds.length > 0 && (
                <Button
                  type="button"
                  onClick={handleCompleteSelected}
                  size="sm"
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Completar {selectedPendingIds.length} servicio{selectedPendingIds.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Available Services Section */}
      <div className="space-y-2">
        <Label className="text-gray-300">Servicios Completados Disponibles</Label>
        <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-white/5">
          {filteredServices.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">
                {clientId ? 
                  `No hay servicios completados disponibles para este cliente` : 
                  'No hay servicios completados disponibles para cierre'
                }
              </p>
              {services.length > 0 && clientId && (
                <p className="text-yellow-400 text-xs mt-1">
                  Hay {services.length} servicio(s) disponible(s) para otros clientes.
                  <br />
                  <span className="text-blue-400 cursor-pointer underline">
                    Selecciona "Todos los clientes" para incluirlos.
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredServices.map(service => (
                <div
                  key={service.id}
                  className={`flex items-center space-x-2 py-2 px-1 rounded transition-colors ${
                    selectedServiceIds.includes(service.id) 
                      ? 'bg-tms-green/10 border border-tms-green/30' 
                      : 'hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={service.id}
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={(e) => onServiceToggle(service.id, e.target.checked)}
                    className="text-tms-green rounded"
                  />
                  <label htmlFor={service.id} className="text-sm text-gray-300 flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span>{service.folio} - {service.client.name}</span>
                      <span className="font-medium text-tms-green">${getServiceValueForClosure(service).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {service.serviceDate} • {service.licensePlate} • Status: {service.status}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedServicesSelector;