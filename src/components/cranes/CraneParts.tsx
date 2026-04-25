
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { StatusBadge } from '@/components/ui/status-badge';
import { ChangeHistoryPanel } from '@/components/shared/ChangeHistoryPanel';
import {
  useCranePartChangeHistory,
  useInventoryMovementChangeHistory,
} from '@/hooks/useChangeHistory';

interface CranePartsProps {
  crane: Crane;
}

export const CraneParts = ({ crane }: CranePartsProps) => {
  const [isExitOpen, setIsExitOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ movementId: string; cranePartId: string | null; itemName: string } | null>(null);
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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = consumptions.filter((m: any) => m.movement_date && new Date(m.movement_date) >= thirtyDaysAgo).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Total Consumos" value={consumptions.length} icon={PackageMinus} tone="primary" />
        <MetricCard title="Total Consumido" value={`-$${formatInt(totalConsumed)}`} icon={DollarSign} tone="danger" />
        <MetricCard title="Último Consumo" value={lastDate ? format(lastDate, 'dd/MM', { locale: es }) : '-'} icon={Calendar} tone="info" />
        <MetricCard title="Últimos 30 días" value={recentCount} icon={Clock} tone="warning" />
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Consumos de Inventario</h3>
          <p className="text-muted-foreground">Registro de consumos para la grúa {crane.licensePlate}</p>
        </div>
        <Button onClick={() => setIsExitOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Consumo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Cargando consumos...</div>
        </div>
      ) : consumptions.length === 0 ? (
        <SectionCard className="border-border" contentClassName="py-12">
          <div className="flex flex-col items-center justify-center">
            <Package className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No hay registros</h3>
            <p className="mb-6 text-center text-muted-foreground">
              Comienza registrando el primer consumo de inventario para esta grúa.
            </p>
            <Button onClick={() => setIsExitOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Primer Consumo
            </Button>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {consumptions.map((m: any) => (
            <Card key={m.id} className="border-border bg-card hover:border-violet-500/40 hover:shadow-md transition-all cursor-pointer group" onClick={() => setHistoryTarget({ movementId: m.id, cranePartId: getFirstRelationRow(m.crane_part)?.id || null, itemName: (m.inventory_items as any)?.name || 'Producto' })}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-foreground">{(m.inventory_items as any)?.name || 'Producto'}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <StatusBadge tone="overdue">
                            -{m.quantity} {(m.inventory_items as any)?.unit_of_measure || 'unidad'}
                          </StatusBadge>
                          <span className="text-sm text-muted-foreground">
                            Unitario: ${formatInt(getDisplayUnitCost(m))}
                          </span>
                          <span className="text-sm font-medium text-danger">
                            -{formatInt(getDisplayTotalCost(m))}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setHistoryTarget({ movementId: m.id, cranePartId: getFirstRelationRow(m.crane_part)?.id || null, itemName: (m.inventory_items as any)?.name || 'Producto' }); }}>
                        <History className="w-4 h-4 mr-1" />
                        Historial
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{m.movement_date ? format(new Date(m.movement_date), 'dd MMM yyyy', { locale: es }) : '-'}</span>
                      </div>
                    </div>
                    {m.reason && (
                      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                        {m.reason}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={isExitOpen} onOpenChange={setIsExitOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-violet-600" />
            Historial de cambios
            {target && <span className="text-sm font-normal text-muted-foreground">— {target.itemName}</span>}
          </DialogTitle>
        </DialogHeader>
        <ChangeHistoryPanel changes={combined} isLoading={loadingMovement || loadingPart} />
      </DialogContent>
    </Dialog>
  );
};
