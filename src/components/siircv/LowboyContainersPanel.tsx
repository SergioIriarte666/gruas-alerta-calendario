import { useMemo, useState } from 'react';
import { Box, Download, Eye, Loader2, MoreHorizontal, PackageCheck, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LowboyContainerDetailSheet } from '@/components/siircv/LowboyContainerDetailSheet';
import { LowboyContainerForm } from '@/components/siircv/LowboyContainerForm';
import { LowboySaleForm } from '@/components/siircv/LowboySaleForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLowboyContainerKpis, useLowboyContainers, useLowboyContainersManager } from '@/hooks/siircv/useLowboyContainers';
import { useLowboySalesManager } from '@/hooks/siircv/useLowboySales';
import { cn } from '@/lib/utils';
import type { LowboyContainerSaleAssignment, LowboySaleFormValues, LowboySaleInitialState } from '@/types/lowboySales';
import type { LowboyContainerFormValues, LowboyContainerRow, LowboyContainerStatus } from '@/types/lowboyContainers';
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_SIZE_LABEL,
  CONTAINER_STATUS_LABEL,
  CONTAINER_TYPE_LABEL,
  containerAdditionalCost,
  containerMargin,
  containerTotalCost,
} from '@/types/lowboyContainers';
import { businessClock } from '@/utils/businessClock';
import { generateLowboyContainersPdf } from '@/utils/pdf/lowboyContainersPdfGenerator';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const STATUS_CLASS: Record<LowboyContainerStatus, string> = {
  disponible: 'bg-emerald-600 text-white',
  reservado: 'bg-amber-500 text-white',
  vendido: 'bg-sky-700 text-white',
};

function StatusBadge({ status }: { status: string }) {
  const value = status as LowboyContainerStatus;
  return <Badge className={cn('whitespace-nowrap', STATUS_CLASS[value])}>{CONTAINER_STATUS_LABEL[value]}</Badge>;
}

