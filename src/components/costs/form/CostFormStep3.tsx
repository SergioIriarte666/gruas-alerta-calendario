import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { CostFormValues } from '@/schemas/costSchema';
import { Crane, Operator, Service } from '@/types';
import { ENTITIES, LOWBOY_CRANE_IDS } from '@/lib/entities';
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
  hasCraneParts?: boolean;
}

export const CostFormStep3 = ({
  form,
  cranes,
  isLoadingCranes,
  operators,
  isLoadingOperators,
  services,
  isLoadingServices,
  hasCraneParts = false,
}: CostFormStep3Props) => {
  const { data: costCenters = [] } = useCostCenters();
  const watchedEntity = form.watch('entity');
  const isLowboy = watchedEntity === 'lowboy';

  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Asociaciones"
        icon={<Building2 className="size-4" />}
        color="orange"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Asocia este costo con grúas, operadores o servicios específicos
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="entity" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <Building2 className="size-4" />
                  Empresa
                </Label>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    const currentCraneId = form.getValues('crane_id');
                    const isLowboyCrane = !!currentCraneId && (LOWBOY_CRANE_IDS as readonly string[]).includes(currentCraneId);

                    if (value === ENTITIES.GRUAS_5_NORTE.key) {
                      form.setValue('paid_by', ENTITIES.GRUAS_5_NORTE.key);
                      if (isLowboyCrane) {
                        form.setValue('crane_id', 'none');
                        toast.info('Grúa desasociada', {
                          description: 'La grúa seleccionada pertenece a LowBoy y no aplica para un costo de Grúas 5 Norte.',
                        });
                      }
                    } else if (currentCraneId && currentCraneId !== 'none' && !isLowboyCrane) {
                      form.setValue('crane_id', 'none');
                      toast.info('Grúa desasociada', {
                        description: 'La grúa seleccionada pertenece a Grúas 5 Norte y no aplica para un costo de LowBoy.',
                      });
                    }
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ENTITIES.GRUAS_5_NORTE.key}>{ENTITIES.GRUAS_5_NORTE.label}</SelectItem>
                    <SelectItem value={ENTITIES.LOWBOY.key}>{ENTITIES.LOWBOY.label}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {isLowboy && (
              <FormField name="paid_by" control={form.control} render={({ field }) => (
                <FormItem>
                  <Label className="flex items-center gap-2 text-foreground">
                    <Building2 className="size-4" />
                    Financiado por
                  </Label>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ENTITIES.GRUAS_5_NORTE.key}>{ENTITIES.GRUAS_5_NORTE.label}</SelectItem>
                      <SelectItem value={ENTITIES.LOWBOY.key}>{ENTITIES.LOWBOY.label}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Quién puso la plata para este gasto.</p>
                  <FormMessage />
                </FormItem>
              )} />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="crane_id" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Grúa</Label>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? 'none'}
                  disabled={isLoadingCranes || hasCraneParts}
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
                {hasCraneParts && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    La grúa no puede cambiarse porque este costo tiene piezas registradas. Para reasignar, edita directamente en el módulo de Grúas.
                  </p>
                )}
                {isLowboy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mostrando solo los equipos de LowBoy Chile SpA.
                  </p>
                )}
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

          <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField name="service_id" control={form.control} render={({ field }) => (
                <FormItem>
                  <Label className="text-foreground">Servicio</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <ServiceSelector
                          services={services}
                          value={field.value ?? 'none'}
                          onValueChange={field.onChange}
                          isLoading={isLoadingServices}
                          disabled={isLowboy}
                        />
                      </div>
                    </TooltipTrigger>
                    {isLowboy && (
                      <TooltipContent>
                        <p>Los servicios pertenecen a Grúas 5 Norte</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="service_folio" control={form.control} render={({ field }) => (
                <FormItem>
                  <Label className="text-foreground">Folio de Servicio</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Ej: F-1234"
                            disabled={isLowboy}
                          />
                        </FormControl>
                      </div>
                    </TooltipTrigger>
                    {isLowboy && (
                      <TooltipContent>
                        <p>Los servicios pertenecen a Grúas 5 Norte</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </TooltipProvider>

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
        </div>
      </ColoredSectionCard>
    </div>
  );
};
