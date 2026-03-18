import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2 } from 'lucide-react';
import { CostFormValues } from '@/schemas/costSchema';
import { Crane, Operator, Service } from '@/types';
import { ServiceSelector } from './ServiceSelector';
import { SupplierSelector } from './SupplierSelector';
import { useCostCenters } from '@/hooks/useCostCenters';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';

interface CostFormStep3Props {
  form: UseFormReturn<CostFormValues>;
  cranes: Crane[];
  isLoadingCranes: boolean;
  operators: Operator[];
  isLoadingOperators: boolean;
  services: Service[];
  isLoadingServices: boolean;
}

export const CostFormStep3 = ({
  form,
  cranes,
  isLoadingCranes,
  operators,
  isLoadingOperators,
  services,
  isLoadingServices,
}: CostFormStep3Props) => {
  const { data: costCenters = [] } = useCostCenters();

  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Asociaciones"
        icon={<Building2 className="h-4 w-4" />}
        color="orange"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Asocia este costo con grúas, operadores o servicios específicos
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="crane_id" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Grúa</Label>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? 'none'}
                  disabled={isLoadingCranes}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asociar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin asociar</SelectItem>
                    {cranes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.licensePlate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField name="operator_id" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Operador</Label>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? 'none'}
                  disabled={isLoadingOperators}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asociar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin asociar</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="service_id" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Servicio</Label>
                <ServiceSelector
                  services={services}
                  value={field.value ?? 'none'}
                  onValueChange={field.onChange}
                  isLoading={isLoadingServices}
                />
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="service_folio" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Folio de Servicio</Label>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value ?? ''} 
                    placeholder="Ej: F-1234" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField name="cost_center_id" control={form.control} render={({ field }) => (
            <FormItem>
              <Label className="text-foreground">Centro de Costo</Label>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || 'none'} 
                disabled={!costCenters.length}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin centro de costo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Sin centro de costo</SelectItem>
                  {costCenters
                    .filter(center => center.is_active)
                    .map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.code} - {center.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <SupplierSelector
            form={form}
            fieldName="supplier_id"
            label="Proveedor"
            placeholder="Seleccionar proveedor"
          />

          {form.watch('supplier_id') && form.watch('supplier_id') !== 'none' && (
            <FormField
              name="is_paid"
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <Label className="text-sm font-medium text-foreground cursor-pointer !mt-0" onClick={() => field.onChange(!field.value)}>
                    Este gasto ya fue pagado al proveedor
                  </Label>
                </FormItem>
              )}
            />
          )}
        </div>
      </ColoredSectionCard>
    </div>
  );
};
