
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleExitForm } from '@/components/inventory/SimpleExitForm';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, DollarSign, Package, PackageMinus, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Crane } from '@/types';

interface CranePartsProps {
  crane: Crane;
}

export const CraneParts = ({ crane }: CranePartsProps) => {
  const [isExitOpen, setIsExitOpen] = useState(false);
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
        .order('movement_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!crane.id,
  });

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
    return Math.round((movement.unit_cost || 0) * 1.19);
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
    return Math.round((movement.total_cost || (movement.unit_cost || 0) * (movement.quantity || 0)) * 1.19);
  };

  const totalConsumed = consumptions.reduce((sum: number, m: any) => sum + getDisplayTotalCost(m), 0);
  const lastDate = consumptions[0]?.movement_date ? new Date(consumptions[0].movement_date) : null;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = consumptions.filter((m: any) => m.movement_date && new Date(m.movement_date) >= thirtyDaysAgo).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <PackageMinus className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Consumos</p>
                <p className="text-2xl font-bold text-foreground">{consumptions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Consumido</p>
                <p className="text-2xl font-bold text-red-400">-${totalConsumed.toLocaleString('es-CL')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Último Consumo</p>
                <p className="text-2xl font-bold text-foreground">{lastDate ? format(lastDate, 'dd/MM', { locale: es }) : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Últimos 30 días</p>
                <p className="text-2xl font-bold text-foreground">{recentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Consumos de Inventario</h3>
          <p className="text-gray-400">Registro de consumos para la grúa {crane.licensePlate}</p>
        </div>
        <Button
          onClick={() => setIsExitOpen(true)}
          className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Registrar Consumo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400">Cargando consumos...</div>
        </div>
      ) : consumptions.length === 0 ? (
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay registros</h3>
            <p className="text-gray-400 text-center mb-6">
              Comienza registrando el primer consumo de inventario para esta grúa.
            </p>
            <Button
              onClick={() => setIsExitOpen(true)}
              className="bg-tms-green hover:bg-tms-green/80 text-black font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Primer Consumo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {consumptions.map((m: any) => (
            <Card key={m.id} className="bg-white/5 border-tms-green/30 hover:bg-white/10 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white">{(m.inventory_items as any)?.name || 'Producto'}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm font-medium text-red-400">
                            -{m.quantity} {(m.inventory_items as any)?.unit_of_measure || 'unidad'}
                          </span>
                          <span className="text-sm text-gray-400">
                            Unitario: ${getDisplayUnitCost(m).toLocaleString('es-CL')}
                          </span>
                          <span className="text-sm font-medium text-red-400">
                            -{getDisplayTotalCost(m).toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{m.movement_date ? format(new Date(m.movement_date), 'dd MMM yyyy', { locale: es }) : '-'}</span>
                      </div>
                    </div>
                    {m.reason && (
                      <p className="text-sm text-gray-400 bg-white/5 p-3 rounded-md">
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
    </div>
  );
};
