import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }> => {
    const [{ data: existingInvs }, { data: invSups }] = await Promise.all([
      supabase.from('supplier_invoices').select('invoice_number, supplier_id'),
      supabase.from('inventory_suppliers').select('id, rut'),
    ]);

    return {
      existingInvs: (existingInvs || []) as Array<{ invoice_number: string; supplier_id: string }>,
      invSups: (invSups || []) as Array<{ id: string; rut: string }>,
    };
  };

  /**
   * Obtiene todos los numero_fiscal y folio existentes para deduplicación en import de ventas.
   */
  const fetchExistingInvoiceRefs = async (): Promise<{
    numeros: Set<string>;
    folios: Set<string>;
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

    return { numeros, folios };
  };

  return {
    getCurrentUserId,
    insertInvoiceBatch,
    insertSupplier,
    loadExistingDedupData,
    fetchExistingInvoiceRefs,
  };
}
