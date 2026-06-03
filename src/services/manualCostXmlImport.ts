import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Cost } from '@/types/costs';
import { Supplier, XMLCompleteParseResult, XMLDocumentData, XMLDocumentItem, XMLSupplierData } from '@/types/suppliers';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';
import { findSupplierByIdentity, normalizeSupplierRut } from '@/utils/supplierIdentity';
import { createLogger } from '@/lib/logger';

const logger = createLogger('manualCostXmlImport');

export type ManualCostXmlImportMode = 'overwrite' | 'complement';

type JsonRecord = Record<string, unknown>;

type SupplierInvoiceSnapshot = {
  id: string;
  supplier_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  net_amount: number;
  tax_amount: number | null;
  description: string | null;
  product_service_description: string;
  currency: string | null;
  status: string | null;
  xml_file_name: string | null;
  source_module: string;
};

type SupplierPaymentSnapshot = {
  id: string;
  supplier_id: string | null;
  supplier_invoice_id: string | null;
  reference_number: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  notes: string | null;
};

export interface ManualCostXmlConflict {
  code:
    | 'multiple_documents'
    | 'missing_required_fields'
    | 'invoice_already_linked_elsewhere'
    | 'invoice_linked_to_other_records'
    | 'cost_has_different_invoice'
    | 'supplier_mismatch'
    | 'amount_mismatch'
    | 'date_distance'
    | 'service_folio_conflict';
  severity: 'error' | 'warning';
  message: string;
}

export interface ManualCostXmlFieldChange {
  field:
    | 'amount'
    | 'description'
    | 'document_number'
    | 'document_type'
    | 'service_folio'
    | 'supplier_id'
    | 'notes';
  label: string;
  currentValue: unknown;
  incomingValue: unknown;
  action: 'fill' | 'overwrite' | 'keep';
}

export interface ManualCostXmlPreview {
  document: XMLDocumentData;
  supplier: XMLSupplierData | null;
  supplierMatch: Supplier | null;
  supplierWillBeCreated: boolean;
  mode: ManualCostXmlImportMode;
  fileName: string;
  fieldChanges: ManualCostXmlFieldChange[];
  conflicts: ManualCostXmlConflict[];
  suggestedCostPatch: Partial<Cost>;
  invoicePayload: {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    amount: number;
    net_amount: number;
    tax_amount: number;
    description: string;
    product_service_description: string;
    currency: string;
    status: 'pending';
    xml_file_name: string;
    source_module: 'manual_cost_xml';
  };
}

export interface ManualCostXmlParseOutput {
  parseResult: XMLCompleteParseResult;
  document: XMLDocumentData;
  supplier: XMLSupplierData | null;
}

type ManualImportSnapshotContext = {
  source: 'manual_cost_xml_import';
  snapshotId: string;
  fileName: string;
  importMode: ManualCostXmlImportMode;
  document: XMLDocumentData;
  supplier: XMLSupplierData | null;
  invoiceBefore: SupplierInvoiceSnapshot | null;
  invoiceAfter: SupplierInvoiceSnapshot | null;
  paymentBefore: SupplierPaymentSnapshot | null;
  paymentAfter: SupplierPaymentSnapshot | null;
  previousSupplierInvoiceId: string | null;
  createdSupplierId: string | null;
};

type ManualRevertSnapshotContext = {
  source: 'manual_cost_xml_import_revert';
  snapshotId: string;
  revertedSnapshotId: string;
};

export interface ManualCostXmlImportResult {
  updatedCost: Cost;
  preview: ManualCostXmlPreview;
  snapshotId: string;
}

export interface LatestManualCostXmlImportSnapshot {
  historyId: string;
  snapshotId: string;
  summary: string | null;
  changedAt: string;
  fileName: string | null;
  document: XMLDocumentData | null;
}

const SNAPSHOT_FIELD_PREFIX = 'manual_xml_import_snapshot:';
const REVERT_FIELD_PREFIX = 'manual_xml_import_revert:';
const MANUAL_XML_SOURCE = 'manual_cost_xml';

const MANUAL_COST_FIELDS: Array<{
  field: ManualCostXmlFieldChange['field'];
  label: string;
}> = [
  { field: 'amount', label: 'Monto facturado' },
  { field: 'description', label: 'Descripción' },
  { field: 'document_number', label: 'Número de factura' },
  { field: 'document_type', label: 'Tipo de documento' },
  { field: 'service_folio', label: 'Folio de referencia' },
  { field: 'supplier_id', label: 'Proveedor' },
  { field: 'notes', label: 'Notas' },
];

export const parseManualCostXmlFile = async (file: File): Promise<ManualCostXmlParseOutput> => {
  const parser = new XMLSupplierParser();
  const parseResult = await parser.parseXMLCompleteFile(file);

  if (!parseResult.success && parseResult.documents.length === 0) {
    throw new Error(parseResult.errors[0] || 'No se pudo analizar el archivo XML');
  }

  if (parseResult.documents.length === 0) {
    throw new Error('El XML no contiene ningún documento de compra utilizable');
  }

  if (parseResult.documents.length > 1) {
    throw new Error('El XML contiene más de un documento. Cargue un archivo con una sola factura para importar manualmente');
  }

  const [document] = parseResult.documents;
  const supplier =
    parseResult.suppliers.find((item) => normalizeSupplierRut(item.rut) === normalizeSupplierRut(document.supplier_rut)) ||
    parseResult.suppliers[0] ||
    null;

  return { parseResult, document, supplier };
};

