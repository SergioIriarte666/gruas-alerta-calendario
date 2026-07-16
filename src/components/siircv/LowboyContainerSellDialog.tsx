import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLowboyContainerInvoiceCandidates, useLowboyContainerSales } from '@/hooks/siircv/useLowboyContainers';
import { lowboySaleInitialStateSchema } from '@/schemas/lowboySale';
import { SALE_STATUS_LABEL, type LowboySaleFormValues, type LowboySaleInitialState, type LowboySaleInitialStatus, type LowboySaleStatus } from '@/types/lowboySales';
import type { LowboyContainerRow } from '@/types/lowboyContainers';
import { CONTAINER_SIZE_LABEL } from '@/types/lowboyContainers';
import { businessClock } from '@/utils/businessClock';
import { validateRut } from '@/utils/csvValidations';
import { formatRut } from '@/utils/rutFormatter';
import { getLowboySaleMatch } from '@/utils/lowboySaleMatching';

interface LowboyContainerSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: LowboyContainerRow | null;
  isPending: boolean;
  onLinkSale: (saleId: string, saleNetPrice: number, rcvRecordId?: string, markAsInvoiced?: boolean) => Promise<void>;
  onCreateSale: (values: LowboySaleFormValues, initialState?: LowboySaleInitialState, rcvRecordId?: string) => Promise<void>;
}

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
}).format(Number(value) || 0);

