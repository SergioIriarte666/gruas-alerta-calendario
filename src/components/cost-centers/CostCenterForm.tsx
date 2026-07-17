import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAddCostCenter, useUpdateCostCenter, useCostCenters } from '@/hooks/useCostCenters';
import { CostCenter, BUDGET_PERIODS } from '@/types/costCenters';
import { createLogger } from "@/lib/logger";


const logger = createLogger("CostCenterForm");
const costCenterSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(10, 'Máximo 10 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  is_active: z.boolean().default(true),
  budget_amount: z.coerce.number().min(0, 'El presupuesto debe ser positivo').optional(),
  budget_period: z.string().refine(
    (val) => ['monthly', 'quarterly', 'yearly'].includes(val),
    { message: 'Período presupuestal inválido' }
  ).default('monthly'),
});

type CostCenterFormData = z.infer<typeof costCenterSchema>;

interface CostCenterFormProps {
  isOpen: boolean;
  onClose: () => void;
  costCenter?: CostCenter | null;
}

export const CostCenterForm = ({ isOpen, onClose, costCenter }: CostCenterFormProps) => {
  const { data: costCenters = [] } = useCostCenters();
  const addCostCenter = useAddCostCenter();
  const updateCostCenter = useUpdateCostCenter();

  const form = useForm<CostCenterFormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      parent_id: '',
      is_active: true,
      budget_amount: 0,
      budget_period: 'monthly',
    },
  });

  useEffect(() => {
    if (costCenter) {
      form.reset({
        code: costCenter.code,
        name: costCenter.name,
        description: costCenter.description || '',
        parent_id: costCenter.parent_id || 'none',
        is_active: costCenter.is_active,
        budget_amount: Number(costCenter.budget_amount) || 0,
        budget_period: costCenter.budget_period as any,
      });
    } else {
      form.reset({
        code: '',
        name: '',
        description: '',
        parent_id: 'none',
        is_active: true,
        budget_amount: 0,
        budget_period: 'monthly',
      });
    }
  }, [costCenter, form]);

  const onSubmit = async (data: CostCenterFormData) => {
    try {
      const formData = {
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        parent_id: data.parent_id === 'none' ? null : data.parent_id || null,
        is_active: data.is_active,
        budget_amount: Number(data.budget_amount) || 0,
        budget_period: data.budget_period,
      };

      if (costCenter) {
        await updateCostCenter.mutateAsync({ id: costCenter.id, ...formData });
      } else {
        await addCostCenter.mutateAsync(formData);
      }
      
      onClose();
    } catch (error) {
      logger.error('Error saving cost center:', error);
    }
  };

  // Filter out the current cost center and its descendants from parent options
  const availableParents = costCenters.filter(center => {
    if (!costCenter) return true;
    return center.id !== costCenter.id && center.parent_id !== costCenter.id;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="configuration-dialog sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {costCenter ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="ADMIN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro Padre</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar padre (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin padre</SelectItem>
                        {availableParents.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.code} - {center.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Gastos Administrativos" {...field} />
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
                      placeholder="Descripción detallada del centro de costo..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budget_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Presupuesto</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período Presupuestal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUDGET_PERIODS.map((period) => (
                          <SelectItem key={period.value} value={period.value}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Centro Activo</FormLabel>
                    <div className="text-[0.8rem] text-muted-foreground">
                      Permite asignar costos a este centro
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={addCostCenter.isPending || updateCostCenter.isPending}
              >
                {costCenter ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
