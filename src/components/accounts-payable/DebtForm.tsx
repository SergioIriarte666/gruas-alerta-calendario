import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreditors } from '@/hooks/useCreditors';
import { useCreateDebt } from '@/hooks/useDebts';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { businessClock } from '@/utils/businessClock';

interface DebtFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCreditor: () => void;
}

export const DebtForm = ({ open, onOpenChange, onCreateCreditor }: DebtFormProps) => {
  const { data: creditors } = useCreditors();
  const { mutate: createDebt, isPending } = useCreateDebt();
  const { data: costCenters = [] } = useCostCenters();
  const { operationalCranes: cranes = [] } = useCranes();
  const { operators = [] } = useOperators();
  const { data: categories = [] } = useCostCategories();
  const debtCategoryId = (categories as any[]).find((c: any) => c.name === 'Deudas y Obligaciones')?.id;
  const { subcategories = [] } = useCostSubcategories(debtCategoryId);

  const [form, setForm] = useState({
    creditor_id: '',
    description: '',
    total_amount: '',
    installments_count: '',
    currency: 'CLP',
    frequency: 'monthly',
    first_due_date: businessClock.today(),
    interest_enabled: false,
    interest_rate: '',
    adjustment_enabled: false,
    adjustment_rate: '',
    has_down_payment: false,
    down_payment_amount: '',
    down_payment_date: businessClock.today(),
    down_payment_paid: false,
    down_payment_payment_date: businessClock.today(),
    down_payment_method: 'transferencia',
    cost_center_id: 'none',
    crane_id: 'none',
    operator_id: 'none',
    subcategory: 'none',
  });

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDebt(
      {
        creditor_id: form.creditor_id,
        description: form.description,
        total_amount: Number(form.total_amount),
        installments_count: Number(form.installments_count),
        currency: form.currency,
        frequency: form.frequency,
        first_due_date: form.first_due_date,
        interest_enabled: form.interest_enabled,
        interest_rate: form.interest_enabled ? Number(form.interest_rate) : null,
        adjustment_enabled: form.adjustment_enabled,
        adjustment_rate: form.adjustment_enabled ? Number(form.adjustment_rate) : null,
        down_payment_amount: form.has_down_payment ? Number(form.down_payment_amount) : null,
        down_payment_date: form.has_down_payment ? form.down_payment_date : null,
        down_payment_paid: form.has_down_payment ? form.down_payment_paid : false,
        down_payment_payment_date: form.has_down_payment && form.down_payment_paid ? form.down_payment_payment_date : null,
        down_payment_method: form.has_down_payment && form.down_payment_paid ? form.down_payment_method : null,
        cost_center_id: form.cost_center_id === 'none' ? null : form.cost_center_id,
        crane_id: form.crane_id === 'none' ? null : form.crane_id,
        operator_id: form.operator_id === 'none' ? null : form.operator_id,
        subcategory: form.subcategory === 'none' ? null : form.subcategory,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const total = Number(form.total_amount || 0);
  const totalInstallments = Number(form.installments_count || 0);
  const downPayment = form.has_down_payment ? Number(form.down_payment_amount || 0) : 0;
  const remainingCount = form.has_down_payment ? (totalInstallments - 1) : totalInstallments;
  const remainingTotal = form.has_down_payment ? (total - downPayment) : total;

  const installmentPreview = remainingTotal > 0 && remainingCount > 0
    ? (form.currency === 'UF'
      ? Number((remainingTotal / remainingCount).toFixed(4))
      : Math.round(remainingTotal / remainingCount))
    : 0;

  const canSubmit = !!form.creditor_id
    && Number(form.total_amount) > 0
    && Number(form.installments_count) > 0
    && !!form.first_due_date
    && (!form.has_down_payment || (Number(form.down_payment_amount) > 0 && !!form.down_payment_date))
    && (!form.has_down_payment || !form.down_payment_paid || !!form.down_payment_payment_date)
    && (!form.has_down_payment || remainingTotal >= 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-dialog sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nueva Deuda</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
          <div className="space-y-2">
            <Label>Acreedor</Label>
            <div className="flex gap-2">
              <Select value={form.creditor_id} onValueChange={(v) => handleChange('creditor_id', v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar acreedor" /></SelectTrigger>
                <SelectContent>
                  {creditors?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={onCreateCreditor}>
                Nuevo
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Ej: Crédito bancario, IVA pendiente..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto Total</Label>
              <Input type="number" value={form.total_amount} onChange={(e) => handleChange('total_amount', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Cantidad de Cuotas</Label>
              <Input
                type="number"
                value={form.installments_count}
                onChange={(e) => handleChange('installments_count', e.target.value)}
                min={form.has_down_payment ? '2' : '1'}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Tiene pie inicial</Label>
              <p className="text-xs text-muted-foreground">Registrar pago inicial (pie) y repartir el saldo en cuotas</p>
            </div>
            <Switch checked={form.has_down_payment} onCheckedChange={(v) => handleChange('has_down_payment', v)} />
          </div>

          {form.has_down_payment && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Pie</Label>
                <Input type="number" value={form.down_payment_amount} onChange={(e) => handleChange('down_payment_amount', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Fecha Pie</Label>
                <DatePickerInput value={form.down_payment_date} onChange={(v) => handleChange('down_payment_date', v)} />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Pie pagado</Label>
                  <p className="text-xs text-muted-foreground">Marcar el pie como pagado en la creación</p>
                </div>
                <Switch checked={form.down_payment_paid} onCheckedChange={(v) => handleChange('down_payment_paid', v)} />
              </div>
              {form.down_payment_paid && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha de pago del pie</Label>
                    <DatePickerInput value={form.down_payment_payment_date} onChange={(v) => handleChange('down_payment_payment_date', v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Método de pago</Label>
                    <Select value={form.down_payment_method} onValueChange={(v) => handleChange('down_payment_method', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="initial">Inicial</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          {installmentPreview > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
              Cuota estimada:{' '}
              <strong>
                {form.currency === 'UF'
                  ? `UF ${installmentPreview.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                  : `$${installmentPreview.toLocaleString('es-CL')}`}
              </strong>
              {form.has_down_payment && remainingCount > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Cuotas pendientes: {remainingCount} (total: {totalInstallments} incluyendo pie)
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={form.currency} onValueChange={(v) => handleChange('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLP">CLP</SelectItem>
                <SelectItem value="UF">UF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={form.frequency} onValueChange={(v) => handleChange('frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primera Cuota</Label>
              <DatePickerInput value={form.first_due_date} onChange={(v) => handleChange('first_due_date', v)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Interés</Label>
              <p className="text-xs text-muted-foreground">Aplicar interés a cada cuota</p>
            </div>
            <Switch checked={form.interest_enabled} onCheckedChange={(v) => handleChange('interest_enabled', v)} />
          </div>
          {form.interest_enabled && (
            <div className="space-y-2">
              <Label>Tasa de interés (%)</Label>
              <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => handleChange('interest_rate', e.target.value)} />
            </div>
          )}

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium text-foreground">Asociaciones (heredadas a cada pago)</p>
            <div className="space-y-2">
              <Label>Subcategoría</Label>
              <Select value={form.subcategory} onValueChange={(v) => handleChange('subcategory', v)}>
                <SelectTrigger><SelectValue placeholder="Sin subcategoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subcategoría</SelectItem>
                  {subcategories.map((sc: any) => (
                    <SelectItem key={sc.id} value={sc.name}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Centro de costo</Label>
                <Select value={form.cost_center_id} onValueChange={(v) => handleChange('cost_center_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asociar</SelectItem>
                    {costCenters.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grúa</Label>
                <Select value={form.crane_id} onValueChange={(v) => handleChange('crane_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asociar</SelectItem>
                    {cranes.map((crane: any) => (
                      <SelectItem key={crane.id} value={crane.id}>{crane.licensePlate} - {crane.brand} {crane.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operador</Label>
                <Select value={form.operator_id} onValueChange={(v) => handleChange('operator_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asociar</SelectItem>
                    {operators.map((op: any) => (
                      <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? 'Creando...' : 'Crear Deuda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