export const buildManualCostXmlPreview = (params: {
  cost: Cost;
  document: XMLDocumentData;
  supplier: XMLSupplierData | null;
  supplierMatch: Supplier | null;
  mode: ManualCostXmlImportMode;
  fileName: string;
}): ManualCostXmlPreview => {
  const { cost, document, supplier, supplierMatch, mode, fileName } = params;
  const notes = buildImportedNotes(cost.notes, document, supplier);
  const description = buildImportedDescription(document);
  const suggestedCostPatch: Partial<Cost> = {
    amount: document.total_amount,
    description,
    document_number: document.folio,
    document_type: document.document_type,
    service_folio: document.folio,
    supplier_id: supplierMatch?.id || cost.supplier_id,
    notes,
  };

  const fieldChanges = MANUAL_COST_FIELDS.map(({ field, label }) => {
    const currentValue = getManualFieldValue(cost, field);
    const incomingValue = getManualFieldValue(suggestedCostPatch as Cost, field);
    return {
      field,
      label,
      currentValue,
      incomingValue,
      action: resolveFieldAction(currentValue, incomingValue, mode),
    } satisfies ManualCostXmlFieldChange;
  });

  const conflicts = collectPreviewConflicts({ cost, document, supplierMatch });

  return {
    document,
    supplier,
    supplierMatch,
    supplierWillBeCreated: Boolean(supplier && !supplierMatch),
    mode,
    fileName,
    fieldChanges,
    conflicts,
    suggestedCostPatch,
    invoicePayload: {
      invoice_number: document.folio,
      issue_date: document.issue_date,
      due_date: document.due_date || document.issue_date,
      amount: document.total_amount,
      net_amount: document.net_amount,
      tax_amount: document.vat_amount,
      description,
      product_service_description: buildInvoiceDescription(document),
      currency: document.currency || 'CLP',
      status: 'pending',
      xml_file_name: fileName,
      source_module: MANUAL_XML_SOURCE,
    },
  };
};

export const applyManualCostXmlImport = async (params: {
  costId: string;
  fileName: string;
  mode: ManualCostXmlImportMode;
  document: XMLDocumentData;
  supplier: XMLSupplierData | null;
  suppliers: Supplier[];
  confirmedConflictCodes?: string[];
}): Promise<ManualCostXmlImportResult> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('No se pudo validar la sesión del usuario');
  }

  const role = await getCurrentUserRole(user.id);
  if (!['admin', 'operator'].includes(role)) {
    throw new Error('No tienes permisos para importar XML sobre un costo');
  }

  const currentCost = await fetchCostById(params.costId);
  const supplierMatch = resolveSupplierMatch(params.suppliers, params.supplier);
  const preview = buildManualCostXmlPreview({
    cost: currentCost,
    document: params.document,
    supplier: params.supplier,
    supplierMatch,
    mode: params.mode,
    fileName: params.fileName,
  });

  const blockingConflicts = preview.conflicts.filter((conflict) => conflict.severity === 'error');
  if (blockingConflicts.length > 0) {
    throw new Error(blockingConflicts[0].message);
  }

  const pendingWarnings = preview.conflicts.filter(
    (conflict) =>
      conflict.severity === 'warning' &&
      !(params.confirmedConflictCodes || []).includes(conflict.code)
  );
  if (pendingWarnings.length > 0) {
    throw new Error('Debe confirmar explícitamente los conflictos detectados antes de aplicar la importación');
  }

  const resolvedSupplier = await ensureSupplierForImport(params.supplier, params.suppliers, user.id);
  const linkedInvoiceBefore = await fetchLinkedInvoiceSnapshot(currentCost.supplier_invoice_id);
  const paymentBefore = await fetchRelatedSupplierPaymentSnapshot(currentCost);
  const costPatch = buildCostPatchForApply({
    cost: currentCost,
    preview,
    supplierId: resolvedSupplier?.id || currentCost.supplier_id,
    mode: params.mode,
  });

  const createdInvoiceIds: string[] = [];
  let previousInvoiceId = currentCost.supplier_invoice_id || null;
  let invoiceBefore = linkedInvoiceBefore;
  let invoiceAfter: SupplierInvoiceSnapshot | null = null;
  let paymentAfter: SupplierPaymentSnapshot | null = null;
  let updatedCostSnapshot: Cost | null = null;

  try {
    const invoiceResolution = await upsertSupplierInvoiceForCost({
      currentCost,
      supplierId: resolvedSupplier?.id || currentCost.supplier_id,
      preview,
      paymentSnapshot: paymentBefore,
    });

    invoiceAfter = invoiceResolution.invoice;
    invoiceBefore = invoiceResolution.previousInvoiceSnapshot;
    previousInvoiceId = currentCost.supplier_invoice_id || null;

    if (invoiceResolution.createdInvoiceId) {
      createdInvoiceIds.push(invoiceResolution.createdInvoiceId);
    }

    const patchWithInvoice = {
      ...costPatch,
      supplier_id: resolvedSupplier?.id || currentCost.supplier_id,
      supplier_invoice_id: invoiceAfter.id,
    };

    updatedCostSnapshot = await updateCostRecord(currentCost.id, patchWithInvoice);
    await syncSupplierInvoiceItems({
      invoiceId: invoiceAfter.id,
      document: preview.document,
      userId: user.id,
    });
    paymentAfter = await syncRelatedSupplierPayment({
      currentCost,
      currentPayment: paymentBefore,
      preview,
      invoiceId: invoiceAfter.id,
      supplierId: resolvedSupplier?.id || currentCost.supplier_id,
    });

    const snapshotId = crypto.randomUUID();
    await insertManualSnapshot({
      costId: currentCost.id,
      userId: user.id,
      summary: `Importación manual XML de factura ${preview.document.folio}`,
      fieldName: `${SNAPSHOT_FIELD_PREFIX}${snapshotId}`,
      oldValue: currentCost,
      newValue: updatedCostSnapshot,
      context: {
        source: 'manual_cost_xml_import',
        snapshotId,
        fileName: params.fileName,
        importMode: params.mode,
        document: params.document,
        supplier: params.supplier,
        invoiceBefore,
        invoiceAfter,
        paymentBefore,
        paymentAfter,
        previousSupplierInvoiceId: previousInvoiceId,
        createdSupplierId: resolvedSupplier && !supplierMatch ? resolvedSupplier.id : null,
      } satisfies ManualImportSnapshotContext,
    });

    await insertAuditLog({
      userId: user.id,
      oldData: {
        cost: currentCost,
        invoice: invoiceBefore,
        payment: paymentBefore,
      },
      newData: {
        cost: updatedCostSnapshot,
        invoice: invoiceAfter,
        payment: paymentAfter,
        fileName: params.fileName,
        importMode: params.mode,
        source: MANUAL_XML_SOURCE,
      },
      operation: 'MANUAL_XML_IMPORT',
      tableName: 'costs',
    });

    return {
      updatedCost: updatedCostSnapshot,
      preview,
      snapshotId,
    };
  } catch (error) {
    logger.error('Error applying manual XML import. Rolling back changes', error);
    await rollbackManualImport({
      currentCost,
      invoiceBefore,
      paymentBefore,
      updatedCostSnapshot,
      createdInvoiceIds,
      previousInvoiceId,
      invoiceAfter,
    });
    throw error;
  }
};

