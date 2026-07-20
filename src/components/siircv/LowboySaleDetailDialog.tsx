import { useState, type ReactNode } from 'react';
import {
  Ban,
  Box,
  ChevronDown,
  FileText,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { safeDateToDisplaySlashes } from '@/utils/timezoneUtils';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import { useLowboySaleChangeHistory } from '@/hooks/useChangeHistory';
import { useLowboySaleContainers } from '@/hooks/siircv/useLowboySales';
import { StatusBadge, TypeBadge } from '@/components/siircv/lowboySaleBadges';
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_SIZE_LABEL,
  CONTAINER_TYPE_LABEL,
} from '@/types/lowboyContainers';
import {
  PIPELINE_ORDER,
  SALE_STATUS_LABEL,
  canAdvanceSale,
  canCancelSale,
  nextActionLabel,
  skipTargetsForStatus,
  type LowboySaleRow,
  type LowboySaleStatus,
} from '@/types/lowboySales';

const formatCLP = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const dash = (value: string | null | undefined): string => (value && String(value).trim() ? String(value) : '—');

type LinkedInvoice = NonNullable<LowboySaleRow['linked_rcv_records']>[number];

export interface LowboySaleDetailActions {
  onEdit: (sale: LowboySaleRow) => void;
  onAdvance: (sale: LowboySaleRow) => void;
  onSkip: (sale: LowboySaleRow, status: LowboySaleStatus) => void;
  onCancel: (sale: LowboySaleRow) => void;
  onDelete: (sale: LowboySaleRow) => void;
  onViewInvoice: (invoice: LinkedInvoice) => void;
}

interface LowboySaleDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: LowboySaleRow | null;
  isAdmin: boolean;
  actionPending: boolean;
  actions: LowboySaleDetailActions;
}

function Field({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value}</p>
    </div>
  );
}

