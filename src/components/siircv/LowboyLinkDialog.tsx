import { useEffect, useMemo, useState } from 'react';
import { Check, Link2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useLowboyCostCandidates, useLowboyServiceCandidates } from '@/hooks/useSiiRcv';
import { cn } from '@/lib/utils';
import type { SiiRcvRecordRow } from '@/types/siiRcv';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const compactDate = (value: string) => Number(value.replace(/-/g, '')) || 0;

interface LowboyLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: SiiRcvRecordRow | null;
  isPending: boolean;
  onLink: (linkedId: string | null) => Promise<void>;
}

export function LowboyLinkDialog({ open, onOpenChange, record, isPending, onLink }: LowboyLinkDialogProps) {
  const isPurchase = record?.book_type === 'compra';
  const { data: costs = [], isLoading: costsLoading } = useLowboyCostCandidates(open && isPurchase);
  const { data: services = [], isLoading: servicesLoading } = useLowboyServiceCandidates(open && !isPurchase);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    return services
      .filter((service) => !needle || `${service.folio} ${service.value} ${service.service_date} ${service.client?.name ?? ''}`.toLocaleLowerCase('es-CL').includes(needle))
      .sort((a, b) => {
        const exactA = Number(a.value) === Number(record.total_amount) ? 0 : 1;
        const exactB = Number(b.value) === Number(record.total_amount) ? 0 : 1;
        const dateA = Math.abs(compactDate(a.service_date) - compactDate(record.doc_date));
        const dateB = Math.abs(compactDate(b.service_date) - compactDate(record.doc_date));
        return exactA - exactB || dateA - dateB;
      });
  }, [costs, isPurchase, record, search, services]);

  useEffect(() => {
    if (!open || !record) return;
    setSearch('');
    setSelectedId(record.linked_cost_id ?? record.linked_service_id ?? null);
  }, [open, record]);

  useEffect(() => {
    if (!open || selectedId || candidates.length === 0) return;
    const first = candidates[0];
    const amount = 'amount' in first ? first.amount : first.value;
    if (Number(amount) === Number(record?.total_amount)) setSelectedId(first.id);
  }, [candidates, open, record?.total_amount, selectedId]);

  if (!record) return null;
  const loading = isPurchase ? costsLoading : servicesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isPurchase ? 'Vincular compra a costo' : 'Vincular venta a servicio'}</DialogTitle>
          <DialogDescription>
            Documento {record.folio} por {formatCLP(record.total_amount)}. El vínculo es informativo y no modifica el registro operacional.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder={isPurchase ? 'Buscar por descripción, categoría, fecha o monto…' : 'Buscar por folio, cliente, fecha o monto…'}
          />
        </div>

        <ScrollArea className="h-[360px] rounded-lg border">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>
          ) : candidates.length ? (
            <div className="space-y-1 p-2">
              {candidates.map((candidate) => {
                const selected = candidate.id === selectedId;
                const amount = 'amount' in candidate ? candidate.amount : candidate.value;
                const exact = Number(amount) === Number(record.total_amount);
                const title = 'description' in candidate ? candidate.description : `Servicio ${candidate.folio}`;
                const detail = 'description' in candidate
                  ? `${candidate.date} · ${candidate.cost_categories?.name ?? 'Sin categoría'}`
                  : `${candidate.service_date} · ${candidate.client?.name ?? 'Cliente sin nombre'}`;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedId(candidate.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors hover:bg-muted/60',
                      selected && 'border-primary bg-primary/5',
                    )}
                  >
                    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', selected && 'border-primary bg-primary text-primary-foreground')}>
                      {selected && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                    </span>
                    <span className="text-right">
                      <span className="block whitespace-nowrap font-semibold">{formatCLP(amount)}</span>
                      {exact && <span className="text-xs font-medium text-emerald-600">Monto coincide</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="p-10 text-center text-sm text-muted-foreground">No se encontraron opciones.</p>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button
            type="button"
            disabled={!selectedId || isPending}
            onClick={async () => { await onLink(selectedId); onOpenChange(false); }}
          >
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
            Confirmar vínculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
