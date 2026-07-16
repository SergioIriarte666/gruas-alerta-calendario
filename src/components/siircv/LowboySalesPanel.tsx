import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Box,
  CheckCircle2,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { LowboySaleForm } from '@/components/siircv/LowboySaleForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useLowboySales,
  useLowboySalesKpis,
  useLowboySalesManager,
} from '@/hooks/siircv/useLowboySales';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';
import {
  type LowboySaleFormValues,
  type LowboyContainerSaleAssignment,
  type LowboySaleInitialState,
  type LowboySaleRow,
  type LowboySaleStatus,
  type LowboySaleType,
  LOWBOY_SALE_STATUSES,
  NEXT_STATUS,
  SALE_STATUS_LABEL,
  SALE_TYPE_LABEL,
} from '@/types/lowboySales';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const STATUS_BADGE: Record<LowboySaleStatus, string> = {
  confirmada: 'bg-sky-600 hover:bg-sky-700 text-white',
  ejecutada: 'bg-amber-500 hover:bg-amber-600 text-white',
  facturada: 'bg-violet-600 hover:bg-violet-700 text-white',
  pagada: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  cancelada: 'bg-muted text-muted-foreground line-through',
};

function StatusBadge({ status }: { status: string }) {
  const key = status as LowboySaleStatus;
  return (
    <Badge className={cn('whitespace-nowrap font-medium', STATUS_BADGE[key] ?? 'bg-muted')}>
      {SALE_STATUS_LABEL[key] ?? status}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  const key = type as LowboySaleType;
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap font-normal',
        key === 'flete' ? 'border-indigo-400 text-indigo-600' : 'border-teal-400 text-teal-600',
      )}
    >
      {SALE_TYPE_LABEL[key] ?? type}
    </Badge>
  );
}

const NEXT_ACTION_LABEL: Record<LowboySaleStatus, string> = {
  confirmada: 'Marcar ejecutada',
  ejecutada: 'Marcar facturada',
  facturada: 'Marcar pagada',
  pagada: '',
  cancelada: '',
};

type TypeFilter = 'all' | LowboySaleType;

type SortKey = 'scheduled_date' | 'sale_type' | 'client_name' | 'net_amount' | 'status';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };
type LinkedInvoice = NonNullable<LowboySaleRow['linked_rcv_records']>[number];

// Orden del pipeline para ordenar por estado de forma coherente (no alfabética).
const STATUS_ORDER: Record<LowboySaleStatus, number> = {
  confirmada: 0,
  ejecutada: 1,
  facturada: 2,
  pagada: 3,
  cancelada: 4,
};

function compareBy(a: LowboySaleRow, b: LowboySaleRow, key: SortKey): number {
  switch (key) {
    case 'scheduled_date':
      return (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '');
    case 'net_amount':
      return (Number(a.net_amount) || 0) - (Number(b.net_amount) || 0);
    case 'status':
      return (STATUS_ORDER[a.status as LowboySaleStatus] ?? 99) - (STATUS_ORDER[b.status as LowboySaleStatus] ?? 99);
    default:
      return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es');
  }
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tracking-tight', accent)}>{value}</p>
    </div>
  );
}

interface SaleDescriptionProps {
  sale: LowboySaleRow;
}

