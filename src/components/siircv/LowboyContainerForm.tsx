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
import { formatRut } from '@/utils/rutFormatter';
import type {
  LowboyContainerCondition,
  LowboyContainerFormValues,
  LowboyContainerRow,
  LowboyContainerSize,
  LowboyContainerStatus,
  LowboyContainerType,
} from '@/types/lowboyContainers';
import { CONTAINER_CONDITION_LABEL, CONTAINER_SIZE_LABEL, CONTAINER_TYPE_LABEL } from '@/types/lowboyContainers';

const emptyValues = (): LowboyContainerFormValues => ({
  serial_number: '',
  size: '20',
  container_type: 'dry',
  condition: 'usado',
  acquisition_date: businessClock.today(),
  supplier_rut: '',
  supplier_name: '',
  acquisition_net_cost: 0,
  purchase_rcv_record_id: '',
  status: 'disponible',
  notes: '',
});

const fromContainer = (container: LowboyContainerRow): LowboyContainerFormValues => ({
  serial_number: container.serial_number ?? '',
  size: container.size as LowboyContainerSize,
  container_type: container.container_type as LowboyContainerType,
  condition: container.condition as LowboyContainerCondition,
  acquisition_date: container.acquisition_date,
  supplier_rut: container.supplier_rut ?? '',
  supplier_name: container.supplier_name ?? '',
  acquisition_net_cost: Number(container.acquisition_net_cost),
  purchase_rcv_record_id: container.purchase_rcv_record_id ?? '',
  status: (container.status === 'reservado' ? 'reservado' : 'disponible') as Exclude<LowboyContainerStatus, 'vendido'>,
  notes: container.notes ?? '',
});

interface LowboyContainerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: LowboyContainerRow | null;
  isPending: boolean;
  onSubmit: (values: LowboyContainerFormValues) => Promise<void>;
}

export function LowboyContainerForm({ open, onOpenChange, container, isPending, onSubmit }: LowboyContainerFormProps) {
  const [values, setValues] = useState<LowboyContainerFormValues>(emptyValues);
  const [error, setError] = useState('');
  const { data: rcvRecords } = useLowboyContainerRcvCandidates(open);

  useEffect(() => {
    if (!open) return;
    setValues(container ? fromContainer(container) : emptyValues());
    setError('');
  }, [container, open]);

  const update = <K extends keyof LowboyContainerFormValues>(key: K, value: LowboyContainerFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const selectRcv = (id: string) => {
    if (id === 'none') {
      update('purchase_rcv_record_id', '');
      return;
    }
    const record = rcvRecords?.find((candidate) => candidate.id === id);
    if (!record) return;
    setValues((current) => ({
      ...current,
      purchase_rcv_record_id: record.id,
      supplier_rut: record.counterpart_rut,
      supplier_name: record.counterpart_name ?? current.supplier_name,
      acquisition_date: record.doc_date,
      acquisition_net_cost: Number(record.net_amount),
    }));
  };

  const submit = async () => {
    if (!values.acquisition_date || values.acquisition_net_cost < 0) {
      setError('Revise la fecha y el costo neto de adquisición.');
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{container ? 'Editar contenedor' : 'Nuevo contenedor'}</DialogTitle>
          <DialogDescription>Datos unitarios y costo neto de adquisición.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Factura de compra RCV</Label>
            <Select value={values.purchase_rcv_record_id || 'none'} onValueChange={selectRcv}>
              <SelectTrigger><SelectValue placeholder="Sin factura vinculada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin factura vinculada</SelectItem>
                {(rcvRecords ?? []).map((record) => (
                  <SelectItem key={record.id} value={record.id}>
                    Folio {record.folio} · {record.counterpart_name || record.counterpart_rut} · ${Number(record.net_amount).toLocaleString('es-CL')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="container-serial">Serie</Label>
            <Input id="container-serial" value={values.serial_number} onChange={(event) => update('serial_number', event.target.value)} placeholder="Puede registrarse después" />
          </div>
          <div className="space-y-2">
            <Label>Tamaño</Label>
            <Select value={values.size} onValueChange={(value) => update('size', value as LowboyContainerSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CONTAINER_SIZE_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={values.container_type} onValueChange={(value) => update('container_type', value as LowboyContainerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CONTAINER_TYPE_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Condición</Label>
            <Select value={values.condition} onValueChange={(value) => update('condition', value as LowboyContainerCondition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CONTAINER_CONDITION_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-date">Fecha de adquisición</Label>
            <DatePickerInput id="container-date" value={values.acquisition_date} onChange={(value) => update('acquisition_date', value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-cost">Costo adquisición neto</Label>
            <Input id="container-cost" type="number" min={0} step={1} value={values.acquisition_net_cost} onChange={(event) => update('acquisition_net_cost', Number(event.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-supplier-rut">RUT proveedor</Label>
            <Input id="container-supplier-rut" value={values.supplier_rut} onChange={(event) => update('supplier_rut', formatRut(event.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="container-supplier">Proveedor</Label>
            <Input id="container-supplier" value={values.supplier_name} onChange={(event) => update('supplier_name', event.target.value)} />
          </div>
          {container?.status !== 'vendido' && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={values.status} onValueChange={(value) => update('status', value as 'disponible' | 'reservado')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="disponible">Disponible</SelectItem><SelectItem value="reservado">Reservado</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="container-notes">Notas</Label>
            <Textarea id="container-notes" rows={3} value={values.notes} onChange={(event) => update('notes', event.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