/** Línea de tiempo del pipeline: confirmada → ejecutada → facturada → pagada. */
function PipelineTimeline({ status }: { status: string }) {
  const isCancelled = status === 'cancelada';
  const currentIdx = PIPELINE_ORDER.indexOf(status as LowboySaleStatus);

  return (
    <div className={cn('rounded-lg border p-4', isCancelled && 'opacity-60')}>
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_ORDER.map((step, idx) => {
          const completed = !isCancelled && idx < currentIdx;
          const current = !isCancelled && idx === currentIdx;
          const done = completed || current;
          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold',
                    current && 'border-emerald-600 bg-emerald-600 text-white',
                    completed && 'border-emerald-600 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
                    !done && 'border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {idx + 1}
                </div>
                <span className={cn('text-[11px] font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>
                  {SALE_STATUS_LABEL[step]}
                </span>
              </div>
              {idx < PIPELINE_ORDER.length - 1 && (
                <div className={cn('mx-1 h-0.5 flex-1', completed ? 'bg-emerald-600' : 'bg-muted-foreground/20')} />
              )}
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="destructive" className="gap-1"><Ban className="size-3" />Venta cancelada</Badge>
        </div>
      )}
    </div>
  );
}

/** Desglose económico del contenedor (visible para todos los roles). */
function ProductCostSection({ saleId, netAmount, enabled }: { saleId: string; netAmount: number; enabled: boolean }) {
  const { data: containers, isLoading } = useLowboySaleContainers(saleId, enabled);

  if (isLoading) {
    return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando contenedores…</div>;
  }
  if (!containers || containers.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">Sin contenedor vinculado a esta venta.</p>;
  }

  const totalCost = containers.reduce(
    (sum, c) => sum + Number(c.acquisition_net_cost || 0) + c.costs.reduce((s, cost) => s + Number(cost.net_amount || 0), 0),
    0,
  );
  const margin = netAmount - totalCost;
  const marginPct = netAmount > 0 ? (margin / netAmount) * 100 : 0;

  return (
    <div className="space-y-3">
      {containers.map((container) => {
        const additional = container.costs.reduce((s, cost) => s + Number(cost.net_amount || 0), 0);
        const containerTotal = Number(container.acquisition_net_cost || 0) + additional;
        return (
          <div key={container.id} className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Box className="size-4 text-teal-600" />
              <span className="font-mono text-sm font-semibold">{container.serial_number || 'Sin serie'}</span>
              <span className="text-xs text-muted-foreground">
                {CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL] ?? container.size}
                {' · '}{CONTAINER_TYPE_LABEL[container.container_type as keyof typeof CONTAINER_TYPE_LABEL] ?? container.container_type}
                {' · '}{CONTAINER_CONDITION_LABEL[container.condition as keyof typeof CONTAINER_CONDITION_LABEL] ?? container.condition}
              </span>
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Costo de adquisición</dt>
                <dd className="font-medium">{formatCLP(Number(container.acquisition_net_cost || 0))}</dd>
              </div>
              {container.costs.map((cost) => (
                <div key={cost.id} className="flex justify-between gap-3 pl-3 text-xs">
                  <dt className="text-muted-foreground">+ {cost.concept}</dt>
                  <dd>{formatCLP(Number(cost.net_amount || 0))}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-1">
                <dt className="text-muted-foreground">Costo total contenedor</dt>
                <dd className="font-semibold">{formatCLP(containerTotal)}</dd>
              </div>
            </dl>
          </div>
        );
      })}

      <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/40 p-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Neto venta</p>
          <p className="font-semibold">{formatCLP(netAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Costo total</p>
          <p className="font-semibold">{formatCLP(totalCost)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Margen</p>
          <p className={cn('font-bold', margin >= 0 ? 'text-emerald-600' : 'text-destructive')}>
            {formatCLP(margin)}<span className="ml-1 text-xs font-medium">({marginPct.toFixed(1)}%)</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function LowboySaleDetailDialog({ open, onOpenChange, sale, isAdmin, actionPending, actions }: LowboySaleDetailDialogProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: history, isLoading: historyLoading } = useLowboySaleChangeHistory(open && sale ? sale.id : null);

  if (!sale) return null;

  const isFlete = sale.sale_type === 'flete';
  const net = Number(sale.net_amount) || 0;
  const iva = Math.round(net * 0.19);
  const total = net + iva;
  const invoice = sale.linked_rcv_records?.[0] ?? null;
  const vehicles = [...(sale.lowboy_sale_vehicles ?? [])].sort((a, b) => a.position - b.position);
  const adjustment = Number(sale.flete_adjustment) || 0;
  const hasVehicleValues = vehicles.some((vehicle) => vehicle.service_value != null);
  // El desglose (lista de vehículos + total) se muestra si hay vehículos o un ajuste.
  const showVehicleBreakdown = vehicles.length > 0 || adjustment !== 0;

  const skips = skipTargetsForStatus(sale.status);
  const canEdit = !['pagada', 'cancelada'].includes(sale.status);
  const showFooter = isAdmin && (canAdvanceSale(sale.status) || canEdit || skips.length > 0 || canCancelSale(sale.status));
  const historyCount = history?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-2 border-b p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={sale.sale_type} />
            <StatusBadge status={sale.status} />
          </div>
          <DialogTitle className="text-lg leading-snug">{dash(sale.description)}</DialogTitle>
          <DialogDescription className="sr-only">Detalle de la venta LowBoy de {sale.client_name}.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <PipelineTimeline status={sale.status} />

          {/* Cliente */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Cliente</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Razón social" value={dash(sale.client_name)} />
              <Field label="RUT" value={<span className="font-mono">{dash(sale.client_rut)}</span>} />
            </div>
          </section>

          <Separator />

          {/* Datos comerciales */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Datos comerciales</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Fecha comprometida" value={dash(sale.scheduled_date ? safeDateToDisplaySlashes(sale.scheduled_date) : null)} />
              <Field label="Fecha de ejecución" value={dash(sale.executed_date ? safeDateToDisplaySlashes(sale.executed_date) : null)} />
              <Field label="Neto" value={<span className="font-semibold">{formatCLP(net)}</span>} />
              <Field label="IVA (19%)" value={formatCLP(iva)} />
              <Field label="Total" value={<span className="text-base font-bold">{formatCLP(total)}</span>} className="sm:col-span-2" />
            </div>
            {sale.notes && <Field label="Notas" value={<span className="whitespace-pre-wrap">{sale.notes}</span>} />}
          </section>

          <Separator />

          {/* Producto: contenedor + desglose económico */}
          {!isFlete && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Contenedor y desglose económico</h3>
                <ProductCostSection saleId={sale.id} netAmount={net} enabled={open} />
              </section>
              <Separator />
            </>
          )}

          {/* Flete: ruta + vehículos */}
          {isFlete && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Flete</h3>
                <Field label="Ruta" value={`${dash(sale.origin)} → ${dash(sale.destination)}`} />
                {showVehicleBreakdown && (
                  <div className="mt-2">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Truck className="size-3.5" />Vehículos trasladados ({vehicles.length})
                    </p>
                    <ul className="divide-y rounded-md border">
                      {vehicles.map((vehicle) => {
                        const label = [vehicle.make, vehicle.model].map((p) => p?.trim()).filter(Boolean).join(' ');
                        const isAdjustment = !label && !vehicle.plate;
                        const value = vehicle.service_value;
                        return (
                          <li key={vehicle.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span>{label || (isAdjustment ? (vehicle.notes?.trim() || 'Ajuste') : '')}</span>
                                {vehicle.plate && <span className="font-mono font-semibold">{vehicle.plate}</span>}
                              </div>
                              {!isAdjustment && vehicle.notes?.trim() && (
                                <p className="text-xs text-muted-foreground">{vehicle.notes}</p>
                              )}
                            </div>
                            <span className={cn(
                              'shrink-0 tabular-nums',
                              value == null ? 'text-muted-foreground' : value < 0 ? 'font-medium text-destructive' : 'font-medium',
                            )}>
                              {value == null ? '—' : formatCLP(value)}
                            </span>
                          </li>
                        );
                      })}
                      {adjustment !== 0 && (
                        <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">Ajuste</span>
                          <span className={cn('shrink-0 tabular-nums font-medium', adjustment < 0 ? 'text-destructive' : undefined)}>
                            {formatCLP(adjustment)}
                          </span>
                        </li>
                      )}
                      {(hasVehicleValues || adjustment !== 0) && (
                        <li className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2 text-sm font-semibold">
                          <span>Total</span>
                          <span className="tabular-nums">{formatCLP(net)}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </section>
              <Separator />
            </>
          )}

          {/* Facturación */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Facturación</h3>
            {invoice ? (
              <div className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2" onClick={() => actions.onViewInvoice(invoice)}>
                    <FileText className="size-3.5" />Factura folio {invoice.folio}
                  </Button>
                  <span className="text-xs text-muted-foreground">{safeDateToDisplaySlashes(invoice.doc_date)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                  <div><p className="text-xs text-muted-foreground">Neto</p><p className="font-medium">{formatCLP(Number(invoice.net_amount))}</p></div>
                  <div><p className="text-xs text-muted-foreground">IVA</p><p className="font-medium">{formatCLP(Number(invoice.tax_amount))}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{formatCLP(Number(invoice.total_amount))}</p></div>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Sin factura vinculada.
              </p>
            )}
          </section>

          <Separator />

          {/* Historial de cambios (colapsable, colapsado por defecto) */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border p-3 text-sm font-semibold transition-colors hover:bg-muted/50"
              >
                <span className="flex items-center gap-2">
                  <History className="size-4 text-amber-600" />
                  Historial de cambios
                  {historyCount > 0 && <Badge variant="secondary" className="text-xs">{historyCount}</Badge>}
                </span>
                <ChevronDown className={cn('size-4 transition-transform', historyOpen && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <ChangeHistoryPanel changes={history ?? []} isLoading={historyLoading} />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {showFooter && (
          <DialogFooter className="flex-row flex-wrap gap-2 border-t p-4 sm:p-4">
            {canAdvanceSale(sale.status) && (
              <Button onClick={() => actions.onAdvance(sale)} disabled={actionPending}>
                {actionPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {nextActionLabel(sale.status)}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => actions.onEdit(sale)} disabled={actionPending}>
                <Pencil className="mr-2 size-4" />Editar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones" disabled={actionPending}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {skips.map((target) => (
                  <DropdownMenuItem key={target} onClick={() => actions.onSkip(sale, target)}>
                    Marcar {SALE_STATUS_LABEL[target].toLowerCase()} (admin)
                  </DropdownMenuItem>
                ))}
                {skips.length > 0 && <DropdownMenuSeparator />}
                {canCancelSale(sale.status) && (
                  <DropdownMenuItem className="text-amber-600 focus:text-amber-600" onClick={() => actions.onCancel(sale)}>
                    <Ban className="mr-2 size-4" />Cancelar venta
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDelete(sale)}>
                  <Trash2 className="mr-2 size-4" />Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