function SaleDescription({ sale }: SaleDescriptionProps) {
  return (
    <div className="max-w-72">
      <p className="truncate" title={sale.description}>{sale.description}</p>
      {sale.sale_type === 'flete' && (sale.origin || sale.destination) && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {sale.origin || '—'} → {sale.destination || '—'}
        </p>
      )}
      {sale.sale_type === 'producto' && (sale.lowboy_containers?.length ?? 0) > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sale.lowboy_containers?.map((container) => (
            <Badge key={container.id} variant="outline" className="gap-1 border-teal-600/40 bg-teal-600/5 px-1.5 py-0 text-[11px] text-teal-700">
              <Box className="size-3" />
              {container.serial_number || `${container.size}' sin serie`}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function LowboySalesPanel() {
  const isMobile = useIsMobile();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const { data: sales, isLoading } = useLowboySales();
  const manager = useLowboySalesManager();
  const kpis = useLowboySalesKpis(sales);

  const [statusFilter, setStatusFilter] = useState<LowboySaleStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  // null = orden por defecto del pipeline (activas primero por fecha ascendente).
  const [sort, setSort] = useState<SortState | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<LowboySaleRow | null>(null);
  const [deletingSale, setDeletingSale] = useState<LowboySaleRow | null>(null);
  const [executingSale, setExecutingSale] = useState<LowboySaleRow | null>(null);
  const [executeDate, setExecuteDate] = useState(businessClock.today());
  const [cancelingSale, setCancelingSale] = useState<LowboySaleRow | null>(null);
  const [skip, setSkip] = useState<{ sale: LowboySaleRow; status: LowboySaleStatus } | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<LinkedInvoice | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (sales ?? []).filter((sale) => {
      if (statusFilter !== 'all' && sale.status !== statusFilter) return false;
      if (typeFilter !== 'all' && sale.sale_type !== typeFilter) return false;
      if (term) {
        const haystack = `${sale.client_name} ${sale.client_rut} ${sale.description}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sales, statusFilter, typeFilter, search]);

  // Con columna seleccionada, ordena por ella; sin selección, respeta el orden por defecto.
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => compareBy(a, b, sort.key) * factor);
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === 'asc'
          ? { key, dir: 'desc' }
          : null // tercer clic vuelve al orden por defecto
        : { key, dir: 'asc' },
    );

  const openCreate = () => { setEditingSale(null); setFormOpen(true); };
  const openEdit = (sale: LowboySaleRow) => { setEditingSale(sale); setFormOpen(true); };

  const handleSave = async (values: LowboySaleFormValues, initialState?: LowboySaleInitialState, containerAssignments?: LowboyContainerSaleAssignment[], rcvRecordId?: string) => {
    if (editingSale) {
      await manager.updateSale.mutateAsync({
        id: editingSale.id,
        values,
        status: editingSale.status as Exclude<LowboySaleStatus, 'cancelada'>,
        executedDate: editingSale.executed_date,
        containerAssignments,
      });
    } else {
      await manager.createSale.mutateAsync({ values, initialState, containerAssignments, rcvRecordId });
    }
  };

  const advance = (sale: LowboySaleRow) => {
    const next = NEXT_STATUS[sale.status as LowboySaleStatus];
    if (!next) return;
    if (next === 'ejecutada') {
      setExecuteDate(sale.executed_date ?? businessClock.today());
      setExecutingSale(sale);
      return;
    }
    void manager.setStatus.mutateAsync({ id: sale.id, status: next }).catch(() => { /* handled */ });
  };

  const confirmExecute = () => {
    if (!executingSale) return;
    void manager.setStatus
      .mutateAsync({ id: executingSale.id, status: 'ejecutada', executedDate: executeDate })
      .then(() => setExecutingSale(null))
      .catch(() => { /* handled */ });
  };

  const confirmSkip = () => {
    if (!skip) return;
    // Al saltar más allá de "ejecutada" sin fecha real, fijamos la de hoy para KPIs coherentes.
    const needsDate = skip.status !== 'confirmada' && !skip.sale.executed_date;
    void manager.setStatus
      .mutateAsync({
        id: skip.sale.id,
        status: skip.status,
        executedDate: needsDate ? businessClock.today() : undefined,
      })
      .then(() => setSkip(null))
      .catch(() => { /* handled */ });
  };

  const confirmCancel = () => {
    if (!cancelingSale) return;
    void manager.setStatus
      .mutateAsync({ id: cancelingSale.id, status: 'cancelada' })
      .then(() => setCancelingSale(null))
      .catch(() => { /* handled */ });
  };

  // Estados "hacia adelante" a los que un admin puede saltar (más de una etapa).
  const skipTargets = (sale: LowboySaleRow): LowboySaleStatus[] => {
    const order: LowboySaleStatus[] = ['confirmada', 'ejecutada', 'facturada', 'pagada'];
    const idx = order.indexOf(sale.status as LowboySaleStatus);
    if (idx < 0) return [];
    const next = NEXT_STATUS[sale.status as LowboySaleStatus];
    return order.slice(idx + 1).filter((s) => s !== next);
  };

  const canAdvance = (sale: LowboySaleRow) => Boolean(NEXT_STATUS[sale.status as LowboySaleStatus]);
  const canCancel = (sale: LowboySaleRow) => sale.status === 'confirmada' || sale.status === 'ejecutada';

  function SortHeader({ sortKey, label, align = 'left' }: { sortKey: SortKey; label: string; align?: 'left' | 'right' }) {
    const active = sort?.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(align === 'right' ? '-mr-3 ml-auto' : '-ml-3', 'h-8 gap-1 px-2 font-semibold')}
        onClick={() => toggleSort(sortKey)}
      >
        {label}
        <Icon className={cn('size-3.5', active ? 'opacity-90' : 'opacity-60')} />
      </Button>
    );
  }

  function RowActions({ sale }: { sale: LowboySaleRow }) {
    if (!isAdmin) return null;
    const skips = skipTargets(sale);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones para ${sale.client_name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canAdvance(sale) && (
            <DropdownMenuItem onClick={() => advance(sale)}>
              <ArrowRight className="mr-2 size-4" />
              {NEXT_ACTION_LABEL[sale.status as LowboySaleStatus]}
            </DropdownMenuItem>
          )}
          {skips.length > 0 && (
            <>
              {skips.map((target) => (
                <DropdownMenuItem key={target} onClick={() => setSkip({ sale, status: target })}>
                  <CheckCircle2 className="mr-2 size-4" />
                  Marcar {SALE_STATUS_LABEL[target].toLowerCase()} (admin)
                </DropdownMenuItem>
              ))}
            </>
          )}
          {!['pagada', 'cancelada'].includes(sale.status) && (
            <DropdownMenuItem onClick={() => openEdit(sale)}>
              <Pencil className="mr-2 size-4" />Editar
            </DropdownMenuItem>
          )}
          {canCancel(sale) && (
            <DropdownMenuItem className="text-amber-600 focus:text-amber-600" onClick={() => setCancelingSale(sale)}>
              <Ban className="mr-2 size-4" />Cancelar venta
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingSale(sale)}>
            <Trash2 className="mr-2 size-4" />Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Ventas activas" value={String(kpis.activeCount)} accent="text-sky-600" />
        <KpiCard label="Por facturar (ejecutadas)" value={formatCLP(kpis.toInvoice)} accent="text-amber-600" />
        <KpiCard label="Por cobrar (facturadas)" value={formatCLP(kpis.toCollect)} accent="text-violet-600" />
        <KpiCard label="Pagado del mes" value={formatCLP(kpis.paidThisMonth)} accent="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Pipeline de ventas</CardTitle>
            {isAdmin && <Button size="sm" onClick={openCreate}><Plus className="mr-2 size-4" />Nueva venta</Button>}
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todas</FilterChip>
              {LOWBOY_SALE_STATUSES.map((status) => (
                <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                  {SALE_STATUS_LABEL[status]}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1.5">
                {(['all', 'producto', 'flete'] as const).map((t) => (
                  <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                    {t === 'all' ? 'Todos' : SALE_TYPE_LABEL[t]}
                  </FilterChip>
                ))}
              </div>
              <div className="relative sm:w-72">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por cliente o descripción"
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>
          ) : sorted.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No hay ventas para este filtro.</p>
          ) : isMobile ? (
            <div className="space-y-2 p-3">
              {sorted.map((sale) => (
                <div key={sale.id} className={cn('rounded-lg border p-3 text-sm', sale.status === 'cancelada' && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{sale.client_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{sale.scheduled_date ?? 'Sin fecha'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <TypeBadge type={sale.sale_type} />
                      <RowActions sale={sale} />
                    </div>
                  </div>
                  <div className="mt-2"><SaleDescription sale={sale} /></div>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge status={sale.status} />
                    <p className="font-semibold">{formatCLP(sale.net_amount)}</p>
                  </div>
                  {sale.linked_rcv_records?.[0] && (
                    <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setViewingInvoice(sale.linked_rcv_records?.[0] ?? null)}>
                      <FileText className="mr-1.5 size-3.5" />Factura folio {sale.linked_rcv_records[0].folio}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead><SortHeader sortKey="scheduled_date" label="Fecha comprometida" /></TableHead>
                    <TableHead><SortHeader sortKey="sale_type" label="Tipo" /></TableHead>
                    <TableHead><SortHeader sortKey="client_name" label="Cliente" /></TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right"><SortHeader sortKey="net_amount" label="Neto" align="right" /></TableHead>
                    <TableHead><SortHeader sortKey="status" label="Estado" /></TableHead>
                    <TableHead>Factura RCV</TableHead>
                    {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((sale) => (
                    <TableRow key={sale.id} className={cn(sale.status === 'cancelada' && 'opacity-60')}>
                      <TableCell className="whitespace-nowrap">{sale.scheduled_date ?? '—'}</TableCell>
                      <TableCell><TypeBadge type={sale.sale_type} /></TableCell>
                      <TableCell>
                        <div className="max-w-48">
                          <p className="truncate" title={sale.client_name}>{sale.client_name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">{sale.client_rut}</p>
                        </div>
                      </TableCell>
                      <TableCell><SaleDescription sale={sale} /></TableCell>
                      <TableCell className="text-right font-semibold">{formatCLP(sale.net_amount)}</TableCell>
                      <TableCell><StatusBadge status={sale.status} /></TableCell>
                      <TableCell>
                        {sale.linked_rcv_records?.[0] ? (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setViewingInvoice(sale.linked_rcv_records?.[0] ?? null)}>
                            <FileText className="mr-1.5 size-3.5" />Folio {sale.linked_rcv_records[0].folio}
                          </Button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {isAdmin && <TableCell><div className="flex justify-end"><RowActions sale={sale} /></div></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <LowboySaleForm
            open={formOpen}
            onOpenChange={setFormOpen}
            sale={editingSale}
            isPending={manager.createSale.isPending || manager.updateSale.isPending}
            onSubmit={handleSave}
          />

          {/* Marcar ejecutada: propone executed_date */}
          <Dialog open={Boolean(executingSale)} onOpenChange={(open) => { if (!open) setExecutingSale(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Marcar como ejecutada</DialogTitle>
                <DialogDescription>Confirme la fecha real de ejecución / entrega.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="execute-date">Fecha de ejecución</Label>
                <Input id="execute-date" type="date" value={executeDate} onChange={(event) => setExecuteDate(event.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExecutingSale(null)} disabled={manager.setStatus.isPending}>Cancelar</Button>
                <Button onClick={confirmExecute} disabled={manager.setStatus.isPending}>
                  {manager.setStatus.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Salto de estado (admin) */}
          <AlertDialog open={Boolean(skip)} onOpenChange={(open) => { if (!open) setSkip(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Saltar directamente a "{skip ? SALE_STATUS_LABEL[skip.status] : ''}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta transición omite etapas intermedias del flujo normal. Solo un administrador puede hacerlo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={manager.setStatus.isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={(event) => { event.preventDefault(); confirmSkip(); }} disabled={manager.setStatus.isPending}>
                  {manager.setStatus.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Confirmar salto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Cancelar venta */}
          <AlertDialog open={Boolean(cancelingSale)} onOpenChange={(open) => { if (!open) setCancelingSale(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cancelar esta venta?</AlertDialogTitle>
                <AlertDialogDescription>
                  La venta de {cancelingSale?.client_name} quedará marcada como cancelada. No se elimina el registro.
                  {(cancelingSale?.lowboy_containers?.length ?? 0) > 0 && ` Sus ${cancelingSale?.lowboy_containers?.length} contenedor(es) volverán a estar disponibles automáticamente.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={manager.setStatus.isPending}>Volver</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={(event) => { event.preventDefault(); confirmCancel(); }}
                  disabled={manager.setStatus.isPending}
                >
                  {manager.setStatus.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Cancelar venta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Eliminar venta */}
          <AlertDialog open={Boolean(deletingSale)} onOpenChange={(open) => { if (!open) setDeletingSale(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta venta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará permanentemente la venta de {deletingSale?.client_name}. Esta acción no se puede deshacer.
                  {(deletingSale?.lowboy_containers?.length ?? 0) > 0 && ` Sus ${deletingSale?.lowboy_containers?.length} contenedor(es) volverán a estar disponibles.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={manager.deleteSale.isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault();
                    if (!deletingSale) return;
                    void manager.deleteSale.mutateAsync(deletingSale.id).then(() => setDeletingSale(null)).catch(() => { /* handled */ });
                  }}
                  disabled={manager.deleteSale.isPending}
                >
                  {manager.deleteSale.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <Dialog open={Boolean(viewingInvoice)} onOpenChange={(open) => { if (!open) setViewingInvoice(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Factura RCV folio {viewingInvoice?.folio}</DialogTitle>
            <DialogDescription>Detalle del documento vinculado a la venta LowBoy.</DialogDescription>
          </DialogHeader>
          {viewingInvoice && (
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{viewingInvoice.doc_date}</p></div>
              <div><p className="text-xs text-muted-foreground">Tipo DTE</p><p className="font-medium">{viewingInvoice.doc_type}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{viewingInvoice.counterpart_name || '—'} · {viewingInvoice.counterpart_rut}</p></div>
              <div><p className="text-xs text-muted-foreground">Neto</p><p className="font-semibold">{formatCLP(viewingInvoice.net_amount)}</p></div>
              <div><p className="text-xs text-muted-foreground">IVA</p><p className="font-semibold">{formatCLP(viewingInvoice.tax_amount)}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{formatCLP(viewingInvoice.total_amount)}</p></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewingInvoice(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-background text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
