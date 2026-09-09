import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ShoppingCart, Check, X, AlertCircle, Layers, RefreshCw, CheckSquare, Square, AlertTriangle, Lock, DollarSign, Car, MapPin, User } from 'lucide-react';
import { Service } from '@/types';
import { format } from 'date-fns';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toast } from 'sonner';

interface BatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServices: Service[];
  onBatchUpdate: (updates: BatchUpdateData) => Promise<void>;
  clientId: string;
  clientName: string;
}

import { toTitleCase } from '@/lib/utils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("BatchUpdateModal");
export interface BatchUpdateData {
  types: ('quote' | 'purchase_order')[];
  services: {
    id: string;
    quote_number?: string;
    purchase_order_number?: string;
    target_status?: string;
  }[];
  notes?: string;
  auto_update_status?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  quoted: 'Cotizado',
  with_purchase_order: 'Con O.C.',
  in_progress: 'En Progreso',
  completed: 'Completado',
  invoiced: 'Facturado'
};

export const BatchUpdateModal: React.FC<BatchUpdateModalProps> = ({
  open,
  onOpenChange,
  selectedServices,
  onBatchUpdate,
  clientId,
  clientName
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [excludedServices, setExcludedServices] = useState<Set<string>>(new Set());
  const allHaveQuote = useMemo(() =>
    selectedServices.length > 0 && selectedServices.every(s => s.quoteNumber?.trim()),
    [selectedServices]
  );

  const [enableQuote, setEnableQuote] = useState(!allHaveQuote);
  const [enablePurchaseOrder, setEnablePurchaseOrder] = useState(allHaveQuote);

  React.useEffect(() => {
    if (open) {
      const allQuoted = selectedServices.length > 0 &&
        selectedServices.every(s => s.quoteNumber?.trim());
      setEnableQuote(!allQuoted);
      setEnablePurchaseOrder(allQuoted);
    }
  }, [open, selectedServices]);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState(true);
  const [overwriteQuote, setOverwriteQuote] = useState(false);
  const [overwritePO, setOverwritePO] = useState(false);
  const [batchData, setBatchData] = useState({
    quote: {
      baseNumber: '',
      startingNumber: '',
      prefix: 'COT-',
      notes: ''
    },
    purchase_order: {
      baseNumber: '',
      startingNumber: '',
      prefix: 'OC-',
      notes: ''
    }
  });

  // Servicios activos (no excluidos)
  const activeServices = useMemo(() =>
    selectedServices.filter(s => !excludedServices.has(s.id)),
    [selectedServices, excludedServices]
  );

  // Servicios con datos existentes
  const servicesWithQuote = useMemo(() =>
    activeServices.filter(s => s.quoteNumber),
    [activeServices]
  );

  const servicesWithPO = useMemo(() =>
    activeServices.filter(s => s.purchaseOrderNumber),
    [activeServices]
  );

  // Calcular suma total de servicios activos
  const activeTotalValue = useMemo(() =>
    activeServices.reduce((sum, s) => sum + getDisplayServiceValue(s, clientId), 0),
    [activeServices, clientId]
  );

  // Función para determinar el estado objetivo (OC prevalece)
  const determineTargetStatus = (enableQuote: boolean, enablePO: boolean): string | null => {
    if (!autoUpdateStatus) return null;
    if (enablePO && enableQuote) {
      return 'with_purchase_order';
    } else if (enablePO) {
      return 'with_purchase_order';
    } else if (enableQuote) {
      return 'quoted';
    }
    return null;
  };

  const targetStatus = determineTargetStatus(enableQuote, enablePurchaseOrder);

  // Toggle exclusión de servicio
  const toggleServiceExclusion = (serviceId: string) => {
    setExcludedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  // Seleccionar/deseleccionar todos
  const selectAll = () => setExcludedServices(new Set());
  const deselectAll = () => setExcludedServices(new Set(selectedServices.map(s => s.id)));

  const handleSubmit = async () => {
    if (activeServices.length === 0) {
      toast.error('No hay servicios activos para actualizar');
      return;
    }
    if (!enableQuote && !enablePurchaseOrder) {
      toast.error('Debe habilitar al menos una opción: Cotización o Orden de Compra');
      return;
    }

    const quoteData = batchData.quote;
    const poData = batchData.purchase_order;
    if (enableQuote && !quoteData.baseNumber && !quoteData.startingNumber) {
      toast.error('Debe ingresar un número base o inicial para cotizaciones');
      return;
    }
    if (enablePurchaseOrder && !poData.baseNumber && !poData.startingNumber) {
      toast.error('Debe ingresar un número base o inicial para órdenes de compra');
      return;
    }

    setIsLoading(true);
    try {
      // Contador para numeración secuencial (solo servicios que recibirán nuevo número)
      let quoteIndex = 0;
      let poIndex = 0;

      const services: BatchUpdateData['services'] = activeServices.map((service) => {
        const serviceData: any = { id: service.id };

        if (enableQuote) {
          // Solo asignar si NO tiene COT o si el usuario eligió sobrescribir
          const shouldAssignQuote = !service.quoteNumber || overwriteQuote;
          if (shouldAssignQuote) {
            if (quoteData.baseNumber) {
              serviceData.quote_number = `${quoteData.prefix}${quoteData.baseNumber}`;
            } else if (quoteData.startingNumber) {
              const startNum = parseInt(quoteData.startingNumber);
              serviceData.quote_number = `${quoteData.prefix}${startNum + quoteIndex}`;
              quoteIndex++;
            }
          }
        }

        if (enablePurchaseOrder) {
          // Solo asignar si NO tiene OC o si el usuario eligió sobrescribir
          const shouldAssignPO = !service.purchaseOrderNumber || overwritePO;
          if (shouldAssignPO) {
            if (poData.baseNumber) {
              serviceData.purchase_order_number = `${poData.prefix}${poData.baseNumber}`;
            } else if (poData.startingNumber) {
              const startNum = parseInt(poData.startingNumber);
              serviceData.purchase_order_number = `${poData.prefix}${startNum + poIndex}`;
              poIndex++;
            }
          }
        }

        if (targetStatus) {
          serviceData.target_status = targetStatus;
        }

        return serviceData;
      });

      const activeTypes: ('quote' | 'purchase_order')[] = [];
      if (enableQuote) activeTypes.push('quote');
      if (enablePurchaseOrder) activeTypes.push('purchase_order');

      const updateData: BatchUpdateData = {
        types: activeTypes,
        services,
        notes: (enableQuote ? quoteData.notes : poData.notes) || undefined,
        auto_update_status: autoUpdateStatus
      };

      // Cerrar este modal antes de iniciar la operación asíncrona: el padre
      // muestra un modal de progreso (BatchProgressModal) durante el batch,
      // y tener dos Dialogs de Radix abiertos a la vez provoca que el de
      // progreso tape visualmente a este, dando la apariencia de que se
      // cierra y reabre solo cuando el de progreso termina.
      onOpenChange(false);

      await onBatchUpdate(updateData);

      const typesText = activeTypes.length === 2 ? 'COT + OC' : activeTypes[0] === 'quote' ? 'cotizaciones' : 'órdenes de compra';
      toast.success(`${activeServices.length} servicios actualizados con ${typesText}`);

      // Reset
      setBatchData({
        quote: { baseNumber: '', startingNumber: '', prefix: 'COT-', notes: '' },
        purchase_order: { baseNumber: '', startingNumber: '', prefix: 'OC-', notes: '' }
      });
      setEnableQuote(true);
      setEnablePurchaseOrder(false);
      setAutoUpdateStatus(true);
      setExcludedServices(new Set());
      setOverwriteQuote(false);
      setOverwritePO(false);
    } catch (error) {
      logger.error('Error en actualización por lotes:', error);
      toast.error('Error al actualizar los servicios');
    } finally {
      setIsLoading(false);
    }
  };

  const updateData = (type: 'quote' | 'purchase_order', field: string, value: string) => {
    setBatchData(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }));
  };

  // Generar resumen para el footer
  const generateSummary = () => {
    const parts: string[] = [];
    const quoteData = batchData.quote;
    const poData = batchData.purchase_order;

    if (enableQuote && (quoteData.baseNumber || quoteData.startingNumber)) {
      if (quoteData.baseNumber) {
        parts.push(`${quoteData.prefix}${quoteData.baseNumber}`);
      } else {
        const start = parseInt(quoteData.startingNumber);
        const end = start + activeServices.length - 1;
        parts.push(`${quoteData.prefix}${start} → ${quoteData.prefix}${end}`);
      }
    }

    if (enablePurchaseOrder && (poData.baseNumber || poData.startingNumber)) {
      if (poData.baseNumber) {
        parts.push(`${poData.prefix}${poData.baseNumber}`);
      } else {
        const start = parseInt(poData.startingNumber);
        const end = start + activeServices.length - 1;
        parts.push(`${poData.prefix}${start} → ${poData.prefix}${end}`);
      }
    }

    return parts.join(' + ');
  };

  const summary = generateSummary();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl h-[80vh] bg-card border select-none flex flex-col p-0"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
        onMouseDown={e => e.stopPropagation()}
        onDragStart={e => e.preventDefault()}
        draggable={false}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Registro por Lotes
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{toTitleCase(clientName)}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido principal - 2 columnas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Panel izquierdo - Lista de servicios */}
          <div className="w-[35%] border-r flex flex-col bg-muted/10">
            <div className="px-4 py-3 border-b bg-background/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Servicios</span>
                <Badge variant="outline" className="text-xs">
                  {activeServices.length} de {selectedServices.length}
                </Badge>
              </div>

              {/* Suma total de servicios activos */}
              <div className="flex items-center justify-between mb-3 py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="size-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Valor Total:</span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  ${activeTotalValue.toLocaleString('es-CL')}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={selectAll}
                >
                  <CheckSquare className="size-3 mr-1" />
                  Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={deselectAll}
                >
                  <Square className="size-3 mr-1" />
                  Ninguno
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {selectedServices.map((service, _index) => {
                  const isExcluded = excludedServices.has(service.id);
                  return (
                    <div
                      key={service.id}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isExcluded
                          ? 'bg-muted/30 border-border/50 opacity-50'
                          : 'bg-card border-border hover:border-primary/30'
                      }`}
                      onClick={() => toggleServiceExclusion(service.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={!isExcluded}
                          className="mt-0.5"
                          onCheckedChange={() => toggleServiceExclusion(service.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground truncate">
                              {service.folio}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-xs px-1.5 py-0 ${
                                String(service.status) === 'new' ? 'bg-info/20 text-info-text' :
                                String(service.status) === 'quoted' ? 'bg-warning/20 text-warning-text' :
                                String(service.status) === 'with_purchase_order' ? 'bg-success/20 text-success-text' :
                                'bg-muted text-muted-foreground'
                              }`}
                            >
                              {STATUS_LABELS[String(service.status)] || service.status}
                            </Badge>
                          </div>
                          {/* Mostrar COT y OC existentes con indicador de protección */}
                          {(service.quoteNumber || service.purchaseOrderNumber) && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {service.quoteNumber && (
                                <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-1 ${
                                  enableQuote && !overwriteQuote
                                    ? 'bg-warning/10 text-warning-text border-warning/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}>
                                  {enableQuote && !overwriteQuote && <Lock className="size-2.5" />}
                                  COT: {service.quoteNumber}
                                </Badge>
                              )}
                              {service.purchaseOrderNumber && (
                                <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-1 ${
                                  enablePurchaseOrder && !overwritePO
                                    ? 'bg-success/10 text-success-text border-success/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}>
                                  {enablePurchaseOrder && !overwritePO && <Lock className="size-2.5" />}
                                  OC: {service.purchaseOrderNumber}
                                </Badge>
                              )}
                            </div>
                          )}
                          {/* Datos del vehículo y servicio */}
                          {(service.vehicleBrand || service.vehicleModel || service.licensePlate) && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground min-w-0">
                              <Car className="size-3 flex-shrink-0" />
                              <span className="truncate">
                                {[service.vehicleBrand, service.vehicleModel].filter(Boolean).join(' ')}
                                {(service.vehicleBrand || service.vehicleModel) && service.licensePlate && ' · '}
                                {service.licensePlate && (
                                  <span className="font-medium text-foreground">{service.licensePlate}</span>
                                )}
                              </span>
                            </div>
                          )}
                          {(service.origin || service.destination) && (
                            <div
                              className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0"
                              title={`${service.origin || '?'} → ${service.destination || '?'}`}
                            >
                              <MapPin className="size-3 flex-shrink-0" />
                              <span className="truncate">
                                {service.origin || '—'} → {service.destination || '—'}
                              </span>
                            </div>
                          )}
                          {(service.operator?.name || service.crane?.licensePlate) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                              <User className="size-3 flex-shrink-0" />
                              <span className="truncate">
                                {service.operator?.name || 'Sin operador'}
                                {' · '}
                                {service.crane?.licensePlate || 'Sin grúa'}
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {service.serviceType?.name || 'Sin tipo'} • {format(new Date(service.serviceDate), 'dd/MM/yy')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Panel derecho - Cards de campos */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b bg-background/50">
              <span className="text-sm font-medium text-foreground">Campos a modificar</span>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Card Cotizaciones */}
                <div className={`rounded-xl border-2 transition-all ${
                  enableQuote
                    ? 'border-info/40 bg-info/5'
                    : 'border-border bg-card'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center ${
                          enableQuote ? 'bg-info/20' : 'bg-muted'
                        }`}>
                          <FileText className={`size-5 ${enableQuote ? 'text-info-text' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Cotizaciones</h3>
                          <p className="text-xs text-muted-foreground">Asignar números de cotización</p>
                        </div>
                      </div>
                      <Switch checked={enableQuote} onCheckedChange={setEnableQuote} />
                    </div>

                    {enableQuote && (
                      <div className="grid grid-cols-3 gap-3 mt-4 animate-fade-in">
                        <div>
                          <Label className="text-xs text-muted-foreground">Prefijo</Label>
                          <Input
                            value={batchData.quote.prefix}
                            onChange={e => updateData('quote', 'prefix', e.target.value)}
                            placeholder="COT-"
                            className="h-9 bg-background/50"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nº Base (mismo)</Label>
                          <Input
                            value={batchData.quote.baseNumber}
                            onChange={e => {
                              updateData('quote', 'baseNumber', e.target.value);
                              if (e.target.value) updateData('quote', 'startingNumber', '');
                            }}
                            placeholder="2024001"
                            className="h-9 bg-background/50"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nº Inicial (secuencial)</Label>
                          <Input
                            type="number"
                            value={batchData.quote.startingNumber}
                            onChange={e => {
                              updateData('quote', 'startingNumber', e.target.value);
                              if (e.target.value) updateData('quote', 'baseNumber', '');
                            }}
                            placeholder="1001"
                            className="h-9 bg-background/50"
                            disabled={!!batchData.quote.baseNumber}
                          />
                        </div>
                        {batchData.quote.startingNumber && activeServices.length > 0 && (
                          <div className="col-span-3">
                            <p className="text-xs text-info-text">
                              Se numerarán: {batchData.quote.prefix}{batchData.quote.startingNumber} → {batchData.quote.prefix}{parseInt(batchData.quote.startingNumber) + (overwriteQuote ? activeServices.length : activeServices.length - servicesWithQuote.length) - 1}
                            </p>
                          </div>
                        )}

                        {/* Alerta de servicios con COT existente */}
                        {servicesWithQuote.length > 0 && (
                          <div className="col-span-3 mt-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="size-4 text-warning-text" />
                                <span className="text-xs text-warning-text">
                                  {servicesWithQuote.length} servicio(s) ya tienen COT asignado
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Sobrescribir</Label>
                                <Switch
                                  checked={overwriteQuote}
                                  onCheckedChange={setOverwriteQuote}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                            {!overwriteQuote && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Se mantendrán los números existentes
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Órdenes de Compra */}
                <div className={`rounded-xl border-2 transition-all ${
                  enablePurchaseOrder
                    ? 'border-success/40 bg-success/5'
                    : 'border-border bg-card'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center ${
                          enablePurchaseOrder ? 'bg-success/20' : 'bg-muted'
                        }`}>
                          <ShoppingCart className={`size-5 ${enablePurchaseOrder ? 'text-success-text' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Órdenes de Compra</h3>
                          <p className="text-xs text-muted-foreground">Asignar números de O.C.</p>
                        </div>
                      </div>
                      <Switch checked={enablePurchaseOrder} onCheckedChange={setEnablePurchaseOrder} />
                    </div>

                    {enablePurchaseOrder && (
                      <div className="grid grid-cols-3 gap-3 mt-4 animate-fade-in">
                        <div>
                          <Label className="text-xs text-muted-foreground">Prefijo</Label>
                          <Input
                            value={batchData.purchase_order.prefix}
                            onChange={e => updateData('purchase_order', 'prefix', e.target.value)}
                            placeholder="OC-"
                            className="h-9 bg-background/50"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nº Base (mismo)</Label>
                          <Input
                            value={batchData.purchase_order.baseNumber}
                            onChange={e => {
                              updateData('purchase_order', 'baseNumber', e.target.value);
                              if (e.target.value) updateData('purchase_order', 'startingNumber', '');
                            }}
                            placeholder="2024001"
                            className="h-9 bg-background/50"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nº Inicial (secuencial)</Label>
                          <Input
                            type="number"
                            value={batchData.purchase_order.startingNumber}
                            onChange={e => {
                              updateData('purchase_order', 'startingNumber', e.target.value);
                              if (e.target.value) updateData('purchase_order', 'baseNumber', '');
                            }}
                            placeholder="1001"
                            className="h-9 bg-background/50"
                            disabled={!!batchData.purchase_order.baseNumber}
                          />
                        </div>
                        {batchData.purchase_order.startingNumber && activeServices.length > 0 && (
                          <div className="col-span-3">
                            <p className="text-xs text-success-text">
                              Se numerarán: {batchData.purchase_order.prefix}{batchData.purchase_order.startingNumber} → {batchData.purchase_order.prefix}{parseInt(batchData.purchase_order.startingNumber) + (overwritePO ? activeServices.length : activeServices.length - servicesWithPO.length) - 1}
                            </p>
                          </div>
                        )}

                        {/* Alerta de servicios con OC existente */}
                        {servicesWithPO.length > 0 && (
                          <div className="col-span-3 mt-2 p-3 rounded-lg bg-success/10 border border-success/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="size-4 text-success-text" />
                                <span className="text-xs text-success-text">
                                  {servicesWithPO.length} servicio(s) ya tienen OC asignado
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Sobrescribir</Label>
                                <Switch
                                  checked={overwritePO}
                                  onCheckedChange={setOverwritePO}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                            {!overwritePO && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Se mantendrán los números existentes
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Gestión de Estado */}
                <div className={`rounded-xl border-2 transition-all ${
                  autoUpdateStatus && (enableQuote || enablePurchaseOrder)
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-card'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center ${
                          autoUpdateStatus ? 'bg-primary/20' : 'bg-muted'
                        }`}>
                          <RefreshCw className={`size-5 ${autoUpdateStatus ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Gestión Automática de Estado</h3>
                          <p className="text-xs text-muted-foreground">Actualizar estado según documentos asignados</p>
                        </div>
                      </div>
                      <Switch checked={autoUpdateStatus} onCheckedChange={setAutoUpdateStatus} />
                    </div>

                    {autoUpdateStatus && (enableQuote || enablePurchaseOrder) && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/10 animate-fade-in">
                      <div className="flex items-center gap-2">
                          <AlertCircle className="size-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">Estado resultante:</span>
                          <Badge className={`${
                            enablePurchaseOrder
                              ? 'border-success/30 bg-success/20 text-success-text'
                              : 'border-info/30 bg-info/20 text-info-text'
                          }`}>
                            {enablePurchaseOrder ? 'Con Orden de Compra' : 'Cotizado'}
                          </Badge>
                          {enablePurchaseOrder && enableQuote && (
                            <span className="text-xs font-medium text-primary">(OC prevalece)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer con resumen */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm">
              {summary ? (
                <>
                  <span className="text-muted-foreground">Aplicando</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {summary}
                  </Badge>
                  <span className="text-muted-foreground">a</span>
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    {activeServices.length} servicios
                  </Badge>
                </>
              ) : (
                <span className="text-muted-foreground">Seleccione opciones para ver el resumen</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                <X className="size-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || activeServices.length === 0 || (!enableQuote && !enablePurchaseOrder)}
              >
                <Check className="size-4 mr-2" />
                {isLoading ? 'Actualizando...' : 'Actualizar Servicios'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