export const getLatestRevertibleManualCostXmlImport = async (
  costId: string
): Promise<LatestManualCostXmlImportSnapshot | null> => {
  const { data, error } = await supabase
    .from('cost_change_history')
    .select('id, changed_at, field_name, change_summary, change_context')
    .eq('cost_id', costId)
    .like('field_name', 'manual_xml_import_%')
    .order('changed_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  const revertedSnapshotIds = new Set<string>();
  const snapshots: Array<{
    id: string;
    changed_at: string;
    field_name: string;
    change_summary: string | null;
    change_context: string | null;
  }> = [];

  for (const entry of data || []) {
    if (entry.field_name.startsWith(REVERT_FIELD_PREFIX)) {
      const revertContext = safeParseContext<ManualRevertSnapshotContext>(entry.change_context);
      if (revertContext?.revertedSnapshotId) {
        revertedSnapshotIds.add(revertContext.revertedSnapshotId);
      }
      continue;
    }

    if (entry.field_name.startsWith(SNAPSHOT_FIELD_PREFIX)) {
      snapshots.push(entry);
    }
  }

  const latestSnapshot = snapshots.find((entry) => {
    const snapshotId = entry.field_name.replace(SNAPSHOT_FIELD_PREFIX, '');
    return !revertedSnapshotIds.has(snapshotId);
  });

  if (!latestSnapshot) return null;

  const snapshotId = latestSnapshot.field_name.replace(SNAPSHOT_FIELD_PREFIX, '');
  const context = safeParseContext<ManualImportSnapshotContext>(latestSnapshot.change_context);

  return {
    historyId: latestSnapshot.id,
    snapshotId,
    summary: latestSnapshot.change_summary,
    changedAt: latestSnapshot.changed_at,
    fileName: context?.fileName || null,
    document: context?.document || null,
  };
};

export const revertManualCostXmlImport = async (params: {
  costId: string;
  historyId: string;
}): Promise<Cost> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('No se pudo validar la sesión del usuario');
  }

  const role = await getCurrentUserRole(user.id);
  if (!['admin', 'operator'].includes(role)) {
    throw new Error('No tienes permisos para revertir una importación XML');
  }

  const { data: historyEntry, error } = await supabase
    .from('cost_change_history')
    .select('id, cost_id, field_name, old_value, new_value, change_summary, change_context')
    .eq('id', params.historyId)
    .eq('cost_id', params.costId)
    .single();

  if (error || !historyEntry) {
    throw new Error(error?.message || 'No se encontró el snapshot de importación a revertir');
  }

  const snapshotId = historyEntry.field_name.replace(SNAPSHOT_FIELD_PREFIX, '');
  const context = safeParseContext<ManualImportSnapshotContext>(historyEntry.change_context);
  const oldCost = safeParseJson<Partial<Cost>>(historyEntry.old_value);
  const newCost = safeParseJson<Partial<Cost>>(historyEntry.new_value);

  if (!oldCost || !context) {
    throw new Error('El snapshot de importación no contiene información suficiente para revertir');
  }

  const currentCost = await fetchCostById(params.costId);
  const restoredCost = await updateCostRecord(params.costId, buildRestorableCostPatch(oldCost));

  if (context.invoiceAfter?.id) {
    if (!context.invoiceBefore) {
      await supabase.from('costs').update({ supplier_invoice_id: context.previousSupplierInvoiceId }).eq('id', params.costId);

      const paymentId =
        context.paymentBefore?.id ||
        (await fetchRelatedSupplierPaymentSnapshot(currentCost))?.id ||
        null;

      if (paymentId) {
        await supabase
          .from('supplier_payments')
          .update({
            supplier_invoice_id: context.paymentBefore?.supplier_invoice_id || null,
            reference_number: context.paymentBefore?.reference_number || null,
            description: context.paymentBefore?.description || null,
            amount: context.paymentBefore?.amount || 0,
            due_date: context.paymentBefore?.due_date || oldCost.payment_date || currentCost.date,
            status: context.paymentBefore?.status || 'pending',
            notes: context.paymentBefore?.notes || null,
          })
          .eq('id', paymentId);
      }

      const { error: deleteInvoiceError } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('id', context.invoiceAfter.id);

      if (deleteInvoiceError) {
        throw new Error(`No se pudo eliminar la factura creada durante la importación: ${deleteInvoiceError.message}`);
      }
    } else {
      const { error: restoreInvoiceError } = await supabase
        .from('supplier_invoices')
        .update(buildInvoicePatch(context.invoiceBefore))
        .eq('id', context.invoiceAfter.id);

      if (restoreInvoiceError) {
        throw new Error(`No se pudo restaurar la factura vinculada: ${restoreInvoiceError.message}`);
      }

      if (context.paymentBefore?.id) {
        const { error: restorePaymentError } = await supabase
          .from('supplier_payments')
          .update({
            supplier_invoice_id: context.paymentBefore.supplier_invoice_id,
            reference_number: context.paymentBefore.reference_number,
            description: context.paymentBefore.description,
            amount: context.paymentBefore.amount,
            due_date: context.paymentBefore.due_date,
            status: context.paymentBefore.status,
            notes: context.paymentBefore.notes,
          })
          .eq('id', context.paymentBefore.id);

        if (restorePaymentError) {
          throw new Error(`No se pudo restaurar el pago del proveedor vinculado: ${restorePaymentError.message}`);
        }
      }
    }
  }

  await insertManualSnapshot({
    costId: params.costId,
    userId: user.id,
    summary: `Reversión de importación XML ${context.document?.folio || ''}`.trim(),
    fieldName: `${REVERT_FIELD_PREFIX}${snapshotId}`,
    oldValue: newCost || currentCost,
    newValue: restoredCost,
    context: {
      source: 'manual_cost_xml_import_revert',
      snapshotId: crypto.randomUUID(),
      revertedSnapshotId: snapshotId,
    } satisfies ManualRevertSnapshotContext,
  });

  await insertAuditLog({
    userId: user.id,
    oldData: {
      cost: newCost || currentCost,
      snapshotId,
    },
    newData: {
      cost: restoredCost,
      revertedSnapshotId: snapshotId,
    },
    operation: 'MANUAL_XML_IMPORT_REVERT',
    tableName: 'costs',
  });

  return restoredCost;
};

