import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateInventoryMovement, useInventoryLocations, useInventorySuppliers, type InventoryItem } from '@/hooks/useInventory';
import { toast } from 'sonner';
import DatePickerInput from '@/components/common/DatePickerInput';
import { SupplierCombobox } from '@/components/costs/form/SupplierSelector';

import { toLocalDateString, getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PurchaseModal");
const purchaseSchema = z.object({
  quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  unit_cost: z.number().min(0.01, 'El costo unitario debe ser mayor a 0'),
  supplier_id: z.string().optional(),
  supplier_name: z.string().optional(),
  location_id: z.string().min(1, 'Debe seleccionar una ubicación'),
  batch_number: z.string().optional(),
  expiration_date: z.string().optional(),
  reference_document: z.string().optional(),
  observations: z.string().optional(),
  movement_date: z.string().min(1, 'La fecha es requerida'),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSuccess?: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess
}) => {
  const { data: locations = [] } = useInventoryLocations();
  const { data: suppliers = [] } = useInventorySuppliers();
  const createMovement = useCreateInventoryMovement();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset
  } = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      quantity: 1,
      unit_cost: item?.unit_cost || 0,
      movement_date: getTodayLocal(),
    }
  });

  const watchedValues = watch();
  const totalCost = (watchedValues.quantity || 0) * (watchedValues.unit_cost || 0);

  const onSubmit = async (data: PurchaseFormData) => {
    if (!item) {
      toast.error('No hay producto seleccionado');
      return;
    }

    try {
      const movementDate = new Date(data.movement_date).toISOString();
      
      await createMovement.mutateAsync({
        item_id: item.id,
        location_id: data.location_id,
        movement_type: 'entry',
        quantity: data.quantity,
        unit_cost: data.unit_cost,
        total_cost: totalCost,
        supplier_id: data.supplier_id || undefined,
        supplier_name: data.supplier_name || undefined,
        batch_number: data.batch_number || undefined,
        expiration_date: data.expiration_date ? toLocalDateString(new Date(data.expiration_date)) : undefined,
        reference_document: data.reference_document || undefined,
        observations: data.observations || undefined,
        movement_date: movementDate,
        reason: 'Compra de inventario',
        generateCost: true, // Enable automatic cost generation
      });

      toast.success(`Compra registrada: ${data.quantity} unidades de ${item.name}`);
      reset();
      onClose();
      onSuccess?.();
    } catch (error) {
      logger.error('Error registering purchase:', error);
      toast.error('Error al registrar la compra');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Compra de Inventario</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Producto: <span className="font-medium">{item.name}</span>
            {item.sku && <span className="ml-2">SKU: {item.sku}</span>}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Cantidad *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                {...register('quantity', { valueAsNumber: true })}
                placeholder="Cantidad a comprar"
              />
              {errors.quantity && (
                <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="unit_cost">Costo Unitario *</Label>
              <Input
                id="unit_cost"
                type="number"
                min="0.01"
                step="0.01"
                {...register('unit_cost', { valueAsNumber: true })}
                placeholder="Costo por unidad"
              />
              {errors.unit_cost && (
                <p className="text-sm text-destructive mt-1">{errors.unit_cost.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="movement_date">Fecha de Compra *</Label>
              <DatePickerInput
                id="movement_date"
                value={watch('movement_date') || ''}
                onChange={(value) => setValue('movement_date', value)}
                placeholder="Seleccionar fecha"
              />
              {errors.movement_date && (
                <p className="text-sm text-destructive mt-1">{errors.movement_date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="location_id">Ubicación *</Label>
              <Select onValueChange={(value) => setValue('location_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location_id && (
                <p className="text-sm text-destructive mt-1">{errors.location_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier_id">Proveedor</Label>
              <SupplierCombobox
                value={watchedValues.supplier_id ?? null}
                onValueChange={(value) => {
                  setValue('supplier_id', value ?? undefined);
                  if (!value) return;
                  const supplier = suppliers.find(s => s.id === value);
                  if (supplier) setValue('supplier_name', supplier.name);
                }}
                placeholder="Seleccionar proveedor"
                noneLabel="Sin proveedor"
                allowCreate
              />
            </div>

            <div>
              <Label htmlFor="supplier_name">Nombre Proveedor (Manual)</Label>
              <Input
                id="supplier_name"
                {...register('supplier_name')}
                placeholder="Nombre del proveedor"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batch_number">Número de Lote</Label>
              <Input
                id="batch_number"
                {...register('batch_number')}
                placeholder="Lote o serie"
              />
            </div>

            <div>
              <Label htmlFor="expiration_date">Fecha de Vencimiento</Label>
              <DatePickerInput
                id="expiration_date"
                value={watch('expiration_date') || ''}
                onChange={(value) => setValue('expiration_date', value)}
                placeholder="Seleccionar fecha"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reference_document">Documento de Referencia</Label>
            <Input
              id="reference_document"
              {...register('reference_document')}
              placeholder="Factura, OC, etc."
            />
          </div>

          <div>
            <Label htmlFor="observations">Observaciones</Label>
            <Textarea
              id="observations"
              {...register('observations')}
              placeholder="Observaciones adicionales"
              rows={3}
            />
          </div>

          {/* Resumen de la compra */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Resumen de la Compra</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Cantidad: <span className="font-medium">{watchedValues.quantity || 0} unidades</span></div>
              <div>Costo unitario: <span className="font-medium">${(watchedValues.unit_cost || 0).toLocaleString()}</span></div>
              <div className="col-span-2 border-t pt-2 mt-2">
                <strong>Total: ${totalCost.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar Compra'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
