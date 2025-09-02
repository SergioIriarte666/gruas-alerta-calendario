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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  ToggleRight
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
  }[];
  notes?: string;
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
        
        return serviceData;
      });

      const activeTypes: ('quote' | 'purchase_order')[] = [];
      if (enableQuote) activeTypes.push('quote');
      if (enablePurchaseOrder) activeTypes.push('purchase_order');

      const updateData: BatchUpdateData = {
        types: activeTypes,
        services,
        notes: (enableQuote ? quoteData.notes : poData.notes) || undefined
      };

      await onBatchUpdate(updateData);
      
      const typesText = activeTypes.length === 2 ? 'cotizaciones y órdenes de compra' : 
                       activeTypes[0] === 'quote' ? 'cotizaciones' : 'órdenes de compra';
      toast.success(`${selectedServices.length} servicios actualizados con ${typesText}`);
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

  // Generar preview de números
  const generatePreview = () => {
    const previews: any[] = [];
    
    selectedServices.slice(0, 3).forEach((service, index) => {
      const item: any = { folio: service.folio };
      
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
      
      if (item.quote || item.purchaseOrder) {
        previews.push(item);
      }
    });
    
    return previews;
  };

  const preview = generatePreview();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] glass-card select-none"
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
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Registro por Lotes - {clientName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Actualice números de cotización o órdenes de compra para múltiples servicios
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Servicios seleccionados */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                {selectedServices.length} servicios seleccionados
              </Badge>
            </div>
            
            <ScrollArea className="h-32 rounded-md border border-gray-700 bg-gray-800/50 p-3">
              <div className="space-y-2">
                {selectedServices.map((service, index) => (
                  <div key={service.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                      <span className="text-white">{service.folio}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300">{service.serviceType.name}</span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {format(new Date(service.serviceDate), 'dd/MM/yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Configuración de tipos */}
          <div className="space-y-6">
            {/* Cotizaciones */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-medium text-white">Cotizaciones</h3>
                </div>
                <Switch
                  checked={enableQuote}
                  onCheckedChange={setEnableQuote}
                />
              </div>
              
              {enableQuote && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quote-prefix" className="text-gray-300">Prefijo</Label>
                      <Input
                        id="quote-prefix"
                        value={batchData.quote.prefix}
                        onChange={(e) => updateData('quote', 'prefix', e.target.value)}
                        placeholder="COT-"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="quote-base" className="text-gray-300">Número base (mismo para todos)</Label>
                      <Input
                        id="quote-base"
                        value={batchData.quote.baseNumber}
                        onChange={(e) => {
                          updateData('quote', 'baseNumber', e.target.value);
                          if (e.target.value) updateData('quote', 'startingNumber', '');
                        }}
                        placeholder="2024001"
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label htmlFor="quote-start" className="text-gray-300">Número inicial (secuencial)</Label>
                      <Input
                        id="quote-start"
                        type="number"
                        value={batchData.quote.startingNumber}
                        onChange={(e) => {
                          updateData('quote', 'startingNumber', e.target.value);
                          if (e.target.value) updateData('quote', 'baseNumber', '');
                        }}
                        placeholder="1001"
                        className="bg-gray-800 border-gray-700 text-white"
                        disabled={!!batchData.quote.baseNumber}
                      />
                      {batchData.quote.startingNumber && (
                        <p className="text-xs text-gray-400 mt-1">
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
                  <h3 className="text-lg font-medium text-white">Órdenes de Compra</h3>
                </div>
                <Switch
                  checked={enablePurchaseOrder}
                  onCheckedChange={setEnablePurchaseOrder}
                />
              </div>
              
              {enablePurchaseOrder && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
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

          {/* Preview */}
          {preview.length > 0 && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                Vista Previa
              </h4>
              <div className="space-y-2">
                {preview.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-900/50 p-3 rounded">
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
              placeholder="Observaciones sobre esta actualización por lotes..."
              className="bg-gray-800 border-gray-700 text-white"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || (!enableQuote && !enablePurchaseOrder)}
          >
            <Check className="w-4 h-4 mr-2" />
            {isLoading ? 'Actualizando...' : `Actualizar ${selectedServices.length} servicios`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};