const buildImportedDescription = (document: XMLDocumentData) => {
  const conceptText = (document.items || [])
    .map((item) => item.product_name || item.description)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');

  if (conceptText) {
    return conceptText;
  }

  return document.description || `${document.document_type} ${document.folio}`;
};

const buildInvoiceDescription = (document: XMLDocumentData) => {
  const items = (document.items || [])
    .map((item, index) => `${index + 1}. ${item.description}`)
    .join(' | ');

  return items || buildImportedDescription(document);
};

const buildImportedNotes = (
  currentNotes: string | null | undefined,
  document: XMLDocumentData,
  supplier: XMLSupplierData | null
) => {
  const cleanedCurrentNotes = removeLegacyImportedNotes(currentNotes);
  const primaryLineDescription =
    (document.items || []).map((item) => item.description?.trim()).find(Boolean) ||
    document.description ||
    'N/A';

  const xmlSummary = [
    supplier?.name ? `Proveedor: ${supplier.name}` : null,
    `Factura: ${document.folio}`,
    `Glosa principal: ${primaryLineDescription}`,
    `Archivo XML: ${document.folio}.xml`,
  ]
    .filter(Boolean)
    .join(' | ');

  return [cleanedCurrentNotes, xmlSummary].filter(Boolean).join('\n\n');
};

const removeLegacyImportedNotes = (notes: string | null | undefined) => {
  if (!notes) return '';

  return notes
    .replace(/\[XML IMPORTADO MANUALMENTE\][\s\S]*?(?=\n{2,}|$)/g, '')
    .replace(/\s*\n{3,}\s*/g, '\n\n')
    .trim();
};

