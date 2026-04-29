import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { toast } from 'sonner';

export interface VoidablePurchase {
  id: string;
  date: string;
  description: string;
  amount: number;
  supplier_id: string | null;
  supplier_name: string | null;
  document_number: string | null;
  service_folio: string | null;
  payment_date: string | null;
  immediate_consumption: boolean | null;
  inventory_movement_id: string | null;
  supplier_payment_id: string | null;
  supplier_invoice_id: string | null;
  purchase_quantity: number | null;
  purchase_unit_cost: number | null;
}

export interface PurchaseVoidImpact {
  cost: VoidablePurchase | null;
  movements: Array<{
    id: string;
    movement_type: string;
    quantity: number;
    unit_cost: number | null;
    item_id: string;
    item_name: string | null;
    location_id: string;
    location_name: string | null;
    crane_id: string | null;
  }>;
  payment: {
    id: string;
    amount: number;
    paid_date: string | null;
    reference_number: string | null;
    description: string;
  } | null;
  invoice: {
    id: string;
    invoice_number: string;
    issue_date: string;
    amount: number;
  } | null;
  currentStock: number | null;
  stockAfter: number | null;
}

export const useSearchVoidablePurchases = (search: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['voidable-purchases', search],
    enabled,
    queryFn: async (): Promise<VoidablePurchase[]> => {
      const term = (search || '').trim();

      // Estrategia: si hay término, buscamos por descripción/folio/nro doc/proveedor
      // SIN restringir a inventario en el servidor, y filtramos cliente para mostrar
      // solo costos vinculados a inventario o que sean compras (con purchase_quantity).
      let query = supabase
        .from('costs')
        .select(`
          id, date, description, amount, supplier_id, document_number, service_folio,
          payment_date, immediate_consumption, inventory_movement_id,
          supplier_payment_id, supplier_invoice_id,
          purchase_quantity, purchase_unit_cost,
          suppliers ( name )
        `)
        .order('date', { ascending: false })
        .limit(100);

      if (term.length > 0) {
        const t = `%${term}%`;
        query = query.or(
          `description.ilike.${t},document_number.ilike.${t},service_folio.ilike.${t},notes.ilike.${t}`
        );
      } else {
        query = query.or('inventory_movement_id.not.is.null,purchase_quantity.not.is.null');
      }

      const { data, error } = await query;
      if (error) throw error;

      const lowerTerm = term.toLowerCase();
      const filtered = (data || []).filter((row: any) => {
        const isInventoryCost =
          !!row.inventory_movement_id || row.purchase_quantity !== null;
        if (!term) return isInventoryCost;
        // En modo búsqueda: aceptar también match por nombre de proveedor
        const supplierMatch =
          row.suppliers?.name?.toLowerCase().includes(lowerTerm) ?? false;
        return isInventoryCost && (supplierMatch || true);
      });

      return filtered.map((row: any) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        amount: Number(row.amount),
        supplier_id: row.supplier_id,
        supplier_name: row.suppliers?.name || null,
        document_number: row.document_number,
        service_folio: row.service_folio,
        payment_date: row.payment_date,
        immediate_consumption: row.immediate_consumption,
        inventory_movement_id: row.inventory_movement_id,
        supplier_payment_id: row.supplier_payment_id,
        supplier_invoice_id: row.supplier_invoice_id,
        purchase_quantity: row.purchase_quantity,
        purchase_unit_cost: row.purchase_unit_cost,
      }));
    },
  });
};

export const usePurchaseVoidImpact = (cost: VoidablePurchase | null) => {
  return useQuery({
    queryKey: ['purchase-void-impact', cost?.id],
    enabled: !!cost?.id,
    queryFn: async (): Promise<PurchaseVoidImpact> => {
      if (!cost) throw new Error('Sin costo seleccionado');

      // Movimientos: por cost_id o por inventory_movement_id directo
      const { data: movs, error: movsError } = await supabase
        .from('inventory_movements')
        .select(`
          id, movement_type, quantity, unit_cost, item_id, location_id, crane_id,
          inventory_items ( name ),
          inventory_locations ( name )
        `)
        .or(
          cost.inventory_movement_id
            ? `cost_id.eq.${cost.id},id.eq.${cost.inventory_movement_id}`
            : `cost_id.eq.${cost.id}`
        );
      if (movsError) throw movsError;

      const movements = (movs || []).map((m: any) => ({
        id: m.id,
        movement_type: m.movement_type,
        quantity: m.quantity,
        unit_cost: m.unit_cost,
        item_id: m.item_id,
        item_name: m.inventory_items?.name || null,
        location_id: m.location_id,
        location_name: m.inventory_locations?.name || null,
        crane_id: m.crane_id,
      }));

      // Pago
      let payment: PurchaseVoidImpact['payment'] = null;
      if (cost.supplier_payment_id) {
        const { data: p } = await supabase
          .from('supplier_payments')
          .select('id, amount, paid_date, reference_number, description')
          .eq('id', cost.supplier_payment_id)
          .maybeSingle();
        if (p) payment = { ...p, amount: Number(p.amount) };
      }

      // Factura
      let invoice: PurchaseVoidImpact['invoice'] = null;
      if (cost.supplier_invoice_id) {
        const { data: inv } = await supabase
          .from('supplier_invoices')
          .select('id, invoice_number, issue_date, amount')
          .eq('id', cost.supplier_invoice_id)
          .maybeSingle();
        if (inv) invoice = { ...inv, amount: Number(inv.amount) };
      }

      // Stock actual y proyectado
      let currentStock: number | null = null;
      let stockAfter: number | null = null;
      const entry = movements.find((m) => m.movement_type === 'entry');
      if (entry) {
        const { data: stockRow } = await supabase
          .from('inventory_stock')
          .select('current_quantity')
          .eq('item_id', entry.item_id)
          .eq('location_id', entry.location_id)
          .maybeSingle();
        currentStock = stockRow?.current_quantity ?? 0;
        const exitsForCost = movements
          .filter((m) => m.movement_type === 'exit')
          .reduce((s, m) => s + m.quantity, 0);
        stockAfter = (currentStock || 0) - entry.quantity + exitsForCost;
      }

      return { cost, movements, payment, invoice, currentStock, stockAfter };
    },
  });
};

export const useVoidPurchase = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();

  return useMutation({
    mutationFn: async (params: {
      costId: string;
      reason: string;
      replacementSupplierId?: string | null;
      revertPayment: boolean;
      revertInvoice: boolean;
    }) => {
      const { data, error } = await supabase.rpc('void_inventory_purchase', {
        p_cost_id: params.costId,
        p_reason: params.reason,
        p_replacement_supplier_id: params.replacementSupplierId ?? null,
        p_revert_payment: params.revertPayment,
        p_revert_invoice: params.revertInvoice,
      });
      if (error) throw error;
      return data as {
        cost_deleted: boolean;
        movements_deleted: number;
        payment_reverted: boolean;
        invoice_reverted: boolean;
      };
    },
    onSuccess: (result) => {
      const parts = [
        result.cost_deleted ? '1 costo' : null,
        result.movements_deleted > 0 ? `${result.movements_deleted} movimientos` : null,
        result.payment_reverted ? '1 pago' : null,
        result.invoice_reverted ? '1 factura' : null,
      ].filter(Boolean);
      toast.success('Compra anulada', {
        description: `Revertidos: ${parts.join(', ')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['voidable-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-void-impact'] });
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error('No se pudo anular la compra', {
        description: err?.message || 'Error desconocido',
      });
    },
  });
};