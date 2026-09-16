import { businessClock } from '@/utils/businessClock';
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInventoryItems, useInventoryLocations, useInventoryStock, useCreateInventoryMovement } from '@/hooks/useInventory';
import { useCranes } from '@/hooks/useCranes';
import { CalendarIcon, PackageMinus, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import {
  INVENTORY_LOCATION_ENTITY_LABELS,
  getLocationEntity,
  sortLocationsForEntity,
  type InventoryEntityFilter,
} from '@/utils/inventoryEntity';


const logger = createLogger("SimpleExitForm");
const exitSchema = z.object({
  item_id: z.string().min(1, 'Selecciona un producto'),
  location_id: z.string().min(1, 'Selecciona una ubicación'),
  quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  movement_date: z.date(),
  destination_type: z.enum(['crane', 'sale', 'adjustment', 'other']),
  source_entry_id: z.string().optional(),
  crane_id: z.string().optional(),
  reason: z.string().min(1, 'El motivo es requerido'),
  observations: z.string().optional(),
});

type ExitFormData = z.infer<typeof exitSchema>;

interface SimpleExitFormProps {
  onSuccess?: () => void;
  defaultCraneId?: string;
  entityFilter?: InventoryEntityFilter;
}

export const SimpleExitForm: React.FC<SimpleExitFormProps> = ({ onSuccess, defaultCraneId, entityFilter = 'all' }) => {
  const { data: items = [] } = useInventoryItems();
  const { data: locations = [] } = useInventoryLocations();
  const { cranes = [] } = useCranes();
  const createMovement = useCreateInventoryMovement();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ExitFormData>({
    resolver: zodResolver(exitSchema),
    defaultValues: {
      movement_date: businessClock.todayDate(),
      quantity: 1,
      item_id: '',
      location_id: '',
      destination_type: 'crane',
      source_entry_id: '',
      crane_id: defaultCraneId ?? '',
    },
  });

  const watchedValues = watch();
  const selectedItem = items.find(item => item.id === watchedValues.item_id);
  const orderedLocations = React.useMemo(
    () => sortLocationsForEntity(locations.filter((location) => location.is_active), entityFilter),
    [locations, entityFilter],
  );

  React.useEffect(() => {
    if (entityFilter === 'all' || watchedValues.location_id) return;
    const preferredLocation = orderedLocations.find((location) => getLocationEntity(location) === entityFilter);
    if (preferredLocation) setValue('location_id', preferredLocation.id);
  }, [entityFilter, orderedLocations, setValue, watchedValues.location_id]);
  
  // Get stock for selected item and location
  const { data: allStock = [] } = useInventoryStock();
  const stockData = allStock.filter(
    s => s.item_id === watchedValues.item_id && s.location_id === watchedValues.location_id
  );
  const availableStock = stockData[0]?.available_quantity || 0;

  // Query recent entries to get real cost (FIFO)
  const { data: recentEntries = [] } = useQuery({
    queryKey: ['recent-entries', watchedValues.item_id, watchedValues.location_id],
    queryFn: async () => {
      if (!watchedValues.item_id || !watchedValues.location_id) return [];
      
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('id, unit_cost, quantity, movement_date, supplier_id, reference_document, batch_number, supplier_invoice_id, supplier_invoice_item_id')
        .eq('item_id', watchedValues.item_id)
        .eq('location_id', watchedValues.location_id)
        .eq('movement_type', 'entry')
        .eq('status', 'active')
        .order('movement_date', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!watchedValues.item_id && !!watchedValues.location_id,
  });

  React.useEffect(() => {
    if (!recentEntries.length) {
      if (watchedValues.source_entry_id) {
        setValue('source_entry_id', '');
      }
      return;
    }

    const selectedEntryStillExists = recentEntries.some((entry) => entry.id === watchedValues.source_entry_id);
    if (!watchedValues.source_entry_id || !selectedEntryStillExists) {
      setValue('source_entry_id', recentEntries[0].id);
    }
  }, [recentEntries, setValue, watchedValues.source_entry_id]);

  const selectedSourceEntry = recentEntries.find((entry) => entry.id === watchedValues.source_entry_id) || recentEntries[0];

  // Calculate cost from the selected source entry when available
  const calculateRealCost = () => {
    if (!selectedSourceEntry) {
      return selectedItem?.unit_cost || 0;
    }
    return selectedSourceEntry.unit_cost || 0;
  };

  const realUnitCost = calculateRealCost();

  const onSubmit = async (data: ExitFormData) => {
    // Validate stock
    if (data.quantity > availableStock) {
      toast.error(`Stock insuficiente. Disponible: ${availableStock}`);
      return;
    }

    try {
      if (data.destination_type === 'crane' && !data.crane_id) {
        toast.error('Selecciona una grúa');
        return;
      }

      const movementData: any = {
        item_id: data.item_id,
        location_id: data.location_id,
        movement_type: 'exit',
        quantity: data.quantity,
        movement_date: businessClock.toTimestamp(data.movement_date),
        reason: data.reason,
        observations: data.observations || null,
      };

      // Add crane if destination is crane
      if (data.destination_type === 'crane' && data.crane_id) {
        movementData.crane_id = data.crane_id;
      }

      // Use real cost from FIFO and propagate invoice link
      movementData.unit_cost = realUnitCost;
      movementData.total_cost = realUnitCost * data.quantity;
      
      // Preserve the traceable origin chosen by the user.
      if (selectedSourceEntry?.supplier_id) {
        movementData.supplier_id = selectedSourceEntry.supplier_id;
      }
      if (selectedSourceEntry?.reference_document) {
        movementData.reference_document = selectedSourceEntry.reference_document;
      }
      if (selectedSourceEntry?.batch_number) {
        movementData.batch_number = selectedSourceEntry.batch_number;
      }
      if (selectedSourceEntry?.supplier_invoice_id) {
        movementData.supplier_invoice_id = selectedSourceEntry.supplier_invoice_id;
      }
      if (selectedSourceEntry?.supplier_invoice_item_id) {
        movementData.supplier_invoice_item_id = selectedSourceEntry.supplier_invoice_item_id;
      }

      await createMovement.mutateAsync(movementData);

      toast.success('Salida registrada exitosamente');
      onSuccess?.();
    } catch (error) {
      logger.error('Error creating exit:', error);
      toast.error('Error al registrar la salida');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información Básica */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <PackageMinus className="size-5 text-destructive" />
          <h3 className="font-semibold">Información de Salida</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Producto */}
          <div className="space-y-2">
            <Label htmlFor="item_id">Producto *</Label>
            <Select
              value={watchedValues.item_id}
              onValueChange={(value) => setValue('item_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {items.filter(item => item.is_active).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.sku && `(${item.sku})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.item_id && (
              <p className="text-sm text-destructive">{errors.item_id.message}</p>
            )}
          </div>

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="location_id">Ubicación *</Label>
            <Select
              value={watchedValues.location_id}
              onValueChange={(value) => setValue('location_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ubicación" />
              </SelectTrigger>
              <SelectContent>
                {orderedLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                    {entityFilter === 'all' ? ` · ${INVENTORY_LOCATION_ENTITY_LABELS[getLocationEntity(location)]}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.location_id && (
              <p className="text-sm text-destructive">{errors.location_id.message}</p>
            )}
          </div>

          {/* Stock Disponible Alert */}
          {watchedValues.item_id && watchedValues.location_id && (
            <div className="md:col-span-2">
              <Alert className={availableStock > 0 ? "border-primary" : "border-destructive"}>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Stock disponible: <span className="font-semibold">{availableStock}</span> {selectedItem?.unit_of_measure || 'unidades'}
                  {availableStock === 0 && ' - No hay stock disponible'}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Real Cost Display (FIFO) */}
          {watchedValues.item_id && watchedValues.location_id && realUnitCost > 0 && (
            <div className="md:col-span-2 p-3 bg-muted rounded-md">
              <div className="text-sm text-muted-foreground">Costo unitario a registrar:</div>
              <div className="text-lg font-semibold text-primary">
                ${realUnitCost.toLocaleString('es-CL')}
              </div>
              {selectedSourceEntry && (
                <div className="text-xs text-muted-foreground mt-1">
                  Basado en origen seleccionado: {businessClock.format(selectedSourceEntry.movement_date, 'dd/MM/yyyy', { locale: es })}
                </div>
              )}
              {!selectedSourceEntry && (
                <div className="text-xs text-muted-foreground mt-1">
                  Basado en costo de catálogo (sin compras recientes)
                </div>
              )}
            </div>
          )}

          {watchedValues.item_id && watchedValues.location_id && recentEntries.length > 0 && (
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="source_entry_id">Origen para trazabilidad</Label>
              <Select
                value={watchedValues.source_entry_id}
                onValueChange={(value) => setValue('source_entry_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar entrada de origen" />
                </SelectTrigger>
                <SelectContent>
                  {recentEntries.map((entry) => {
                    const parts = [
                      businessClock.format(entry.movement_date, 'dd/MM/yyyy', { locale: es }),
                      entry.reference_document ? `Doc ${entry.reference_document}` : null,
                      entry.batch_number ? `Lote ${entry.batch_number}` : null,
                      `Costo $${Number(entry.unit_cost || 0).toLocaleString('es-CL')}`
                    ].filter(Boolean);

                    return (
                      <SelectItem key={entry.id} value={entry.id}>
                        {parts.join(' | ')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esta entrada se usa para copiar documento, lote y vínculo de factura a la salida.
              </p>
            </div>
          )}

          {watchedValues.item_id && watchedValues.location_id && recentEntries.length === 0 && (
            <div className="md:col-span-2">
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  No hay entradas activas recientes para copiar trazabilidad; la salida se registrará sin origen documental.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Cantidad */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={availableStock}
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !watchedValues.movement_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {watchedValues.movement_date ? (
                    format(watchedValues.movement_date, "PPP", { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={watchedValues.movement_date}
                  onSelect={(date) => date && setValue('movement_date', date)}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {!defaultCraneId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="destination_type">Destino *</Label>
                <Select
                  value={watchedValues.destination_type}
                  onValueChange={(value: any) => setValue('destination_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crane">Consumo en Grúa</SelectItem>
                    <SelectItem value="sale">Venta</SelectItem>
                    <SelectItem value="adjustment">Ajuste de Inventario</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {watchedValues.destination_type === 'crane' && (
                <div className="space-y-2">
                  <Label htmlFor="crane_id">Grúa *</Label>
                  <Select
                    value={watchedValues.crane_id}
                    onValueChange={(value) => setValue('crane_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar grúa" />
                    </SelectTrigger>
                    <SelectContent>
                      {cranes.filter(c => c.isActive).map((crane) => (
                        <SelectItem key={crane.id} value={crane.id}>
                          {crane.licensePlate} - {crane.brand} {crane.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        {/* Motivo */}
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo *</Label>
          <Input
            id="reason"
            {...register('reason')}
            placeholder="Describe el motivo de esta salida..."
          />
          {errors.reason && (
            <p className="text-sm text-destructive">{errors.reason.message}</p>
          )}
        </div>

        {/* Observaciones */}
        <div className="space-y-2">
          <Label htmlFor="observations">Observaciones</Label>
          <Textarea
            id="observations"
            {...register('observations')}
            rows={2}
            placeholder="Notas adicionales sobre esta salida..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || availableStock === 0}
          variant="destructive"
        >
          {isSubmitting ? 'Registrando...' : 'Registrar Salida'}
        </Button>
      </div>
    </form>
  );
};