const resolveFieldAction = (
  currentValue: unknown,
  incomingValue: unknown,
  mode: ManualCostXmlImportMode
): ManualCostXmlFieldChange['action'] => {
  if (!hasValue(incomingValue)) return 'keep';
  if (!hasValue(currentValue)) return 'fill';
  if (valuesEqual(currentValue, incomingValue)) return 'keep';
  return mode === 'overwrite' ? 'overwrite' : 'keep';
};

const collectPreviewConflicts = (params: {
  cost: Cost;
  document: XMLDocumentData;
  supplierMatch: Supplier | null;
}): ManualCostXmlConflict[] => {
  const { cost, document, supplierMatch } = params;
  const conflicts: ManualCostXmlConflict[] = [];

  if (!document.folio || !document.issue_date || !document.total_amount || !document.supplier_rut) {
    conflicts.push({
      code: 'missing_required_fields',
      severity: 'error',
      message: 'El XML no contiene folio, fecha de emisión, monto total y RUT del proveedor requeridos',
    });
  }

  if (cost.supplier_id && supplierMatch && cost.supplier_id !== supplierMatch.id) {
    conflicts.push({
      code: 'supplier_mismatch',
      severity: 'warning',
      message: 'El proveedor del XML no coincide con el proveedor actualmente asociado al costo',
    });
  }

  if (cost.amount && Math.abs(Number(cost.amount) - Number(document.total_amount)) > 0.99) {
    conflicts.push({
      code: 'amount_mismatch',
      severity: 'warning',
      message: 'El monto del XML es diferente al monto registrado actualmente en el costo',
    });
  }

  if (cost.document_number && cost.document_number !== document.folio) {
    conflicts.push({
      code: 'cost_has_different_invoice',
      severity: 'warning',
      message: 'El costo ya tiene un número de documento distinto al folio del XML',
    });
  }

  if (cost.service_folio && cost.service_folio !== document.folio) {
    conflicts.push({
      code: 'service_folio_conflict',
      severity: 'warning',
      message: 'El folio de referencia actual del costo es distinto al folio de la factura XML',
    });
  }

  const costDate = new Date(`${cost.date}T00:00:00`);
  const issueDate = new Date(`${document.issue_date}T00:00:00`);
  const diffDays = Math.abs(Math.round((issueDate.getTime() - costDate.getTime()) / (1000 * 60 * 60 * 24)));
  if (Number.isFinite(diffDays) && diffDays > 45) {
    conflicts.push({
      code: 'date_distance',
      severity: 'warning',
      message: 'La fecha de emisión del XML está a más de 45 días de la fecha del costo',
    });
  }

  return conflicts;
};

const getManualFieldValue = (cost: Partial<Cost>, field: ManualCostXmlFieldChange['field']) => {
  return cost[field as keyof Cost];
};

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const valuesEqual = (left: unknown, right: unknown) => {
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left) === Number(right);
  }

  return String(left ?? '') === String(right ?? '');
};

const resolveSupplierMatch = (suppliers: Supplier[], supplier: XMLSupplierData | null) => {
  if (!supplier) return null;
  return findSupplierByIdentity(suppliers, { name: supplier.name, rut: supplier.rut }) || null;
};

const getCurrentUserRole = async (userId: string): Promise<string> => {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error || !data?.role) {
    throw new Error(error?.message || 'No se pudo validar el rol del usuario');
  }

  return data.role;
};

const fetchCostById = async (costId: string): Promise<Cost> => {
  const { data, error } = await supabase
    .from('costs')
    .select(
      `
      *,
      cost_categories (*),
      cost_centers (*),
      cranes (*),
      operators (*),
      services (*, clients!services_client_id_fkey(*)),
      crane_parts (
        part_name,
        supplier,
        phone,
        quantity,
        unit_price,
        total_value,
        kilometraje
      ),
      crane_maintenance (
        id,
        description,
        maintenance_type,
        provider,
        notes
      ),
      creator:profiles!costs_created_by_fkey (
        id,
        full_name,
        email
      )
    `
    )
    .eq('id', costId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo cargar el costo seleccionado');
  }

  return data as Cost;
};

const ensureSupplierForImport = async (
  supplier: XMLSupplierData | null,
  suppliers: Supplier[],
  userId: string
) => {
  if (!supplier) return null;

  const existing = resolveSupplierMatch(suppliers, supplier);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('inventory_suppliers')
    .insert({
      name: supplier.name,
      rut: supplier.rut || '',
      email: supplier.email || null,
      phone: supplier.phone || null,
      address: supplier.address || null,
      contact_person: supplier.contact_name || null,
      category: supplier.category || 'otros',
      notes: supplier.notes || null,
      is_active: true,
      created_by: userId,
    })
    .select(
      `
      id,
      name,
      rut,
      email,
      phone,
      address,
      contact_person,
      category,
      subcategory,
      notes,
      payment_terms,
      default_payment_term_id,
      credit_date,
      delivery_time_days,
      is_active,
      created_at,
      updated_at,
      created_by,
      updated_by
    `
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo crear el proveedor del XML');
  }

  return {
    ...data,
    contact_name: (data as any).contact_person,
  } as Supplier;
};

