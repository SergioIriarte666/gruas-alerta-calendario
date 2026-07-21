
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleExitForm } from '@/components/inventory/SimpleExitForm';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, DollarSign, Package, PackageMinus, Plus, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Crane } from '@/types';
import { MetricCard } from '@/components/ui/metric-card';
import { SectionCard } from '@/components/ui/section-card';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import {
  useCranePartChangeHistory,
  useInventoryMovementChangeHistory,
} from '@/hooks/useChangeHistory';
import { cn } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';
import { isCranePermanentlyLocked } from '@/utils/craneStatus';

interface CranePartsProps {
  crane: Crane;
}

export const CraneParts = ({ crane }: CranePartsProps) => {
  const isLocked = isCranePermanentlyLocked(crane);
  const [isExitOpen, setIsExitOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ movementId: string; cranePartId: string | null; itemName: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'month' | '3months'>('all');
  const queryClient = useQueryClient();

  const getFirstRelationRow = (value: any) => {
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  };

  const { data: consumptions = [], isLoading } = useQuery({
    queryKey: ['crane-consumptions', crane.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(
          `
          id,
          item_id,
          movement_date,
          quantity,
          unit_cost,
          total_cost,
          reason,
          observations,
          reference_document,
          crane_part:crane_parts!crane_parts_inventory_movement_id_fkey (
            id,
            unit_price,
            total_value
          ),
          supplier_invoice_item:supplier_invoice_items!inventory_movements_supplier_invoice_item_id_fkey (
            quantity,
            unit_price,
            subtotal,
            tax_amount,
            total_amount
          ),
          supplier_invoice:supplier_invoices!inventory_movements_supplier_invoice_id_fkey (
            items:supplier_invoice_items (
              inventory_item_id,
              quantity,
              unit_price,
              total_amount
            )
          ),
          inventory_items (
            name,
            unit_of_measure
          )
        `
        )
        .eq('crane_id', crane.id)
        .eq('movement_type', 'exit')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!crane.id,
  });

  const formatInt = (n: number) => Math.round(n).toLocaleString('es-CL', { maximumFractionDigits: 0 });

  const getDisplayUnitCost = (movement: any) => {
    const invoiceItem = getFirstRelationRow(movement.supplier_invoice_item);
    if (invoiceItem?.total_amount && invoiceItem?.quantity) {
      return Number(invoiceItem.total_amount) / Math.max(Number(invoiceItem.quantity), 1);
    }
    const invoice = getFirstRelationRow(movement.supplier_invoice);
    const fallbackInvoiceItem = Array.isArray(invoice?.items)
      ? invoice.items.find((item: any) =>
          item.inventory_item_id === movement.item_id &&
          Number(item.quantity || 0) === Number(movement.quantity || 0)
        ) || invoice.items.find((item: any) => item.inventory_item_id === movement.item_id) || invoice.items[0]
      : null;
    if (fallbackInvoiceItem?.total_amount && fallbackInvoiceItem?.quantity) {
      return Number(fallbackInvoiceItem.total_amount) / Math.max(Number(fallbackInvoiceItem.quantity), 1);
    }
    const cranePart = getFirstRelationRow(movement.crane_part);
    if (cranePart?.unit_price) {
      return Number(cranePart.unit_price);
    }
    return movement.unit_cost || 0;
  };

  const getDisplayTotalCost = (movement: any) => {
    const invoiceItem = getFirstRelationRow(movement.supplier_invoice_item);
    if (invoiceItem?.total_amount) {
      return Number(invoiceItem.total_amount);
    }
    const invoice = getFirstRelationRow(movement.supplier_invoice);
    const fallbackInvoiceItem = Array.isArray(invoice?.items)
      ? invoice.items.find((item: any) =>
          item.inventory_item_id === movement.item_id &&
          Number(item.quantity || 0) === Number(movement.quantity || 0)
        ) || invoice.items.find((item: any) => item.inventory_item_id === movement.item_id) || invoice.items[0]
      : null;
    if (fallbackInvoiceItem?.total_amount) {
      return Number(fallbackInvoiceItem.total_amount);
    }
    const cranePart = getFirstRelationRow(movement.crane_part);
    if (cranePart?.total_value) {
      return Number(cranePart.total_value);
    }
    return movement.total_cost || (movement.unit_cost || 0) * (movement.quantity || 0);
  };

  const totalConsumed = consumptions.reduce((sum: number, m: any) => sum + getDisplayTotalCost(m), 0);
  const lastDate = consumptions[0]?.movement_date ? new Date(consumptions[0].movement_date) : null;
  const thirtyDaysAgo = businessClock.todayDate();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = consumptions.filter((m: any) => m.movement_date && new Date(m.movement_date) >= thirtyDaysAgo).length;

  const filteredConsumptions = consumptions.filter((m: any) => {
    if (activeFilter === 'all') return true;
    if (!m.movement_date) return false;
    const date = new Date(m.movement_date);
    const now = businessClock.todayDate();
    if (activeFilter === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (activeFilter === '3months') {
      const threeMonthsAgo = businessClock.todayDate();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return date >= threeMonthsAgo;
    }
    return true;
  });

  const groupedByMonth = filteredConsumptions.reduce((acc: Record<string, any[]>, m: any) => {
    const key = m.movement_date
      ? format(new Date(m.movement_date), 'MMMM yyyy', { locale: es })
      : 'Sin fecha';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const monthGroups = Object.entries(groupedByMonth);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Total Consumos" value={consumptions.length} icon={PackageMinus} tone="primary" />
        <MetricCard title="Total Consumido" value={`-$${formatInt(totalConsumed)}`} icon={DollarSign} tone="danger" />
        <MetricCard title="Último Consumo" value={lastDate ? format(lastDate, 'dd/MM', { locale: es }) : '-'} icon={Calendar} tone="info" />
        <MetricCard title="Últimos 30 días" value={recentCount} icon={Clock} tone="warning" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Cargando consumos...
        </div>
      ) : consumptions.length === 0 ? (
        <SectionCard className="border-border" contentClassName="py-12">
          <div className="flex flex-col items-center justify-center">
            <Package className="mb-4 size-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No hay registros</h3>
            <p className="mb-6 text-center text-muted-foreground">
              Comienza registrando el primer consumo de inventario para esta grúa.
            </p>
            <Button onClick={() => setIsExitOpen(true)} disabled={isLocked}>
              <Plus className="size-4 mr-2" />
              Registrar Primer Consumo
            </Button>
          </div>
        </SectionCard>
      ) : (
        <>
          {/* Controles: filtros + botón */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(['all', 'month', '3months'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    activeFilter === f
                      ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground'
                  )}
                >
                  {f === 'all' ? 'Todo' : f === 'month' ? 'Este mes' : '3 meses'}
                </button>
              ))}
            </div>
            <Button onClick={() => setIsExitOpen(true)} size="sm" disabled={isLocked}>
              <Plus className="size-4 mr-1.5" />
              Registrar Consumo
            </Button>
          </div>

          {/* Timeline */}
          {filteredConsumptions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay consumos para el período seleccionado.
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Línea vertical del timeline */}
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

              {monthGroups.map(([month, items]) => {
                const monthTotal = items.reduce((sum: number, m: any) => sum + getDisplayTotalCost(m), 0);
                const monthCount = items.length;

                return (
                  <div key={month} className="mb-6">
                    {/* Separador de mes */}
                    <div className="relative mb-3 flex items-center gap-3">
                      <div className="absolute -left-6 flex size-3.5 items-center justify-center rounded-full border-2 border-border bg-background" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {month}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {monthCount} consumo{monthCount !== 1 ? 's' : ''}
                      </span>
                      <span className="ml-auto text-xs font-medium text-danger">
                        -${formatInt(monthTotal)}
                      </span>
                    </div>

                    {/* Items del mes */}
                    <div className="space-y-1.5">
                      {items.map((m: any) => {
                        const itemName = (m.inventory_items as any)?.name || 'Producto';
                        const unitMeasure = (m.inventory_items as any)?.unit_of_measure || 'unidad';
                        const unitCost = getDisplayUnitCost(m);
                        const totalCost = getDisplayTotalCost(m);
                        const cranePart = getFirstRelationRow(m.crane_part);

                        return (
                          <div
                            key={m.id}
                            onClick={() => setHistoryTarget({
                              movementId: m.id,
                              cranePartId: cranePart?.id || null,
                              itemName,
                            })}
                            className="group relative flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:border-primary/30 hover:shadow-sm"
                          >
                            {/* Dot del timeline */}
                            <div className="absolute -left-[1.35rem] size-2 rounded-full bg-primary/60 ring-2 ring-background" />

                            {/* Ícono */}
                            <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                              <Package className="size-3.5 text-primary" />
                            </div>

                            {/* Nombre y fecha */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{itemName}</p>
                              <p className="text-xs text-muted-foreground">
                                {m.movement_date
                                  ? format(new Date(m.movement_date), 'dd MMM yyyy', { locale: es })
                                  : '-'}
                                {m.reason ? ` · ${m.reason}` : ''}
                              </p>
                            </div>

                            {/* Cantidad */}
                            <span className="flex-shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                              -{m.quantity} {unitMeasure}
                            </span>

                            {/* Precios */}
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs font-semibold text-danger">-${formatInt(totalCost)}</p>
                              <p className="text-xs text-muted-foreground">${formatInt(unitCost)} c/u</p>
                            </div>

                            {/* Botón historial (hover) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryTarget({
                                  movementId: m.id,
                                  cranePartId: cranePart?.id || null,
                                  itemName,
                                });
                              }}
                              className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                              title="Ver historial"
                            >
                              <History className="size-3.5 text-muted-foreground hover:text-primary" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={!isLocked && isExitOpen} onOpenChange={setIsExitOpen}>
        <DialogContent className="resources-dialog max-h-[90vh] max-w-3xl w-[95vw] border-border/70 bg-card overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Consumo - {crane.licensePlate}</DialogTitle>
          </DialogHeader>
          <SimpleExitForm
            defaultCraneId={crane.id}
            onSuccess={() => {
              setIsExitOpen(false);
              queryClient.invalidateQueries({ queryKey: ['crane-consumptions', crane.id] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal historial de cambios */}
      <PartHistoryModal target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
};

interface PartHistoryModalProps {
  target: { movementId: string; cranePartId: string | null; itemName: string } | null;
  onClose: () => void;
}

const PartHistoryModal = ({ target, onClose }: PartHistoryModalProps) => {
  const { data: movementHistory, isLoading: loadingMovement } = useInventoryMovementChangeHistory(target?.movementId ?? null);
  const { data: partHistory, isLoading: loadingPart } = useCranePartChangeHistory(target?.cranePartId ?? null);

  const combined = [
    ...(movementHistory || []),
    ...(partHistory || []),
  ].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="resources-dialog max-h-[85vh] max-w-3xl w-[95vw] border-border/70 bg-card overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            Historial de cambios
            {target && <span className="text-sm font-normal text-muted-foreground">— {target.itemName}</span>}
          </DialogTitle>
        </DialogHeader>
        <ChangeHistoryPanel changes={combined} isLoading={loadingMovement || loadingPart} />
      </DialogContent>
    </Dialog>
  );
};
