
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { CostFormValues } from '@/schemas/costSchema';
import { Calculator, Receipt } from 'lucide-react';

interface CostAmountSectionProps {
  form: UseFormReturn<CostFormValues>;
  isServiceExpense: boolean;
  onServiceExpenseClick?: () => void;
  calculatedTotal?: number;
  showServiceButton?: boolean;
}

export const CostAmountSection = ({ 
  form, 
  isServiceExpense, 
  onServiceExpenseClick, 
  calculatedTotal = 0,
  showServiceButton = false 
}: CostAmountSectionProps) => {
  const amount = form.watch('amount');
  const supplierId = form.watch('supplier_id');
  const canMarkAsPaid = Boolean(supplierId && supplierId !== 'none');
  
  return (
    <div className="space-y-4">
      <FormField name="amount" control={form.control} render={({ field }) => (
        <FormItem>
          <Label className="flex items-center gap-2 text-base font-medium text-foreground">
            <Receipt className="w-4 h-4" />
            Monto Total
          </Label>
          <div className="relative">
            <FormControl>
              <Input 
                type="number" 
                step="0.01" 
                min="0"
                {...field} 
                disabled={isServiceExpense && showServiceButton}
                className={`text-lg h-12 pr-16 ${
                  isServiceExpense && showServiceButton 
                    ? 'bg-blue-50 border-blue-300' 
                    : ''
                }`}
                placeholder="0.00"
              />
            </FormControl>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              CLP
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )} />

      <FormField
        name="is_paid"
        control={form.control}
        render={({ field }) => (
          <FormItem className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                disabled={!canMarkAsPaid}
              />
            </FormControl>
            <div className="space-y-1">
              <Label
                className={`text-sm font-medium text-foreground !mt-0 ${canMarkAsPaid ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                onClick={() => canMarkAsPaid && field.onChange(!field.value)}
              >
                Marcar como pagado
              </Label>
              <p className="text-xs text-muted-foreground">
                {canMarkAsPaid
                  ? 'Al guardar, se registrará la fecha del costo como fecha de pago.'
                  : 'Selecciona un proveedor en Asociaciones para habilitar esta opción.'}
              </p>
            </div>
          </FormItem>
        )}
      />

      {/* Sección especial para Gastos de Servicios */}
      {isServiceExpense && showServiceButton && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-blue-800 mb-1">
                  Gastos de Servicios
                </h4>
                <p className="text-sm text-blue-600">
                  Desglosa los gastos en combustible, peajes y otros conceptos
                </p>
                {calculatedTotal > 0 && (
                  <p className="text-sm font-medium text-blue-800 mt-2">
                    Total calculado: <span className="text-lg">${calculatedTotal.toLocaleString()}</span>
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={onServiceExpenseClick}
                className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Desglosar Gastos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensaje informativo cuando el monto está calculado */}
      {isServiceExpense && amount > 0 && !showServiceButton && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">
            ✅ Monto calculado desde el desglose de gastos de servicios
          </p>
        </div>
      )}
    </div>
  );
};
