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
import { useSuppliers, useSupplierCategories, getCategoryLabel } from '@/hooks/useSuppliers';
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
  const { createPayment, updatePayment, isCreating, isUpdating } = useSupplierPayments();
  const { suppliers } = useSuppliers();
  const { cranes } = useCranes();
  const categories = useSupplierCategories();

  const statusOptions: SupplierPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      supplier_id: payment?.supplier_id || preselectedSupplierId || '',
      amount: payment?.amount || 0,
      due_date: payment?.due_date ? payment.due_date.split('T')[0] : '',
      description: payment?.description || '',
      category: payment?.category || 'otros',
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
    // Lógica de detección automática: Si se llenan campos de piezas, cambiar subcategoría
    let processedData = { ...data };
    
    // Si es mantenimiento Y se llenaron campos de piezas, es una compra de piezas
    if (data.category === 'mantenimiento' && 
        data.part_name && 
        data.part_quantity && 
        data.part_unit_price && 
        data.crane_id) {
      // El backend detectará esto automáticamente por la subcategoría "Piezas y Repuestos"
      // que se genera en el trigger create_cost_from_supplier_payment()
    }
    
    if (payment) {
      updatePayment({ id: payment.id, data: processedData }, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    } else {
      createPayment(processedData, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    }
  };

  const isLoading = isCreating || isUpdating;
  
  // Detectar si es categoría mantenimiento para mostrar campos de piezas
  const isMaintenanceCategory = form.watch('category') === 'mantenimiento';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-white">
            {payment ? 'Editar Pago' : 'Nuevo Pago'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Supplier Selection */}
            <div className="space-y-2">
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
                      {supplier.name} - {supplier.rut}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.supplier_id && (
                <span className="text-red-400 text-sm">
                  {form.formState.errors.supplier_id.message}
                </span>
              )}
            </div>

            {/* Amount and Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-white flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Monto *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...form.register('amount', { valueAsNumber: true })}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="0.00"
                />
                {form.formState.errors.amount && (
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.amount.message}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date" className="text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de Vencimiento *
                </Label>
                <Input
                  id="due_date"
                  type="date"
                  {...form.register('due_date')}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                {form.formState.errors.due_date && (
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.due_date.message}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-white">
                Descripción *
              </Label>
              <Input
                id="description"
                {...form.register('description')}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Descripción del pago o servicio"
              />
              {form.formState.errors.description && (
                <span className="text-red-400 text-sm">
                  {form.formState.errors.description.message}
                </span>
              )}
            </div>

            {/* Category and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Categoría *</Label>
                <Select
                  value={form.watch('category')}
                  onValueChange={(value) => form.setValue('category', value as any)}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {categories.map((category) => (
                      <SelectItem 
                        key={category} 
                        value={category}
                        className="text-white hover:bg-gray-600"
                      >
                        {getCategoryLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.category.message}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-white">Estado *</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value as any)}
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
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.status.message}
                  </span>
                )}
              </div>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="reference_number" className="text-white">
                Número de Referencia
              </Label>
              <Input
                id="reference_number"
                {...form.register('reference_number')}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Número de factura, orden de compra, etc."
              />
            </div>

            {/* Detalles de Piezas - Solo para categoría Mantenimiento */}
            {isMaintenanceCategory && (
              <div className="space-y-4 p-4 border border-yellow-600/30 bg-yellow-900/10 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Wrench className="h-4 w-4" />
                  <span className="font-medium">Detalles de Piezas (Opcional)</span>
                  <Package className="h-4 w-4" />
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Si este pago es para compra de piezas, complete estos campos para registrar automáticamente en el sistema de piezas.
                </p>

                {/* Nombre de la pieza y Grúa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="part_name" className="text-white">
                      Nombre de la Pieza
                    </Label>
                    <Input
                      id="part_name"
                      {...form.register('part_name')}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Ej: Filtro de aceite, Pastillas de freno..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Grúa Destino</Label>
                    <Select
                      value={form.watch('crane_id')}
                      onValueChange={(value) => form.setValue('crane_id', value)}
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Seleccionar grúa" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600">
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

                {/* Cantidad y Precio unitario */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="part_quantity" className="text-white">
                      Cantidad
                    </Label>
                    <Input
                      id="part_quantity"
                      type="number"
                      step="1"
                      {...form.register('part_quantity', { valueAsNumber: true })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="part_unit_price" className="text-white">
                      Precio Unitario
                    </Label>
                    <Input
                      id="part_unit_price"
                      type="number"
                      step="0.01"
                      {...form.register('part_unit_price', { valueAsNumber: true })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Indicador automático */}
                {form.watch('part_name') && form.watch('part_quantity') && form.watch('part_unit_price') && form.watch('crane_id') && (
                  <div className="text-sm text-green-400 bg-green-900/20 p-2 rounded border border-green-600/30">
                    ✓ Este pago se registrará automáticamente como "Piezas y Repuestos" en el sistema de costos y piezas.
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-white">
                Notas
              </Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Notas adicionales sobre el pago"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="border-gray-600 text-gray-300 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {payment ? 'Actualizar' : 'Crear'} Pago
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};