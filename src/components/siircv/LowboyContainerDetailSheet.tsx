import { useMemo, useState } from 'react';
import { ExternalLink, FileText, MoreHorizontal, PackageCheck, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { LowboyContainerCostDialog } from '@/components/siircv/LowboyContainerCostDialog';
import { LowboyLinkedDetailDialog } from '@/components/siircv/LowboyLinkedDetailDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLowboyContainersManager } from '@/hooks/siircv/useLowboyContainers';
import { cn } from '@/lib/utils';
import type { SiiRcvRecordRow } from '@/types/siiRcv';
import type { LowboyContainerCostFormValues, LowboyContainerCostRow, LowboyContainerRow } from '@/types/lowboyContainers';
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_SIZE_LABEL,
  CONTAINER_STATUS_LABEL,
  CONTAINER_TYPE_LABEL,
  containerAdditionalCost,
  containerMargin,
  containerTotalCost,
} from '@/types/lowboyContainers';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const STATUS_CLASS = {
  disponible: 'bg-emerald-600 text-white',
  reservado: 'bg-amber-500 text-white',
  vendido: 'bg-sky-700 text-white',
} as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium">{value || '—'}</dd></div>;
}

interface LowboyContainerDetailSheetProps {
  container: LowboyContainerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onEdit: (container: LowboyContainerRow) => void;
  onSell: (container: LowboyContainerRow) => void;
}

