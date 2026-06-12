import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Service } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, CheckCircle, Clock, AlertTriangle, Zap, Search, X, CalendarDays, FileText, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';
import { ProcessedServiceInfo } from '@/hooks/useServicesForClosures';
import { toTitleCase } from '@/lib/utils';
import { safeParseDateOnly } from '@/utils/timezoneUtils';

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
  isGlobalSearch?: boolean;
  onAutoFillDates?: (dateFrom: Date, dateTo: Date) => void;
  onSearchTermChange?: (searchTerm: string) => void;
  // New props for processed services
  processedServices?: ProcessedServiceInfo[];
  searchingProcessed?: boolean;
  onSearchProcessed?: (searchTerm: string) => void;
  onClearProcessed?: () => void;
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
  usedServiceIds,
  isGlobalSearch = false,
  onAutoFillDates,
  onSearchTermChange,
  processedServices = [],
  searchingProcessed = false,
  onSearchProcessed,
  onClearProcessed
}: EnhancedServicesSelectorProps) => {
  const [showPending, setShowPending] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onSearchTermChange?.(searchTerm);
  }, [searchTerm, onSearchTermChange]);

  // Function to filter services by search term
  const filterServicesBySearch = useCallback((serviceList: Service[]) => {
    if (!searchTerm.trim()) return serviceList;
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    return serviceList.filter(service => {
      // Search in quote number
      if (service.quoteNumber?.toLowerCase().includes(searchLower)) return true;
      
      // Search in purchase order
      if (service.purchaseOrder?.toLowerCase().includes(searchLower)) return true;
      if (service.purchaseOrderNumber?.toLowerCase().includes(searchLower)) return true;
      
      // Search in license plate
      if (service.licensePlate?.toLowerCase().includes(searchLower)) return true;
      
      // Search in folio
      if (service.folio?.toLowerCase().includes(searchLower)) return true;
      
      // Search in client name
      if (service.client?.name?.toLowerCase().includes(searchLower)) return true;
      
      // Search in vehicle brand and model
      if (service.vehicleBrand?.toLowerCase().includes(searchLower)) return true;
      if (service.vehicleModel?.toLowerCase().includes(searchLower)) return true;
      
      // Search in origin and destination
      if (service.origin?.toLowerCase().includes(searchLower)) return true;
      if (service.destination?.toLowerCase().includes(searchLower)) return true;
      
      return false;
    });
  }, [searchTerm]);

  // Effect to search for processed services when no results are found
  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    const trimmedSearch = searchTerm.trim();
    
    // Only search processed if there's a search term
    if (!trimmedSearch) {
      onClearProcessed?.();
      return;
    }
    
    // Check if we have any available results
    const clientFilteredServices = services.filter(service => {
      if (!clientId) return true;
      return service.client?.id === clientId;
    });
    
    const clientFilteredPending = pendingServices.filter(service => {
      if (!clientId) return true;
      return service.client?.id === clientId;
    });
    
    const hasAvailableResults = filterServicesBySearch(clientFilteredServices).length > 0;
    const hasPendingResults = filterServicesBySearch(clientFilteredPending).length > 0;
    
    if (!hasAvailableResults && !hasPendingResults && onSearchProcessed) {
      // Debounce the search
      debounceTimeoutRef.current = setTimeout(() => {
        
        onSearchProcessed(trimmedSearch);
      }, 500);
    } else {
      // Clear processed results if we have available results
      onClearProcessed?.();
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm, services, pendingServices, clientId, filterServicesBySearch, onSearchProcessed, onClearProcessed]);

  const filteredServices = useMemo(() => filterServicesBySearch(
    services.filter(service => {
      if (!clientId) return true;
      return service.client.id === clientId;
    })
  ), [services, clientId, filterServicesBySearch]);

  const filteredPendingServices = useMemo(() => filterServicesBySearch(
    pendingServices.filter(service => {
      if (!clientId) return true;
      return service.client.id === clientId;
    })
  ), [pendingServices, clientId, filterServicesBySearch]);

  const visibleServices = useMemo(() => filteredServices.slice(0, 120), [filteredServices]);
  const visiblePendingServices = useMemo(() => filteredPendingServices.slice(0, 80), [filteredPendingServices]);

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

  // Estado del checkbox maestro para servicios completados
  const allServicesSelected = filteredServices.length > 0 && 
    filteredServices.every(service => selectedServiceIds.includes(service.id));

  const someServicesSelected = filteredServices.some(service => 
    selectedServiceIds.includes(service.id)
  ) && !allServicesSelected;

  // Handler para seleccionar/deseleccionar todos los servicios completados
  const handleSelectAllServices = (checked: boolean) => {
    filteredServices.forEach(service => {
      const isCurrentlySelected = selectedServiceIds.includes(service.id);
      if (checked && !isCurrentlySelected) {
        onServiceToggle(service.id, true);
      } else if (!checked && isCurrentlySelected) {
        onServiceToggle(service.id, false);
      }
    });
  };

  // Estado del checkbox maestro para servicios pendientes
  const allPendingSelected = filteredPendingServices.length > 0 && 
    filteredPendingServices.every(service => selectedPendingIds.includes(service.id));

  const somePendingSelected = filteredPendingServices.some(service => 
    selectedPendingIds.includes(service.id)
  ) && !allPendingSelected;

  // Handler para seleccionar/deseleccionar todos los servicios pendientes
  const handleSelectAllPending = (checked: boolean) => {
    if (checked) {
      setSelectedPendingIds(filteredPendingServices.map(s => s.id));
    } else {
      setSelectedPendingIds([]);
    }
  };

  // Calculate date range from selected services for auto-fill
  const handleAutoFillDates = () => {
    if (!onAutoFillDates || selectedServiceIds.length === 0) return;
    
    const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
    if (selectedServices.length === 0) return;
    
    const dates = selectedServices
      .map(s => safeParseDateOnly(s.serviceDate))
      .filter(d => !isNaN(d.getTime()));
    
    if (dates.length === 0) return;
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    onAutoFillDates(minDate, maxDate);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="text-foreground">Servicios</Label>
        <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-muted">
          <div className="space-y-2">
            <div className="h-4 bg-muted-foreground/20 rounded animate-pulse"></div>
            <div className="h-4 bg-muted-foreground/20 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-muted-foreground/20 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusMessage = () => {
    const hasActiveSearch = searchTerm.trim().length > 0;
    
    // Don't show "not found" message if there are processed services found
    // This avoids redundancy when processedServices panel is shown below
    if (filteredServices.length === 0 && filteredPendingServices.length === 0) {
      // If searching and there are processed services or currently searching for them, don't show this message
      if (hasActiveSearch && (processedServices.length > 0 || searchingProcessed)) {
        return null;
      }
      
      return {
        type: 'info' as const,
        title: hasActiveSearch 
          ? 'No se encontraron servicios con ese criterio'
          : 'No hay servicios en el rango de fechas',
        description: hasActiveSearch
          ? `No se encontraron servicios que coincidan con "${searchTerm}". Intenta con otros términos de búsqueda.`
          : 'No se encontraron servicios completados ni pendientes para el período seleccionado.',
        suggestions: hasActiveSearch
          ? [
              'Verifica la ortografía del término de búsqueda',
              'Intenta buscar por otro campo (patente, folio, orden de compra)',
              'Limpia la búsqueda para ver todos los servicios del rango'
            ]
          : [
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
        <div className="flex items-center gap-2">
          <Label className="text-foreground">Servicios para Cierre</Label>
          {searchTerm && (
            <Badge variant="secondary" className="text-xs">
              {filteredServices.length + filteredPendingServices.length} resultado(s)
            </Badge>
          )}
        </div>
        {selectedServiceIds.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-primary">
            <CheckCircle className="size-4" />
            <span>{selectedServiceIds.length} seleccionado{selectedServiceIds.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Global Search Banner */}
      {isGlobalSearch && (
        <Alert className="border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <AlertDescription className="text-foreground">
                <div className="font-medium text-amber-700">Búsqueda Global Activa</div>
                <div className="text-sm mt-1 text-muted-foreground">
                  Mostrando servicios sin límite de fecha. Busca por OC, folio o patente.
                </div>
                {selectedServiceIds.length > 0 && onAutoFillDates && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFillDates}
                    className="mt-2 text-amber-700 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    <CalendarDays className="size-4 mr-2" />
                    Auto-rellenar fechas ({selectedServiceIds.length} servicio{selectedServiceIds.length !== 1 ? 's' : ''})
                  </Button>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Search Input */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por cotización, orden de compra, patente, folio, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 size-7 p-0"
              onClick={() => setSearchTerm('')}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <Alert className="border">
          <div className="flex items-start gap-2">
            {statusMessage.type === 'warning' ? (
              <AlertTriangle className="size-4 text-destructive mt-0.5" />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle className="size-4 text-primary mt-0.5" />
            ) : (
              <InfoIcon className="size-4 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1">
              <AlertDescription className="text-foreground">
                <div className="font-medium">{statusMessage.title}</div>
                <div className="text-sm mt-1 text-muted-foreground">{statusMessage.description}</div>
                {statusMessage.suggestions.length > 0 && (
                  <ul className="text-xs mt-2 space-y-1 text-muted-foreground">
                    {statusMessage.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="size-1 bg-current rounded-full"></span>
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

      {/* Processed Services Section - Shows when searching for already processed services */}
      {searchTerm.trim() && filteredServices.length === 0 && filteredPendingServices.length === 0 && (
        <>
          {searchingProcessed ? (
            <Alert className="border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center gap-2">
                <div className="animate-spin size-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <AlertDescription className="text-foreground">
                  Buscando en servicios ya procesados...
                </AlertDescription>
              </div>
            </Alert>
          ) : processedServices.length > 0 ? (
            <Alert className="border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-start gap-2">
                <FileText className="size-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <AlertDescription className="text-foreground">
                    <div className="font-medium text-blue-700 mb-2">
                      Servicio encontrado (ya procesado)
                    </div>
                    <div className="space-y-3">
                      {processedServices.map(ps => (
                        <div key={ps.serviceId} className="text-sm bg-background/50 rounded-md p-3 border border-blue-200/50">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">📋 Servicio:</span>
                              <span className="font-medium">{ps.serviceFolio}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">👤 Cliente:</span>
                              <span className="font-medium">{toTitleCase(ps.clientName)}</span>
                            </div>
                            {(ps.purchaseOrder || ps.purchaseOrderNumber) && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">🛒 OC:</span>
                                <span className="font-medium">{ps.purchaseOrder || ps.purchaseOrderNumber}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">📦 Cierre:</span>
                              <span className="font-medium text-primary">{ps.closureFolio}</span>
                            </div>
                          </div>
                          
                          {ps.invoiceFolio ? (
                            <div className="mt-2 pt-2 border-t border-blue-200/50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Receipt className="size-4 text-green-600" />
                                <span className="text-muted-foreground">Factura:</span>
                                <span className="font-medium">{ps.invoiceFolio}</span>
                                {ps.invoiceNumeroFiscal && (
                                  <span className="text-muted-foreground">(N° Fiscal: {ps.invoiceNumeroFiscal})</span>
                                )}
                              </div>
                              <Badge 
                                variant={
                                  ps.invoiceStatus === 'paid' ? 'default' :
                                  ps.invoiceStatus === 'sent' ? 'secondary' :
                                  ps.invoiceStatus === 'overdue' ? 'destructive' :
                                  'outline'
                                }
                                className="text-xs"
                              >
                                {ps.invoiceStatus === 'paid' ? 'Pagada' :
                                 ps.invoiceStatus === 'sent' ? 'Enviada' :
                                 ps.invoiceStatus === 'overdue' ? 'Vencida' :
                                 ps.invoiceStatus === 'draft' ? 'Borrador' :
                                 ps.invoiceStatus === 'cancelled' ? 'Anulada' :
                                 ps.invoiceStatus || 'Pendiente'}
                              </Badge>
                            </div>
                          ) : (
                            <div className="mt-2 pt-2 border-t border-blue-200/50 flex items-center gap-2">
                              <Clock className="size-4 text-amber-600" />
                              <span className="text-amber-700 text-sm">Sin facturar aún</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : null}
        </>
      )}

      {/* Pending Services Section */}
      {filteredPendingServices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Checkbox
              id="select-all-pending"
              checked={allPendingSelected}
              ref={(el) => {
                if (el) {
                  (el as any).indeterminate = somePendingSelected;
                }
              }}
              onCheckedChange={handleSelectAllPending}
              disabled={filteredPendingServices.length === 0}
            />
              <Clock className="size-4 text-secondary-foreground" />
              <Label htmlFor="select-all-pending" className="text-foreground cursor-pointer">
                Servicios Pendientes
              </Label>
              <Badge variant="secondary">
                {filteredPendingServices.length}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPending(!showPending)}
              className="text-xs"
            >
              {showPending ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          {showPending && (
            <div className="space-y-2">
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-muted">
                <div className="space-y-1">
                  {visiblePendingServices.map(service => (
                    <div key={service.id} className="flex items-center gap-x-2 py-1 px-1 rounded hover:bg-background">
                      <input
                        type="checkbox"
                        id={`pending-${service.id}`}
                        checked={selectedPendingIds.includes(service.id)}
                        onChange={(e) => handlePendingToggle(service.id, e.target.checked)}
                        className="text-secondary rounded"
                      />
                      <label htmlFor={`pending-${service.id}`} className="text-sm text-foreground flex-1 cursor-pointer">
                     <div className="flex justify-between items-center">
                          <span>{service.folio} - {toTitleCase(service.client.name)}</span>
                          <span className="font-medium text-secondary-foreground">${getServiceValueForClosure(service).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-1 items-center">
                          <span>{service.serviceDate}</span>
                          <span>•</span>
                          <span>{service.licensePlate}</span>
                          {service.quoteNumber && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                COT: {service.quoteNumber}
                              </Badge>
                            </>
                          )}
                          {(service.purchaseOrder || service.purchaseOrderNumber) && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                OC: {service.purchaseOrder || service.purchaseOrderNumber}
                              </Badge>
                            </>
                          )}
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
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  <Zap className="size-4 mr-2" />
                  Completar {selectedPendingIds.length} servicio{selectedPendingIds.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Available Services Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all-services"
              checked={allServicesSelected}
              ref={(el) => {
                if (el) {
                  (el as any).indeterminate = someServicesSelected;
                }
              }}
              onCheckedChange={handleSelectAllServices}
              disabled={filteredServices.length === 0}
            />
            <Label htmlFor="select-all-services" className="text-foreground cursor-pointer">
              Servicios Completados Disponibles
            </Label>
          </div>
          {filteredServices.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedServiceIds.filter(id => 
                filteredServices.some(s => s.id === id)
              ).length} de {filteredServices.length} seleccionados
            </div>
          )}
        </div>
        <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-muted">
          {filteredServices.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm">
                {clientId ? 
                  `No hay servicios completados disponibles para este cliente` : 
                  'No hay servicios completados disponibles para cierre'
                }
              </p>
              {services.length > 0 && clientId && (
                <p className="text-secondary-foreground text-xs mt-1">
                  Hay {services.length} servicio(s) disponible(s) para otros clientes.
                  <br />
                  <span className="text-primary cursor-pointer underline">
                    Selecciona "Todos los clientes" para incluirlos.
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {visibleServices.map(service => (
                <div
                  key={service.id}
                  className={`flex items-center gap-x-2 py-2 px-1 rounded transition-colors ${
                    selectedServiceIds.includes(service.id) 
                      ? 'bg-primary/10 border border-primary/30' 
                      : 'hover:bg-background'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={service.id}
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={(e) => onServiceToggle(service.id, e.target.checked)}
                    className="text-primary rounded"
                  />
                  <label htmlFor={service.id} className="text-sm text-foreground flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        {service.folio} - {toTitleCase(service.client.name)}
                        {(service as any)._closureType === 'covered' && (
                          <Badge className="bg-teal-500/15 text-teal-700 border border-teal-500/30 text-[10px] h-4 px-1 hover:bg-teal-500/15">
                            Cubierto
                          </Badge>
                        )}
                        {(service as any)._closureType === 'excess' && (
                          <Badge className="bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[10px] h-4 px-1 hover:bg-amber-500/15">
                            Excedente
                          </Badge>
                        )}
                      </span>
                      <span className="font-medium text-violet-600">${getServiceValueForClosure(service).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-1 items-center">
                      <span>{service.serviceDate}</span>
                      <span>•</span>
                      <span>{service.licensePlate}</span>
                      {service.quoteNumber && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            COT: {service.quoteNumber}
                          </Badge>
                        </>
                      )}
                      {(service.purchaseOrder || service.purchaseOrderNumber) && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            OC: {service.purchaseOrder || service.purchaseOrderNumber}
                          </Badge>
                        </>
                      )}
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