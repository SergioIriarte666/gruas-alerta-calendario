import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import type { SupplierCategory } from '@/types/suppliers';

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const formSchema = z.object({
  label: z.string().min(1, 'El nombre visible es requerido'),
  name: z.string().min(1, 'El identificador es requerido'),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SupplierCategoryFormProps {
  category?: SupplierCategory | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SupplierCategoryForm = ({ category, onSuccess, onCancel }: SupplierCategoryFormProps) => {
  const { createCategory, updateCategory, isCreating, isUpdating } = useSupplierCategoryManager();

  const defaultValues = useMemo<FormValues>(() => ({
    label: category?.label || '',
    name: category?.name || '',
    description: category?.description || '',
    is_active: category?.is_active ?? true,
  }), [category]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [form, defaultValues]);

  const labelValue = form.watch('label');
  const nameValue = form.watch('name');

  useEffect(() => {
    if (category) return;
    if (!labelValue) return;
    if (nameValue && nameValue.trim()) return;
    form.setValue('name', normalizeName(labelValue), { shouldValidate: true });
  }, [category, form, labelValue, nameValue]);

  const onSubmit = (values: FormValues) => {
    const payload = {
      label: values.label.trim(),
      name: values.name.trim(),
      description: (values.description || '').trim() || null,
      is_active: values.is_active ?? true,
    };

    if (category) {
      updateCategory({ id: category.id, ...payload }, { onSuccess });
      return;
    }

    createCategory(payload, { onSuccess });
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre visible *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Combustible" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Identificador *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: combustible" {...field} />
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
                <Textarea placeholder="Descripción opcional" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
              <div className="space-y-0.5">
                <FormLabel>Activa</FormLabel>
                <div className="text-xs text-muted-foreground">Las categorías inactivas no se muestran en el formulario.</div>
              </div>
              <FormControl>
                <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
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
