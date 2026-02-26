import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { X, Save, Loader2, Calendar, DollarSign, AlertTriangle, Wrench, Package } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useSupplierPayments, getStatusLabel, getStatusColor } from '@/hooks/useSupplierPayments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { usePaymentDuplicateCheck, DuplicatePayment } from '@/hooks/usePaymentDuplicateCheck';
import { useCostCategories } from '@/hooks/useCostCategories';
import { PaymentFormData, SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { useCranes } from '@/hooks/useCranes';
import { formatCurrency } from '@/lib/utils';
import { parseFromDatabase, formatForDisplay } from '@/utils/timezoneUtils';
import { Badge } from '@/components/ui/badge';

const paymentSchema = z.object({
  supplier_id: z.string().min(1, 'El proveedor es requerido'),
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  due_date: z.string().min(1, 'La fecha de vencimiento es requerida'),
  description: z.string().min(1, 'La descripción es requerida'),
  category: z.string().min(1, 'La categoría es requerida'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().min(1, 'El estado es requerido'),
  // Campos opcionales para piezas
  part_name: z.string().optional(),
  part_quantity: z.number().positive().optional(),
  part_unit_price: z.number().positive().optional(),
  crane_id: z.string().optional(),
  // Nuevo: checkbox para sincronización
  add_to_inventory: z.boolean().optional(),
  // Fecha de pago
  paid_date: z.string().optional(),
  paid_amount: z.number().optional()
});

interface PaymentFormProps {
  payment?: SupplierPayment;
  onClose: () => void;
  onSave?: () => void;
  preselectedSupplierId?: string;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ 
  payment, 
  onClose, 
  onSave,
  preselectedSupplierId 
}) => {
  const { createPayment, updatePayment, markPaymentAsPaid, isCreating, isUpdating } = useSupplierPayments();
  const { suppliers } = useSuppliers();
  const { cranes } = useCranes();
  const { data: costCategories = [], isLoading: categoriesLoading } = useCostCategories();
  const { checkDuplicate } = usePaymentDuplicateCheck();
  
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicatePayment, setDuplicatePayment] = useState<DuplicatePayment | null>(null);
  const [pendingFormData, setPendingFormData] = useState<PaymentFormData | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      supplier_id: payment?.supplier_id || preselectedSupplierId || '',
      amount: payment?.amount || 0,
      due_date: payment?.due_date ? payment.due_date.split('T')[0] : '',
      description: payment?.description || '',
      category: payment?.category || (costCategories?.[0]?.id || ''),
      reference_number: payment?.reference_number || '',
      notes: payment?.notes || '',
      status: payment?.status || 'pending' as SupplierPaymentStatus,
      // Cargar valores de piezas si existen
      part_name: payment?.part_name || '',
      part_quantity: payment?.part_quantity || undefined,
      part_unit_price: payment?.part_unit_price || undefined,
      crane_id: payment?.crane_id || '',
      add_to_inventory: payment?.add_to_inventory || false,
      paid_date: payment?.paid_date ? payment.paid_date.split('T')[0] : new Date().toISOString().split('T')[0]
    }
  });

  const handleSubmit = async (data: PaymentFormData) => {
    // Only check for duplicates if reference_number is provided and creating a new payment
    if (!payment && data.reference_number && data.supplier_id) {
      setIsCheckingDuplicate(true);
      try {
        const existingPayment = await checkDuplicate(data.reference_number, data.supplier_id);
        if (existingPayment) {
          setDuplicatePayment(existingPayment);
          setPendingFormData(data);
          setShowDuplicateWarning(true);
          setIsCheckingDuplicate(false);
          return;
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
      }
      setIsCheckingDuplicate(false);
    }
    
    // Proceed with save
    savePayment(data);
  };

  const savePayment = (data: PaymentFormData) => {
    if (payment) {
      updatePayment({ id: payment.id, data }, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    } else {
      createPayment(data, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    }
  };

  const handleConfirmDuplicate = () => {
    if (pendingFormData) {
      savePayment(pendingFormData);
    }
    setShowDuplicateWarning(false);
    setPendingFormData(null);
    setDuplicatePayment(null);
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateWarning(false);
    setPendingFormData(null);
    setDuplicatePayment(null);
  };

  const getSupplierNameById = (id: string) => {
    return suppliers.find(s => s.id === id)?.name || 'Proveedor desconocido';
  };

  const isSubmitting = isCreating || isUpdating || isCheckingDuplicate;
  const watchedStatus = form.watch('status');
  const selectedCategory = form.watch('category');
  // Solo mostrar detalles de piezas para categoría "Mantenimiento"
  const selectedCategoryData = costCategories.find(cat => cat.id === selectedCategory);
  const isPiezasCategory = selectedCategoryData ? 
    selectedCategoryData.name?.toLowerCase().includes('mantenimiento') : 
    false;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 suppliers-scope">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-card border">
        <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-violet-600 to-violet-500 text-white -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {payment ? 'Editar Pago a Proveedor' : 'Nuevo Pago a Proveedor'}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Información básica del pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Proveedor *</Label>
                <Select
                  value={form.watch('supplier_id')}
                  onValueChange={(value) => form.setValue('supplier_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem 
                        key={supplier.id} 
                        value={supplier.id}
                      >
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.supplier_id && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.supplier_id.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-foreground">Monto *</Label>
                <Input
                  {...form.register('amount', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
                {form.formState.errors.amount && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de Vencimiento *
                </Label>
                <DatePickerInput
                  value={form.watch('due_date') || ''}
                  onChange={(value) => form.setValue('due_date', value)}
                  placeholder="Seleccionar fecha"
                />
                {form.formState.errors.due_date && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.due_date.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-foreground">Estado *</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value as SupplierPaymentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem 
                        key={status} 
                        value={status}
                      >
                        {getStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.status && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.status.message}
                  </p>
                )}
              </div>

              {/* Fecha de Pago - visible cuando estado es Pagado */}
              {watchedStatus === 'paid' && (
                <div>
                  <Label className="text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha de Pago
                  </Label>
                  <DatePickerInput
                    value={form.watch('paid_date') || new Date().toISOString().split('T')[0]}
                    onChange={(value) => form.setValue('paid_date', value)}
                    placeholder="Seleccionar fecha de pago"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-foreground">Categoría *</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(value) => form.setValue('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <SelectItem value="loading" disabled>Cargando categorías...</SelectItem>
                  ) : (
                    costCategories.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.id}
                      >
                        {category.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground">Descripción *</Label>
              <Input
                {...form.register('description')}
                placeholder="Descripción del pago o servicio"
              />
              {form.formState.errors.description && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Número de Referencia</Label>
                <Input
                  {...form.register('reference_number')}
                  placeholder="Factura, OC, etc."
                />
              </div>
            </div>

            {/* Sección de Piezas y Repuestos - Solo para categoría mantenimiento */}
            {isPiezasCategory && (
              <div className="border-t border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Detalles de Piezas y Repuestos</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-foreground">Nombre de la Pieza</Label>
                    <Input
                      {...form.register('part_name')}
                      placeholder="ej: Filtro de aceite"
                    />
                  </div>

                  <div>
                    <Label className="text-foreground">Cantidad</Label>
                    <Input
                      {...form.register('part_quantity', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <Label className="text-foreground">Precio Unitario</Label>
                    <Input
                      {...form.register('part_unit_price', { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label className="text-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Grúa Asociada
                    </Label>
                    <Select
                      value={form.watch('crane_id') || ''}
                      onValueChange={(value) => form.setValue('crane_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar grúa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin grúa específica</SelectItem>
                        {cranes.map((crane) => (
                          <SelectItem 
                            key={crane.id} 
                            value={crane.id}
                          >
                            {crane.licensePlate} - {crane.brand} {crane.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Nuevo: Checkbox para agregar a inventario */}
                <div className="flex items-center space-x-2 mt-4 p-3 bg-muted/50 rounded-lg border border-primary/20">
                  <Checkbox
                    id="add_to_inventory"
                    checked={!!form.watch('add_to_inventory')}
                    onCheckedChange={(checked: boolean) => form.setValue('add_to_inventory', checked)}
                  />
                  <Label htmlFor="add_to_inventory" className="flex items-center gap-2 cursor-pointer">
                    <Package className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="font-medium">Agregar automáticamente a inventario (Bodega)</span>
                      <span className="text-xs text-muted-foreground">
                        ✅ El producto se registrará en Costos + Bodega automáticamente
                      </span>
                    </div>
                  </Label>
                </div>
              </div>
            )}

            <div>
              <Label className="text-foreground">Notas</Label>
              <Textarea
                {...form.register('notes')}
                placeholder="Información adicional sobre el pago..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {payment ? 'Actualizando...' : 'Creando...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {payment ? 'Actualizar' : 'Crear'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pago Duplicado Detectado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Ya existe un pago con la referencia <strong className="text-foreground">{pendingFormData?.reference_number}</strong> para este proveedor.
                </p>
                
                {duplicatePayment && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2">
                    <div className="text-sm font-medium text-foreground">Pago existente:</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Monto:</span>
                        <span className="font-medium text-foreground">{formatCurrency(duplicatePayment.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vencimiento:</span>
                        <span>{formatForDisplay(parseFromDatabase(duplicatePayment.due_date))}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Estado:</span>
                        <Badge className={`${getStatusColor(duplicatePayment.status)} text-black text-xs`}>
                          {getStatusLabel(duplicatePayment.status)}
                        </Badge>
                      </div>
                      <div className="text-xs pt-1 border-t border-border mt-2">
                        {duplicatePayment.description}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  ¿Desea crear este pago de todas formas?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDuplicate}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDuplicate}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              Crear de Todas Formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};