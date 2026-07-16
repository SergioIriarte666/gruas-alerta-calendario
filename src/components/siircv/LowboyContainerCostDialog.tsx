import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLowboyContainerRcvCandidates } from '@/hooks/siircv/useLowboyContainers';
import { businessClock } from '@/utils/businessClock';
import type { LowboyContainerCostFormValues, LowboyContainerCostRow } from '@/types/lowboyContainers';

const COST_SUGGESTIONS = ['Flete de traída', 'Reparación', 'Pintura', 'Otro'];

const emptyValues = (): LowboyContainerCostFormValues => ({
  concept: 'Flete de traída',
  net_amount: 0,
  cost_date: businessClock.today(),
  rcv_record_id: '',
  notes: '',
});

interface LowboyContainerCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cost: LowboyContainerCostRow | null;
  isPending: boolean;
  onSubmit: (values: LowboyContainerCostFormValues) => Promise<void>;
}

export function LowboyContainerCostDialog({ open, onOpenChange, cost, isPending, onSubmit }: LowboyContainerCostDialogProps) {
  const [values, setValues] = useState<LowboyContainerCostFormValues>(emptyValues);
  const [error, setError] = useState('');
  const { data: rcvRecords } = useLowboyContainerRcvCandidates(open);

  useEffect(() => {
    if (!open) return;
    setValues(cost ? {
      concept: cost.concept,
      net_amount: Number(cost.net_amount),
      cost_date: cost.cost_date,
      rcv_record_id: cost.rcv_record_id ?? '',
      notes: cost.notes ?? '',
    } : emptyValues());
    setError('');
  }, [cost, open]);

  const submit = async () => {
    if (!values.concept.trim() || values.net_amount < 0 || !values.cost_date) {
      setError('Ingrese concepto, monto neto y fecha válidos.');
      return;
    }
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      // La mutación ya muestra el error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cost ? 'Editar costo adicional' : 'Agregar costo adicional'}</DialogTitle>
          <DialogDescription>Todos los montos se registran netos, sin IVA.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="container-cost-concept">Concepto</Label>
            <Input
              id="container-cost-concept"
              list="container-cost-concepts"
              value={values.concept}
              onChange={(event) => setValues((current) => ({ ...current, concept: event.target.value }))}
            />
            <datalist id="container-cost-concepts">{COST_SUGGESTIONS.map((concept) => <option key={concept} value={concept} />)}</datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-extra-net">Monto neto</Label>
            <Input id="container-extra-net" type="number" min={0} step={1} value={values.net_amount} onChange={(event) => setValues((current) => ({ ...current, net_amount: Number(event.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-extra-date">Fecha</Label>
            <DatePickerInput id="container-extra-date" value={values.cost_date} onChange={(value) => setValues((current) => ({ ...current, cost_date: value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Documento RCV relacionado</Label>
            <Select value={values.rcv_record_id || 'none'} onValueChange={(value) => setValues((current) => ({ ...current, rcv_record_id: value === 'none' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="Sin documento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin documento</SelectItem>
                {(rcvRecords ?? []).map((record) => <SelectItem key={record.id} value={record.id}>Folio {record.folio} · {record.counterpart_name || record.counterpart_rut} · ${Number(record.net_amount).toLocaleString('es-CL')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="container-extra-notes">Notas</Label>
            <Textarea id="container-extra-notes" rows={3} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} placeholder="Ej: financiado por G5N" />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar costo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
