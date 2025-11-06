import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IncomeCategory, useIncomeCategoryManager } from '@/hooks/useIncomeCategoryManager';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface IncomeCategoryFormProps {
  category?: IncomeCategory;
  onSuccess: () => void;
  onCancel: () => void;
}

export const IncomeCategoryForm = ({ category, onSuccess, onCancel }: IncomeCategoryFormProps) => {
  const { createCategory, updateCategory, isCreating, isUpdating } = useIncomeCategoryManager();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
    },
  });

  const onSubmit = (values: FormValues) => {
    const formData = {
      name: values.name,
      description: values.description || undefined,
    };
    
    if (category) {
      updateCategory(
        { id: category.id, ...formData },
        { onSuccess }
      );
    } else {
      createCategory(formData, { onSuccess });
    }
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          {...form.register('name')}
          placeholder="Ej: Servicios Facturados"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          {...form.register('description')}
          placeholder="Descripción opcional de la categoría"
          rows={3}
        />
      </div>

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
          {isSubmitting ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
};
