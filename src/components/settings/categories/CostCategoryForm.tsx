import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCostCategoryManager } from '@/hooks/useCostCategoryManager';
import { CostCategory } from '@/types/costs';
import { useCostCenters } from '@/hooks/useCostCenters';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  default_cost_center_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CostCategoryFormProps {
  category?: CostCategory | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CostCategoryForm = ({ category, onSuccess, onCancel }: CostCategoryFormProps) => {
  const { createCategory, updateCategory, isCreating, isUpdating } = useCostCategoryManager();
  const { data: costCenters = [] } = useCostCenters();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
      default_cost_center_id: category?.default_cost_center_id || 'none',
    },
  });

  const onSubmit = (values: FormValues) => {
    const defaultCostCenterId = values.default_cost_center_id === 'none' ? null : (values.default_cost_center_id || null);
    if (category) {
      updateCategory({ id: category.id, name: values.name, description: values.description, default_cost_center_id: defaultCostCenterId }, {
        onSuccess: () => {
          onSuccess();
          form.reset();
        },
      });
    } else {
      createCategory({ name: values.name, description: values.description, default_cost_center_id: defaultCostCenterId }, {
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

        <FormField
          control={form.control}
          name="default_cost_center_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Centro de costo por defecto</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || 'none'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin centro por defecto" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Sin centro por defecto</SelectItem>
                  {costCenters
                    .filter(cc => cc.is_active)
                    .map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
