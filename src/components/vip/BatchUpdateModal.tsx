import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  ShoppingCart, 
  Check, 
  X, 
  AlertCircle,
  Hash,
  Calendar,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
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

export const BatchUpdateModal: React.FC<BatchUpdateModalProps> = ({
  open,
  onOpenChange,
  selectedServices,
  onBatchUpdate,
  clientName
}) => {
  const [isLoading, setIsLoading] = useState(false);
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

  // Función para determinar el estado objetivo (OC prevalece)
  const determineTargetStatus = (enableQuote: boolean, enablePO: boolean): string | null => {
    if (!autoUpdateStatus) return null;
    
    if (enablePO && enableQuote) {
      return 'with_purchase_order'; // OC PREVALECE SIEMPRE
    } else if (enablePO) {
      return 'with_purchase_order';
    } else if (enableQuote) {
      return 'quoted';
    }
    return null;
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      toast.error('No hay servicios seleccionados');
      return;
    }

    if (!enableQuote && !enablePurchaseOrder) {
      toast.error('Debe habilitar al menos una opción: Cotización o Orden de Compra');
      return;
    }

    // Validar datos según las opciones habilitadas
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
      const targetStatus = determineTargetStatus(enableQuote, enablePurchaseOrder);
      
      // 🔍 DEBUG: Logging valores de diagnóstico
      console.log('🔍 BatchUpdateModal - Valores de diagnóstico:', {
        autoUpdateStatus,
        enableQuote,
        enablePurchaseOrder,
        targetStatus,
        selectedServicesCount: selectedServices.length
      });
      
      const services: BatchUpdateData['services'] = selectedServices.map((service, index) => {
        const serviceData: any = { id: service.id };
        
        // Procesar cotizaciones si están habilitadas
        if (enableQuote) {
          if (quoteData.baseNumber) {
            serviceData.quote_number = `${quoteData.prefix}${quoteData.baseNumber}`;
          } else if (quoteData.startingNumber) {
            const startNum = parseInt(quoteData.startingNumber);
            serviceData.quote_number = `${quoteData.prefix}${startNum + index}`;
          }
        }
        
        // Procesar órdenes de compra si están habilitadas
        if (enablePurchaseOrder) {
          if (poData.baseNumber) {
            serviceData.purchase_order_number = `${poData.prefix}${poData.baseNumber}`;
          } else if (poData.startingNumber) {
            const startNum = parseInt(poData.startingNumber);
            serviceData.purchase_order_number = `${poData.prefix}${startNum + index}`;
          }
        }
        
        // Agregar estado objetivo si el cambio automático está habilitado
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

      // 🔍 DEBUG: Logging datos finales antes de enviar
      console.log('🔍 BatchUpdateModal - Datos finales a enviar:', {
        updateData,
        firstServiceSample: services[0]
      });

      await onBatchUpdate(updateData);
      
      const typesText = activeTypes.length === 2 ? 'cotizaciones y órdenes de compra' : 
                       activeTypes[0] === 'quote' ? 'cotizaciones' : 'órdenes de compra';
      const statusText = targetStatus ? ` - Estado cambiado a '${targetStatus === 'quoted' ? 'Cotizado' : 'Con Orden de Compra'}'` : '';
      toast.success(`${selectedServices.length} servicios actualizados con ${typesText}${statusText}`);
      onOpenChange(false);
      
      // Resetear formulario
      setBatchData({
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
      setEnableQuote(true);
      setEnablePurchaseOrder(false);
      setAutoUpdateStatus(true);
      
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
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  // Generar preview de números y estados
  const generatePreview = () => {
    const previews: any[] = [];
    const targetStatus = determineTargetStatus(enableQuote, enablePurchaseOrder);
    
    selectedServices.slice(0, 3).forEach((service, index) => {
      const item: any = { 
        folio: service.folio, 
        currentStatus: service.status,
        targetStatus: targetStatus 
      };
      
      if (enableQuote) {
        const quoteData = batchData.quote;
        if (quoteData.baseNumber) {
          item.quote = `${quoteData.prefix}${quoteData.baseNumber}`;
        } else if (quoteData.startingNumber) {
          const startNum = parseInt(quoteData.startingNumber);
          item.quote = `${quoteData.prefix}${startNum + index}`;
        }
      }
      
      if (enablePurchaseOrder) {
        const poData = batchData.purchase_order;
        if (poData.baseNumber) {
          item.purchaseOrder = `${poData.prefix}${poData.baseNumber}`;
        } else if (poData.startingNumber) {
          const startNum = parseInt(poData.startingNumber);
          item.purchaseOrder = `${poData.prefix}${startNum + index}`;
        }
      }
      
      if (item.quote || item.purchaseOrder || targetStatus) {
        previews.push(item);
      }
    });
    
    return previews;
  };

  const preview = generatePreview();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[75vh] bg-card border select-none flex flex-col p-0 vip-pipeline-scope"
        style={{ 
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}>
        
        {/* Header fijo */}
        <DialogHeader className="flex-shrink-0 p-6 border-b">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Registro por Lotes - {clientName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Actualice números de cotización o órdenes de compra para múltiples servicios
          </DialogDescription>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div 
          className="flex-1 overflow-y-auto px-6 py-4"
          style={{ 
            maxHeight: 'calc(75vh - 140px)' // 75vh menos header (~80px) y footer (~60px)
          }}
        >
          <div className="space-y-4">
            {/* Servicios seleccionados */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  {selectedServices.length} servicios seleccionados
                </Badge>
              </div>
              
              <div className="h-20 overflow-y-auto space-y-2 border bg-card p-3 rounded-md">
                <div className="space-y-2">
                  {selectedServices.map((service, index) => (
                    <div key={service.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-xs">
                          {index + 1}
                        </span>
                        <span className="text-foreground">{service.folio}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{service.serviceType.name}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {format(new Date(service.serviceDate), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Configuración de tipos */}
            <div className="space-y-3">
              {/* Cotizaciones */}
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-medium text-foreground">Cotizaciones</h3>
                    </div>
                    <Switch
                      checked={enableQuote}
                      onCheckedChange={setEnableQuote}
                    />
                  </div>
                
                {enableQuote && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="quote-prefix" className="text-foreground">Prefijo</Label>
                        <Input
                          id="quote-prefix"
                          value={batchData.quote.prefix}
                          onChange={(e) => updateData('quote', 'prefix', e.target.value)}
                          placeholder="COT-"
                          className="bg-background border"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="quote-base" className="text-foreground">Número base (mismo para todos)</Label>
                        <Input
                          id="quote-base"
                          value={batchData.quote.baseNumber}
                          onChange={(e) => {
                            updateData('quote', 'baseNumber', e.target.value);
                            if (e.target.value) updateData('quote', 'startingNumber', '');
                          }}
                          placeholder="2024001"
                          className="bg-background border"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label htmlFor="quote-start" className="text-foreground">Número inicial (secuencial)</Label>
                        <Input
                          id="quote-start"
                          type="number"
                          value={batchData.quote.startingNumber}
                          onChange={(e) => {
                            updateData('quote', 'startingNumber', e.target.value);
                            if (e.target.value) updateData('quote', 'baseNumber', '');
                          }}
                          placeholder="1001"
                          className="bg-background border"
                          disabled={!!batchData.quote.baseNumber}
                        />
                        {batchData.quote.startingNumber && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Se numerarán del {batchData.quote.prefix}{batchData.quote.startingNumber} al {batchData.quote.prefix}{parseInt(batchData.quote.startingNumber) + selectedServices.length - 1}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Órdenes de Compra */}
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-5 h-5 text-green-400" />
                      <h3 className="text-lg font-medium text-foreground">Órdenes de Compra</h3>
                    </div>
                    <Switch
                      checked={enablePurchaseOrder}
                      onCheckedChange={setEnablePurchaseOrder}
                    />
                  </div>
                
                {enablePurchaseOrder && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="po-prefix" className="text-gray-300">Prefijo</Label>
                        <Input
                          id="po-prefix"
                          value={batchData.purchase_order.prefix}
                          onChange={(e) => updateData('purchase_order', 'prefix', e.target.value)}
                          placeholder="OC-"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="po-base" className="text-gray-300">Número base (mismo para todos)</Label>
                        <Input
                          id="po-base"
                          value={batchData.purchase_order.baseNumber}
                          onChange={(e) => {
                            updateData('purchase_order', 'baseNumber', e.target.value);
                            if (e.target.value) updateData('purchase_order', 'startingNumber', '');
                          }}
                          placeholder="2024001"
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label htmlFor="po-start" className="text-gray-300">Número inicial (secuencial)</Label>
                        <Input
                          id="po-start"
                          type="number"
                          value={batchData.purchase_order.startingNumber}
                          onChange={(e) => {
                            updateData('purchase_order', 'startingNumber', e.target.value);
                            if (e.target.value) updateData('purchase_order', 'baseNumber', '');
                          }}
                          placeholder="1001"
                          className="bg-gray-800 border-gray-700 text-white"
                          disabled={!!batchData.purchase_order.baseNumber}
                        />
                        {batchData.purchase_order.startingNumber && (
                          <p className="text-xs text-gray-400 mt-1">
                            Se numerarán del {batchData.purchase_order.prefix}{batchData.purchase_order.startingNumber} al {batchData.purchase_order.prefix}{parseInt(batchData.purchase_order.startingNumber) + selectedServices.length - 1}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gestión Automática de Estado */}
            <div className="space-y-4">
              <Separator className="bg-gray-700" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-medium text-white">Gestión Automática de Estado</h3>
                </div>
                <Switch
                  checked={autoUpdateStatus}
                  onCheckedChange={setAutoUpdateStatus}
                />
              </div>
              
              {autoUpdateStatus && (enableQuote || enablePurchaseOrder) && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300 font-medium">Estado Resultante</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {enablePurchaseOrder && enableQuote ? (
                      <div className="flex items-center gap-2">
                        <span>Los servicios cambiarán automáticamente a</span>
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                          Con Orden de Compra
                        </Badge>
                        <span className="text-purple-400">(OC prevalece sobre cotización)</span>
                      </div>
                    ) : enablePurchaseOrder ? (
                      <div className="flex items-center gap-2">
                        <span>Los servicios cambiarán automáticamente a</span>
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                          Con Orden de Compra
                        </Badge>
                      </div>
                    ) : enableQuote ? (
                      <div className="flex items-center gap-2">
                        <span>Los servicios cambiarán automáticamente a</span>
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                          Cotizado
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  Vista Previa
                </h4>
                <div className="space-y-2">
                  {preview.map((item, index) => (
                    <div key={index} className="bg-gray-900/50 p-3 rounded border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 font-medium">{item.folio}</span>
                        <div className="flex items-center gap-2">
                          {item.quote && (
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                              COT: {item.quote}
                            </Badge>
                          )}
                          {item.purchaseOrder && (
                            <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30">
                              O.C.: {item.purchaseOrder}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {autoUpdateStatus && item.targetStatus && (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary" className="bg-gray-700 text-gray-300">
                            {item.currentStatus === 'new' ? 'Nuevo' : 
                             item.currentStatus === 'quoted' ? 'Cotizado' : 
                             item.currentStatus === 'with_purchase_order' ? 'Con O.C.' : 
                             item.currentStatus}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-purple-400" />
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            {item.targetStatus === 'quoted' ? 'Cotizado' : 'Con Orden de Compra'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedServices.length > 3 && (
                    <div className="text-center text-gray-400 text-sm">
                      ... y {selectedServices.length - 3} servicios más
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notas */}
            <div>
              <Label htmlFor="notes" className="text-gray-300">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={enableQuote ? batchData.quote.notes : batchData.purchase_order.notes}
                onChange={(e) => {
                  if (enableQuote) updateData('quote', 'notes', e.target.value);
                  if (enablePurchaseOrder) updateData('purchase_order', 'notes', e.target.value);
                }}
                placeholder="Notas adicionales sobre esta actualización por lotes..."
                className="bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="flex-shrink-0 p-6 border-t border-gray-700">
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || (!enableQuote && !enablePurchaseOrder)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              {isLoading ? 'Actualizando...' : 'Actualizar Servicios'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};