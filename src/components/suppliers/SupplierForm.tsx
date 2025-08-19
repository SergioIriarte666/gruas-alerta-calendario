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
import { Checkbox } from '@/components/ui/checkbox';
import { X, Save, Loader2 } from 'lucide-react';
import { useSuppliers, useSupplierCategories, getCategoryLabel } from '@/hooks/useSuppliers';
import { SupplierFormData, Supplier } from '@/types/suppliers';

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  rut: z.string().min(1, 'El RUT es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  category: z.string().min(1, 'La categoría es requerida'),
  notes: z.string().optional(),
  is_active: z.boolean()
});

interface SupplierFormProps {
  supplier?: Supplier;
  onClose: () => void;
  onSave?: () => void;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({ 
  supplier, 
  onClose, 
  onSave 
}) => {
  const { createSupplier, updateSupplier, isCreating, isUpdating } = useSuppliers();
  const categories = useSupplierCategories();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name || '',
      rut: supplier?.rut || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      contact_name: supplier?.contact_name || '',
      category: supplier?.category || 'otros',
      notes: supplier?.notes || '',
      is_active: supplier?.is_active ?? true
    }
  });

  const onSubmit = (data: SupplierFormData) => {
    if (supplier) {
      updateSupplier({ id: supplier.id, data }, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    } else {
      createSupplier(data, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-white">
            {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
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
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">
                  Nombre *
                </Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="Nombre del proveedor"
                />
                {form.formState.errors.name && (
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.name.message}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rut" className="text-white">
                  RUT *
                </Label>
                <Input
                  id="rut"
                  {...form.register('rut')}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="12.345.678-9"
                />
                {form.formState.errors.rut && (
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.rut.message}
                  </span>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="correo@proveedor.com"
                />
                {form.formState.errors.email && (
                  <span className="text-red-400 text-sm">
                    {form.formState.errors.email.message}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  className="bg-gray-700 border-gray-600 text-white"
                  placeholder="+56 9 1234 5678"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name" className="text-white">
                Nombre de Contacto
              </Label>
              <Input
                id="contact_name"
                {...form.register('contact_name')}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Persona de contacto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-white">
                Dirección
              </Label>
              <Textarea
                id="address"
                {...form.register('address')}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Dirección completa"
                rows={2}
              />
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
                <Label className="text-white">Estado</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="is_active"
                    checked={form.watch('is_active')}
                    onCheckedChange={(checked) => form.setValue('is_active', !!checked)}
                    className="border-gray-600"
                  />
                  <Label htmlFor="is_active" className="text-white text-sm">
                    Proveedor activo
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-white">
                Notas
              </Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Notas adicionales sobre el proveedor"
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
                {supplier ? 'Actualizar' : 'Crear'} Proveedor
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};