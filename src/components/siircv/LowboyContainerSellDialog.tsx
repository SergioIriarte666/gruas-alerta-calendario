import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLowboyContainerSales } from '@/hooks/siircv/useLowboyContainers';
import { businessClock } from '@/utils/businessClock';
import { validateRut } from '@/utils/csvValidations';
import { formatRut } from '@/utils/rutFormatter';
import type { LowboySaleFormValues } from '@/types/lowboySales';
import type { LowboyContainerRow } from '@/types/lowboyContainers';
import { CONTAINER_SIZE_LABEL } from '@/types/lowboyContainers';

interface LowboyContainerSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: LowboyContainerRow | null;
  isPending: boolean;
  onLinkSale: (saleId: string, saleNetPrice: number) => Promise<void>;
  onCreateSale: (values: LowboySaleFormValues) => Promise<void>;
}

export function LowboyContainerSellDialog({ open, onOpenChange, container, isPending, onLinkSale, onCreateSale }: LowboyContainerSellDialogProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [saleId, setSaleId] = useState('');
  const [saleNetPrice, setSaleNetPrice] = useState(0);
  const [values, setValues] = useState<LowboySaleFormValues>({
    sale_type: 'producto', client_rut: '', client_name: '', description: '', origin: '', destination: '', scheduled_date: '', net_amount: 0, notes: '',
  });
  const [error, setError] = useState('');
  const { data: sales, isLoading } = useLowboyContainerSales(open);

  const description = useMemo(() => {
    if (!container) return 'Contenedor';
    const size = CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL] ?? container.size;
    return `Contenedor ${size} ${container.serial_number || 'sin serie'}`;
  }, [container]);

  useEffect(() => {
    if (!open) return;
    setMode('existing');
    setSaleId('');
    setSaleNetPrice(0);
    setValues({
      sale_type: 'producto',
      client_rut: '',
      client_name: '',
      description,
      origin: '',
      destination: '',
      scheduled_date: businessClock.today(),
      net_amount: 0,
      notes: '',
    });
    setError('');
  }, [description, open]);

  const selectSale = (id: string) => {
    setSaleId(id);
    const sale = sales?.find((candidate) => candidate.id === id);
    setSaleNetPrice(Number(sale?.net_amount ?? 0));
  };

  const submit = async () => {
    try {
      if (mode === 'existing') {
        if (!saleId || saleNetPrice < 0) {
          setError('Seleccione una venta e ingrese el precio neto del contenedor.');
          return;
        }
        await onLinkSale(saleId, saleNetPrice);
      } else {
        if (!validateRut(values.client_rut) || !values.client_name.trim() || values.net_amount < 0) {
          setError('Complete un RUT válido, cliente y precio neto.');
          return;
        }
        await onCreateSale(values);
      }
      onOpenChange(false);
    } catch {
      // La mutación ya muestra el error.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vender {description}</DialogTitle>
          <DialogDescription>Asocie una venta de producto activa o créela aquí. Los montos son netos.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => { setMode(value as 'existing' | 'new'); setError(''); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Venta existente</TabsTrigger>
            <TabsTrigger value="new">Nueva venta</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'existing' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Venta activa de producto</Label>
              <Select value={saleId} onValueChange={selectSale} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder={isLoading ? 'Cargando ventas...' : 'Seleccione una venta'} /></SelectTrigger>
                <SelectContent>
                  {(sales ?? []).map((sale) => (
                    <SelectItem key={sale.id} value={sale.id}>
                      {sale.client_name} · {sale.description} · ${Number(sale.net_amount).toLocaleString('es-CL')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-sale-price">Precio neto asignado al contenedor</Label>
              <Input id="container-sale-price" type="number" min={0} step={1} value={saleNetPrice} onChange={(event) => setSaleNetPrice(Number(event.target.value))} />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="container-client-rut">RUT cliente</Label>
              <Input id="container-client-rut" value={values.client_rut} onChange={(event) => setValues((current) => ({ ...current, client_rut: formatRut(event.target.value) }))} placeholder="12.345.678-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-client-name">Cliente</Label>
              <Input id="container-client-name" value={values.client_name} onChange={(event) => setValues((current) => ({ ...current, client_name: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="container-sale-description">Descripción</Label>
              <Input id="container-sale-description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-delivery-date">Fecha comprometida</Label>
              <Input id="container-delivery-date" type="date" value={values.scheduled_date} onChange={(event) => setValues((current) => ({ ...current, scheduled_date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-new-sale-net">Precio venta neto</Label>
              <Input id="container-new-sale-net" type="number" min={0} step={1} value={values.net_amount} onChange={(event) => setValues((current) => ({ ...current, net_amount: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="container-sale-notes">Notas</Label>
              <Textarea id="container-sale-notes" rows={3} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={isPending || isLoading}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