const buildCostPatchForApply = (params: {
  cost: Cost;
  preview: ManualCostXmlPreview;
  supplierId: string | null;
  mode: ManualCostXmlImportMode;
}) => {
  const { cost, preview, supplierId, mode } = params;
  const patch: Record<string, unknown> = {};

  const candidateValues: Record<string, unknown> = {
    amount: preview.document.total_amount,
    description: buildImportedDescription(preview.document),
    document_number: preview.document.folio,
    document_type: preview.document.document_type,
    service_folio: preview.document.folio,
    supplier_id: supplierId,
    notes: buildImportedNotes(cost.notes, preview.document, preview.supplier),
  };

  Object.entries(candidateValues).forEach(([key, value]) => {
    const currentValue = (cost as any)[key];
    if (!hasValue(value)) return;

    if (mode === 'overwrite') {
      if (!valuesEqual(currentValue, value)) {
        patch[key] = value;
      }
      return;
    }

    if (!hasValue(currentValue)) {
      patch[key] = value;
    }
  });

  return patch;
};

const upsertSupplierInvoiceForCost = async (params: {
  currentCost: Cost;
  supplierId: string | null;
  preview: ManualCostXmlPreview;
  paymentSnapshot: SupplierPaymentSnapshot | null;
}) => {
  const { currentCost, supplierId, preview } = params;

  if (!supplierId) {
    throw new Error('No se pudo resolver el proveedor asociado al XML');
  }

  const { data: existingInvoiceByFolio, error: existingInvoiceError } = await supabase
    .from('supplier_invoices')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('invoice_number', preview.document.folio)
    .maybeSingle();

  if (existingInvoiceError) {
    throw new Error(existingInvoiceError.message);
  }

  if (existingInvoiceByFolio && existingInvoiceByFolio.id !== currentCost.supplier_invoice_id) {
    const { data: linkedCosts, error: linkedCostsError } = await supabase
      .from('costs')
      .select('id')
      .eq('supplier_invoice_id', existingInvoiceByFolio.id);

    if (linkedCostsError) {
      throw new Error(linkedCostsError.message);
    }

    if ((linkedCosts || []).some((row) => row.id !== currentCost.id)) {
      throw new Error('La factura del XML ya está vinculada a otro costo');
    }
  }

  let baseInvoiceSnapshot = await fetchLinkedInvoiceSnapshot(currentCost.supplier_invoice_id);
  let targetInvoiceId = currentCost.supplier_invoice_id || existingInvoiceByFolio?.id || null;

  if (currentCost.supplier_invoice_id && baseInvoiceSnapshot && baseInvoiceSnapshot.invoice_number !== preview.document.folio) {
    const linkedUsage = await countOtherInvoiceLinks(baseInvoiceSnapshot.id, currentCost.id, params.paymentSnapshot?.id || null);
    if (linkedUsage.costs > 0 || linkedUsage.payments > 0) {
      throw new Error('El costo ya está asociado a una factura distinta que también es usada por otros registros');
    }
  }

  const invoicePatch = {
    supplier_id: supplierId,
    invoice_number: preview.invoicePayload.invoice_number,
    issue_date: preview.invoicePayload.issue_date,
    due_date: preview.invoicePayload.due_date,
    amount: preview.invoicePayload.amount,
    net_amount: preview.invoicePayload.net_amount,
    tax_amount: preview.invoicePayload.tax_amount,
    description: preview.invoicePayload.description,
    product_service_description: preview.invoicePayload.product_service_description,
    currency: preview.invoicePayload.currency,
    status: preview.invoicePayload.status,
    xml_file_name: preview.invoicePayload.xml_file_name,
    source_module: preview.invoicePayload.source_module,
  };

  if (targetInvoiceId) {
    const { data, error } = await supabase
      .from('supplier_invoices')
      .update(invoicePatch)
      .eq('id', targetInvoiceId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'No se pudo actualizar la factura vinculada al costo');
    }

    return {
      invoice: mapInvoiceSnapshot(data),
      previousInvoiceSnapshot: baseInvoiceSnapshot,
      createdInvoiceId: null,
    };
  }

  const { data, error } = await supabase
    .from('supplier_invoices')
    .insert(invoicePatch)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo crear la factura vinculada al costo');
  }

  return {
    invoice: mapInvoiceSnapshot(data),
    previousInvoiceSnapshot: baseInvoiceSnapshot,
    createdInvoiceId: data.id,
  };
};

const updateCostRecord = async (costId: string, patch: Record<string, unknown>) => {
  const { data, error } = await supabase.from('costs').update(patch).eq('id', costId).select('*').single();

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo actualizar el costo');
  }

  return data as Cost;
};