export function LowboyContainerDetailSheet({ container, open, onOpenChange, isAdmin, onEdit, onSell }: LowboyContainerDetailSheetProps) {
  const manager = useLowboyContainersManager();
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<LowboyContainerCostRow | null>(null);
  const [deletingCost, setDeletingCost] = useState<LowboyContainerCostRow | null>(null);
  const [rcvDetailOpen, setRcvDetailOpen] = useState(false);

  const rcvRecord = useMemo<SiiRcvRecordRow | null>(() => container?.purchase_rcv ? {
    ...container.purchase_rcv,
    linked_cost: null,
    linked_service: null,
  } : null, [container]);

  if (!container) return null;

  const additional = containerAdditionalCost(container);
  const total = containerTotalCost(container);
  const margin = containerMargin(container);
  const status = container.status as keyof typeof STATUS_CLASS;

  const saveCost = async (values: LowboyContainerCostFormValues) => {
    await manager.saveCost.mutateAsync({ containerId: container.id, costId: editingCost?.id, values });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full px-4 sm:max-w-2xl sm:px-6">
          <SheetHeader className="pr-8 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="font-mono text-base sm:text-lg">{container.serial_number || 'CONTENEDOR SIN SERIE'}</SheetTitle>
              {!container.serial_number && <Badge className="bg-amber-500 text-white">Sin serie</Badge>}
              <Badge className={STATUS_CLASS[status]}>{CONTAINER_STATUS_LABEL[status]}</Badge>
            </div>
            <SheetDescription>{CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL]} · {CONTAINER_TYPE_LABEL[container.container_type as keyof typeof CONTAINER_TYPE_LABEL]}</SheetDescription>
          </SheetHeader>

          {isAdmin && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(container)}><Pencil className="mr-2 size-4" />Editar</Button>
              {container.status !== 'vendido' && <Button size="sm" onClick={() => onSell(container)}><PackageCheck className="mr-2 size-4" />Vender</Button>}
              {container.status !== 'vendido' && (
                <Button size="sm" variant="outline" onClick={() => manager.setReservation.mutate({ id: container.id, reserved: container.status !== 'reservado' })}>
                  {container.status === 'reservado' ? 'Liberar reserva' : 'Reservar'}
                </Button>
              )}
            </div>
          )}

          <section className="mt-6">
            <h3 className="text-sm font-semibold">Datos generales</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 rounded-md border bg-muted/20 p-4">
              <Field label="Tamaño" value={CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL]} />
              <Field label="Tipo" value={CONTAINER_TYPE_LABEL[container.container_type as keyof typeof CONTAINER_TYPE_LABEL]} />
              <Field label="Condición" value={CONTAINER_CONDITION_LABEL[container.condition as keyof typeof CONTAINER_CONDITION_LABEL]} />
              <Field label="Adquisición" value={container.acquisition_date} />
              <Field label="Proveedor" value={container.supplier_name} />
              <Field label="RUT proveedor" value={<span className="font-mono">{container.supplier_rut || '—'}</span>} />
            </dl>
            {container.notes && <p className="mt-3 text-sm text-muted-foreground">{container.notes}</p>}
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Costo unitario neto</h3>
                <p className="text-xs text-muted-foreground">Adquisición más costos adicionales</p>
              </div>
              {isAdmin && <Button size="sm" variant="outline" onClick={() => { setEditingCost(null); setCostDialogOpen(true); }}><Plus className="mr-2 size-4" />Agregar costo</Button>}
            </div>

            <div className="mt-3 divide-y rounded-md border">
              <div className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>Adquisición</span><span className="font-semibold">{formatCLP(container.acquisition_net_cost)}</span>
              </div>
              {container.costs.map((cost) => (
                <div key={cost.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cost.concept}</p>
                    <p className="text-xs text-muted-foreground">{cost.cost_date}{cost.notes ? ` · ${cost.notes}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold">{formatCLP(cost.net_amount)}</span>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingCost(cost); setCostDialogOpen(true); }}><Pencil className="mr-2 size-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingCost(cost)}><Trash2 className="mr-2 size-4" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 bg-muted/25 p-3 text-sm">
                <div><span className="text-muted-foreground">Adicionales</span><p className="font-semibold">{formatCLP(additional)}</p></div>
                <div className="text-right"><span className="text-muted-foreground">Costo total</span><p className="text-base font-bold">{formatCLP(total)}</p></div>
              </div>
            </div>
          </section>

          {container.status === 'vendido' && (
            <section className="mt-6 rounded-md border border-sky-700/25 bg-sky-700/5 p-4">
              <h3 className="text-sm font-semibold">Venta asociada</h3>
              <p className="mt-1 text-sm">{container.sale?.client_name} · {container.sale?.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Field label="Precio neto" value={formatCLP(Number(container.sale_net_price))} />
                <Field label="Margen neto" value={<span className={cn(margin >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatCLP(margin)}</span>} />
              </div>
            </section>
          )}

          {container.purchase_rcv && (
            <section className="mt-6 pb-8">
              <Separator className="mb-5" />
              <div className="flex items-start gap-3">
                <ReceiptText className="mt-0.5 size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Factura de compra RCV</p>
                  <p className="text-sm text-muted-foreground">Folio {container.purchase_rcv.folio} · {container.purchase_rcv.doc_date} · {formatCLP(container.purchase_rcv.net_amount)} neto</p>
                </div>
                {container.purchase_rcv.linked_cost_id && (
                  <Button variant="ghost" size="icon" title="Ver vínculo RCV" onClick={() => setRcvDetailOpen(true)}><ExternalLink className="size-4" /></Button>
                )}
                {!container.purchase_rcv.linked_cost_id && <FileText className="size-4 text-muted-foreground" />}
              </div>
            </section>
          )}
        </SheetContent>
      </Sheet>

      <LowboyContainerCostDialog
        open={costDialogOpen}
        onOpenChange={setCostDialogOpen}
        cost={editingCost}
        isPending={manager.saveCost.isPending}
        onSubmit={saveCost}
      />

      <AlertDialog open={Boolean(deletingCost)} onOpenChange={(nextOpen) => { if (!nextOpen) setDeletingCost(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este costo?</AlertDialogTitle><AlertDialogDescription>Se quitará {deletingCost?.concept} del costo unitario del contenedor.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); if (!deletingCost) return; void manager.deleteCost.mutateAsync(deletingCost).then(() => setDeletingCost(null)); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LowboyLinkedDetailDialog open={rcvDetailOpen} onOpenChange={setRcvDetailOpen} record={rcvRecord} onChangeLink={() => undefined} />
    </>
  );
}
