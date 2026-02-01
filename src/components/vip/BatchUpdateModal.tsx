import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ShoppingCart, Check, X, AlertCircle, Layers, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { Service } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface BatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServices: Service[];
  onBatchUpdate: (updates: BatchUpdateData) => Promise<void>;
  clientName: string;
}

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
  clientName
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [excludedServices, setExcludedServices] = useState<Set<string>>(new Set());
  const [enableQuote, setEnableQuote] = useState(true);
  const [enablePurchaseOrder, setEnablePurchaseOrder] = useState(false);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState(true);
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
      const services: BatchUpdateData['services'] = activeServices.map((service, index) => {
        const serviceData: any = { id: service.id };

        if (enableQuote) {
          if (quoteData.baseNumber) {
            serviceData.quote_number = `${quoteData.prefix}${quoteData.baseNumber}`;
          } else if (quoteData.startingNumber) {
            const startNum = parseInt(quoteData.startingNumber);
            serviceData.quote_number = `${quoteData.prefix}${startNum + index}`;
          }
        }

        if (enablePurchaseOrder) {
          if (poData.baseNumber) {
            serviceData.purchase_order_number = `${poData.prefix}${poData.baseNumber}`;
          } else if (poData.startingNumber) {
            const startNum = parseInt(poData.startingNumber);
            serviceData.purchase_order_number = `${poData.prefix}${startNum + index}`;
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

      await onBatchUpdate(updateData);
      
      const typesText = activeTypes.length === 2 ? 'COT + OC' : activeTypes[0] === 'quote' ? 'cotizaciones' : 'órdenes de compra';
      toast.success(`${activeServices.length} servicios actualizados con ${typesText}`);
      onOpenChange(false);

      // Reset
      setBatchData({
        quote: { baseNumber: '', startingNumber: '', prefix: 'COT-', notes: '' },
        purchase_order: { baseNumber: '', startingNumber: '', prefix: 'OC-', notes: '' }
      });
      setEnableQuote(true);
      setEnablePurchaseOrder(false);
      setAutoUpdateStatus(true);
      setExcludedServices(new Set());
    } catch (error) {
      console.error('Error en actualización por lotes:', error);
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
        className="max-w-5xl h-[80vh] bg-card border select-none flex flex-col p-0 vip-pipeline-scope" 
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
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Registro por Lotes
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{clientName}</p>
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
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs flex-1"
                  onClick={selectAll}
                >
                  <CheckSquare className="w-3 h-3 mr-1" />
                  Todos
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs flex-1"
                  onClick={deselectAll}
                >
                  <Square className="w-3 h-3 mr-1" />
                  Ninguno
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {selectedServices.map((service, index) => {
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
                              className={`text-[10px] px-1.5 py-0 ${
                                String(service.status) === 'new' ? 'bg-blue-500/20 text-blue-400' :
                                String(service.status) === 'quoted' ? 'bg-amber-500/20 text-amber-400' :
                                String(service.status) === 'with_purchase_order' ? 'bg-green-500/20 text-green-400' :
                                'bg-muted text-muted-foreground'
                              }`}
                            >
                              {STATUS_LABELS[String(service.status)] || service.status}
                            </Badge>
                          </div>
                          {/* Mostrar COT y OC existentes */}
                          {(service.quoteNumber || service.purchaseOrderNumber) && (
                            <div className="flex items-center gap-2 mt-1">
                              {service.quoteNumber && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/30">
                                  COT: {service.quoteNumber}
                                </Badge>
                              )}
                              {service.purchaseOrderNumber && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-500 border-green-500/30">
                                  OC: {service.purchaseOrderNumber}
                                </Badge>
                              )}
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
                    ? 'border-blue-500/40 bg-blue-500/5' 
                    : 'border-border bg-card'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          enableQuote ? 'bg-blue-500/20' : 'bg-muted'
                        }`}>
                          <FileText className={`w-5 h-5 ${enableQuote ? 'text-blue-400' : 'text-muted-foreground'}`} />
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
                            <p className="text-xs text-blue-400">
                              Se numerarán: {batchData.quote.prefix}{batchData.quote.startingNumber} → {batchData.quote.prefix}{parseInt(batchData.quote.startingNumber) + activeServices.length - 1}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Órdenes de Compra */}
                <div className={`rounded-xl border-2 transition-all ${
                  enablePurchaseOrder 
                    ? 'border-green-500/40 bg-green-500/5' 
                    : 'border-border bg-card'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          enablePurchaseOrder ? 'bg-green-500/20' : 'bg-muted'
                        }`}>
                          <ShoppingCart className={`w-5 h-5 ${enablePurchaseOrder ? 'text-green-400' : 'text-muted-foreground'}`} />
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
                            <p className="text-xs text-green-400">
                              Se numerarán: {batchData.purchase_order.prefix}{batchData.purchase_order.startingNumber} → {batchData.purchase_order.prefix}{parseInt(batchData.purchase_order.startingNumber) + activeServices.length - 1}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Gestión de Estado */}
                <div className={`rounded-xl border-2 transition-all ${
                  autoUpdateStatus && (enableQuote || enablePurchaseOrder)
                    ? 'border-purple-500/40 bg-purple-500/5' 
                    : 'border-border bg-card'
                }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          autoUpdateStatus ? 'bg-purple-500/20' : 'bg-muted'
                        }`}>
                          <RefreshCw className={`w-5 h-5 ${autoUpdateStatus ? 'text-purple-400' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Gestión Automática de Estado</h3>
                          <p className="text-xs text-muted-foreground">Actualizar estado según documentos asignados</p>
                        </div>
                      </div>
                      <Switch checked={autoUpdateStatus} onCheckedChange={setAutoUpdateStatus} />
                    </div>
                    
                    {autoUpdateStatus && (enableQuote || enablePurchaseOrder) && (
                      <div className="mt-3 p-3 rounded-lg bg-purple-500/10 animate-fade-in">
                      <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">Estado resultante:</span>
                          <Badge className={`${
                            enablePurchaseOrder 
                              ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' 
                              : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30'
                          }`}>
                            {enablePurchaseOrder ? 'Con Orden de Compra' : 'Cotizado'}
                          </Badge>
                          {enablePurchaseOrder && enableQuote && (
                            <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">(OC prevalece)</span>
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
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isLoading || activeServices.length === 0 || (!enableQuote && !enablePurchaseOrder)}
              >
                <Check className="w-4 h-4 mr-2" />
                {isLoading ? 'Actualizando...' : 'Actualizar Servicios'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
