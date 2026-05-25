import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, CreditCard, Package, Wrench, ArrowRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CostTraceabilityPanelProps {
  costId: string;
}

export const CostTraceabilityPanel: React.FC<CostTraceabilityPanelProps> = ({ costId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['cost-traceability', costId],
    queryFn: async () => {
      // Fetch cost with related records
      const { data: cost, error } = await supabase
        .from('costs')
        .select(`
          id, amount, description, date, supplier_id, supplier_payment_id, supplier_invoice_id, inventory_movement_id,
          crane_parts(id, part_name, quantity, unit_price, crane_id, cranes(license_plate))
        `)
        .eq('id', costId)
        .single();

      if (error) throw error;

      // Fetch linked payment
      let payment = null;
      if (cost.supplier_payment_id) {
        const { data: p } = await supabase
          .from('supplier_payments')
          .select('id, amount, status, due_date, paid_date')
          .eq('id', cost.supplier_payment_id)
          .single();
        payment = p;
      }

      // Fetch linked inventory movement(s)
      let movement = null;
      let invoiceMovements: any[] = [];
      if (cost.inventory_movement_id) {
        const { data: m } = await supabase
          .from('inventory_movements')
          .select('id, movement_type, quantity, unit_cost, inventory_items(name)')
          .eq('id', cost.inventory_movement_id)
          .single();
        movement = m;
      }

      if (cost.supplier_invoice_id) {
        const { data: movements } = await supabase
          .from('inventory_movements')
          .select('id, movement_type, quantity, unit_cost, inventory_items(name)')
          .eq('supplier_invoice_id', cost.supplier_invoice_id)
          .eq('status', 'active');
        invoiceMovements = movements || [];
      }

      // Fetch supplier name
      let supplierName = null;
      if (cost.supplier_id) {
        const { data: s } = await (supabase as any)
          .from('inventory_suppliers')
          .select('name')
          .eq('id', cost.supplier_id)
          .single();
        supplierName = s?.name;
      }

      return { cost, payment, movement, invoiceMovements, supplierName };
    },
    enabled: !!costId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando trazabilidad...</span>
      </div>
    );
  }

  if (!data) return null;

  const { cost, payment, movement, invoiceMovements, supplierName } = data;
  const parts = (cost as any).crane_parts || [];
  const hasLinks = payment || movement || invoiceMovements.length > 0 || parts.length > 0;

  if (!hasLinks) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Este costo no tiene registros vinculados en otros módulos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ArrowRight className="size-4 text-primary" />
        Cadena de Trazabilidad
      </h4>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Cost node */}
        <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
          <DollarSign className="size-3" />
          Costo: {formatCurrency(Number(cost.amount))}
        </Badge>

        {/* Payment link */}
        {payment && (
          <>
            <ArrowRight className="size-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1 border-violet-500/30 text-violet-600">
              <CreditCard className="size-3" />
              Pago: {payment.status === 'paid' ? 'Pagado' : 'Pendiente'}
              {payment.paid_date && ` (${format(new Date(payment.paid_date), 'dd/MM', { locale: es })})`}
            </Badge>
          </>
        )}

        {/* Inventory link */}
        {movement && (
          <>
            <ArrowRight className="size-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-600">
              <Package className="size-3" />
              Inventario: {(movement as any).inventory_items?.name || 'Item'} ({(movement as any).quantity} uds)
            </Badge>
          </>
        )}

        {!movement && invoiceMovements.length > 0 && (
          <>
            <ArrowRight className="size-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-600">
              <Package className="size-3" />
              Inventario: {invoiceMovements.length} movimiento(s) de factura
            </Badge>
          </>
        )}

        {/* Crane parts link */}
        {parts.length > 0 && (
          <>
            <ArrowRight className="size-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1 border-green-500/30 text-green-600">
              <Wrench className="size-3" />
              Pieza: {parts[0].part_name}
              {parts[0].cranes && ` → ${parts[0].cranes.license_plate}`}
            </Badge>
          </>
        )}
      </div>

      {supplierName && (
        <p className="text-xs text-muted-foreground">
          Proveedor: <span className="font-medium text-foreground">{supplierName}</span>
        </p>
      )}
    </div>
  );
};
