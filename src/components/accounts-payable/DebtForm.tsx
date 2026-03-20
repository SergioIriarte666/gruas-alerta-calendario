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
import { format } from 'date-fns';

interface DebtFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCreditor: () => void;
}

export const DebtForm = ({ open, onOpenChange, onCreateCreditor }: DebtFormProps) => {
  const { data: creditors } = useCreditors();
  const { mutate: createDebt, isPending } = useCreateDebt();

  const [form, setForm] = useState({
    creditor_id: '',
    description: '',
    total_amount: '',
    installments_count: '',
    frequency: 'monthly',
    first_due_date: format(new Date(), 'yyyy-MM-dd'),
    interest_enabled: false,
    interest_rate: '',
    adjustment_enabled: false,
    adjustment_rate: '',
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
        frequency: form.frequency,
        first_due_date: form.first_due_date,
        interest_enabled: form.interest_enabled,
        interest_rate: form.interest_enabled ? Number(form.interest_rate) : null,
        adjustment_enabled: form.adjustment_enabled,
        adjustment_rate: form.adjustment_enabled ? Number(form.adjustment_rate) : null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const installmentPreview = form.total_amount && form.installments_count
    ? Math.round(Number(form.total_amount) / Number(form.installments_count))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nueva Deuda</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Input type="number" value={form.installments_count} onChange={(e) => handleChange('installments_count', e.target.value)} min="1" required />
            </div>
          </div>

          {installmentPreview > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
              Cuota estimada: <strong>${installmentPreview.toLocaleString('es-CL')}</strong>
            </div>
          )}

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
              <Input type="date" value={form.first_due_date} onChange={(e) => handleChange('first_due_date', e.target.value)} required />
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !form.creditor_id}>
              {isPending ? 'Creando...' : 'Crear Deuda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
