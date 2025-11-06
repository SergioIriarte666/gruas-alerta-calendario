import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCostCategoryManager, CostCategory } from '@/hooks/useCostCategoryManager';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CostCategoryFormProps {
  category?: CostCategory | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CostCategoryForm = ({ category, onSuccess, onCancel }: CostCategoryFormProps) => {
  const { createCategory, updateCategory, isCreating, isUpdating } = useCostCategoryManager();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
    },
  });

  const onSubmit = (values: FormValues) => {
    if (category) {
      updateCategory({ id: category.id, name: values.name, description: values.description }, {
        onSuccess: () => {
          onSuccess();
          form.reset();
        },
      });
    } else {
      createCategory({ name: values.name, description: values.description }, {
        onSuccess: () => {
          onSuccess();
          form.reset();
        },
      });
    }
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
              <FormLabel>Nombre *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Seguros, Impuestos..." {...field} />
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
                  {...field}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
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
            {isSubmitting ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
