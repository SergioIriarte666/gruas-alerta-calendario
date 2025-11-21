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
}

export const InventoryPurchaseFields = ({ form }: InventoryPurchaseFieldsProps) => {
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
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <Package className="w-5 h-5 text-primary" />
          Detalles de Compra de Inventario
        </CardTitle>
        <Alert className="mt-2 bg-primary/10 border-primary/30">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground/80">
            Esta compra se sincronizará automáticamente con el inventario. 
            Complete los detalles para un mejor control de stock.
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField 
            name="purchase_quantity" 
            control={form.control} 
            render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <Hash className="w-4 h-4" />
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
                  <DollarSign className="w-4 h-4" />
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
                  <DollarSign className="w-4 h-4" />
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
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Resumen:</strong> {quantity} {Number(quantity) === 1 ? 'unidad' : 'unidades'} × ${Number(unitCost).toLocaleString('es-CL')} = ${(Number(quantity) * Number(unitCost)).toLocaleString('es-CL')}
            </p>
          </div>
        )}

        {/* Checkbox de consumo inmediato */}
        <div className="space-y-3 p-4 border-2 border-dashed border-border rounded-lg bg-background/50">
          <div className="flex items-start gap-3">
            <FormField
              control={form.control}
              name="immediate_consumption"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0 pt-1">
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
            <div className="flex-1">
              <Label 
                htmlFor="immediate_consumption" 
                className="flex items-center gap-2 cursor-pointer font-medium text-foreground"
              >
                <Zap className="w-4 h-4 text-orange-500" />
                Consumo Inmediato
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Esta compra se consumirá inmediatamente en la grúa seleccionada. 
                El stock neto en bodega quedará en 0 (se registra entrada y salida automática).
              </p>
            </div>
          </div>

          {immediateConsumption && (
            <Alert className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
              <Zap className="h-4 w-4 text-orange-600 dark:text-orange-500" />
              <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Consumo inmediato activado:</strong>
                {craneId && craneId !== 'none' ? (
                  <span> Se registrará automáticamente la entrada y salida inmediata a la grúa seleccionada.</span>
                ) : (
                  <span> Al guardar, podrás <strong>distribuir entre varias grúas</strong> usando el asistente de distribución.</span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