const fetchLinkedInvoiceSnapshot = async (invoiceId: string | null | undefined) => {
  if (!invoiceId) return null;

  const { data, error } = await supabase.from('supplier_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapInvoiceSnapshot(data) : null;
};

const fetchRelatedSupplierPaymentSnapshot = async (cost: Pick<Cost, 'id' | 'supplier_payment_id'>) => {
  const paymentId = cost.supplier_payment_id;

  if (paymentId) {
    const { data, error } = await supabase.from('supplier_payments').select('*').eq('id', paymentId).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }

    return data ? mapPaymentSnapshot(data) : null;
  }

  const { data, error } = await supabase
    .from('supplier_payments')
    .select('*')
    .eq('cost_id', cost.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapPaymentSnapshot(data) : null;
};

const syncRelatedSupplierPayment = async (params: {
  currentCost: Cost;
  currentPayment: SupplierPaymentSnapshot | null;
  preview: ManualCostXmlPreview;
  invoiceId: string;
  supplierId: string | null;
}) => {
  const { currentPayment, preview, invoiceId, supplierId } = params;
  if (!currentPayment) return null;

  const paymentPatch = {
    supplier_id: supplierId,
    supplier_invoice_id: invoiceId,
    reference_number: preview.document.folio,
    description: buildImportedDescription(preview.document),
    amount: preview.document.total_amount,
    due_date: preview.document.due_date || preview.document.issue_date,
    notes: buildImportedNotes(currentPayment.notes, preview.document, preview.supplier),
  };

  const { data, error } = await supabase
    .from('supplier_payments')
    .update(paymentPatch)
    .eq('id', currentPayment.id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'No se pudo sincronizar el pago del proveedor asociado al costo');
  }

  return mapPaymentSnapshot(data);
};

const syncSupplierInvoiceItems = async (params: {
  invoiceId: string;
  document: XMLDocumentData;
  userId: string;
}) => {
  const { invoiceId, document, userId } = params;
  const documentItems = document.items || [];

  const { error: deleteError } = await supabase
    .from('supplier_invoice_items')
    .delete()
    .eq('supplier_invoice_id', invoiceId);

  if (deleteError) {
    throw new Error(`No se pudo limpiar el detalle previo de la factura: ${deleteError.message}`);
  }

  if (documentItems.length === 0) {
    return;
  }

  const rows = [];

  for (const [index, item] of documentItems.entries()) {
    const inventoryItemId = await findOrCreateInventoryItemForInvoiceLine(item);
    rows.push({
      supplier_invoice_id: invoiceId,
      inventory_item_id: inventoryItemId,
      line_number: index + 1,
      product_code: item.product_code || null,
      product_name: item.product_name || item.description,
      description: item.description,
      quantity: normalizeInvoiceQuantity(item.quantity),
      unit_price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal ?? inferLineSubtotal(item)),
      tax_rate: item.tax_rate ?? null,
      tax_amount: Number(item.tax_amount || 0),
      total_amount: Number(item.total || 0),
      movement_id: null,
      created_by: userId,
    });
  }

  const { error: insertError } = await supabase.from('supplier_invoice_items').insert(rows);

  if (insertError) {
    throw new Error(`No se pudo guardar el detalle de líneas de la factura: ${insertError.message}`);
  }
};