export function LowboyContainerSellDialog({ open, onOpenChange, container, isPending, onLinkSale, onCreateSale }: LowboyContainerSellDialogProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [saleId, setSaleId] = useState('');
  const [saleNetPrice, setSaleNetPrice] = useState(0);
  const [retroactive, setRetroactive] = useState(false);
  const [initialStatus, setInitialStatus] = useState<LowboySaleInitialStatus>('facturada');
  const [executedDate, setExecutedDate] = useState(businessClock.today());
  const [rcvRecordId, setRcvRecordId] = useState('');
  const [values, setValues] = useState<LowboySaleFormValues>({
    sale_type: 'producto', client_rut: '', client_name: '', description: '', origin: '', destination: '', scheduled_date: '', net_amount: 0, notes: '',
  });
  const [error, setError] = useState('');
  const { data: sales, isLoading } = useLowboyContainerSales(open);
  const { data: invoices, isLoading: invoicesLoading } = useLowboyContainerInvoiceCandidates(open);

  const description = useMemo(() => {
    if (!container) return 'Contenedor';
    const size = CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL] ?? container.size;
    return `Contenedor ${size} ${container.serial_number || 'sin serie'}`;
  }, [container]);

  const selectedSale = sales?.find((sale) => sale.id === saleId) ?? null;
  const needsInvoice = mode === 'existing'
    ? Boolean(selectedSale && ['facturada', 'pagada'].includes(selectedSale.status) && !selectedSale.linked_rcv_records?.length)
    : retroactive && ['facturada', 'pagada'].includes(initialStatus);

  const sortedInvoices = useMemo(() => {
    const rut = mode === 'existing' ? selectedSale?.client_rut : values.client_rut;
    const amount = mode === 'existing' ? selectedSale?.net_amount : values.net_amount;
    return [...(invoices ?? [])].sort((a, b) => {
      const score = (invoice: typeof a) => getLowboySaleMatch(rut, Number(amount), invoice.counterpart_rut, invoice.net_amount).score;
      return score(a) - score(b) || b.doc_date.localeCompare(a.doc_date);
    });
  }, [invoices, mode, selectedSale, values.client_rut, values.net_amount]);

  const assignedNet = selectedSale?.lowboy_containers?.reduce((sum, linkedContainer) => sum + Number(linkedContainer.sale_net_price || 0), 0) ?? 0;
  const exceedsSaleNet = Boolean(selectedSale && assignedNet + saleNetPrice > Number(selectedSale.net_amount));

  useEffect(() => {
    if (!open) return;
    setMode('existing');
    setSaleId('');
    setSaleNetPrice(0);
    setRetroactive(false);
    setInitialStatus('facturada');
    setExecutedDate(businessClock.today());
    setRcvRecordId('');
    setValues({
      sale_type: 'producto', client_rut: '', client_name: '', description,
      origin: '', destination: '', scheduled_date: businessClock.today(), net_amount: 0, notes: '',
    });
    setError('');
  }, [description, open]);

  const selectSale = (id: string) => {
    setSaleId(id);
    setRcvRecordId('');
    const sale = sales?.find((candidate) => candidate.id === id);
    setSaleNetPrice(Number(sale?.net_amount ?? 0));
  };

  const selectInvoice = (id: string) => {
    setRcvRecordId(id);
    const invoice = invoices?.find((candidate) => candidate.id === id);
    if (invoice && mode === 'new' && retroactive) setExecutedDate(invoice.doc_date);
  };

  const submit = async () => {
    try {
      if (mode === 'existing') {
        if (!saleId || saleNetPrice < 0) {
          setError('Seleccione una venta e ingrese el precio neto del contenedor.');
          return;
        }
        await onLinkSale(saleId, saleNetPrice, rcvRecordId || undefined, false);
      } else {
        if (!validateRut(values.client_rut) || !values.client_name.trim() || values.net_amount < 0) {
          setError('Complete un RUT válido, cliente y precio neto.');
          return;
        }
        const initialState = retroactive
          ? lowboySaleInitialStateSchema.parse({ status: initialStatus, executed_date: executedDate })
          : undefined;
        await onCreateSale(values, initialState, rcvRecordId || undefined);
      }
      onOpenChange(false);
    } catch (submitError) {
      if (submitError instanceof Error && submitError.name === 'ZodError') setError('Ingrese una fecha de ejecución válida.');
      // Las mutaciones muestran errores operacionales mediante sonner.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vender {description}</DialogTitle>
          <DialogDescription>Asocie cualquier venta de producto no cancelada o regístrela aquí. Los montos son netos.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => { setMode(value as 'existing' | 'new'); setRcvRecordId(''); setError(''); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Venta existente</TabsTrigger>
            <TabsTrigger value="new">Nueva venta</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'existing' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Venta de producto</Label>
              <Select value={saleId} onValueChange={selectSale} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder={isLoading ? 'Cargando ventas...' : 'Seleccione una venta'} /></SelectTrigger>
                <SelectContent>
                  {(sales ?? []).map((sale) => (
                    <SelectItem key={sale.id} value={sale.id}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>{sale.client_name} · {formatCLP(sale.net_amount)}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{SALE_STATUS_LABEL[sale.status as LowboySaleStatus] ?? sale.status}</span>
                        {sale.linked_rcv_records?.[0] && <span className="text-xs text-muted-foreground">Folio {sale.linked_rcv_records[0].folio}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="container-sale-price">Precio neto asignado al contenedor</Label>
              <Input id="container-sale-price" type="number" min={0} step={1} value={saleNetPrice} onChange={(event) => setSaleNetPrice(Number(event.target.value))} />
            </div>
            {exceedsSaleNet && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>La suma asignada a contenedores ({formatCLP(assignedNet + saleNetPrice)}) supera el neto de la venta ({formatCLP(Number(selectedSale?.net_amount))}). Puede confirmar igualmente.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="container-client-rut">RUT cliente</Label><Input id="container-client-rut" value={values.client_rut} onChange={(event) => setValues((current) => ({ ...current, client_rut: formatRut(event.target.value) }))} placeholder="12.345.678-9" /></div>
            <div className="space-y-2"><Label htmlFor="container-client-name">Cliente</Label><Input id="container-client-name" value={values.client_name} onChange={(event) => setValues((current) => ({ ...current, client_name: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="container-sale-description">Descripción</Label><Input id="container-sale-description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="container-delivery-date">Fecha comprometida</Label><Input id="container-delivery-date" type="date" value={values.scheduled_date} onChange={(event) => setValues((current) => ({ ...current, scheduled_date: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="container-new-sale-net">Precio venta neto</Label><Input id="container-new-sale-net" type="number" min={0} step={1} value={values.net_amount} onChange={(event) => setValues((current) => ({ ...current, net_amount: Number(event.target.value) }))} /></div>

            <div className="space-y-4 rounded-md border p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div><Label htmlFor="container-retroactive">Venta ya realizada</Label><p className="text-xs text-muted-foreground">Registra el estado histórico y su fecha real.</p></div>
                <Switch id="container-retroactive" checked={retroactive} onCheckedChange={(checked) => { setRetroactive(checked); setRcvRecordId(''); }} />
              </div>
              {retroactive && <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="container-executed-date">Fecha de ejecución</Label><Input id="container-executed-date" type="date" value={executedDate} onChange={(event) => setExecutedDate(event.target.value)} /></div>
                <div className="space-y-2"><Label>Estado inicial</Label><Select value={initialStatus} onValueChange={(value) => { setInitialStatus(value as LowboySaleInitialStatus); setRcvRecordId(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ejecutada">Ejecutada</SelectItem><SelectItem value="facturada">Facturada</SelectItem><SelectItem value="pagada">Pagada</SelectItem></SelectContent></Select></div>
              </div>}
            </div>

            <div className="space-y-2 sm:col-span-2"><Label htmlFor="container-sale-notes">Notas</Label><Textarea id="container-sale-notes" rows={3} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
        )}

        {needsInvoice && (
          <div className="space-y-2 rounded-md border p-3">
            <Label>Vincular factura del RCV (opcional)</Label>
            <Select value={rcvRecordId || 'none'} onValueChange={(value) => selectInvoice(value === 'none' ? '' : value)} disabled={invoicesLoading}>
              <SelectTrigger><SelectValue placeholder={invoicesLoading ? 'Cargando facturas...' : 'Seleccione una factura'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular factura</SelectItem>
                {sortedInvoices.map((invoice) => {
                  const targetRut = mode === 'existing' ? selectedSale?.client_rut : values.client_rut;
                  const targetAmount = mode === 'existing' ? selectedSale?.net_amount : values.net_amount;
                  const { rutMatches, amountMatches } = getLowboySaleMatch(targetRut, Number(targetAmount), invoice.counterpart_rut, invoice.net_amount);
                  return <SelectItem key={invoice.id} value={invoice.id}>
                    <span className="flex flex-wrap items-center gap-1.5"><span>Folio {invoice.folio} · {invoice.counterpart_name || invoice.counterpart_rut} · {formatCLP(invoice.net_amount)}</span>{rutMatches && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-emerald-700">RUT</span>}{amountMatches && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-emerald-700">Monto</span>}</span>
                  </SelectItem>;
                })}
              </SelectContent>
            </Select>
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
