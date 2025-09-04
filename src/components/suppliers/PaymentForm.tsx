import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Loader2, Calendar, DollarSign } from 'lucide-react';
import { useSupplierPayments, getStatusLabel } from '@/hooks/useSupplierPayments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { PaymentFormData, SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { useCranes } from '@/hooks/useCranes';
import { Wrench, Package } from 'lucide-react';

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
  crane_id: z.string().optional()
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
  const { activeCategories, isLoading: categoriesLoading } = useSupplierCategoryManager();

  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      supplier_id: payment?.supplier_id || preselectedSupplierId || '',
      amount: payment?.amount || 0,
      due_date: payment?.due_date ? payment.due_date.split('T')[0] : '',
      description: payment?.description || '',
      category: payment?.category || (activeCategories?.[0]?.id || ''),
      reference_number: payment?.reference_number || '',
      notes: payment?.notes || '',
      status: payment?.status || 'pending',
      // Valores por defecto para campos de piezas
      part_name: '',
      part_quantity: undefined,
      part_unit_price: undefined,
      crane_id: ''
    }
  });

  const onSubmit = (data: PaymentFormData) => {
    // Filtrar campos que no existen en la tabla supplier_payments
    const { part_name, part_quantity, part_unit_price, crane_id, ...paymentData } = data;
    
    if (payment) {
      updatePayment({ id: payment.id, data: paymentData }, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    } else {
      createPayment(paymentData, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    }
  };

  const isSubmitting = isCreating || isUpdating;
  const selectedCategory = form.watch('category');
  const isPiezasCategory = selectedCategory === 'mantenimiento' || 
    activeCategories.find(cat => cat.id === selectedCategory)?.name === 'mantenimiento';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between bg-gray-700">
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {payment ? 'Editar Pago a Proveedor' : 'Nuevo Pago a Proveedor'}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-white hover:bg-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6 bg-gray-800">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Información básica del pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Proveedor *</Label>
                <Select
                  value={form.watch('supplier_id')}
                  onValueChange={(value) => form.setValue('supplier_id', value)}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {suppliers.map((supplier) => (
                      <SelectItem 
                        key={supplier.id} 
                        value={supplier.id}
                        className="text-white hover:bg-gray-600"
                      >
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.supplier_id && (
                  <p className="text-red-400 text-sm mt-1">
                    {form.formState.errors.supplier_id.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-white">Monto *</Label>
                <Input
                  {...form.register('amount', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="bg-gray-700 border-gray-600 text-white"
                />
                {form.formState.errors.amount && (
                  <p className="text-red-400 text-sm mt-1">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de Vencimiento *
                </Label>
                <Input
                  {...form.register('due_date')}
                  type="date"
                  className="bg-gray-700 border-gray-600 text-white"
                />
                {form.formState.errors.due_date && (
                  <p className="text-red-400 text-sm mt-1">
                    {form.formState.errors.due_date.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-white">Estado *</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value as SupplierPaymentStatus)}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {statusOptions.map((status) => (
                      <SelectItem 
                        key={status} 
                        value={status}
                        className="text-white hover:bg-gray-600"
                      >
                        {getStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.status && (
                  <p className="text-red-400 text-sm mt-1">
                    {form.formState.errors.status.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-white">Categoría *</Label>
              <Select
                value={form.watch('category')}
                onValueChange={(value) => form.setValue('category', value)}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {categoriesLoading ? (
                    <SelectItem value="" disabled>Cargando categorías...</SelectItem>
                  ) : (
                    activeCategories.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.id}
                        className="text-white hover:bg-gray-600"
                      >
                        {category.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-red-400 text-sm mt-1">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-white">Descripción *</Label>
              <Input
                {...form.register('description')}
                placeholder="Descripción del pago o servicio"
                className="bg-gray-700 border-gray-600 text-white"
              />
              {form.formState.errors.description && (
                <p className="text-red-400 text-sm mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Número de Referencia</Label>
                <Input
                  {...form.register('reference_number')}
                  placeholder="Factura, OC, etc."
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Sección de Piezas y Repuestos - Solo para categoría mantenimiento */}
            {isPiezasCategory && (
              <div className="border-t border-gray-600 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Detalles de Piezas y Repuestos</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-white">Nombre de la Pieza</Label>
                    <Input
                      {...form.register('part_name')}
                      placeholder="ej: Filtro de aceite"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Cantidad</Label>
                    <Input
                      {...form.register('part_quantity', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      placeholder="1"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Precio Unitario</Label>
                    <Input
                      {...form.register('part_unit_price', { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Grúa Asociada
                    </Label>
                    <Select
                      value={form.watch('crane_id') || ''}
                      onValueChange={(value) => form.setValue('crane_id', value)}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Seleccionar grúa" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
                        <SelectItem value="">Sin grúa específica</SelectItem>
                        {cranes.map((crane) => (
                          <SelectItem 
                            key={crane.id} 
                            value={crane.id}
                            className="text-white hover:bg-gray-600"
                          >
                            {crane.licensePlate} - {crane.brand} {crane.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-white">Notas</Label>
              <Textarea
                {...form.register('notes')}
                placeholder="Información adicional sobre el pago..."
                className="bg-gray-700 border-gray-600 text-white"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
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
    </div>
  );
};