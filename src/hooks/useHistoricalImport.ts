import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { extractFolioFromDescription } from '@/utils/folioExtractor';

const logger = createLogger('useHistoricalImport');

/**
 * Operaciones Supabase comunes para los flujos de importación histórica.
 * Extraídas de InvoiceHistoryImport y PurchaseHistoryImport.
 */
export function useHistoricalImport() {
  const getCurrentUserId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error('No se pudo obtener el usuario actual. Inicie sesión nuevamente.');
    return user.id;
  };

  /**
   * Inserta facturas en lotes de 50. Si falla por columna product_service_description,
   * reintenta sin esa columna (schema mismatch entre entornos).
   */
  const insertInvoiceBatch = async (batch: Record<string, unknown>[]): Promise<{ error: boolean; message?: string }> => {
    const { error } = await (supabase.from('invoices') as any).insert(batch);

    if (!error) return { error: false };

    const m = (error.message || '').toLowerCase();
    const isMissingProductServiceDescriptionColumn =
      m.includes('product_service_description') && (m.includes('could not find') || m.includes('schema cache'));

    if (isMissingProductServiceDescriptionColumn) {
      const sanitizedBatch = batch.map((row) => {
        const { product_service_description: _ignored, ...rest } = row;
        return rest;
      });
      const { error: retryError } = await (supabase.from('invoices') as any).insert(sanitizedBatch);
      if (!retryError) return { error: false };
    }

    return { error: true, message: error.message };
  };

  /**
   * Inserta un proveedor en la tabla suppliers. Maneja duplicados y fallback sin created_by.
   */
  const insertSupplier = async (name: string, rut: string, userId: string): Promise<void> => {
    try {
      const { error: supError } = await supabase
        .from('suppliers')
        .insert({ name, rut, category: 'General', created_by: userId, is_active: true });

      if (supError && !supError.message?.includes('duplicate')) {
        if (supError.message?.includes('created_by')) {
          await supabase.from('suppliers').insert({ name, rut, category: 'General', is_active: true });
        } else {
          logger.warn('Could not sync to suppliers table:', supError);
        }
      }
    } catch (e) {
      logger.warn('Error syncing to suppliers table:', e);
    }
  };

  /**
   * Carga todas las facturas de proveedor y mapea inventory_suppliers RUT para deduplicación.
   * Usado en PurchaseHistoryImport para filtrar facturas ya existentes.
   */
  const loadExistingDedupData = async (): Promise<{
    existingInvs: Array<{ invoice_number: string; supplier_id: string }>;
    invSups: Array<{ id: string; rut: string }>;
    existingCosts: Array<{ document_number: string; supplier_id: string }>;
    existingCostsByDescriptionFolio: Array<{
      supplier_id: string;
      folio_extracted: string;
      amount: number;
    }>;
  }> => {
    const [{ data: existingInvs }, { data: invSups }, { data: existingCosts }] = await Promise.all([
      supabase.from('supplier_invoices').select('invoice_number, supplier_id'),
      supabase.from('inventory_suppliers').select('id, rut'),
      supabase
        .from('costs')
        .select('document_number, supplier_id')
        .not('document_number', 'is', null)
        .not('supplier_id', 'is', null),
    ]);

    const PAGE_SIZE = 1000;
    const costsWithoutDocumentNumber: Array<{
      supplier_id: string;
      description: string | null;
      amount: number;
    }> = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('costs')
        .select('supplier_id, description, amount')
        .not('supplier_id', 'is', null)
        .is('document_number', null)
        .not('description', 'is', null)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      costsWithoutDocumentNumber.push(...(page || []));
      if (!page || page.length < PAGE_SIZE) break;
    }

    const existingCostsByDescriptionFolio = costsWithoutDocumentNumber.flatMap((cost) => {
      const folio = extractFolioFromDescription(cost.description);
      return folio && cost.supplier_id
        ? [{ supplier_id: cost.supplier_id, folio_extracted: folio, amount: cost.amount }]
        : [];
    });

    return {
      existingInvs: (existingInvs || []) as Array<{ invoice_number: string; supplier_id: string }>,
      invSups: (invSups || []) as Array<{ id: string; rut: string }>,
      existingCosts: (existingCosts || []) as Array<{ document_number: string; supplier_id: string }>,
      existingCostsByDescriptionFolio,
    };
  };

  /**
   * Obtiene todos los numero_fiscal y folio existentes para deduplicación en import de ventas.
   * También busca folios escritos en incomes (description/notes/bank_reference) y
   * payments (notes/bank_reference) para cubrir el patrón "folio en glosa".
   */
  const fetchExistingInvoiceRefs = async (): Promise<{
    numeros: Set<string>;
    folios: Set<string>;
    incomeFolios: Set<string>;
    paymentFolios: Set<string>;
  }> => {
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('numero_fiscal, folio');

    const numeros = new Set<string>(
      (existingInvoices || []).map((inv: { numero_fiscal?: string | null }) => inv.numero_fiscal).filter(Boolean) as string[],
    );
    const folios = new Set<string>(
      (existingInvoices || []).map((inv: { folio?: string | null }) => inv.folio).filter(Boolean) as string[],
    );

    // Detectar folios en incomes (patrón "folio en glosa" en ventas)
    const incomeFolios = new Set<string>();
    const PAGE_SIZE = 1000;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: incomePage } = await supabase
        .from('incomes')
        .select('description, notes, bank_reference')
        .or('description.not.is.null,notes.not.is.null,bank_reference.not.is.null')
        .range(from, from + PAGE_SIZE - 1);

      if (!incomePage || incomePage.length === 0) break;

      for (const income of incomePage) {
        const folio =
          extractFolioFromDescription(income.description) ||
          extractFolioFromDescription(income.notes) ||
          extractFolioFromDescription(income.bank_reference);
        if (folio) incomeFolios.add(folio);
      }

      if (incomePage.length < PAGE_SIZE) break;
    }

    // Detectar folios en payments (patrón "folio en glosa" en pagos)
    const paymentFolios = new Set<string>();
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: paymentPage } = await supabase
        .from('payments')
        .select('notes, bank_reference')
        .or('notes.not.is.null,bank_reference.not.is.null')
        .range(from, from + PAGE_SIZE - 1);

      if (!paymentPage || paymentPage.length === 0) break;

      for (const payment of paymentPage) {
        const folio =
          extractFolioFromDescription(payment.notes) ||
          extractFolioFromDescription(payment.bank_reference);
        if (folio) paymentFolios.add(folio);
      }

      if (paymentPage.length < PAGE_SIZE) break;
    }

    if (incomeFolios.size > 0) {
      logger.debug(`Detectados ${incomeFolios.size} folios en incomes (glosa)`);
    }
    if (paymentFolios.size > 0) {
      logger.debug(`Detectados ${paymentFolios.size} folios en payments (glosa)`);
    }

    return { numeros, folios, incomeFolios, paymentFolios };
  };

  return {
    getCurrentUserId,
    insertInvoiceBatch,
    insertSupplier,
    loadExistingDedupData,
    fetchExistingInvoiceRefs,
  };
}
