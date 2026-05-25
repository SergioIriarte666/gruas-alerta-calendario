
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { CostFormValues } from '@/schemas/costSchema';
import { Calculator, Receipt, CalendarCheck } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';

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
  const isPaid = form.watch('is_paid');
  const costDate = form.watch('date');
  const paymentDateValue = form.watch('payment_date');

  // Cuando se marca como pagado y no hay fecha real, prellenar con la fecha del costo
  React.useEffect(() => {
    if (isPaid && !paymentDateValue && costDate) {
      form.setValue('payment_date', costDate, { shouldDirty: true });
    }
    if (!isPaid && paymentDateValue) {
      form.setValue('payment_date', '', { shouldDirty: true });
    }
  }, [isPaid, paymentDateValue, costDate, form]);
  
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
                disabled={isServiceExpense && showServiceButton && calculatedTotal > 0}
                className={`text-lg h-12 pr-16 ${
                  isServiceExpense && showServiceButton 
                      ? 'bg-accent/40 border-border' 
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
              />
            </FormControl>
            <div className="space-y-1">
              <Label
                className="text-sm font-medium text-foreground !mt-0 cursor-pointer"
                onClick={() => field.onChange(!field.value)}
              >
                Marcar como pagado
              </Label>
              <p className="text-xs text-muted-foreground">
                Por defecto, se usa la fecha del costo. Puedes indicar abajo la fecha real si fue distinta.
              </p>
            </div>
          </FormItem>
        )}
      />

      {isPaid && (
        <FormField
          name="payment_date"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CalendarCheck className="w-4 h-4" />
                Fecha real de pago
              </Label>
              <FormControl>
                <DatePickerInput
                  value={field.value || ''}
                  onChange={(date) => field.onChange(date)}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Si el pago se realizó en una fecha distinta a la de registro, indícala aquí.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Sección especial para Gastos de Servicios */}
      {isServiceExpense && showServiceButton && (
        <Card className="bg-accent/40 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-1">
                  Gastos de Servicios
                </h4>
                <p className="text-sm text-muted-foreground">
                  Desglosa los gastos en combustible, peajes y otros conceptos
                </p>
                {calculatedTotal > 0 && (
                  <p className="text-sm font-medium text-foreground mt-2">
                    Total calculado: <span className="text-lg">${calculatedTotal.toLocaleString()}</span>
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={onServiceExpenseClick}
                className="ml-4"
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
        <div className="bg-accent/40 border border-border rounded-lg p-3">
          <p className="text-sm text-foreground">
            ✅ Monto calculado desde el desglose de gastos de servicios
          </p>
        </div>
      )}
    </div>
  );
};
