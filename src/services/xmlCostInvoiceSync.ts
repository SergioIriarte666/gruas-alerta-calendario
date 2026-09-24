import { supabase } from '@/integrations/supabase/client';
import { XMLDocumentItem } from '@/types/suppliers';

/**
 * Persistencia del Detalle del DTE para costos importados desde XML.
 *
 * Las líneas se guardan como filas documentales en supplier_invoice_items con
 * inventory_item_id NULL: reflejan la factura tal cual, sin crear ítems de
 * inventario (a diferencia del flujo manual por costo, que sí los resuelve).
 * Bodega solo se toca vía el toggle "Sincronizar con Bodega" del diálogo.
 */

const normalizeQuantity = (quantity: number | undefined) => {
  const normalized = Number(quantity || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return 1;
  return Math.max(1, Math.round(normalized));
};

export const buildDocumentalInvoiceItemRows = (
  invoiceId: string,
  items: XMLDocumentItem[],
  userId: string | null
) =>
  items.map((item, index) => {
    const quantity = normalizeQuantity(item.quantity);
    return {
      supplier_invoice_id: invoiceId,
      inventory_item_id: null,
      line_number: index + 1,
      product_code: item.product_code || null,
      product_name: item.product_name || item.description,
      description: item.description,
      quantity,
      unit_price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal ?? Number(item.unit_price || 0) * quantity),
      tax_rate: item.tax_rate ?? null,
      tax_amount: Number(item.tax_amount || 0),
      total_amount: Number(item.total || 0),
      movement_id: null,
      created_by: userId,
    };
  });

// product_service_description tiene CHECK de largo 10..500 en la base; bajo el
// mínimo se omite el campo (NULL pasa el CHECK).
export const buildProductServiceDescription = (
  items: XMLDocumentItem[],
  fallback: string
): string | null => {
  const text = (
    items.map((item, index) => `${index + 1}. ${item.description}`).join(' | ') || fallback
  ).trim();
  if (text.length < 10) return null;
  return text.slice(0, 500);
};

export interface CreateInvoiceForImportedCostParams {
  costId: string;
  supplierId: string;
  folio: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  netAmount: number;
  taxAmount: number;
  description: string;
  currency?: string;
  isPaid: boolean;
  xmlFileName: string | null;
  items: XMLDocumentItem[];
  userId: string | null;
}

/**
 * Crea (o reutiliza) la supplier_invoice del documento y la vincula al costo.
 * Si la factura ya existía (p.ej. importada desde Proveedores) no se pisa su
 * cabecera; solo se le agrega el detalle cuando aún no tiene líneas.
 */
export const createSupplierInvoiceForImportedCost = async (
  params: CreateInvoiceForImportedCostParams
): Promise<string> => {
  const { data: existing, error: existingError } = await supabase
    .from('supplier_invoices')
    .select('id, supplier_invoice_items(id)')
    .eq('supplier_id', params.supplierId)
    .eq('invoice_number', params.folio)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  let invoiceId = existing?.id ?? null;
  let invoiceHasItems = ((existing as any)?.supplier_invoice_items || []).length > 0;

  if (!invoiceId) {
    const { data: created, error: insertError } = await supabase
      .from('supplier_invoices')
      .insert([
        {
          supplier_id: params.supplierId,
          invoice_number: params.folio,
          issue_date: params.issueDate,
          due_date: params.dueDate,
          amount: params.amount,
          net_amount: params.netAmount,
          tax_amount: params.taxAmount,
          description: params.description,
          product_service_description: buildProductServiceDescription(
            params.items,
            params.description
          ),
          currency: params.currency || 'CLP',
          status: params.isPaid ? 'paid' : 'pending',
          paid_amount: params.isPaid ? params.amount : 0,
          xml_file_name: params.xmlFileName,
          source_module: 'xml_cost_upload',
        },
      ])
      .select('id')
      .single();

    if (insertError || !created?.id) {
      throw new Error(insertError?.message || 'No se pudo crear la factura del XML');
    }

    invoiceId = created.id;
    invoiceHasItems = false;
  }

  if (!invoiceHasItems && params.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('supplier_invoice_items')
      .insert(buildDocumentalInvoiceItemRows(invoiceId, params.items, params.userId));

    if (itemsError) {
      throw new Error(`No se pudo guardar el detalle de la factura: ${itemsError.message}`);
    }
  }

  const { error: linkError } = await supabase
    .from('costs')
    .update({ supplier_invoice_id: invoiceId })
    .eq('id', params.costId);

  if (linkError) {
    throw new Error(`No se pudo vincular la factura al costo: ${linkError.message}`);
  }

  return invoiceId;
};
