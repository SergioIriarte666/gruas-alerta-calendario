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
import { useSimilarItemsSearch } from '@/utils/inventoryHelper';
import { SimilarProductAlert } from './SimilarProductAlert';
import { ProductDetailsModal } from '@/components/inventory/ProductDetailsModal';
import type { SimilarItem } from '@/utils/inventoryHelper';
import { businessClock } from '@/utils/businessClock';

interface PartsFormProps {
  isOpen: boolean;
  onClose: () => void;
  craneId: string;
  editingPart?: CranePart | null;
}

type FormData = Omit<CreateCranePartData, 'crane_id' | 'created_by'>;

export const PartsForm = ({ isOpen, onClose, craneId, editingPart }: PartsFormProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(editingPart ? new Date(editingPart.date) : businessClock.now());
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<SimilarItem | null>(null);
  const [confirmCreateNew, setConfirmCreateNew] = useState(false);
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
      date: businessClock.today(),
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

  // Use similarity search instead of basic inventory check
  const { similarItems, shouldAlert, alertMessage, isLoading } = useSimilarItemsSearch(
    partName, 
    !editingPart && partName.length > 2 // Only check for new parts with meaningful names
  );

  const onSubmit = async (data: FormData) => {
    try {
      // If editing, proceed directly
      if (editingPart) {
        await updateMutation.mutateAsync({
          id: editingPart.id,
          ...data,
        });
        handleClose();
        return;
      }

      // For new parts, check if we should alert about similarities
      if (shouldAlert && !confirmCreateNew) {
        // Don't submit yet, let user decide via SimilarProductAlert
        return;
      }

      // Create new part
      await createMutation.mutateAsync({
        ...data,
        crane_id: craneId,
      });
      handleClose();
    } catch (error) {
      // Error is handled by the mutation hooks
    }
  };

  const handleClose = () => {
    reset();
    setSelectedDate(businessClock.now());
    setConfirmCreateNew(false);
    setShowDetailsModal(false);
    setSelectedProductForDetails(null);
    onClose();
  };

  const handleUseExisting = (item: SimilarItem) => {
    // Fill form with existing item data
    setValue('part_name', item.name);
    setValue('unit_price', item.unit_cost);
    // Note: We don't auto-submit here, let user review and submit manually
  };

  const handleCreateNew = () => {
    setConfirmCreateNew(true);
    // Trigger form submission by calling handleSubmit programmatically
    handleSubmit(onSubmit)();
  };

  const handleViewDetails = (item: SimilarItem) => {
    setSelectedProductForDetails(item);
    setShowDetailsModal(true);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setValue('date', format(date, 'yyyy-MM-dd'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl border-border bg-background">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Package className="size-5 text-primary" />
            {editingPart ? 'Editar Pieza' : 'Agregar Nueva Pieza'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-foreground flex items-center gap-2">
              <CalendarIcon className="size-4" />
              Fecha de Compra
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border">
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
            <Label htmlFor="kilometraje" className="text-foreground flex items-center gap-2">
              <Gauge className="size-4" />
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
              className="bg-background border-border text-foreground"
              placeholder="Ej: 50000"
            />
            {errors.kilometraje && (
              <span className="text-destructive text-sm">{(errors as any).kilometraje.message}</span>
            )}
          </div>

          {/* Supplier Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-foreground flex items-center gap-2">
                <User className="size-4" />
                Proveedor
              </Label>
              <Input
                id="supplier"
                {...register('supplier', { required: 'El proveedor es requerido' })}
                className="bg-background border-border text-foreground"
                placeholder="Nombre del proveedor"
              />
              {errors.supplier && (
                <span className="text-destructive text-sm">{errors.supplier.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
                <Phone className="size-4" />
                Teléfono del proveedor
              </Label>
              <Input
                id="phone"
                {...register('phone')}
                className="bg-background border-border text-foreground"
                placeholder="Teléfono del proveedor"
              />
            </div>
          </div>

           {/* Part Information */}
           <div className="space-y-2">
            <Label htmlFor="part_name" className="text-foreground flex items-center gap-2">
              <Package className="size-4" />
              Nombre de la Pieza
            </Label>
            <Input
              id="part_name"
              {...register('part_name', { required: 'El nombre de la pieza es requerido' })}
              className="bg-background border-border text-foreground"
              placeholder="Ej: Filtro de aceite, Pastillas de freno..."
            />
            {errors.part_name && (
              <span className="text-destructive text-sm">{errors.part_name.message}</span>
            )}
            
            {/* Similarity Alert - only for new parts */}
            {!editingPart && shouldAlert && (
              <div className="mt-2">
                <SimilarProductAlert
                  similarityResult={{
                    shouldAlert,
                    exactMatch: similarItems.find(item => item.match_type === 'exact') || null,
                    similarItems,
                    alertMessage
                  }}
                  onUseExisting={handleUseExisting}
                  onCreateNew={handleCreateNew}
                  onViewDetails={handleViewDetails}
                />
              </div>
            )}
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-foreground flex items-center gap-2">
                <Hash className="size-4" />
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
                className="bg-background border-border text-foreground"
              />
              {errors.quantity && (
                <span className="text-destructive text-sm">{errors.quantity.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price" className="text-foreground flex items-center gap-2">
                <DollarSign className="size-4" />
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
                className="bg-background border-border text-foreground"
              />
              {errors.unit_price && (
                <span className="text-destructive text-sm">{errors.unit_price.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground flex items-center gap-2">
                <DollarSign className="size-4" />
                Valor Total
              </Label>
              <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-primary font-semibold">
                ${totalValue.toLocaleString('es-CL')}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-foreground flex items-center gap-2">
              <FileText className="size-4" />
              Notas (Opcional)
            </Label>
            <Textarea
              id="notes"
              {...register('notes')}
              className="bg-background border-border text-foreground"
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
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingPart ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </form>

        {/* Product Details Modal */}
        <ProductDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          product={selectedProductForDetails}
        />
      </DialogContent>
    </Dialog>
  );
};