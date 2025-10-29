import React, { useState } from 'react';
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
import { useInventoryItems, useInventoryLocations, useCreateInventoryMovement, useCreateInventoryItem, useInventoryCategories } from '@/hooks/useInventory';
import { SupplierSelector } from '@/components/costs/form/SupplierSelector';
import { CalendarIcon, Package, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';

const entrySchema = z.object({
  item_id: z.string().min(1, 'Selecciona un producto'),
  location_id: z.string().min(1, 'Selecciona una ubicación'),
  quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  unit_cost: z.number().min(0, 'El costo debe ser mayor o igual a 0'),
  movement_date: z.date(),
  supplier_id: z.string().optional(),
  reference_document: z.string().optional(),
  batch_number: z.string().optional(),
  observations: z.string().optional(),
});

type EntryFormData = z.infer<typeof entrySchema>;

interface SimpleEntryFormProps {
  onSuccess?: () => void;
}

export const SimpleEntryForm: React.FC<SimpleEntryFormProps> = ({ onSuccess }) => {
  const { data: items = [] } = useInventoryItems();
  const { data: locations = [] } = useInventoryLocations();
  const { data: categories = [] } = useInventoryCategories();
  const createMovement = useCreateInventoryMovement();
  const createItem = useCreateInventoryItem();
  
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '',
    unit_of_measure: 'unidad',
    category_id: '',
    unit_cost: 0,
    sku: '',
  });

  const form = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      movement_date: new Date(),
      quantity: 1,
      unit_cost: 0,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form;

  const watchedValues = watch();
  const selectedItem = items.find(item => item.id === watchedValues.item_id);

  const handleCreateNewProduct = async () => {
    if (!newProductData.name.trim()) {
      toast.error('El nombre del producto es requerido');
      return;
    }

    try {
      const result = await createItem.mutateAsync({
        name: newProductData.name.trim(),
        unit_of_measure: newProductData.unit_of_measure,
        category_id: newProductData.category_id || null,
        unit_cost: newProductData.unit_cost,
        sku: newProductData.sku.trim() || null,
        description: null,
        barcode: null,
        minimum_stock: 0,
        maximum_stock: 0,
        safety_stock: 0,
        is_critical: false,
        has_expiration: false,
        is_active: true,
      });

      // Select the newly created product
      setValue('item_id', result.id);
      setValue('unit_cost', result.unit_cost || 0);
      
      // Reset form
      setNewProductData({
        name: '',
        unit_of_measure: 'unidad',
        category_id: '',
        unit_cost: 0,
        sku: '',
      });
      setShowNewProductForm(false);
      
      toast.success('Producto creado exitosamente');
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Error al crear el producto');
    }
  };

  const onSubmit = async (data: EntryFormData) => {
    try {
      const totalCost = data.quantity * data.unit_cost;

      await createMovement.mutateAsync({
        item_id: data.item_id,
        location_id: data.location_id,
        movement_type: 'entry',
        quantity: data.quantity,
        unit_cost: data.unit_cost,
        total_cost: totalCost,
        movement_date: data.movement_date.toISOString(),
        supplier_id: data.supplier_id || null,
        reference_document: data.reference_document || null,
        batch_number: data.batch_number || null,
        observations: data.observations || null,
      });

      toast.success('Entrada registrada exitosamente');
      onSuccess?.();
    } catch (error) {
      console.error('Error creating entry:', error);
      toast.error('Error al registrar la entrada');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información Básica */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Información de Entrada</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Producto */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="item_id">Producto *</Label>
              {!showNewProductForm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewProductForm(true)}
                  className="h-auto py-1 px-2 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Crear nuevo producto
                </Button>
              )}
            </div>
            
            {!showNewProductForm ? (
              <>
                <Select
                  value={watchedValues.item_id}
                  onValueChange={(value) => {
                    setValue('item_id', value);
                    const item = items.find(i => i.id === value);
                    if (item && item.unit_cost) {
                      setValue('unit_cost', item.unit_cost);
                    }
                  }}
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
              </>
            ) : (
              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Crear Nuevo Producto</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewProductForm(false);
                        setNewProductData({
                          name: '',
                          unit_of_measure: 'unidad',
                          category_id: '',
                          unit_cost: 0,
                          sku: '',
                        });
                      }}
                      className="h-auto p-1"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre del Producto *</Label>
                      <Input
                        value={newProductData.name}
                        onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                        placeholder="Ej: Aceite Hidráulico"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">SKU (Código)</Label>
                      <Input
                        value={newProductData.sku}
                        onChange={(e) => setNewProductData({ ...newProductData, sku: e.target.value })}
                        placeholder="Ej: ACE-001"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Unidad de Medida *</Label>
                      <Select
                        value={newProductData.unit_of_measure}
                        onValueChange={(value) => setNewProductData({ ...newProductData, unit_of_measure: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unidad">Unidad</SelectItem>
                          <SelectItem value="litro">Litro</SelectItem>
                          <SelectItem value="kilogramo">Kilogramo</SelectItem>
                          <SelectItem value="metro">Metro</SelectItem>
                          <SelectItem value="caja">Caja</SelectItem>
                          <SelectItem value="paquete">Paquete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Categoría</Label>
                      <Select
                        value={newProductData.category_id}
                        onValueChange={(value) => setNewProductData({ ...newProductData, category_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.filter(c => c.is_active).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Costo Unitario ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newProductData.unit_cost}
                        onChange={(e) => setNewProductData({ ...newProductData, unit_cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    onClick={handleCreateNewProduct}
                    disabled={createItem.isPending || !newProductData.name.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {createItem.isPending ? 'Creando...' : 'Crear y Seleccionar Producto'}
                  </Button>
                </div>
              </Card>
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
                {locations.filter(loc => loc.is_active).map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.location_id && (
              <p className="text-sm text-destructive">{errors.location_id.message}</p>
            )}
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              {...register('quantity', { valueAsNumber: true })}
            />
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                Unidad: {selectedItem.unit_of_measure}
              </p>
            )}
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Costo Unitario */}
          <div className="space-y-2">
            <Label htmlFor="unit_cost">Costo Unitario ($) *</Label>
            <Input
              id="unit_cost"
              type="number"
              min="0"
              step="0.01"
              {...register('unit_cost', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              💡 Este costo se usará automáticamente en los próximos consumos (FIFO)
            </p>
            {errors.unit_cost && (
              <p className="text-sm text-destructive">{errors.unit_cost.message}</p>
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
                  <CalendarIcon className="mr-2 h-4 w-4" />
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

          {/* Total */}
          <div className="space-y-2">
            <Label>Total</Label>
            <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
              <span className="font-semibold text-purple-600">
                ${((watchedValues.quantity || 0) * (watchedValues.unit_cost || 0)).toLocaleString('es-CL')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Información Adicional (Colapsable) */}
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          + Información adicional (opcional)
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {/* Proveedor */}
          <SupplierSelector form={form} />

          {/* Documento de Referencia */}
          <div className="space-y-2">
            <Label htmlFor="reference_document">Documento de Referencia</Label>
            <Input
              id="reference_document"
              {...register('reference_document')}
              placeholder="Ej: FAC-12345"
            />
          </div>

          {/* Número de Lote */}
          <div className="space-y-2">
            <Label htmlFor="batch_number">Número de Lote</Label>
            <Input
              id="batch_number"
              {...register('batch_number')}
              placeholder="Ej: LOTE-2025-001"
            />
          </div>
        </div>

        {/* Observaciones */}
        <div className="space-y-2">
          <Label htmlFor="observations">Observaciones</Label>
          <Textarea
            id="observations"
            {...register('observations')}
            rows={2}
            placeholder="Notas adicionales sobre esta entrada..."
          />
        </div>
      </details>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : 'Registrar Entrada'}
        </Button>
      </div>
    </form>
  );
};
