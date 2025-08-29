import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useSupplierCategoryManager, SupplierCategory, SupplierCategoryFormData } from '@/hooks/useSupplierCategoryManager';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(50, 'Máximo 50 caracteres'),
  label: z.string().min(1, 'La etiqueta es obligatoria').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(200, 'Máximo 200 caracteres').optional(),
  is_active: z.boolean().default(true),
});

interface SupplierCategoryFormProps {
  category?: SupplierCategory | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SupplierCategoryForm = ({ 
  category, 
  onSuccess, 
  onCancel 
}: SupplierCategoryFormProps) => {
  const { createCategory, updateCategory, isCreating, isUpdating } = useSupplierCategoryManager();

  const form = useForm<SupplierCategoryFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name || '',
      label: category?.label || '',
      description: category?.description || '',
      is_active: category?.is_active ?? true,
    },
  });

  const onSubmit = (data: SupplierCategoryFormData) => {
    if (category) {
      updateCategory({ ...data, id: category.id });
    } else {
      createCategory(data);
    }
    onSuccess();
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de Categoría *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="ej: combustible" 
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Etiqueta Visible *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="ej: Combustible" 
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descripción opcional de la categoría"
                  rows={3}
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Estado Activo</FormLabel>
                <div className="text-sm text-muted-foreground">
                  {field.value 
                    ? 'La categoría estará disponible para usar' 
                    : 'La categoría estará oculta'
                  }
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (category ? 'Actualizar' : 'Crear')}
          </Button>
        </div>
      </form>
    </Form>
  );
};