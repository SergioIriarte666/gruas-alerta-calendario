import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon, Package, Phone, User, Hash, DollarSign, FileText, Gauge, Database, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateCranePart, useUpdateCranePart, type CranePart, type CreateCranePartData } from '@/hooks/useCraneParts';
import { useUnifiedPartsPurchase, useCheckInventoryItem } from '@/hooks/useUnifiedParts';

interface PartsFormProps {
  isOpen: boolean;
  onClose: () => void;
  craneId: string;
  editingPart?: CranePart | null;
}

type FormData = Omit<CreateCranePartData, 'crane_id' | 'created_by'>;

export const PartsForm = ({ isOpen, onClose, craneId, editingPart }: PartsFormProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(editingPart ? new Date(editingPart.date) : new Date());
  const createMutation = useCreateCranePart();
  const updateMutation = useUpdateCranePart();
  const unifiedPurchaseMutation = useUnifiedPartsPurchase();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: editingPart ? {
      date: editingPart.date,
      supplier: editingPart.supplier,
      phone: editingPart.phone || '',
      part_name: editingPart.part_name,
      quantity: editingPart.quantity,
      unit_price: editingPart.unit_price,
      notes: editingPart.notes || '',
      kilometraje: (editingPart as any).kilometraje || undefined,
    } : {
      date: format(new Date(), 'yyyy-MM-dd'),
      supplier: '',
      phone: '',
      part_name: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
      kilometraje: undefined,
    }
  });

  const partName = watch('part_name') || '';
  const quantity = watch('quantity') || 0;
  const unitPrice = watch('unit_price') || 0;
  const totalValue = quantity * unitPrice;

  // Check if part exists in inventory
  const { data: inventoryItem } = useCheckInventoryItem(partName);

  const onSubmit = async (data: FormData) => {
    try {
      if (editingPart) {
        await updateMutation.mutateAsync({
          id: editingPart.id,
          ...data,
        });
      } else {
        await createMutation.mutateAsync({
          ...data,
          crane_id: craneId,
        });
      }
      handleClose();
    } catch (error) {
      // Error is handled by the mutation hooks
    }
  };

  const handleClose = () => {
    reset();
    setSelectedDate(new Date());
    onClose();
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setValue('date', format(date, 'yyyy-MM-dd'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-black border-tms-green/30 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-tms-green" />
            {editingPart ? 'Editar Pieza' : 'Agregar Nueva Pieza'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Fecha de Compra
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal border-tms-green/30 hover:bg-tms-green/10"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-black border-tms-green/30">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Kilometraje */}
          <div className="space-y-2">
            <Label htmlFor="kilometraje" className="text-white flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Kilometraje (Opcional)
            </Label>
            <Input
              id="kilometraje"
              type="number"
              min="0"
              {...register('kilometraje', { 
                valueAsNumber: true,
                min: { value: 0, message: 'El kilometraje debe ser mayor o igual a 0' }
              })}
              className="bg-white/5 border-tms-green/30 text-white"
              placeholder="Ej: 50000"
            />
            {errors.kilometraje && (
              <span className="text-red-400 text-sm">{(errors as any).kilometraje.message}</span>
            )}
          </div>

          {/* Supplier Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-white flex items-center gap-2">
                <User className="w-4 h-4" />
                Proveedor
              </Label>
              <Input
                id="supplier"
                {...register('supplier', { required: 'El proveedor es requerido' })}
                className="bg-white/5 border-tms-green/30 text-white"
                placeholder="Nombre del proveedor"
              />
              {errors.supplier && (
                <span className="text-red-400 text-sm">{errors.supplier.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Teléfono
              </Label>
              <Input
                id="phone"
                {...register('phone')}
                className="bg-white/5 border-tms-green/30 text-white"
                placeholder="Teléfono del proveedor"
              />
            </div>
          </div>

           {/* Part Information */}
          <div className="space-y-2">
            <Label htmlFor="part_name" className="text-white flex items-center gap-2">
              <Package className="w-4 h-4" />
              Nombre de la Pieza
            </Label>
            <Input
              id="part_name"
              {...register('part_name', { required: 'El nombre de la pieza es requerido' })}
              className="bg-white/5 border-tms-green/30 text-white"
              placeholder="Ej: Filtro de aceite, Pastillas de freno..."
            />
            {errors.part_name && (
              <span className="text-red-400 text-sm">{errors.part_name.message}</span>
            )}
            
            {/* Inventory Information */}
            {inventoryItem && partName.length > 2 && (
              <div className="bg-tms-green/10 border border-tms-green/30 rounded-md p-3 mt-2">
                <div className="flex items-center gap-2 text-tms-green font-medium mb-2">
                  <Database className="w-4 h-4" />
                  Pieza encontrada en inventario
                </div>
                <div className="space-y-1 text-sm text-white">
                  <div>Nombre: {inventoryItem.name}</div>
                  <div>Costo unitario registrado: ${inventoryItem.unit_cost?.toLocaleString('es-CL')}</div>
                  {inventoryItem.inventory_stock && inventoryItem.inventory_stock.length > 0 && (
                    <div>
                      Stock disponible: {inventoryItem.inventory_stock.reduce((total, stock) => total + stock.current_quantity, 0)} unidades
                      {inventoryItem.inventory_stock.map((stock, idx) => (
                        <div key={idx} className="text-xs text-gray-400 ml-2">
                          • {stock.location?.name}: {stock.current_quantity} unidades
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-yellow-400 text-xs mt-2">
                  <AlertCircle className="w-3 h-3" />
                  Al registrar esta pieza se creará automáticamente el movimiento de inventario
                </div>
              </div>
            )}
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-white flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Cantidad
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...register('quantity', { 
                  required: 'La cantidad es requerida',
                  min: { value: 1, message: 'Debe ser al menos 1' }
                })}
                className="bg-white/5 border-tms-green/30 text-white"
              />
              {errors.quantity && (
                <span className="text-red-400 text-sm">{errors.quantity.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price" className="text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Valor Unitario
              </Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                {...register('unit_price', { 
                  required: 'El valor unitario es requerido',
                  min: { value: 0.01, message: 'Debe ser mayor a 0' }
                })}
                className="bg-white/5 border-tms-green/30 text-white"
              />
              {errors.unit_price && (
                <span className="text-red-400 text-sm">{errors.unit_price.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Valor Total
              </Label>
              <div className="bg-tms-green/10 border border-tms-green/30 rounded-md px-3 py-2 text-tms-green font-semibold">
                ${totalValue.toLocaleString('es-CL')}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notas (Opcional)
            </Label>
            <Textarea
              id="notes"
              {...register('notes')}
              className="bg-white/5 border-tms-green/30 text-white"
              placeholder="Información adicional sobre la compra..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingPart ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};