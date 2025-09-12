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
import { Switch } from '@/components/ui/switch';
import { X, Save, Loader2 } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { SupplierFormData, Supplier } from '@/types/suppliers';

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  rut: z.string().min(1, 'El RUT es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
  contact_name: z.string().min(1, 'El nombre de contacto es requerido'),
  category: z.string().min(1, 'La categoría es requerida'),
  notes: z.string().optional(),
  is_active: z.boolean()
});

type FormData = z.infer<typeof supplierSchema>;

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
  const { activeCategories, isLoading: categoriesLoading } = useSupplierCategoryManager();

  const form = useForm<FormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name || '',
      rut: supplier?.rut || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      contact_name: supplier?.contact_name || '',
      category: supplier?.category || (activeCategories?.[0]?.id || ''),
      notes: supplier?.notes || '',
      is_active: supplier?.is_active ?? true
    }
  });

  const onSubmit = (data: FormData) => {
    const supplierData: SupplierFormData = {
      name: data.name,
      rut: data.rut,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      contact_name: data.contact_name || '',
      category: data.category,
      notes: data.notes || '',
      is_active: data.is_active
    };
    
    if (supplier) {
      updateSupplier({ id: supplier.id, data: supplierData }, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    } else {
      createSupplier(supplierData, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    }
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 suppliers-scope">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-card border">
        <CardHeader className="flex flex-row items-center justify-between border-b border">
          <CardTitle className="text-foreground">
            {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Nombre *</Label>
                <Input
                  {...form.register('name')}
                  placeholder="Nombre del proveedor"
                />
                {form.formState.errors.name && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-foreground">RUT *</Label>
                <Input
                  {...form.register('rut')}
                  placeholder="12.345.678-9"
                />
                {form.formState.errors.rut && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.rut.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-foreground">Email</Label>
                <Input
                  {...form.register('email')}
                  type="email"
                  placeholder="email@ejemplo.com"
                />
                {form.formState.errors.email && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-foreground">Teléfono *</Label>
                <Input
                  {...form.register('phone')}
                  placeholder="+56 9 1234 5678"
                />
                {form.formState.errors.phone && (
                  <p className="text-destructive text-sm mt-1">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-foreground">Dirección *</Label>
              <Input
                {...form.register('address')}
                placeholder="Dirección completa"
              />
              {form.formState.errors.address && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground">Persona de Contacto *</Label>
              <Input
                {...form.register('contact_name')}
                placeholder="Nombre del contacto principal"
              />
              {form.formState.errors.contact_name && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.contact_name.message}
                </p>
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
                    activeCategories.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.id}
                      >
                        {category.label}
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
              <Label className="text-foreground">Notas</Label>
              <Textarea
                {...form.register('notes')}
                placeholder="Información adicional sobre el proveedor..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={form.watch('is_active')}
                onCheckedChange={(checked) => form.setValue('is_active', checked)}
              />
              <Label className="text-foreground">Activo</Label>
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
                variant="default"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {supplier ? 'Actualizando...' : 'Creando...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {supplier ? 'Actualizar' : 'Crear'}
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