const findOrCreateInventoryItemForInvoiceLine = async (item: XMLDocumentItem): Promise<string> => {
  const candidateNames = [
    item.product_name?.trim(),
    item.description.trim(),
  ].filter(Boolean) as string[];

  const productCode = item.product_code?.trim();

  if (productCode) {
    const { data: bySku, error: skuError } = await supabase
      .from('inventory_items')
      .select('id')
      .or(`sku.ilike.%${escapeIlikeValue(productCode)}%,barcode.ilike.%${escapeIlikeValue(productCode)}%`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (skuError) {
      throw new Error(`No se pudo buscar un ítem de inventario por código: ${skuError.message}`);
    }

    if (bySku?.id) {
      return bySku.id;
    }
  }

  for (const name of candidateNames) {
    const { data: byName, error: nameError } = await supabase
      .from('inventory_items')
      .select('id')
      .ilike('name', name)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (nameError) {
      throw new Error(`No se pudo buscar un ítem de inventario por nombre: ${nameError.message}`);
    }

    if (byName?.id) {
      return byName.id;
    }
  }

  const fallbackName = candidateNames[0] || 'Item XML manual';
  const { data: createdItem, error: createItemError } = await supabase
    .from('inventory_items')
    .insert({
      name: fallbackName,
      sku: productCode || null,
      barcode: productCode || null,
      unit_of_measure: 'unidad',
      unit_cost: Number(item.unit_price || 0),
      is_active: true,
    })
    .select('id')
    .single();

  if (createItemError || !createdItem?.id) {
    throw new Error(createItemError?.message || 'No se pudo crear el ítem de inventario para la línea del XML');
  }

  return createdItem.id;
};

const normalizeInvoiceQuantity = (quantity: number | undefined) => {
  const normalized = Number(quantity || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return 1;
  return Math.max(1, Math.round(normalized));
};

const inferLineSubtotal = (item: XMLDocumentItem) => {
  const quantity = normalizeInvoiceQuantity(item.quantity);
  return Number(item.unit_price || 0) * quantity;
};

const escapeIlikeValue = (value: string) => value.replace(/[%_,]/g, '');

const countOtherInvoiceLinks = async (invoiceId: string, costId: string, paymentId: string | null) => {
  const [costsResult, paymentsResult] = await Promise.all([
    supabase.from('costs').select('id', { count: 'exact', head: true }).eq('supplier_invoice_id', invoiceId).neq('id', costId),
    paymentId
      ? supabase.from('supplier_payments').select('id', { count: 'exact', head: true }).eq('supplier_invoice_id', invoiceId).neq('id', paymentId)
      : supabase.from('supplier_payments').select('id', { count: 'exact', head: true }).eq('supplier_invoice_id', invoiceId),
  ]);

  if (costsResult.error) {
    throw new Error(costsResult.error.message);
  }

  if (paymentsResult.error) {
    throw new Error(paymentsResult.error.message);
  }

  return {
    costs: costsResult.count || 0,
    payments: paymentsResult.count || 0,
  };
};

const rollbackManualImport = async (params: {
  currentCost: Cost;
  invoiceBefore: SupplierInvoiceSnapshot | null;
  paymentBefore: SupplierPaymentSnapshot | null;
  updatedCostSnapshot: Cost | null;
  createdInvoiceIds: string[];
  previousInvoiceId: string | null;
  invoiceAfter: SupplierInvoiceSnapshot | null;
}) => {
  const { currentCost, invoiceBefore, paymentBefore, updatedCostSnapshot, createdInvoiceIds, previousInvoiceId, invoiceAfter } = params;

  if (updatedCostSnapshot) {
    await supabase
      .from('costs')
      .update(buildRestorableCostPatch(currentCost))
      .eq('id', currentCost.id);
  }

  if (paymentBefore?.id) {
    await supabase
      .from('supplier_payments')
      .update({
        supplier_id: paymentBefore.supplier_id,
        supplier_invoice_id: paymentBefore.supplier_invoice_id,
        reference_number: paymentBefore.reference_number,
        description: paymentBefore.description,
        amount: paymentBefore.amount,
        due_date: paymentBefore.due_date,
        status: paymentBefore.status,
        notes: paymentBefore.notes,
      })
      .eq('id', paymentBefore.id);
  }

  if (invoiceBefore && invoiceAfter?.id) {
    await supabase
      .from('supplier_invoices')
      .update(buildInvoicePatch(invoiceBefore))
      .eq('id', invoiceAfter.id);
  }

  if (createdInvoiceIds.length > 0) {
    await supabase.from('costs').update({ supplier_invoice_id: previousInvoiceId }).eq('id', currentCost.id);
    await supabase.from('supplier_invoices').delete().in('id', createdInvoiceIds);
  }
};

const buildRestorableCostPatch = (cost: Partial<Cost>) => ({
  amount: cost.amount ?? 0,
  description: cost.description ?? '',
  document_number: cost.document_number ?? null,
  document_type: cost.document_type ?? null,
  service_folio: cost.service_folio ?? null,
  supplier_id: cost.supplier_id ?? null,
  supplier_invoice_id: cost.supplier_invoice_id ?? null,
  notes: cost.notes ?? null,
});

const buildInvoicePatch = (invoice: SupplierInvoiceSnapshot) => ({
  supplier_id: invoice.supplier_id,
  invoice_number: invoice.invoice_number,
  issue_date: invoice.issue_date,
  due_date: invoice.due_date,
  amount: invoice.amount,
  net_amount: invoice.net_amount,
  tax_amount: invoice.tax_amount,
  description: invoice.description,
  product_service_description: invoice.product_service_description,
  currency: invoice.currency,
  status: invoice.status,
  xml_file_name: invoice.xml_file_name,
  source_module: invoice.source_module,
});

const insertManualSnapshot = async (params: {
  costId: string;
  userId: string;
  summary: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  context: JsonRecord;
}) => {
  const { error } = await supabase.rpc('log_cost_snapshot_entry', {
    p_cost_id: params.costId,
    p_field_name: params.fieldName,
    p_old_value: JSON.stringify(params.oldValue ?? null),
    p_new_value: JSON.stringify(params.newValue ?? null),
    p_change_summary: params.summary,
    p_change_context: JSON.stringify(params.context),
  });

  if (error) {
    throw new Error(error.message);
  }
};

const insertAuditLog = async (params: {
  userId: string;
  operation: string;
  tableName: string;
  oldData: JsonRecord;
  newData: JsonRecord;
}) => {
  const { error } = await supabase.rpc('log_audit_entry', {
    p_table_name: params.tableName,
    p_operation: params.operation,
    p_old_data: params.oldData as Json,
    p_new_data: params.newData as Json,
  });

  if (error) {
    throw new Error(error.message);
  }
};

const mapInvoiceSnapshot = (data: any): SupplierInvoiceSnapshot => ({
  id: data.id,
  supplier_id: data.supplier_id ?? null,
  invoice_number: data.invoice_number,
  issue_date: data.issue_date,
  due_date: data.due_date,
  amount: Number(data.amount || 0),
  net_amount: Number(data.net_amount || 0),
  tax_amount: data.tax_amount === null || data.tax_amount === undefined ? null : Number(data.tax_amount),
  description: data.description ?? null,
  product_service_description: data.product_service_description || '',
  currency: data.currency ?? null,
  status: data.status ?? null,
  xml_file_name: data.xml_file_name ?? null,
  source_module: data.source_module || MANUAL_XML_SOURCE,
});

const mapPaymentSnapshot = (data: any): SupplierPaymentSnapshot => ({
  id: data.id,
  supplier_id: data.supplier_id ?? null,
  supplier_invoice_id: data.supplier_invoice_id ?? null,
  reference_number: data.reference_number ?? null,
  description: data.description,
  amount: Number(data.amount || 0),
  due_date: data.due_date,
  status: data.status,
  notes: data.notes ?? null,
});

const safeParseContext = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const safeParseJson = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};
