import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { uploadManualPurchasePhoto } from '@/services/manualPurchase';
import { manualPurchaseItems, normalizePurchaseRut, validateManualPurchase, type ManualPurchaseDraft } from '@/utils/manualPurchase';
import type { EntityKey } from '@/lib/entities';

export interface ManualCostClassification {
  categoryId: string;
  costCenterId: string;
  craneId: string;
  entity: EntityKey;
  paidBy: EntityKey;
  subcategories: Record<string, string>;
  headerSubcategoryId: string;
  description: string;
  isPaid: boolean;
  paymentDate: string;
  paymentReference: string;
  supplierNameChoice?: 'document' | 'master';
}

export function buildManualCostPayload(draft: ManualPurchaseDraft, classification: ManualCostClassification) {
  const error = validateManualPurchase(draft, true);
  if (error) throw new Error(error);
  return {
    supplier_name: draft.supplierName.trim(), supplier_rut: normalizePurchaseRut(draft.supplierRut), folio: draft.folio.trim(),
    confirm_supplier_name: classification.supplierNameChoice === 'document',
    issue_date: draft.issueDate, due_date: draft.dueDate || draft.issueDate,
    net_amount: Number(draft.net), vat_amount: Number(draft.vat), total_amount: Number(draft.total),
    category_id: classification.categoryId, cost_center_id: classification.costCenterId || null,
    crane_id: classification.craneId || null, entity: classification.entity, paid_by: classification.paidBy,
    description: classification.description.trim(), header_subcategory_id: draft.lines.length ? null : classification.headerSubcategoryId || null,
    is_paid: classification.isPaid, payment_date: classification.isPaid ? classification.paymentDate : null,
    payment_reference: classification.isPaid ? classification.paymentReference.trim() || null : null,
    lines: manualPurchaseItems(draft).map((item, index) => ({
      product_code: item.product_code, description: item.description, quantity: item.quantity, unit_price: item.unit_price,
      subtotal: item.subtotal, tax_rate: item.tax_rate, tax_amount: item.tax_amount, total_amount: item.total,
      cost_subcategory_id: classification.subcategories[draft.lines[index].id] || null,
    })),
  };
}

export async function registerManualCost(requestId: string, payload: ReturnType<typeof buildManualCostPayload>, photo: File | null) {
  const receiptPath = await uploadManualPurchasePhoto(requestId, photo);
  const { data, error } = await supabase.rpc('register_manual_cost_purchase', {
    p_request_id: requestId, p_data: payload as unknown as Json, p_receipt_path: receiptPath,
  });
  if (error) throw new Error(error.message);
  return data;
}
