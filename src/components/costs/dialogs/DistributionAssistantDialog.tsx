import React, { useState, useMemo, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCranes } from '@/hooks/useCranes';
import { useCreateInventoryMovement, useInventoryItems, useInventoryLocations } from '@/hooks/useInventory';
import { Trash2, Plus, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Distribution {
  id: string;
  crane_id: string;
  quantity: number;
}

interface DistributionAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryData: {
    costId: string;
    itemName: string;
    totalQuantity: number;
    unitCost: number;
    date: string;
  } | null;
}

export const DistributionAssistantDialog = ({
  open,
  onOpenChange,
  inventoryData,
}: DistributionAssistantDialogProps) => {
  const { cranes } = useCranes();
  const { mutateAsync: createMovement } = useCreateInventoryMovement();
  const { data: inventoryItems = [] } = useInventoryItems();
  const { data: locations = [] } = useInventoryLocations();
  
  const [distributions, setDistributions] = useState<Distribution[]>([
    { id: crypto.randomUUID(), crane_id: '', quantity: 0 }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const activeCranes = cranes.filter(c => c.isActive);

  // Obtener o crear item de inventario y ubicación
  useEffect(() => {
    if (!inventoryData || !open) return;

    const initializeInventory = async () => {
      try {
        // Buscar ubicación activa (usar la primera disponible)
        const activeLocation = locations.find(l => l.is_active);
        if (!activeLocation) {
          toast.error('No hay ubicaciones de inventario configuradas');
          return;
        }
        setLocationId(activeLocation.id);

        // Buscar si ya existe un item con este nombre
        const existingItem = inventoryItems.find(
          item => item.name.toLowerCase() === inventoryData.itemName.toLowerCase()
        );

        if (existingItem) {
          setInventoryItemId(existingItem.id);
        } else {
          // Crear nuevo item de inventario
          const { data: newItem, error } = await supabase
            .from('inventory_items')
            .insert({
              name: inventoryData.itemName,
              unit_of_measure: 'unidad',
              unit_cost: inventoryData.unitCost,
              is_active: true,
            })
            .select()
            .single();

          if (error) throw error;
          setInventoryItemId(newItem.id);
        }

        // Crear movimiento de entrada inicial
        // (esto se hará al confirmar la distribución)
      } catch (error) {
        console.error('Error inicializando inventario:', error);
        toast.error('Error al preparar el inventario');
      }
    };

    initializeInventory();
  }, [inventoryData, open, inventoryItems, locations]);

  const totalDistributed = useMemo(() => {
    return distributions.reduce((sum, dist) => sum + (dist.quantity || 0), 0);
  }, [distributions]);

  const remaining = useMemo(() => {
    return (inventoryData?.totalQuantity || 0) - totalDistributed;
  }, [inventoryData, totalDistributed]);

  const isValid = useMemo(() => {
    if (!inventoryData) return false;
    if (distributions.length === 0) return false;
    if (totalDistributed === 0) return false;
    if (totalDistributed > inventoryData.totalQuantity) return false;
    
    // Verificar que todas las distribuciones tengan grúa y cantidad
    return distributions.every(d => d.crane_id && d.quantity > 0);
  }, [distributions, totalDistributed, inventoryData]);

  const handleAddDistribution = () => {
    setDistributions(prev => [
      ...prev,
      { id: crypto.randomUUID(), crane_id: '', quantity: 0 }
    ]);
  };

  const handleRemoveDistribution = (id: string) => {
    if (distributions.length === 1) {
      toast.error('Debe haber al menos una distribución');
      return;
    }
    setDistributions(prev => prev.filter(d => d.id !== id));
  };

  const handleCraneChange = (id: string, craneId: string) => {
    setDistributions(prev =>
      prev.map(d => d.id === id ? { ...d, crane_id: craneId } : d)
    );
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setDistributions(prev =>
      prev.map(d => d.id === id ? { ...d, quantity: Math.max(0, quantity) } : d)
    );
  };

  const handleConfirm = async () => {
    if (!inventoryData || !isValid || !inventoryItemId || !locationId) {
      toast.error('Faltan datos necesarios para completar la distribución');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Crear movimiento de entrada a bodega
      await createMovement({
        item_id: inventoryItemId,
        location_id: locationId,
        movement_type: 'entry',
        quantity: inventoryData.totalQuantity,
        movement_date: inventoryData.date,
        unit_cost: inventoryData.unitCost,
        total_cost: inventoryData.totalQuantity * inventoryData.unitCost,
        observations: `Entrada por compra - Costo ID: ${inventoryData.costId}`,
      });

      // 2. Crear movimientos de salida para cada distribución
      for (const dist of distributions) {
        if (!dist.crane_id || !dist.quantity) continue;

        await createMovement({
          item_id: inventoryItemId,
          location_id: locationId,
          movement_type: 'exit',
          quantity: dist.quantity,
          crane_id: dist.crane_id,
          movement_date: inventoryData.date,
          reason: 'Consumo en Grúa',
          unit_cost: inventoryData.unitCost,
          total_cost: dist.quantity * inventoryData.unitCost,
          observations: `Distribución automática: ${inventoryData.itemName}`,
        });
      }

      // 3. Vincular el costo con el inventario
      await supabase
        .from('costs')
        .update({ inventory_movement_id: inventoryItemId })
        .eq('id', inventoryData.costId);

      toast.success(
        `Distribución completada: ${distributions.length} ${distributions.length === 1 ? 'grúa' : 'grúas'}`
      );
      
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Error en distribución:', error);
      toast.error('Error al distribuir el inventario');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setDistributions([{ id: crypto.randomUUID(), crane_id: '', quantity: 0 }]);
  };

  if (!inventoryData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            Distribuir Compra entre Grúas
          </DialogTitle>
          <DialogDescription>
            Se han comprado <strong>{inventoryData.totalQuantity}</strong> unidades de{' '}
            <strong>{inventoryData.itemName}</strong>. Especifica cuántas unidades va a cada grúa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Comprado</p>
              <p className="text-2xl font-bold">{inventoryData.totalQuantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Distribuido</p>
              <p className="text-2xl font-bold text-primary">{totalDistributed}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Restante</p>
              <p className={`text-2xl font-bold ${remaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {remaining}
              </p>
            </div>
          </div>

          {/* Alertas de validación */}
          {remaining < 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                La suma de cantidades ({totalDistributed}) excede el total comprado ({inventoryData.totalQuantity})
              </AlertDescription>
            </Alert>
          )}

          {remaining > 0 && totalDistributed > 0 && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Quedarán {remaining} unidades en bodega sin asignar a ninguna grúa.
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de distribuciones */}
          <div className="space-y-3">
            {distributions.map((dist, index) => (
              <div key={dist.id} className="flex items-end gap-3 p-3 border rounded-lg bg-background">
                <div className="flex-1 gap-y-2">
                  <Label>Grúa {index + 1}</Label>
                  <Select
                    value={dist.crane_id}
                    onValueChange={(value) => handleCraneChange(dist.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar grúa" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCranes.map(crane => (
                        <SelectItem key={crane.id} value={crane.id}>
                          {crane.brand} {crane.model} - {crane.licensePlate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32 space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="0"
                    max={inventoryData.totalQuantity}
                    value={dist.quantity || ''}
                    onChange={(e) => handleQuantityChange(dist.id, parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveDistribution(dist.id)}
                  disabled={distributions.length === 1}
                  className="shrink-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Botón agregar grúa */}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddDistribution}
            className="w-full"
          >
            <Plus className="size-4 mr-2" />
            Agregar Grúa
          </Button>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={isProcessing}
          >
            Omitir
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid || isProcessing || !inventoryItemId || !locationId}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              'Confirmar Distribución'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