function SerialLabel({ container }: { container: LowboyContainerRow }) {
  return container.serial_number
    ? <span className="font-mono text-xs font-semibold sm:text-sm">{container.serial_number}</span>
    : <Badge className="bg-amber-500 text-white">Sin serie</Badge>;
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', tone)}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

type StatusFilter = 'all' | LowboyContainerStatus;

export function LowboyContainersPanel() {
  const isMobile = useIsMobile();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const { data: containers, isLoading } = useLowboyContainers();
  const manager = useLowboyContainersManager();
  const salesManager = useLowboySalesManager();
  const kpis = useLowboyContainerKpis(containers);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<LowboyContainerRow | null>(null);
  const [sellingContainer, setSellingContainer] = useState<LowboyContainerRow | null>(null);
  const [deletingContainer, setDeletingContainer] = useState<LowboyContainerRow | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const selectedContainer = containers?.find((container) => container.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (containers ?? []).filter((container) => {
      if (statusFilter !== 'all' && container.status !== statusFilter) return false;
      if (!term) return true;
      return `${container.serial_number ?? ''} ${container.supplier_name ?? ''} ${container.size} ${container.container_type}`.toLowerCase().includes(term);
    });
  }, [containers, search, statusFilter]);

  const openCreate = () => { setEditingContainer(null); setFormOpen(true); };
  const openEdit = (container: LowboyContainerRow) => { setEditingContainer(container); setFormOpen(true); };
  const openSale = (container: LowboyContainerRow) => { setSelectedId(null); setSellingContainer(container); };

  const saveContainer = async (values: LowboyContainerFormValues) => {
    if (editingContainer) await manager.updateContainer.mutateAsync({ id: editingContainer.id, values, preserveSoldStatus: editingContainer.status === 'vendido' });
    else await manager.createContainer.mutateAsync(values);
  };

  const createSale = async (values: LowboySaleFormValues, initialState?: LowboySaleInitialState, containerAssignments?: LowboyContainerSaleAssignment[], rcvRecordId?: string) => {
    if (!sellingContainer) return;
    await salesManager.createSale.mutateAsync({ values, initialState, containerAssignments, rcvRecordId });
    setSellingContainer(null);
  };

  const downloadPdf = async () => {
    if (filtered.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await generateLowboyContainersPdf({ containers: filtered, statusFilter, search });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Informe_Contenedores_LowBoy_${businessClock.today()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Informe de contenedores exportado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible exportar el informe.');
    } finally {
      setIsExporting(false);
    }
  };

  function Actions({ container }: { container: LowboyContainerRow }) {
    if (!isAdmin) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Acciones para ${container.serial_number || 'contenedor sin serie'}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSelectedId(container.id)}><Eye className="mr-2 size-4" />Ver ficha</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEdit(container)}><Pencil className="mr-2 size-4" />Editar</DropdownMenuItem>
          {container.status === 'disponible' && <DropdownMenuItem onClick={() => openSale(container)}><PackageCheck className="mr-2 size-4" />Vender</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingContainer(container)}><Trash2 className="mr-2 size-4" />Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Disponibles" value={String(kpis.availableCount)} detail={`${formatCLP(kpis.availableCapital)} invertidos`} tone="text-emerald-600" />
        <Kpi label="Reservados" value={String(kpis.reservedCount)} tone="text-amber-600" />
        <Kpi label="Vendidos del año" value={String(kpis.soldThisYearCount)} tone="text-sky-700" />
        <Kpi label="Margen del año" value={formatCLP(kpis.soldThisYearMargin)} tone={kpis.soldThisYearMargin >= 0 ? 'text-emerald-600' : 'text-destructive'} />
      </div>

      <section className="border-y bg-card">
        <div className="flex flex-col gap-3 px-0 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold"><Box className="size-4 text-teal-600" />Inventario seriado</h2>
            <p className="text-sm text-muted-foreground">Costo específico y margen por unidad</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void downloadPdf()} disabled={isLoading || filtered.length === 0 || isExporting}>
              {isExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
              Descargar PDF
            </Button>
            {isAdmin && <Button size="sm" onClick={openCreate}><Plus className="mr-2 size-4" />Nuevo contenedor</Button>}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'disponible', 'reservado', 'vendido'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn('rounded-md border px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === status ? 'border-teal-700 bg-teal-700 text-white' : 'bg-background text-muted-foreground hover:bg-muted')}
              >
                {status === 'all' ? 'Todos' : CONTAINER_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar serie o proveedor" className="pl-8" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center border-t"><Loader2 className="size-7 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="border-t p-8 text-center text-muted-foreground">No hay contenedores para este filtro.</p>
        ) : isMobile ? (
          <div className="space-y-2 border-t py-3">
            {filtered.map((container) => {
              const margin = containerMargin(container);
              return (
                <button key={container.id} type="button" onClick={() => setSelectedId(container.id)} className="block w-full rounded-md border bg-background p-3 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><SerialLabel container={container} /><p className="mt-1 text-sm text-muted-foreground">{CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL]} · {CONTAINER_TYPE_LABEL[container.container_type as keyof typeof CONTAINER_TYPE_LABEL]} · {CONTAINER_CONDITION_LABEL[container.condition as keyof typeof CONTAINER_CONDITION_LABEL]}</p></div>
                    <StatusBadge status={container.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Costo total</p><p className="font-semibold">{formatCLP(containerTotalCost(container))}</p></div>
                    {container.status === 'vendido' ? <div className="text-right"><p className="text-xs text-muted-foreground">Margen</p><p className={cn('font-semibold', margin >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatCLP(margin)}</p></div> : <div className="text-right"><p className="text-xs text-muted-foreground">Adicionales</p><p className="font-semibold">{formatCLP(containerAdditionalCost(container))}</p></div>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="border-t">
            <Table>
              <TableHeader><TableRow><TableHead>Serie</TableHead><TableHead>Unidad</TableHead><TableHead>Adquisición</TableHead><TableHead>Adicionales</TableHead><TableHead>Costo total</TableHead><TableHead>Estado</TableHead><TableHead>Venta / margen</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>{filtered.map((container) => {
                const margin = containerMargin(container);
                return <TableRow key={container.id} className="cursor-pointer" onDoubleClick={() => setSelectedId(container.id)}>
                  <TableCell><SerialLabel container={container} /></TableCell>
                  <TableCell><p className="font-medium">{CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL]} · {CONTAINER_TYPE_LABEL[container.container_type as keyof typeof CONTAINER_TYPE_LABEL]}</p><p className="text-xs text-muted-foreground">{CONTAINER_CONDITION_LABEL[container.condition as keyof typeof CONTAINER_CONDITION_LABEL]}</p></TableCell>
                  <TableCell>{formatCLP(container.acquisition_net_cost)}</TableCell>
                  <TableCell>{formatCLP(containerAdditionalCost(container))}</TableCell>
                  <TableCell className="font-semibold">{formatCLP(containerTotalCost(container))}</TableCell>
                  <TableCell><StatusBadge status={container.status} /></TableCell>
                  <TableCell>{container.status === 'vendido' ? <div><p>{formatCLP(Number(container.sale_net_price))}</p><p className={cn('text-xs font-semibold', margin >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatCLP(margin)} margen</p></div> : '—'}</TableCell>
                  <TableCell><div className="flex justify-end"><Actions container={container} /></div></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </div>
        )}
      </section>

      <LowboyContainerDetailSheet container={selectedContainer} open={Boolean(selectedContainer)} onOpenChange={(open) => { if (!open) setSelectedId(null); }} isAdmin={isAdmin} onEdit={openEdit} onSell={openSale} />
      <LowboyContainerForm open={formOpen} onOpenChange={setFormOpen} container={editingContainer} isPending={manager.createContainer.isPending || manager.updateContainer.isPending} onSubmit={saveContainer} />
      <LowboySaleForm
        open={Boolean(sellingContainer)}
        onOpenChange={(open) => { if (!open) setSellingContainer(null); }}
        sale={null}
        isPending={salesManager.createSale.isPending}
        onSubmit={createSale}
        initialContainerIds={sellingContainer ? [sellingContainer.id] : []}
        fixedSaleType="producto"
      />

      <AlertDialog open={Boolean(deletingContainer)} onOpenChange={(open) => { if (!open) setDeletingContainer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este contenedor?</AlertDialogTitle><AlertDialogDescription>Se eliminará la unidad {deletingContainer?.serial_number || 'sin serie'} y todas sus líneas de costo. La venta asociada no se elimina.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); if (!deletingContainer) return; void manager.deleteContainer.mutateAsync(deletingContainer.id).then(() => setDeletingContainer(null)); }}><Trash2 className="mr-2 size-4" />Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
