import { useEffect, useMemo, useState } from 'react';
import { Check, Link2, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLowboyCostCandidates, useLowboySaleCandidates } from '@/hooks/useSiiRcv';
import { cn } from '@/lib/utils';
import { SALE_STATUS_LABEL, type LowboySaleStatus } from '@/types/lowboySales';
import type { SiiRcvRecordRow } from '@/types/siiRcv';
import { normalizeRut } from '@/utils/rutFormatter';
import { getLowboySaleMatch } from '@/utils/lowboySaleMatching';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

interface LowboyLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: SiiRcvRecordRow | null;
  isPending: boolean;
  onLink: (linkedId: string | null, markAsInvoiced?: boolean) => Promise<void>;
  onCreateSale: (record: SiiRcvRecordRow) => void;
}

export function LowboyLinkDialog({ open, onOpenChange, record, isPending, onLink, onCreateSale }: LowboyLinkDialogProps) {
  const isPurchase = record?.book_type === 'compra';
  const { data: costs = [], isLoading: costsLoading } = useLowboyCostCandidates(open && isPurchase);
  const { data: sales = [], isLoading: salesLoading } = useLowboySaleCandidates(open && !isPurchase, record?.id);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markAsInvoiced, setMarkAsInvoiced] = useState(false);

  const candidates = useMemo(() => {
    if (!record) return [];
    const needle = search.trim().toLocaleLowerCase('es-CL');
    if (isPurchase) {
      return costs
        .filter((cost) => !needle || `${cost.description} ${cost.amount} ${cost.date} ${cost.cost_categories?.name ?? ''}`.toLocaleLowerCase('es-CL').includes(needle))
        .sort((a, b) => {
          const exactA = Number(a.amount) === Number(record.total_amount) ? 0 : 1;
          const exactB = Number(b.amount) === Number(record.total_amount) ? 0 : 1;
          return exactA - exactB || Math.abs(Number(a.amount) - Number(record.total_amount)) - Math.abs(Number(b.amount) - Number(record.total_amount));
        });
    }
    const recordRut = normalizeRut(record.counterpart_rut);
    return sales
      .filter((sale) => !needle || `${sale.client_name} ${sale.client_rut} ${sale.description} ${sale.net_amount} ${sale.status}`.toLocaleLowerCase('es-CL').includes(needle))
      .sort((a, b) => {
        const score = (sale: typeof a) => getLowboySaleMatch(recordRut, record.net_amount, sale.client_rut, sale.net_amount).score;
        return score(a) - score(b) || Math.abs(Number(a.net_amount) - Number(record.net_amount)) - Math.abs(Number(b.net_amount) - Number(record.net_amount));
      });
  }, [costs, isPurchase, record, sales, search]);

  const selectedSale = !isPurchase ? sales.find((sale) => sale.id === selectedId) : null;

  useEffect(() => {
    if (!open || !record) return;
    setSearch('');
    setSelectedId(record.linked_cost_id ?? record.linked_sale_id ?? null);
    setMarkAsInvoiced(false);
  }, [open, record]);

  useEffect(() => {
    if (!open || selectedId || candidates.length === 0 || !record) return;
    const first = candidates[0];
    const amount = 'amount' in first ? first.amount : first.net_amount;
    const rutMatches = 'client_rut' in first && normalizeRut(first.client_rut) === normalizeRut(record.counterpart_rut);
    if (Number(amount) === Number(isPurchase ? record.total_amount : record.net_amount) && (isPurchase || rutMatches)) {
      setSelectedId(first.id);
      if ('status' in first) setMarkAsInvoiced(first.status === 'ejecutada');
    }
  }, [candidates, isPurchase, open, record, selectedId]);

  if (!record) return null;
  const loading = isPurchase ? costsLoading : salesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isPurchase ? 'Vincular compra a costo' : 'Vincular factura a venta LowBoy'}</DialogTitle>
          <DialogDescription>
            Documento {record.folio} por {formatCLP(isPurchase ? record.total_amount : record.net_amount)}. El vínculo es conciliatorio y no duplica montos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder={isPurchase ? 'Buscar por descripción, categoría, fecha o monto' : 'Buscar por cliente, RUT, descripción o monto'}
          />
        </div>

        <ScrollArea className="h-[340px] rounded-md border">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>
          ) : candidates.length ? (
            <div className="space-y-1 p-2">
              {candidates.map((candidate) => {
                const selected = candidate.id === selectedId;
                const amount = 'amount' in candidate ? candidate.amount : candidate.net_amount;
                const amountMatches = Number(amount) === Number(isPurchase ? record.total_amount : record.net_amount);
                const saleMatch = 'client_rut' in candidate
                  ? getLowboySaleMatch(record.counterpart_rut, record.net_amount, candidate.client_rut, candidate.net_amount)
                  : null;
                const rutMatches = saleMatch?.rutMatches ?? false;
                const title = 'amount' in candidate ? candidate.description : candidate.client_name;
                const detail = 'amount' in candidate
                  ? `${candidate.date} · ${candidate.cost_categories?.name ?? 'Sin categoría'}`
                  : `${candidate.client_rut} · ${candidate.description}`;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(candidate.id);
                      setMarkAsInvoiced('status' in candidate && candidate.status === 'ejecutada');
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors hover:bg-muted/60',
                      selected && 'border-primary bg-primary/5',
                    )}
                  >
                    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', selected && 'border-primary bg-primary text-primary-foreground')}>
                      {selected && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{title}</span>
                        {'status' in candidate && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{SALE_STATUS_LABEL[candidate.status as LowboySaleStatus] ?? candidate.status}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {rutMatches && <span className="rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs font-semibold text-emerald-700">RUT coincide</span>}
                        {amountMatches && <span className="rounded-full border border-emerald-600/40 px-2 py-0.5 text-xs font-semibold text-emerald-700">Monto coincide</span>}
                      </span>
                    </span>
                    <span className="whitespace-nowrap font-semibold">{formatCLP(amount)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">{isPurchase ? 'No se encontraron costos disponibles.' : 'No hay ventas LowBoy disponibles para vincular.'}</p>
              {!isPurchase && <Button type="button" size="sm" onClick={() => onCreateSale(record)}><Plus className="mr-2 size-4" />Crear venta</Button>}
            </div>
          )}
        </ScrollArea>

        {!isPurchase && selectedSale && ['confirmada', 'ejecutada'].includes(selectedSale.status) && (
          <label className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <Checkbox checked={markAsInvoiced} onCheckedChange={(checked) => setMarkAsInvoiced(checked === true)} />
            <span>
              <span className="block text-sm font-medium">Marcar la venta como facturada</span>
              <span className="block text-xs text-muted-foreground">También registra la fecha del documento como ejecución si aún no existe.</span>
            </span>
          </label>
        )}

        <DialogFooter className="sm:justify-between">
          {!isPurchase && candidates.length > 0 && (
            <Button type="button" variant="outline" onClick={() => onCreateSale(record)}><Plus className="mr-2 size-4" />Crear venta</Button>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
            <Button
              type="button"
              disabled={!selectedId || isPending}
              onClick={async () => {
                try {
                  await onLink(selectedId, markAsInvoiced);
                  onOpenChange(false);
                } catch {
                  // onError mantiene el diálogo disponible para reintentar.
                }
              }}
            >
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
              Confirmar vínculo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
