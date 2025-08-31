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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Calendar
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
  type: 'quote' | 'purchase_order';
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
  const [activeTab, setActiveTab] = useState<'quote' | 'purchase_order'>('quote');
  const [isLoading, setIsLoading] = useState(false);
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

    const currentData = batchData[activeTab];
    
    if (!currentData.baseNumber && !currentData.startingNumber) {
      toast.error('Debe ingresar un número base o número inicial');
      return;
    }

    setIsLoading(true);
    
    try {
      let services: BatchUpdateData['services'] = [];
      
      if (currentData.baseNumber) {
        // Usar el mismo número para todos los servicios
        services = selectedServices.map(service => ({
          id: service.id,
          ...(activeTab === 'quote' 
            ? { quote_number: `${currentData.prefix}${currentData.baseNumber}` }
            : { purchase_order_number: `${currentData.prefix}${currentData.baseNumber}` }
          )
        }));
      } else if (currentData.startingNumber) {
        // Numerar secuencialmente
        const startNum = parseInt(currentData.startingNumber);
        services = selectedServices.map((service, index) => ({
          id: service.id,
          ...(activeTab === 'quote' 
            ? { quote_number: `${currentData.prefix}${startNum + index}` }
            : { purchase_order_number: `${currentData.prefix}${startNum + index}` }
          )
        }));
      }

      const updateData: BatchUpdateData = {
        type: activeTab,
        services,
        notes: currentData.notes || undefined
      };

      await onBatchUpdate(updateData);
      
      toast.success(`${selectedServices.length} servicios actualizados correctamente`);
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
      
    } catch (error) {
      console.error('Error en actualización por lotes:', error);
      toast.error('Error al actualizar los servicios');
    } finally {
      setIsLoading(false);
    }
  };

  const currentData = batchData[activeTab];
  const updateCurrentData = (field: string, value: string) => {
    setBatchData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value
      }
    }));
  };

  // Generar preview de números
  const generatePreview = () => {
    if (!currentData.baseNumber && !currentData.startingNumber) return [];
    
    if (currentData.baseNumber) {
      return [{ 
        folio: selectedServices[0]?.folio || 'SRV-XXXX', 
        number: `${currentData.prefix}${currentData.baseNumber}`,
        isExample: true
      }];
    }
    
    if (currentData.startingNumber) {
      const startNum = parseInt(currentData.startingNumber);
      return selectedServices.slice(0, 3).map((service, index) => ({
        folio: service.folio,
        number: `${currentData.prefix}${startNum + index}`,
        isExample: false
      }));
    }
    
    return [];
  };

  const preview = generatePreview();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-card">
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

          {/* Tabs para tipo de actualización */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'quote' | 'purchase_order')}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="quote" className="data-[state=active]:bg-blue-600">
                <FileText className="w-4 h-4 mr-2" />
                Cotizaciones
              </TabsTrigger>
              <TabsTrigger value="purchase_order" className="data-[state=active]:bg-green-600">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Órdenes de Compra
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quote" className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h4 className="text-blue-300 font-medium mb-2">Configuración de Cotizaciones</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Configure cómo asignar números de cotización a los servicios seleccionados.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quote-prefix" className="text-gray-300">Prefijo</Label>
                    <Input
                      id="quote-prefix"
                      value={currentData.prefix}
                      onChange={(e) => updateCurrentData('prefix', e.target.value)}
                      placeholder="COT-"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="quote-base" className="text-gray-300">Número base (mismo para todos)</Label>
                    <Input
                      id="quote-base"
                      value={currentData.baseNumber}
                      onChange={(e) => {
                        updateCurrentData('baseNumber', e.target.value);
                        if (e.target.value) updateCurrentData('startingNumber', '');
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
                      value={currentData.startingNumber}
                      onChange={(e) => {
                        updateCurrentData('startingNumber', e.target.value);
                        if (e.target.value) updateCurrentData('baseNumber', '');
                      }}
                      placeholder="1001"
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={!!currentData.baseNumber}
                    />
                    {currentData.startingNumber && (
                      <p className="text-xs text-gray-400 mt-1">
                        Se numerarán del {currentData.prefix}{currentData.startingNumber} al {currentData.prefix}{parseInt(currentData.startingNumber) + selectedServices.length - 1}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="purchase_order" className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <h4 className="text-green-300 font-medium mb-2">Configuración de Órdenes de Compra</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Configure cómo asignar números de orden de compra a los servicios seleccionados.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="po-prefix" className="text-gray-300">Prefijo</Label>
                    <Input
                      id="po-prefix"
                      value={currentData.prefix}
                      onChange={(e) => updateCurrentData('prefix', e.target.value)}
                      placeholder="OC-"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="po-base" className="text-gray-300">Número base (mismo para todos)</Label>
                    <Input
                      id="po-base"
                      value={currentData.baseNumber}
                      onChange={(e) => {
                        updateCurrentData('baseNumber', e.target.value);
                        if (e.target.value) updateCurrentData('startingNumber', '');
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
                      value={currentData.startingNumber}
                      onChange={(e) => {
                        updateCurrentData('startingNumber', e.target.value);
                        if (e.target.value) updateCurrentData('baseNumber', '');
                      }}
                      placeholder="1001"
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={!!currentData.baseNumber}
                    />
                    {currentData.startingNumber && (
                      <p className="text-xs text-gray-400 mt-1">
                        Se numerarán del {currentData.prefix}{currentData.startingNumber} al {currentData.prefix}{parseInt(currentData.startingNumber) + selectedServices.length - 1}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                Vista Previa
              </h4>
              <div className="space-y-2">
                {preview.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-900/50 p-2 rounded">
                    <span className="text-gray-300">{item.folio}</span>
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-300">
                      {item.number}
                    </Badge>
                  </div>
                ))}
                {currentData.startingNumber && selectedServices.length > 3 && (
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
              value={currentData.notes}
              onChange={(e) => updateCurrentData('notes', e.target.value)}
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
          <Button onClick={handleSubmit} disabled={isLoading || (!currentData.baseNumber && !currentData.startingNumber)}>
            <Check className="w-4 h-4 mr-2" />
            {isLoading ? 'Actualizando...' : `Actualizar ${selectedServices.length} servicios`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};