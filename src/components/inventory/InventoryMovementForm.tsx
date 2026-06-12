import React from 'react';
import { toLocalDateString } from '@/utils/timezoneUtils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Package, Plus, AlertTriangle, DollarSign } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useInventoryItems, useInventoryLocations, useInventoryStock, useCreateInventoryMovement } from '@/hooks/useInventory';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { toast } from 'sonner';
import { SupplierCombobox } from '@/components/costs/form/SupplierSelector';
import { createLogger } from "@/lib/logger";


const logger = createLogger("InventoryMovementForm");
const movementSchema = z.object({
  item_id: z.string().min(1, 'Seleccione un producto'),
  location_id: z.string().min(1, 'Seleccione una ubicación'),
  movement_type: z.enum(['entry', 'exit', 'transfer', 'adjustment']),
  quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  unit_cost: z.number().optional(),
  reference_document: z.string().optional(),
  batch_number: z.string().optional(),
  expiration_date: z.date().optional(),
  supplier_id: z.string().optional(),
  crane_id: z.string().optional(),
  operator_id: z.string().optional(),
  reason: z.string().optional(),
  observations: z.string().optional(),
  movement_date: z.date(),
  generate_cost: z.boolean().optional(),
}).refine(
  (data) => {
    // For exit movements, reason should be provided
    if (data.movement_type === 'exit' && (!data.reason || data.reason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'El motivo es requerido para movimientos de salida',
    path: ['reason']
  }
);

type MovementFormData = z.infer<typeof movementSchema>;

interface InventoryMovementFormProps {
  onSuccess?: () => void;
  defaultMovementType?: 'entry' | 'exit' | 'transfer' | 'adjustment';
  prefill?: Partial<{
    item_id: string;
    location_id: string;
    movement_type: 'entry' | 'exit' | 'transfer' | 'adjustment';
    quantity: number;
    unit_cost: number;
    reason: string;
    observations: string;
    movement_date: Date;
  }>;
  onCreated?: (movement: any) => void;
}

export const InventoryMovementForm: React.FC<InventoryMovementFormProps> = ({
  onSuccess,
  defaultMovementType = 'entry',
  prefill,
  onCreated
}) => {
  const { data: items } = useInventoryItems();
  const { data: locations } = useInventoryLocations();
  const { data: stockData } = useInventoryStock();
  const { operationalCranes: cranes } = useCranes();
  const { operators } = useOperators();
  const createMovement = useCreateInventoryMovement();

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      movement_type: defaultMovementType,
      movement_date: new Date(),
      quantity: 1,
    },
  });

  React.useEffect(() => {
    if (prefill) {
      if (prefill.item_id) form.setValue('item_id', prefill.item_id);
      if (prefill.location_id) form.setValue('location_id', prefill.location_id);
      if (prefill.movement_type) form.setValue('movement_type', prefill.movement_type);
      if (prefill.quantity !== undefined) form.setValue('quantity', prefill.quantity);
      if (prefill.unit_cost !== undefined) form.setValue('unit_cost', prefill.unit_cost);
      if (prefill.reason) form.setValue('reason', prefill.reason);
      if (prefill.observations) form.setValue('observations', prefill.observations);
      if (prefill.movement_date) form.setValue('movement_date', prefill.movement_date);
    }
  }, [prefill, form]);
  const watchedMovementType = form.watch('movement_type');
  const watchedItemId = form.watch('item_id');
  const watchedLocationId = form.watch('location_id');
  const watchedQuantity = form.watch('quantity');
  const selectedItem = items?.find(item => item.id === watchedItemId);

  // Get current stock for selected item and location
  const currentStock = stockData?.find(
    stock => stock.item_id === watchedItemId && stock.location_id === watchedLocationId
  )?.current_quantity || 0;

  const onSubmit = async (data: MovementFormData) => {
    try {
      logger.debug('Form submission data:', data);
      
      // Validate stock for exit movements
      if ((data.movement_type === 'exit' || data.movement_type === 'transfer') && data.quantity > currentStock) {
        toast.error(`Stock insuficiente. Stock actual: ${currentStock} ${selectedItem?.unit_of_measure || 'unidades'}`);
        return;
      }

      const total_cost = data.unit_cost ? data.quantity * data.unit_cost : undefined;
      
      logger.debug('Calling createMovement with:', {
        item_id: data.item_id,
        location_id: data.location_id,
        movement_type: data.movement_type,
        quantity: data.quantity,
        unit_cost: data.unit_cost,
        total_cost,
        reference_document: data.reference_document,
        batch_number: data.batch_number,
        expiration_date: data.expiration_date ? toLocalDateString(data.expiration_date) : undefined,
        supplier_id: data.supplier_id || null,
        crane_id: data.crane_id,
        operator_id: data.operator_id,
        reason: data.reason,
        observations: data.observations,
        movement_date: data.movement_date.toISOString(),
        generateCost: data.generate_cost,
      });
      
      const created = await createMovement.mutateAsync({
        item_id: data.item_id,
        location_id: data.location_id,
        movement_type: data.movement_type,
        quantity: data.quantity,
        unit_cost: data.unit_cost,
        total_cost,
        reference_document: data.reference_document,
        batch_number: data.batch_number,
        expiration_date: data.expiration_date ? toLocalDateString(data.expiration_date) : undefined,
        supplier_id: data.supplier_id || null,
        crane_id: data.crane_id,
        operator_id: data.operator_id,
        reason: data.reason,
        observations: data.observations,
        movement_date: data.movement_date.toISOString(),
        generateCost: data.generate_cost,
      });
      
      if (onCreated) onCreated(created);
      
      toast.success('Movimiento registrado correctamente');
      form.reset({
        movement_type: defaultMovementType,
        movement_date: new Date(),
        quantity: 1,
      });
      onSuccess?.();
    } catch (error) {
      logger.error('Error creating movement:', error);
      toast.error(`Error al registrar el movimiento: ${error.message || 'Error desconocido'}`);
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'entry': return 'border-success/20 bg-success/10 text-success';
      case 'exit': return 'border-danger/20 bg-danger/10 text-danger';
      case 'transfer': return 'border-info/20 bg-info/10 text-info';
      case 'adjustment': return 'border-warning/20 bg-warning/10 text-warning';
      default: return 'border-border/70 bg-muted text-muted-foreground';
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'entry': return 'Entrada';
      case 'exit': return 'Salida';
      case 'transfer': return 'Transferencia';
      case 'adjustment': return 'Ajuste';
      default: return type;
    }
  };

  return (
    <Card className="w-full max-w-2xl border-border/70 bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-5" />
          Nuevo Movimiento de Inventario
        </CardTitle>
        <CardDescription>
          Registre entradas, salidas y transferencias de productos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Movement Type */}
          <div className="space-y-2">
            <Label htmlFor="movement_type">Tipo de Movimiento</Label>
            <Select 
              value={form.watch('movement_type')} 
              onValueChange={(value) => form.setValue('movement_type', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione el tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">
                  <div className="flex items-center gap-2">
                    <Badge className={getMovementTypeColor('entry')}>
                      Entrada
                    </Badge>
                    <span>Ingreso de productos</span>
                  </div>
                </SelectItem>
                <SelectItem value="exit">
                  <div className="flex items-center gap-2">
                    <Badge className={getMovementTypeColor('exit')}>
                      Salida
                    </Badge>
                    <span>Consumo o venta</span>
                  </div>
                </SelectItem>
                <SelectItem value="transfer">
                  <div className="flex items-center gap-2">
                    <Badge className={getMovementTypeColor('transfer')}>
                      Transferencia
                    </Badge>
                    <span>Entre ubicaciones</span>
                  </div>
                </SelectItem>
                <SelectItem value="adjustment">
                  <div className="flex items-center gap-2">
                    <Badge className={getMovementTypeColor('adjustment')}>
                      Ajuste
                    </Badge>
                    <span>Corrección de inventario</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.movement_type && (
              <p className="text-sm text-red-600">{form.formState.errors.movement_type.message}</p>
            )}
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label htmlFor="item_id">Producto</Label>
            <Select 
              value={form.watch('item_id')} 
              onValueChange={(value) => form.setValue('item_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un producto" />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      {item.sku && <span className="text-sm text-muted-foreground">SKU: {item.sku}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.item_id && (
              <p className="text-sm text-red-600">{form.formState.errors.item_id.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location_id">Ubicación</Label>
            <Select 
              value={form.watch('location_id')} 
              onValueChange={(value) => form.setValue('location_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una ubicación" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{location.name}</span>
                      <span className="text-sm text-muted-foreground">Código: {location.code}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.location_id && (
              <p className="text-sm text-red-600">{form.formState.errors.location_id.message}</p>
            )}
            
            {/* Current Stock Information */}
            {watchedItemId && watchedLocationId && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stock actual:</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={currentStock > 0 ? "default" : "destructive"}>
                      {currentStock} {selectedItem?.unit_of_measure || 'unidades'}
                    </Badge>
                    {selectedItem?.minimum_stock && currentStock <= selectedItem.minimum_stock && (
                      <Badge variant="destructive" className="text-xs">Stock Bajo</Badge>
                    )}
                  </div>
                </div>
                {selectedItem?.minimum_stock && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock mínimo: {selectedItem.minimum_stock} {selectedItem.unit_of_measure}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quantity and Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad</Label>
              <Input
                type="number"
                min="1"
                {...form.register('quantity', { valueAsNumber: true })}
                placeholder="0"
                className={cn(
                  (watchedMovementType === 'exit' || watchedMovementType === 'transfer') && 
                  watchedQuantity > currentStock && 
                  watchedItemId && watchedLocationId && 
                  "border-red-500 focus:border-red-500"
                )}
              />
              {selectedItem && (
                <p className="text-sm text-muted-foreground">
                  Unidad: {selectedItem.unit_of_measure}
                </p>
              )}
              {/* Stock validation warning */}
              {(watchedMovementType === 'exit' || watchedMovementType === 'transfer') && 
               watchedQuantity > currentStock && 
               watchedItemId && watchedLocationId && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Stock insuficiente (disponible: {currentStock})
                </p>
              )}
              {form.formState.errors.quantity && (
                <p className="text-sm text-red-600">{form.formState.errors.quantity.message}</p>
              )}
            </div>

            {watchedMovementType === 'entry' && (
              <div className="space-y-2">
                <Label htmlFor="unit_cost">Costo Unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register('unit_cost', { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {form.formState.errors.unit_cost && (
                  <p className="text-sm text-red-600">{form.formState.errors.unit_cost.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Movement Date */}
          <div className="space-y-2">
            <Label>Fecha del Movimiento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !form.watch('movement_date') && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {form.watch('movement_date') ? format(form.watch('movement_date'), "PPP") : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch('movement_date')}
                  onSelect={(date) => date && form.setValue('movement_date', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Cost information and checkbox for entry movements */}
          {watchedMovementType === 'entry' && form.watch('unit_cost') && form.watch('quantity') && (
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4" />
                <span className="font-medium">Información de Costo</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Costo total: ${(form.watch('unit_cost') * form.watch('quantity')).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-x-2">
                <Checkbox
                  id="generate_cost"
                  checked={form.watch('generate_cost') || false}
                  onCheckedChange={(checked) => form.setValue('generate_cost', checked as boolean)}
                />
                <Label 
                  htmlFor="generate_cost" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Registrar como gasto en costos
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Al activar esta opción se creará automáticamente un registro de costo en el módulo de gastos.
              </p>
            </div>
          )}

          {/* Additional fields based on movement type */}
          {watchedMovementType === 'entry' && (
            <>
              {/* Supplier Selector */}
              <div className="space-y-2">
                <Label htmlFor="supplier_id">Proveedor (Opcional)</Label>
                <SupplierCombobox
                  value={form.watch('supplier_id') ?? null}
                  onValueChange={(value) => form.setValue('supplier_id', value ?? undefined)}
                  placeholder="Seleccionar proveedor"
                  noneLabel="Sin proveedor"
                  allowCreate
                />
              </div>

              {/* Reference Document - Enhanced for Multi-Product Purchases */}
              <div className="space-y-2">
                <Label htmlFor="reference_document" className="flex items-center gap-2">
                  <Package className="size-4" />
                  Documento de Referencia
                  <Badge variant="outline" className="text-xs">Recomendado</Badge>
                </Label>
                <Input
                  {...form.register('reference_document')}
                  placeholder="Ej: FAC-001234, OC-5678 (para agrupar compras múltiples)"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Use el mismo número de documento para todos los productos de una misma compra/factura. 
                  Esto permite agrupar y hacer seguimiento de compras con múltiples productos.
                </p>
              </div>

              {/* Batch Number */}
              <div className="space-y-2">
                <Label htmlFor="batch_number">Número de Lote/Serie (Opcional)</Label>
                <Input
                  {...form.register('batch_number')}
                  placeholder="Para trazabilidad"
                />
              </div>
            </>
          )}

          {watchedMovementType === 'exit' && (
            <>
              {/* Crane */}
              <div className="space-y-2">
                <Label htmlFor="crane_id">Grúa (Opcional)</Label>
                <Select 
                  value={form.watch('crane_id') || ''} 
                  onValueChange={(value) => form.setValue('crane_id', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una grúa" />
                  </SelectTrigger>
                  <SelectContent>
                    {cranes?.map((crane) => (
                      <SelectItem key={crane.id} value={crane.id}>
                        {crane.licensePlate} - {crane.brand} {crane.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operator */}
              <div className="space-y-2">
                <Label htmlFor="operator_id">Operador (Opcional)</Label>
                <Select 
                  value={form.watch('operator_id') || ''} 
                  onValueChange={(value) => form.setValue('operator_id', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators?.map((operator) => (
                      <SelectItem key={operator.id} value={operator.id}>
                        {operator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo {watchedMovementType === 'exit' && <span className="text-red-500">*</span>}
            </Label>
            <Input
              {...form.register('reason')}
              placeholder="Motivo del movimiento"
            />
            {form.formState.errors.reason && (
              <p className="text-sm text-red-600">{form.formState.errors.reason.message}</p>
            )}
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones (Opcional)</Label>
            <Textarea
              {...form.register('observations')}
              placeholder="Observaciones adicionales"
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={createMovement.isPending}
          >
            <Plus className="size-4 mr-2" />
            {createMovement.isPending ? 'Registrando...' : `Registrar ${getMovementTypeLabel(watchedMovementType)}`}
          </Button>
        </form>
      </CardContent>

    </Card>
  );
};
