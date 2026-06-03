/**
 * FASE 3: Componente para capturar datos de compra de inventario
 * 
 * Campos adicionales que aparecen cuando se selecciona la categoría "Inventario"
 * para registrar cantidad y precio unitario, mejorando la sincronización automática.
 */

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CostFormValues } from '@/schemas/costSchema';
import { Package, Hash, DollarSign, Info, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

interface InventoryPurchaseFieldsProps {
  form: UseFormReturn<CostFormValues>;
  disabled?: boolean;
  disabledReason?: string;
}

export const InventoryPurchaseFields = ({ form, disabled = false, disabledReason }: InventoryPurchaseFieldsProps) => {
  const quantity = form.watch('purchase_quantity') as number | undefined;
  const unitCost = form.watch('purchase_unit_cost') as number | undefined;
  const immediateConsumption = form.watch('immediate_consumption');
  const craneId = form.watch('crane_id');
  
  // Calcular automáticamente el monto total
  React.useEffect(() => {
    if (quantity && unitCost && quantity > 0 && unitCost > 0) {
      const total = Number(quantity) * Number(unitCost);
      form.setValue('amount', total);
    }
  }, [quantity, unitCost, form]);

  return (
    <Card className="bg-accent/30 border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Package className="size-5 text-primary" />
          Detalles de Compra de Inventario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {disabled && disabledReason && (
          <Alert>
            <Info className="size-4" />
            <AlertDescription className="text-xs">{disabledReason}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField 
            name="purchase_quantity" 
            control={form.control} 
            render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <Hash className="size-4" />
                  Cantidad *
                </Label>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="1"
                    className="bg-background"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} 
          />

          <FormField 
            name="purchase_unit_cost" 
            control={form.control} 
            render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <DollarSign className="size-4" />
                  Precio Unitario *
                </Label>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.00"
                    className="bg-background"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} 
          />

          <FormField 
            name="amount" 
            control={form.control} 
            render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <DollarSign className="size-4" />
                  Total (Auto-calculado)
                </Label>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    {...field} 
                    value={field.value || ''} 
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.00"
                    className="bg-muted/50"
                    readOnly={!!(quantity && unitCost)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} 
          />
        </div>

        {quantity && unitCost && Number(quantity) > 0 && Number(unitCost) > 0 && (
          <div className="sticky top-0 z-10 px-3 py-2 bg-violet-100 dark:bg-violet-950/30 border-l-4 border-violet-500 dark:border-violet-400 rounded shadow-sm">
            <p className="text-xs font-medium text-foreground">
              📦 {quantity} unidad{Number(quantity) !== 1 ? 'es' : ''} × ${Number(unitCost).toLocaleString('es-CL')} = <span className="text-violet-700 dark:text-violet-300 font-bold">${(Number(quantity) * Number(unitCost)).toLocaleString('es-CL')}</span>
            </p>
          </div>
        )}

        {immediateConsumption && (!quantity || !unitCost || Number(quantity) <= 0 || Number(unitCost) <= 0) && (
          <Alert variant="destructive" className="py-2">
            <Info className="size-4" />
            <AlertDescription className="text-xs">
              Cantidad y precio unitario son <strong>obligatorios</strong> para registrar el consumo inmediato en bodega y grúa.
            </AlertDescription>
          </Alert>
        )}

        {/* Consumo Inmediato - Layout compacto */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <FormField
                control={form.control}
                name="immediate_consumption"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                        id="immediate_consumption"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div>
                <Label 
                  htmlFor="immediate_consumption" 
                  className="flex items-center gap-2 cursor-pointer font-medium text-sm"
                >
                  <Zap className="size-3.5 text-orange-500" />
                  Consumo Inmediato
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Asignar a grúa(s) al guardar
                </p>
              </div>
            </div>
            
            {immediateConsumption && (
              <div className="flex items-center gap-2 text-xs bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-full border border-orange-200 dark:border-orange-800">
                <Zap className="size-3" />
                {craneId && craneId !== 'none' ? (
                  <span className="font-medium">→ 1 grúa seleccionada</span>
                ) : (
                  <span className="font-medium">→ Distribución multi-grúa</span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
