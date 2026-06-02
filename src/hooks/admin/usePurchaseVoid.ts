import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePurchaseVoid");
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
  matched_item: string | null;
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
      const { data, error } = await supabase.rpc(
        'search_voidable_inventory_purchases',
        { p_search: term || null }
      );
      if (error) {
        logger.error('[PurchaseVoid] search rpc error:', error);
        throw error;
      }
      logger.debug('[PurchaseVoid] term:', term, 'rows:', data?.length || 0);
      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        amount: Number(row.amount),
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        document_number: row.document_number,
        service_folio: row.service_folio,
        payment_date: row.payment_date,
        immediate_consumption: row.immediate_consumption,
        inventory_movement_id: row.inventory_movement_id,
        supplier_payment_id: row.supplier_payment_id,
        supplier_invoice_id: row.supplier_invoice_id,
        purchase_quantity: row.purchase_quantity,
        purchase_unit_cost: row.purchase_unit_cost,
        matched_item: row.matched_item ?? null,
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
      const { data, error } = await supabase.rpc('get_purchase_void_impact', {
        p_cost_id: cost.id,
      });
      if (error) {
        logger.error('[PurchaseVoid] impact rpc error:', error);
        throw error;
      }
      const impact = (data || {}) as any;
      const movements = (impact.movements || []).map((m: any) => ({
        id: m.id,
        movement_type: m.movement_type,
        quantity: Number(m.quantity),
        unit_cost: m.unit_cost !== null ? Number(m.unit_cost) : null,
        item_id: m.item_id,
        item_name: m.item_name,
        location_id: m.location_id,
        location_name: m.location_name,
        crane_id: m.crane_id,
      }));
      return {
        cost,
        movements,
        payment: impact.payment
          ? { ...impact.payment, amount: Number(impact.payment.amount) }
          : null,
        invoice: impact.invoice
          ? { ...impact.invoice, amount: Number(impact.invoice.amount) }
          : null,
        currentStock:
          impact.currentStock !== null && impact.currentStock !== undefined
            ? Number(impact.currentStock)
            : null,
        stockAfter:
          impact.stockAfter !== null && impact.stockAfter !== undefined
            ? Number(impact.stockAfter)
            : null,
      };
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