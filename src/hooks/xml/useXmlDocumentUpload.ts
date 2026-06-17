import { useState } from 'react';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierPayments } from '@/hooks/useSupplierPayments';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useSupplierInvoiceDuplicateCheck, SupplierInvoiceDuplicateResult } from '@/hooks/useDuplicateCheck';
import { useLinkInvoiceToCost } from '@/hooks/useCosts';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { useBatchProgress } from '@/components/ui/batch-progress-modal';
import { supabase } from '@/integrations/supabase/client';
import { findSupplierByIdentity } from '@/utils/supplierIdentity';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { XMLCompleteParseResult, XMLDocumentData } from '@/types/suppliers';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  HistoricalGlosaCandidate,
  HistoricalGlosaSuggestion,
  buildHistoricalGlosaSuggestion,
  getDocumentStateKey,
} from '@/utils/xml/xmlGlosaHelpers';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';

const logger = createLogger('useXmlDocumentUpload');

interface MatchedCost {
  id: string;
  description: string;
  amount: number;
  date: string;
  payment_date: string | null;
  supplier_name: string;
  supplier_payment_id: string | null;
  has_invoice: boolean;
}

interface UseXmlDocumentUploadOptions {
  onSuccess: () => void;
  onClose: () => void;
}

export function useXmlDocumentUpload({ onSuccess, onClose }: UseXmlDocumentUploadOptions) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, string>>({});
  const [supplierSubcategoryMapping, setSupplierSubcategoryMapping] = useState<Record<string, string>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [createPayments, setCreatePayments] = useState(true);
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd] = useState<number>(30);
  const [supplierPaymentCondition, setSupplierPaymentCondition] = useState<Record<string, 'none' | 'credit' | string>>({});
  const [supplierCreditDate, setSupplierCreditDate] = useState<Record<string, string>>({});
  const [, setBulkDueDate] = useState<string>('');
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'pending' | 'paid'>>({});
  const [documentDescriptionOverrides, setDocumentDescriptionOverrides] = useState<Record<string, string>>({});
  const [expandedDocumentDetails, setExpandedDocumentDetails] = useState<Record<string, boolean>>({});
  const [historicalGlosaSuggestions, setHistoricalGlosaSuggestions] = useState<Record<string, HistoricalGlosaSuggestion>>({});
  const [duplicateResults, setDuplicateResults] = useState<SupplierInvoiceDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [matchedCosts, setMatchedCosts] = useState<Record<string, MatchedCost[]>>({});
  const [linkDecisions, setLinkDecisions] = useState<Record<string, string | 'new'>>({});
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  const [expandedSearchKeys, setExpandedSearchKeys] = useState<Set<string>>(new Set());
  const [expandingSearchKey, setExpandingSearchKey] = useState<string | null>(null);

  const { suppliers, createSupplier } = useSuppliers();
  const { createPayment, updatePayment } = useSupplierPayments();
  const { checkDuplicates } = useSupplierInvoiceDuplicateCheck();
  const linkInvoiceMutation = useLinkInvoiceToCost();
  const batchProgress = useBatchProgress();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));

  const resolveCategoryId = (rawCategory?: string | null) => {
    const normalized = rawCategory?.trim();
    if (!normalized) return '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
    if (isUuid) return normalized;
    const lower = normalized.toLowerCase();
    return activeCategories.find(c => c.id === normalized || c.name.toLowerCase() === lower || c.label.toLowerCase() === lower)?.id || '';
  };

  const getSupplierCondition = (rut: string) => supplierPaymentCondition[rut] ?? 'none';

  const applyConditionToSupplierDocuments = (
    supplierRut: string,
    condition: 'none' | 'credit' | string,
    creditDate?: string,
    docs?: XMLDocumentData[]
  ) => {
    const documents = docs ?? parseResult?.documents ?? [];
    if (condition === 'none') return;
    const nextOverrides: Record<string, string> = {};
    documents.forEach(doc => {
      if (doc.supplier_rut !== supplierRut || !doc.issue_date) return;
      const key = getDocumentStateKey(doc);
      if (condition === 'credit') { if (creditDate) nextOverrides[key] = creditDate; return; }
      const term = paymentTerms.find(t => t.id === condition);
      if (term) nextOverrides[key] = format(addDays(safeParseDateOnly(doc.issue_date), term.days), 'yyyy-MM-dd');
    });
    setDueDateOverrides(prev => ({ ...prev, ...nextOverrides }));
  };

  const buildSuggestedGlosa = (doc: XMLDocumentData) => {
    if (doc.items && doc.items.length > 0) {
      const lines = doc.items.map(it => {
        const desc = (it.description || '').trim();
        if (!desc) return '';
        const qty = typeof it.quantity === 'number' && isFinite(it.quantity) && it.quantity > 0 ? it.quantity : null;
        const unit = typeof it.unit_price === 'number' && isFinite(it.unit_price) && it.unit_price > 0 ? it.unit_price : null;
        const tot = typeof it.total === 'number' && isFinite(it.total) && it.total > 0 ? it.total : null;
        const parts: string[] = [desc];
        if (qty && unit && tot) parts.push(`— ${qty} x $${unit.toLocaleString('es-CL', { maximumFractionDigits: 0 })} = $${tot.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`);
        else if (qty && unit) parts.push(`— ${qty} x $${unit.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`);
        else if (qty) parts.push(`— ${qty} u.`);
        else if (tot) parts.push(`— $${tot.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`);
        return parts.join(' ');
      }).filter(t => t.length > 0);
      if (lines.length > 0) {
        const body = lines.join('\n');
        const folioLine = doc.folio ? `Folio ${doc.folio}` : '';
        return [body, folioLine].filter(Boolean).join('\n').trim();
      }
    }
    const typeLabel = (doc.document_type || 'Factura').trim();
    if (doc.folio) return `${typeLabel} ${doc.folio}`.trim();
    return typeLabel || 'Factura';
  };

  const getEffectiveGlosa = (doc: XMLDocumentData) => {
    const key = getDocumentStateKey(doc);
    const hasOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, key);
    const override = hasOverride ? documentDescriptionOverrides[key] : undefined;
    const value = (override ?? buildSuggestedGlosa(doc)).trim();
    return value.length > 0 ? value : buildSuggestedGlosa(doc);
  };

  async function initAfterParse(result: XMLCompleteParseResult) {
    const uniqueSuppliers = result.suppliers;
    const validSuppliers = new Set(uniqueSuppliers.filter(s => s.name && s.rut).map(s => s.rut));
    const validDocuments = new Set(result.documents.filter(d => d.folio && d.total_amount > 0).map(getDocumentStateKey));
    setSelectedSuppliers(validSuppliers);
    setSelectedDocuments(validDocuments);

    const categoryMap: Record<string, string> = {};
    const subcategoryMap: Record<string, string> = {};
    const nextHistoricalGlosaSuggestions: Record<string, HistoricalGlosaSuggestion> = {};
    uniqueSuppliers.forEach(supplier => {
      const parsedSubcategory = (supplier as any).subcategory?.trim();
      categoryMap[supplier.rut] = supplier.category || 'otros';
      if (parsedSubcategory) subcategoryMap[supplier.rut] = parsedSubcategory;
    });

    const initialSupplierCondition: Record<string, 'none' | 'credit' | string> = {};
    const initialSupplierCreditDate: Record<string, string> = {};

    try {
      const supplierRuts = uniqueSuppliers.map(s => s.rut).filter(Boolean);
      if (supplierRuts.length > 0) {
        const { data, error } = await supabase.from('inventory_suppliers').select('id, rut, category, subcategory, default_payment_term_id, credit_date').in('rut', supplierRuts);
        if (!error && Array.isArray(data)) {
          data.forEach((row: any) => {
            if (!row?.rut) return;
            if (row.category) categoryMap[row.rut] = row.category;
            if (row.subcategory?.trim()) subcategoryMap[row.rut] = row.subcategory.trim();
            if (row.credit_date) { initialSupplierCondition[row.rut] = 'credit'; initialSupplierCreditDate[row.rut] = row.credit_date; }
            else if (row.default_payment_term_id) initialSupplierCondition[row.rut] = row.default_payment_term_id;
            else initialSupplierCondition[row.rut] = 'none';
          });

          const supplierRowsWithId = data.filter((row: any) => row?.id && row?.rut);
          const supplierIdByRut = new Map<string, string>();
          supplierRowsWithId.forEach((row: any) => supplierIdByRut.set(row.rut, row.id));
          const supplierIds = supplierRowsWithId.map((row: any) => row.id);

          if (supplierIds.length > 0) {
            const [{ data: historicalPayments }, { data: historicalCosts }] = await Promise.all([
              supabase.from('supplier_payments').select('supplier_id, description, amount, due_date, created_at').in('supplier_id', supplierIds).not('description', 'is', null).order('due_date', { ascending: false }).limit(500),
              supabase.from('costs').select('supplier_id, description, amount, date, created_at').in('supplier_id', supplierIds).not('description', 'is', null).order('date', { ascending: false }).limit(500),
            ]);

            const combinedHistory: HistoricalGlosaCandidate[] = [
              ...((historicalPayments || []).map((row: any) => ({ supplier_id: row.supplier_id, description: row.description, amount: row.amount, date: row.due_date, created_at: row.created_at })) as HistoricalGlosaCandidate[]),
              ...((historicalCosts || []) as HistoricalGlosaCandidate[]),
            ];
            const recordsBySupplierId = new Map<string, HistoricalGlosaCandidate[]>();
            combinedHistory.forEach((row: HistoricalGlosaCandidate) => {
              if (!row?.supplier_id) return;
              const existing = recordsBySupplierId.get(row.supplier_id) || [];
              existing.push(row);
              recordsBySupplierId.set(row.supplier_id, existing);
            });
            result.documents.forEach(doc => {
              const supplierId = supplierIdByRut.get(doc.supplier_rut);
              if (!supplierId) return;
              const suggestion = buildHistoricalGlosaSuggestion(doc, recordsBySupplierId.get(supplierId) || []);
              if (suggestion) nextHistoricalGlosaSuggestions[getDocumentStateKey(doc)] = suggestion;
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error cargando configuración de crédito:', error);
    }

    uniqueSuppliers.forEach(s => { if (!initialSupplierCondition[s.rut]) initialSupplierCondition[s.rut] = 'none'; });
    setSupplierCategoryMapping(categoryMap);
    setSupplierSubcategoryMapping(subcategoryMap);
    setSupplierPaymentCondition(initialSupplierCondition);
    setSupplierCreditDate(initialSupplierCreditDate);
    setHistoricalGlosaSuggestions(nextHistoricalGlosaSuggestions);

    if (result.documents.length > 0 && result.documents[0].issue_date) {
      setBulkDueDate(format(addDays(safeParseDateOnly(result.documents[0].issue_date), 30), 'yyyy-MM-dd'));
    } else {
      setBulkDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    }

    const initialDueOverrides: Record<string, string> = {};
    result.documents.forEach(doc => {
      if (doc.issue_date) initialDueOverrides[getDocumentStateKey(doc)] = format(addDays(safeParseDateOnly(doc.issue_date), defaultDaysToAdd), 'yyyy-MM-dd');
    });
    setDueDateOverrides(initialDueOverrides);
    Object.entries(initialSupplierCondition).forEach(([rut, condition]) => {
      if (condition === 'credit') applyConditionToSupplierDocuments(rut, 'credit', initialSupplierCreditDate[rut]);
      else if (condition !== 'none') applyConditionToSupplierDocuments(rut, condition);
    });

    if (!result.success) {
      toast.error('Se encontraron errores en el archivo XML');
    } else {
      toast.success(`Análisis completado: ${result.totalSuppliers} proveedores, ${result.totalDocuments} documentos. Verificando duplicados...`);

      if (result.documents.length > 0) {
        setIsCheckingDuplicates(true);
        try {
          const itemsToCheck = result.documents.map(doc => ({ folio: doc.folio, supplier_rut: doc.supplier_rut, amount: doc.total_amount }));
          const duplicates = await checkDuplicates(itemsToCheck);
          setDuplicateResults(duplicates);
          if (duplicates.length > 0) {
            const exactDuplicates = duplicates.filter(d => d.matchType === 'exact_folio');
            const similarDuplicates = duplicates.filter(d => d.matchType === 'similar');
            if (exactDuplicates.length > 0) {
              const newSelection = new Set(validDocuments);
              exactDuplicates.forEach(d => { const doc = result.documents[d.index]; if (doc) newSelection.delete(getDocumentStateKey(doc)); });
              setSelectedDocuments(newSelection);
              setShowDuplicateWarning(true);
              toast.warning(`Se detectaron ${exactDuplicates.length} duplicados reales y ${similarDuplicates.length} coincidencias similares. Los duplicados por folio fueron deseleccionados.`);
            } else if (similarDuplicates.length > 0) {
              toast.info(`Se encontraron ${similarDuplicates.length} coincidencias similares para revisar.`);
            }
          }
        } catch (dupError) {
          logger.error('Error checking duplicates:', dupError);
        } finally {
          setIsCheckingDuplicates(false);
        }
      }

      if (result.documents.length > 0) {
        setIsSearchingMatches(true);
        try {
          const matches: Record<string, MatchedCost[]> = {};
          const decisions: Record<string, string | 'new'> = {};
          for (const doc of result.documents) {
            if (!doc.supplier_rut || !doc.total_amount) continue;
            const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
            const dateFrom = new Date(issueDate); dateFrom.setDate(dateFrom.getDate() - 30);
            const dateTo = new Date(issueDate); dateTo.setDate(dateTo.getDate() + 30);
            const { data, error } = await supabase.rpc('find_matching_costs_for_invoice', { p_supplier_rut: doc.supplier_rut, p_amount: doc.total_amount, p_date_from: format(dateFrom, 'yyyy-MM-dd'), p_date_to: format(dateTo, 'yyyy-MM-dd') });
            if (!error && data && data.length > 0) {
              const exactMatch = data.find((m: any) => Math.abs(m.amount - doc.total_amount) < 1);
              const documentKey = getDocumentStateKey(doc);
              matches[documentKey] = data as MatchedCost[];
              decisions[documentKey] = exactMatch ? (exactMatch as any).id : 'new';
            }
          }
          setMatchedCosts(matches);
          setLinkDecisions(decisions);
          const matchCount = Object.keys(matches).length;
          if (matchCount > 0) toast.info(`🔗 Se encontraron ${matchCount} costos existentes que coinciden con documentos del XML`);
        } catch (matchError) {
          logger.error('Error searching matches:', matchError);
        } finally {
          setIsSearchingMatches(false);
        }
      }
    }
  }

  const findSupplierInDb = async (rut: string): Promise<string | null> => {
    const normalizedRut = rut.replace(/[^0-9kK]/gi, '').toUpperCase();
    if (!normalizedRut) return null;
    const { data } = await supabase.from('inventory_suppliers').select('id, rut').order('created_at', { ascending: false });
    if (!data) return null;
    const match = data.find((s: any) => (s.rut || '').replace(/[^0-9kK]/gi, '').toUpperCase() === normalizedRut);
    return match?.id || null;
  };

  const expandMatchSearchForDoc = async (doc: XMLDocumentData, windowDays = 15) => {
    if (!doc.supplier_rut || !doc.total_amount) { toast.warning('Este documento no tiene RUT o monto.'); return; }
    const documentKey = getDocumentStateKey(doc);
    setExpandingSearchKey(documentKey);
    try {
      const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
      const dateFrom = new Date(issueDate); dateFrom.setDate(dateFrom.getDate() - windowDays);
      const dateTo = new Date(issueDate); dateTo.setDate(dateTo.getDate() + windowDays);
      const { data, error } = await supabase.rpc('find_matching_costs_for_invoice', { p_supplier_rut: doc.supplier_rut, p_amount: doc.total_amount, p_date_from: format(dateFrom, 'yyyy-MM-dd'), p_date_to: format(dateTo, 'yyyy-MM-dd') });
      if (error) throw error;
      const results = (data || []) as MatchedCost[];
      setMatchedCosts(prev => ({ ...prev, [documentKey]: results }));
      setExpandedSearchKeys(prev => { const next = new Set(prev); next.add(documentKey); return next; });
      const exact = results.find(m => Math.abs(Number(m.amount) - doc.total_amount) < 1);
      if (exact && (!linkDecisions[documentKey] || linkDecisions[documentKey] === 'new')) setLinkDecisions(prev => ({ ...prev, [documentKey]: exact.id }));
      if (results.length === 0) toast.info(`No se encontraron costos coincidentes en ±${windowDays} días.`);
      else toast.success(`${results.length} costo(s) encontrado(s) en ±${windowDays} días.`);
    } catch (e: any) {
      logger.error('expandMatchSearchForDoc error', e);
      toast.error('Error al ampliar la búsqueda de costos.');
    } finally {
      setExpandingSearchKey(null);
    }
  };

  const getMatchQuality = (cost: MatchedCost, doc: XMLDocumentData): { label: string; tone: 'exact' | 'similar' | 'possible' } => {
    const diff = Math.abs(Number(cost.amount) - (doc.total_amount || 0));
    if (diff < 1) return { label: '✓ Exacto', tone: 'exact' };
    const ratio = doc.total_amount ? diff / doc.total_amount : 1;
    if (ratio <= 0.02) return { label: '≈ Casi exacto', tone: 'exact' };
    if (ratio <= 0.05) return { label: '≈ Similar', tone: 'similar' };
    return { label: '~ Posible', tone: 'possible' };
  };

  const getCostAgeLabel = (cost: MatchedCost, doc: XMLDocumentData): string => {
    try {
      const costDate = safeParseDateOnly(cost.date);
      const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
      const days = Math.round((issueDate.getTime() - costDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return 'mismo día';
      if (days > 0) return `${days} día${days > 1 ? 's' : ''} antes`;
      return `${Math.abs(days)} día${Math.abs(days) > 1 ? 's' : ''} después`;
    } catch { return cost.date; }
  };

  const handleLinkDecisionChange = (documentKey: string, newValue: string, doc: XMLDocumentData) => {
    const candidates = matchedCosts[documentKey] || [];
    const currentSelected = candidates.find(c => c.id === linkDecisions[documentKey]);
    const wasExactMatch = currentSelected && Math.abs(Number(currentSelected.amount) - (doc.total_amount || 0)) < 1;
    if (wasExactMatch && newValue === 'new') {
      const confirmed = window.confirm('⚠️ Hay un costo existente con monto idéntico sin factura vinculada.\n\nSi creas uno nuevo, ese costo quedará huérfano y duplicarás el gasto en el sistema.\n\n¿Seguro que quieres crear un costo nuevo en vez de vincular el existente?');
      if (!confirmed) return;
    }
    setLinkDecisions(prev => ({ ...prev, [documentKey]: newValue }));
  };

  const getDuplicateInfoForDocument = (document: XMLDocumentData): SupplierInvoiceDuplicateResult | undefined =>
    duplicateResults.find(d => { const doc = parseResult?.documents[d.index]; return !!doc && getDocumentStateKey(doc) === getDocumentStateKey(document); });

  const handleUploadData = async () => {
    if (!parseResult) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const totalItems = selectedSuppliers.size + (createPayments ? selectedDocuments.size : 0);
      let processed = 0;
      let suppliersCreated = 0, suppliersReused = 0, suppliersFailed = 0, paymentsCreated = 0, paymentsFailed = 0;
      const createdSupplierMap = new Map<string, string>();

      for (const supplier of parseResult.suppliers) {
        if (!selectedSuppliers.has(supplier.rut)) continue;
        try {
          const existingSupplier = findSupplierByIdentity(suppliers, supplier);
          if (!existingSupplier) {
            try {
              await new Promise<void>((resolve, reject) => {
                createSupplier({ ...supplier, category: resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category), subcategory: (supplierSubcategoryMapping[supplier.rut] || '').trim() || undefined }, {
                  onSuccess: newSupplier => { createdSupplierMap.set(supplier.rut, newSupplier.id); suppliersCreated++; resolve(); },
                  onError: reject,
                });
              });
            } catch {
              logger.warn(`Create failed for ${supplier.name}, trying DB lookup...`);
              const dbSupplierId = await findSupplierInDb(supplier.rut);
              if (dbSupplierId) { createdSupplierMap.set(supplier.rut, dbSupplierId); suppliersReused++; }
              else { logger.error(`Could not find or create supplier ${supplier.name}`); suppliersFailed++; }
            }
          } else {
            createdSupplierMap.set(supplier.rut, existingSupplier.id);
            suppliersReused++;
          }

          const mappedId = createdSupplierMap.get(supplier.rut);
          if (mappedId) {
            const condition = getSupplierCondition(supplier.rut);
            const updateData: Record<string, any> = {
              category: resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category || 'otros'),
              subcategory: (supplierSubcategoryMapping[supplier.rut] || '').trim() || null,
            };
            if (condition === 'credit') { updateData.credit_date = supplierCreditDate[supplier.rut] || null; updateData.default_payment_term_id = null; }
            else if (condition !== 'none') { updateData.default_payment_term_id = condition; updateData.credit_date = null; }
            else { updateData.default_payment_term_id = null; updateData.credit_date = null; }
            try { await supabase.from('inventory_suppliers').update(updateData).eq('id', mappedId); } catch (e) { logger.error('Error actualizando configuración de crédito:', e); }
          }
          processed++;
          setUploadProgress((processed / totalItems) * 100);
        } catch (error) {
          logger.error(`Error processing supplier ${supplier.name}:`, error);
          suppliersFailed++;
        }
      }

      if (createPayments) {
        const parser = new XMLSupplierParser();
        const paymentsData = parser.convertDocumentsToPayments(parseResult.documents.filter(d => selectedDocuments.has(getDocumentStateKey(d))), parseResult.suppliers, dueDateOverrides);

        let exactFolioUpdated = 0, exactFolioSkipped = 0, linkedCount = 0;
        batchProgress.start('Cargando Documentos desde XML', paymentsData.length);

        for (const paymentData of paymentsData) {
          let createdPaymentId: string | null = null;
          batchProgress.update(paymentsCreated + paymentsFailed, `${paymentData.reference_number}`);
          try {
            let supplierId = createdSupplierMap.get(paymentData.supplier_rut);
            if (!supplierId) {
              const dbId = await findSupplierInDb(paymentData.supplier_rut);
              if (dbId) { supplierId = dbId; createdSupplierMap.set(paymentData.supplier_rut, dbId); }
              else { logger.error(`No supplier found for RUT ${paymentData.supplier_rut}`); paymentsFailed++; continue; }
            }

            const docFolio = paymentData.reference_number || '';
            const originalDoc = parseResult.documents.find(d => d.folio === docFolio && d.supplier_rut === paymentData.supplier_rut);
            const documentKey = originalDoc ? getDocumentStateKey(originalDoc) : `${paymentData.supplier_rut || 'sin-rut'}::${docFolio || 'sin-folio'}`;
            const status = statusOverrides[documentKey] || 'pending';
            const paidDate = status === 'paid' ? paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd') : undefined;

            let finalDueDate = paymentData.due_date;
            if (!finalDueDate) {
              const condition = getSupplierCondition(paymentData.supplier_rut);
              if (condition === 'credit') finalDueDate = supplierCreditDate[paymentData.supplier_rut] || finalDueDate;
              else if (condition !== 'none' && originalDoc?.issue_date) {
                const term = paymentTerms.find(t => t.id === condition);
                if (term) finalDueDate = format(addDays(safeParseDateOnly(originalDoc.issue_date), term.days), 'yyyy-MM-dd');
              }
            }

            if (docFolio) {
              const { data: existingPayment } = await supabase.from('supplier_payments').select('id').eq('supplier_id', supplierId).eq('reference_number', docFolio).maybeSingle();
              if (existingPayment) { logger.debug(`Folio ${docFolio} ya existe, omitiendo`); toast.info(`Folio ${docFolio} ya registrado, omitido`); processed++; continue; }
            }

            const linkCostId = linkDecisions[documentKey];
            if (linkCostId && linkCostId !== 'new' && originalDoc) {
              await linkInvoiceMutation.mutateAsync({ costId: linkCostId, supplierId, invoiceData: { folio: docFolio, issueDate: originalDoc.issue_date, dueDate: originalDoc.due_date || paymentData.due_date, amount: originalDoc.total_amount, netAmount: originalDoc.net_amount, taxAmount: originalDoc.vat_amount, description: originalDoc.description, currency: originalDoc.currency, paidDate, status: status as 'pending' | 'paid' } });
              linkedCount++; processed++; continue;
            }

            const duplicateInfo = originalDoc ? getDuplicateInfoForDocument(originalDoc) : undefined;
            if (duplicateInfo?.matchType === 'exact_folio' && duplicateInfo.existingPayment?.id) {
              if (status === 'paid') {
                await new Promise<void>((resolve, reject) => { updatePayment({ id: duplicateInfo.existingPayment!.id, data: { status: 'paid', paid_date: paidDate, paid_amount: paymentData.amount } }, { onSuccess: () => resolve(), onError: reject }); });
                exactFolioUpdated++;
              } else { exactFolioSkipped++; }
              processed++; continue;
            }

            const categoryId = resolveCategoryId(supplierCategoryMapping[paymentData.supplier_rut] || paymentData.category) || paymentData.category;
            const subcatName = supplierSubcategoryMapping[paymentData.supplier_rut] || null;
            const effectiveDescription = originalDoc ? getEffectiveGlosa(originalDoc) : paymentData.description;

            await new Promise<any>((resolve, reject) => {
              createPayment({ supplier_id: supplierId, amount: paymentData.amount, due_date: finalDueDate || paymentData.due_date, description: effectiveDescription, category: categoryId, subcategory: subcatName, reference_number: paymentData.reference_number, notes: paymentData.notes, status, paid_date: paidDate, paid_amount: status === 'paid' ? paymentData.amount : undefined }, { onSuccess: data => { createdPaymentId = (data as any)?.id ?? null; resolve(data); }, onError: reject });
            });
            paymentsCreated++; processed++;
          } catch (error) {
            logger.error(`Error creating payment for ${paymentData.reference_number}:`, error);
            try {
              if (createdPaymentId) {
                await supabase.from('costs').delete().eq('supplier_payment_id', createdPaymentId);
                await supabase.from('supplier_payments').delete().eq('id', createdPaymentId);
              }
            } catch (rollbackError) { logger.error(`Rollback error:`, rollbackError); }
            paymentsFailed++;
          }
        }

        if (paymentsFailed === 0) { batchProgress.complete(); setTimeout(() => batchProgress.close(), 1500); }
        else batchProgress.error(`${paymentsFailed} de ${paymentsData.length} con error`);
        if (exactFolioUpdated > 0 || exactFolioSkipped > 0) toast.message(`Duplicados por folio: ${exactFolioUpdated} actualizado(s), ${exactFolioSkipped} omitido(s)`);
        if (linkedCount > 0) toast.success(`🔗 ${linkedCount} factura(s) vinculada(s) a costos existentes`);
      }

      const totalSuccesses = (suppliersCreated + suppliersReused) + paymentsCreated;
      const totalFailures = suppliersFailed + paymentsFailed;
      if (totalFailures > 0 && totalSuccesses === 0) toast.error('Importación fallida.');
      else if (totalFailures > 0) { toast.warning(`Importación parcial: ${paymentsCreated} pago(s) creado(s), ${totalFailures} error(es)`); onSuccess(); onClose(); }
      else { toast.success(`Importación completada: ${suppliersCreated > 0 ? `${suppliersCreated} proveedor(es) creado(s), ` : ''}${suppliersReused > 0 ? `${suppliersReused} existente(s), ` : ''}${paymentsCreated > 0 ? `${paymentsCreated} pago(s) registrado(s)` : 'sin pagos nuevos'}`); onSuccess(); onClose(); }
    } catch (error) {
      logger.error('Error uploading data:', error);
      toast.error('Error durante la importación');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive,
    handleAnalyzeFile: triggerAnalyze, reset: resetParsing,
  } = useXMLParsing({
    onFileSelected: () => {
      setUploadProgress(0);
      setSupplierCategoryMapping({});
      setSelectedSuppliers(new Set());
      setSelectedDocuments(new Set());
      setDocumentDescriptionOverrides({});
      setExpandedDocumentDetails({});
      setHistoricalGlosaSuggestions({});
      setExpandedSearchKeys(new Set());
      setMatchedCosts({});
      setLinkDecisions({});
    },
    onParsed: initAfterParse,
  });

  const handleCategoryChange = (rut: string, category: string) => {
    setSupplierCategoryMapping(prev => ({ ...prev, [rut]: category }));
    setSupplierSubcategoryMapping(prev => ({ ...prev, [rut]: '' }));
  };
  const handleSubcategoryChange = (rut: string, subcategory: string) => setSupplierSubcategoryMapping(prev => ({ ...prev, [rut]: subcategory }));
  const toggleSupplierSelection = (rut: string) => setSelectedSuppliers(prev => { const s = new Set(prev); s.has(rut) ? s.delete(rut) : s.add(rut); return s; });
  const toggleDocumentSelection = (key: string) => setSelectedDocuments(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const reset = () => {
    resetParsing();
    setUploadProgress(0);
    setSupplierCategoryMapping({});
    setSupplierSubcategoryMapping({});
    setSelectedSuppliers(new Set());
    setSelectedDocuments(new Set());
    setCreatePayments(true);
    setDueDateOverrides({});
    setSupplierPaymentCondition({});
    setSupplierCreditDate({});
    setBulkDueDate('');
    setPaidDateOverrides({});
    setStatusOverrides({});
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setMatchedCosts({});
    setLinkDecisions({});
    setHistoricalGlosaSuggestions({});
  };

  const selectedTotalAmount = parseResult
    ? parseResult.documents.filter(d => selectedDocuments.has(getDocumentStateKey(d))).reduce((sum, d) => sum + d.total_amount, 0)
    : 0;

  return {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive, triggerAnalyze,
    isUploading, uploadProgress,
    isCheckingDuplicates, isSearchingMatches, showDuplicateWarning, setShowDuplicateWarning,
    selectedSuppliers, selectedDocuments, selectedTotalAmount,
    createPayments, setCreatePayments,
    supplierCategoryMapping, supplierSubcategoryMapping,
    supplierPaymentCondition, setSupplierPaymentCondition,
    supplierCreditDate, setSupplierCreditDate,
    dueDateOverrides, setDueDateOverrides,
    defaultDaysToAdd,
    paidDateOverrides, setPaidDateOverrides,
    statusOverrides, setStatusOverrides,
    documentDescriptionOverrides, setDocumentDescriptionOverrides,
    expandedDocumentDetails, setExpandedDocumentDetails,
    historicalGlosaSuggestions,
    duplicateResults, matchedCosts,
    linkDecisions, setLinkDecisions,
    expandedSearchKeys, expandingSearchKey,
    activeCategories, paymentTerms, loadingTerms, batchProgress,
    getSupplierCondition, getEffectiveGlosa, getDuplicateInfoForDocument,
    buildSuggestedGlosa, applyConditionToSupplierDocuments, resolveCategoryId,
    getMatchQuality, getCostAgeLabel, handleLinkDecisionChange,
    expandMatchSearchForDoc,
    handleUploadData, reset,
    handleCategoryChange, handleSubcategoryChange,
    toggleSupplierSelection, toggleDocumentSelection,
  };
}
