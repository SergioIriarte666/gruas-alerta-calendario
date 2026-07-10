import { useState } from 'react';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { useAddCost, useLinkInvoiceToCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { entityByRut, ENTITIES, LOWBOY_CRANE_IDS, EntityKey } from '@/lib/entities';
import { useCostDuplicateCheck, CostDuplicateResult } from '@/hooks/useDuplicateCheck';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { useBatchProgress } from '@/components/ui/batch-progress-modal';
import { supabase } from '@/integrations/supabase/client';
import { createDirectInventoryEntry } from '@/utils/inventoryConsumptionHelper';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { applyCurrentDocumentFolioToSuggestion } from '@/utils/xmlGlosaSuggestion';
import { XMLCompleteParseResult, XMLDocumentData } from '@/types/suppliers';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  HistoricalGlosaCandidate,
  HistoricalGlosaSuggestion,
  buildCompactXmlDescription,
  buildHistoricalGlosaSuggestion,
  getDocumentStateKey,
} from '@/utils/xml/xmlGlosaHelpers';

const logger = createLogger('useXmlCostUpload');

interface UseXmlCostUploadOptions {
  onSuccess?: (count: number) => void;
  onClose: () => void;
}

export function useXmlCostUpload({ onSuccess, onClose }: UseXmlCostUploadOptions) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [documentDescriptionOverrides, setDocumentDescriptionOverrides] = useState<Record<string, string>>({});
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, string>>({});
  const [supplierSubcategoryMapping, setSupplierSubcategoryMapping] = useState<Record<string, string>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd] = useState<number>(30);
  const [supplierPaymentCondition, setSupplierPaymentCondition] = useState<Record<string, 'none' | 'credit' | string>>({});
  const [supplierCreditDate, setSupplierCreditDate] = useState<Record<string, string>>({});
  const [paidOverrides, setPaidOverrides] = useState<Record<string, boolean>>({});
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [duplicateResults, setDuplicateResults] = useState<CostDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [syncToInventory, setSyncToInventory] = useState(false);
  const [matchedCosts, setMatchedCosts] = useState<Record<string, any[]>>({});
  const [linkDecisions, setLinkDecisions] = useState<Record<string, string | 'new'>>({});
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  const [expandedDocumentDetails, setExpandedDocumentDetails] = useState<Record<string, boolean>>({});
  const [historicalGlosaSuggestions, setHistoricalGlosaSuggestions] = useState<Record<string, HistoricalGlosaSuggestion>>({});
  const [craneIdByDocument, setCraneIdByDocument] = useState<Record<string, string | null>>({});
  const [paidByDocument, setPaidByDocument] = useState<Record<string, EntityKey>>({});

  const batchProgress = useBatchProgress();
  const { mutate: addCost } = useAddCost();
  const linkInvoiceMutation = useLinkInvoiceToCost();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));
  const { checkDuplicates } = useCostDuplicateCheck();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  const { cranes } = useCranes();
  const lowboyCraneOptions = cranes
    .filter(c => (LOWBOY_CRANE_IDS as readonly string[]).includes(c.id))
    .map(c => ({ id: c.id, label: `${c.licensePlate || 'Sin patente'} - ${c.brand} ${c.model}`.trim() }));
  const firstActiveLowboyCraneId = cranes.find(c => (LOWBOY_CRANE_IDS as readonly string[]).includes(c.id) && c.isActive)?.id
    ?? lowboyCraneOptions[0]?.id
    ?? null;

  const getDocumentEntity = (doc: XMLDocumentData): EntityKey => entityByRut(doc.receiver_rut) ?? ENTITIES.GRUAS_5_NORTE.key;

  const resolveCategoryId = (rawCategory?: string | null) => {
    const normalized = rawCategory?.trim();
    if (!normalized) return '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
    if (isUuid) return normalized;
    const directMatch = activeCategories.find(c => c.id === normalized);
    if (directMatch) return directMatch.id;
    const lower = normalized.toLowerCase();
    const nameMatch = activeCategories.find(c => c.name.toLowerCase() === lower || c.label.toLowerCase() === lower);
    return nameMatch?.id || '';
  };

  const getSupplierCondition = (rut: string) => supplierPaymentCondition[rut] ?? 'none';

  const buildSuggestedGlosa = buildCompactXmlDescription;

  const getEffectiveGlosa = (doc: XMLDocumentData) => {
    const key = getDocumentStateKey(doc);
    const hasOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, key);
    const override = hasOverride ? documentDescriptionOverrides[key] : undefined;
    const value = (override ?? buildSuggestedGlosa(doc)).trim();
    return value.length > 0 ? value : buildSuggestedGlosa(doc);
  };

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
      if (condition === 'credit') {
        if (creditDate) nextOverrides[key] = creditDate;
        return;
      }
      const term = paymentTerms.find(t => t.id === condition);
      if (term) nextOverrides[key] = format(addDays(safeParseDateOnly(doc.issue_date), term.days), 'yyyy-MM-dd');
    });
    setDueDateOverrides(prev => ({ ...prev, ...nextOverrides }));
  };

  async function initAfterParse(result: XMLCompleteParseResult) {
    const uniqueSuppliers = result.suppliers;
    const validSuppliers = new Set(uniqueSuppliers.filter(s => s.name && s.rut).map(s => s.rut));
    const validDocuments = new Set(result.documents.filter(d => d.folio && d.total_amount > 0).map(getDocumentStateKey));
    setSelectedSuppliers(validSuppliers);
    setSelectedDocuments(validDocuments);

    const categoryMap: Record<string, string> = {};
    const subcategoryMap: Record<string, string> = {};
    uniqueSuppliers.forEach(supplier => {
      const parsedSubcategory = (supplier as any).subcategory?.trim();
      categoryMap[supplier.rut] = supplier.category || 'otros';
      if (parsedSubcategory) subcategoryMap[supplier.rut] = parsedSubcategory;
    });

    const initialSupplierCondition: Record<string, 'none' | 'credit' | string> = {};
    const initialSupplierCreditDate: Record<string, string> = {};
    const nextHistoricalGlosaSuggestions: Record<string, HistoricalGlosaSuggestion> = {};

    try {
      const supplierRuts = uniqueSuppliers.map(s => s.rut).filter(Boolean);
      if (supplierRuts.length > 0) {
        const { data, error } = await supabase
          .from('inventory_suppliers')
          .select('id, rut, category, subcategory, default_payment_term_id, credit_date')
          .in('rut', supplierRuts);

        if (!error && Array.isArray(data)) {
          data.forEach((row: any) => {
            if (!row?.rut) return;
            if (row.category) categoryMap[row.rut] = row.category;
            if (row.subcategory?.trim()) subcategoryMap[row.rut] = row.subcategory.trim();
            if (row.credit_date) {
              initialSupplierCondition[row.rut] = 'credit';
              initialSupplierCreditDate[row.rut] = row.credit_date;
            } else if (row.default_payment_term_id) {
              initialSupplierCondition[row.rut] = row.default_payment_term_id;
            } else {
              initialSupplierCondition[row.rut] = 'none';
            }
          });

          const supplierRowsWithId = data.filter((row: any) => row?.id && row?.rut);
          const supplierIdByRut = new Map<string, string>();
          supplierRowsWithId.forEach((row: any) => supplierIdByRut.set(row.rut, row.id));

          const supplierIds = supplierRowsWithId.map((row: any) => row.id);
          if (supplierIds.length > 0) {
            const [
              { data: historicalCosts, error: historyError },
              { data: historicalPayments, error: paymentHistoryError },
            ] = await Promise.all([
              supabase.from('costs').select('supplier_id, description, amount, date, created_at').in('supplier_id', supplierIds).not('description', 'is', null).order('date', { ascending: false }).limit(500),
              supabase.from('supplier_payments').select('supplier_id, description, amount, due_date, created_at').in('supplier_id', supplierIds).not('description', 'is', null).order('due_date', { ascending: false }).limit(500),
            ]);

            if ((!historyError || !paymentHistoryError) && (Array.isArray(historicalCosts) || Array.isArray(historicalPayments))) {
              const costsBySupplierId = new Map<string, HistoricalGlosaCandidate[]>();
              const combinedHistory: HistoricalGlosaCandidate[] = [
                ...((historicalCosts || []) as HistoricalGlosaCandidate[]),
                ...((historicalPayments || []).map((row: any) => ({
                  supplier_id: row.supplier_id,
                  description: row.description,
                  amount: row.amount,
                  date: row.due_date,
                  created_at: row.created_at,
                })) as HistoricalGlosaCandidate[]),
              ];
              combinedHistory.forEach((row: HistoricalGlosaCandidate) => {
                if (!row?.supplier_id) return;
                const existing = costsBySupplierId.get(row.supplier_id) || [];
                existing.push(row);
                costsBySupplierId.set(row.supplier_id, existing);
              });
              result.documents.forEach(doc => {
                const supplierId = supplierIdByRut.get(doc.supplier_rut);
                if (!supplierId) return;
                const suggestion = buildHistoricalGlosaSuggestion(doc, costsBySupplierId.get(supplierId) || []);
                if (suggestion) nextHistoricalGlosaSuggestions[getDocumentStateKey(doc)] = suggestion;
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error cargando configuración de crédito:', error);
    }

    uniqueSuppliers.forEach(s => {
      if (!initialSupplierCondition[s.rut]) {
        const supplierDocs = result.documents.filter(d => d.supplier_rut === s.rut);
        const firstDocWithFmaPago = supplierDocs.find(d => d.payment_method_code !== undefined);
        if (firstDocWithFmaPago?.payment_method_code === 2) {
          initialSupplierCondition[s.rut] = 'credit';
          if (firstDocWithFmaPago.due_date) initialSupplierCreditDate[s.rut] = firstDocWithFmaPago.due_date;
        } else {
          initialSupplierCondition[s.rut] = 'none';
        }
      }
    });

    setSupplierCategoryMapping(categoryMap);
    setSupplierSubcategoryMapping(subcategoryMap);
    setSupplierPaymentCondition(initialSupplierCondition);
    setSupplierCreditDate(initialSupplierCreditDate);
    setHistoricalGlosaSuggestions(nextHistoricalGlosaSuggestions);

    const initialCraneByDoc: Record<string, string | null> = {};
    const initialPaidByDoc: Record<string, EntityKey> = {};
    result.documents.forEach(doc => {
      if (getDocumentEntity(doc) === ENTITIES.LOWBOY.key) {
        const key = getDocumentStateKey(doc);
        initialCraneByDoc[key] = firstActiveLowboyCraneId;
        initialPaidByDoc[key] = ENTITIES.GRUAS_5_NORTE.key;
      }
    });
    setCraneIdByDocument(initialCraneByDoc);
    setPaidByDocument(initialPaidByDoc);

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
          const itemsToCheck = result.documents.map(doc => ({
            date: doc.issue_date || format(new Date(), 'yyyy-MM-dd'),
            amount: doc.total_amount,
            description: doc.description || '',
            folio: doc.folio,
          }));
          const duplicatesFromHeuristic = await checkDuplicates(itemsToCheck);
          const duplicatesByIndex = new Map<number, CostDuplicateResult>();
          const rank = (t: CostDuplicateResult['matchType']) => (t === 'exact' ? 3 : t === 'folio' ? 2 : t === 'similar' ? 1 : 0);
          duplicatesFromHeuristic.forEach(d => duplicatesByIndex.set(d.index, d));

          try {
            const supplierRuts = Array.from(new Set(result.documents.map(d => d.supplier_rut).filter(Boolean)));
            if (supplierRuts.length > 0) {
              const { data: supplierRows, error: supplierError } = await supabase.from('inventory_suppliers').select('id, rut').in('rut', supplierRuts);
              if (!supplierError && Array.isArray(supplierRows)) {
                const supplierIdByRut = new Map<string, string>();
                supplierRows.forEach((row: any) => { if (row?.rut && row?.id) supplierIdByRut.set(row.rut, row.id); });

                for (const rut of supplierRuts) {
                  const supplierId = supplierIdByRut.get(rut);
                  if (!supplierId) continue;
                  const folios = Array.from(new Set(result.documents.filter(d => d.supplier_rut === rut).map(d => d.folio).filter(Boolean)));
                  if (folios.length === 0) continue;

                  const { data: existingPayments } = await supabase.from('supplier_payments').select('id, due_date, description, amount, reference_number, created_at').eq('supplier_id', supplierId).in('reference_number', folios);
                  const { data: existingCosts } = await supabase.from('costs').select('id, date, description, amount, service_folio, created_at').eq('supplier_id', supplierId).in('service_folio', folios);

                  if (Array.isArray(existingPayments) && existingPayments.length > 0) {
                    const existingByFolio = new Map<string, any>();
                    existingPayments.forEach((p: any) => { if (p?.reference_number) existingByFolio.set(p.reference_number, p); });
                    result.documents.forEach((doc, idx) => {
                      if (doc.supplier_rut !== rut || !doc.folio) return;
                      const existing = existingByFolio.get(doc.folio);
                      if (!existing) return;
                      const candidate: CostDuplicateResult = { index: idx, matchType: 'folio', existingCost: { id: existing.id, date: existing.due_date, description: existing.description, amount: existing.amount, service_folio: existing.reference_number, created_at: existing.created_at } };
                      const current = duplicatesByIndex.get(idx);
                      if (!current || rank(candidate.matchType) > rank(current.matchType)) duplicatesByIndex.set(idx, candidate);
                    });
                  }

                  if (Array.isArray(existingCosts) && existingCosts.length > 0) {
                    const existingByFolio = new Map<string, any>();
                    existingCosts.forEach((c: any) => { if (c?.service_folio) existingByFolio.set(c.service_folio, c); });
                    result.documents.forEach((doc, idx) => {
                      if (doc.supplier_rut !== rut || !doc.folio) return;
                      const existing = existingByFolio.get(doc.folio);
                      if (!existing) return;
                      const candidate: CostDuplicateResult = { index: idx, matchType: 'folio', existingCost: { id: existing.id, date: existing.date, description: existing.description, amount: existing.amount, service_folio: existing.service_folio, created_at: existing.created_at } };
                      const current = duplicatesByIndex.get(idx);
                      if (!current || rank(candidate.matchType) > rank(current.matchType)) duplicatesByIndex.set(idx, candidate);
                    });
                  }
                }
              }
            }
          } catch (error) {
            logger.error('Error checking cost folio duplicates:', error);
          }

          const duplicates = Array.from(duplicatesByIndex.values());
          setDuplicateResults(duplicates);

          if (duplicates.length > 0) {
            const exactDuplicates = duplicates.filter(d => d.matchType === 'exact' || d.matchType === 'folio');
            const similarDuplicates = duplicates.filter(d => d.matchType === 'similar');
            if (exactDuplicates.length > 0) {
              const newSelection = new Set(validDocuments);
              exactDuplicates.forEach(d => { const doc = result.documents[d.index]; if (doc) newSelection.delete(getDocumentStateKey(doc)); });
              setSelectedDocuments(newSelection);
              setShowDuplicateWarning(true);
              toast.warning(`Se detectaron ${exactDuplicates.length} duplicados reales y ${similarDuplicates.length} coincidencias similares. Los duplicados reales fueron deseleccionados para revisión.`);
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
          const matches: Record<string, any[]> = {};
          const decisions: Record<string, string | 'new'> = {};
          for (const doc of result.documents) {
            if (!doc.supplier_rut || !doc.total_amount) continue;
            const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
            const dateFrom = new Date(issueDate); dateFrom.setDate(dateFrom.getDate() - 30);
            const dateTo = new Date(issueDate); dateTo.setDate(dateTo.getDate() + 30);
            const { data, error } = await supabase.rpc('find_matching_costs_for_invoice', {
              p_supplier_rut: doc.supplier_rut,
              p_amount: doc.total_amount,
              p_date_from: format(dateFrom, 'yyyy-MM-dd'),
              p_date_to: format(dateTo, 'yyyy-MM-dd'),
            });
            if (!error && data && data.length > 0) {
              matches[getDocumentStateKey(doc)] = data;
              const exactMatch = data.find((m: any) => Math.abs(m.amount - doc.total_amount) < 1);
              decisions[getDocumentStateKey(doc)] = exactMatch ? (exactMatch as any).id : 'new';
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

  const findSupplierByRutOrName = async (rut: string, name: string): Promise<string | null> => {
    if (rut?.trim()) {
      const { data } = await supabase.from('inventory_suppliers').select('id').eq('rut', rut.trim()).maybeSingle();
      if (data) return data.id;
    }
    if (name?.trim()) {
      const { data } = await supabase.from('inventory_suppliers').select('id, name').ilike('name', `%${name.trim()}%`).limit(1).maybeSingle();
      if (data) return data.id;
    }
    return null;
  };

  const handleUploadCosts = async () => {
    if (!parseResult) return;
    if (costCategoriesData.length === 0) {
      toast.error('No hay categorías de costo cargadas. Reintenta en unos segundos o configura categorías.');
      return;
    }

    const docsToImport = parseResult.documents.filter(d => selectedDocuments.has(getDocumentStateKey(d)) && selectedSuppliers.has(d.supplier_rut));
    if (docsToImport.length === 0) { toast.error('No hay documentos seleccionados para importar'); return; }

    const selectedSupplierRuts = Array.from(new Set(docsToImport.map(d => d.supplier_rut)));
    const creditSuppliersMissingDate = selectedSupplierRuts.filter(rut => supplierPaymentCondition[rut] === 'credit' && !supplierCreditDate[rut]);
    if (creditSuppliersMissingDate.length > 0) { toast.error('Falta fecha de crédito para uno o más proveedores'); return; }

    const invalidCreditDateSuppliers = selectedSupplierRuts.filter(rut => {
      if (supplierPaymentCondition[rut] !== 'credit') return false;
      const creditDate = supplierCreditDate[rut];
      if (!creditDate) return true;
      const minIssue = docsToImport.filter(d => d.supplier_rut === rut && d.issue_date).map(d => safeParseDateOnly(d.issue_date!)).reduce<Date | null>((min, d) => (min && min.getTime() <= d.getTime() ? min : d), null);
      if (!minIssue) return false;
      return safeParseDateOnly(creditDate).getTime() < minIssue.getTime();
    });
    if (invalidCreditDateSuppliers.length > 0) { toast.error('La fecha de crédito no puede ser anterior a la fecha de emisión'); return; }

    setIsUploading(true);
    batchProgress.start('Cargando Gastos desde XML', docsToImport.length);
    let successCount = 0, errorCount = 0, skippedDuplicatesCount = 0;
    const failureMessages: string[] = [];

    const getErrorMessage = (error: unknown) => {
      if (error instanceof Error && error.message.trim()) return error.message;
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
      }
      return 'Error desconocido al guardar el gasto';
    };

    try {
      const supplierIdByRut = new Map<string, string>();
      const userId = (await supabase.auth.getUser()).data.user?.id || null;

      const getSelectedCondition = (rut: string) => supplierPaymentCondition[rut] ?? 'none';
      const getComputedDueDate = (doc: XMLDocumentData) => {
        const condition = getSelectedCondition(doc.supplier_rut);
        if (condition === 'credit') { const d = supplierCreditDate[doc.supplier_rut]; if (d) return d; }
        else if (condition !== 'none') { const term = paymentTerms.find(t => t.id === condition); if (term && doc.issue_date) return format(addDays(safeParseDateOnly(doc.issue_date), term.days), 'yyyy-MM-dd'); }
        return null;
      };

      const ensureSupplierId = async (rut: string, name: string) => {
        if (supplierIdByRut.has(rut)) return supplierIdByRut.get(rut)!;
        const existingId = await findSupplierByRutOrName(rut, name);
        if (existingId) { supplierIdByRut.set(rut, existingId); return existingId; }
        const { data: created, error } = await supabase.from('inventory_suppliers').insert([{ name: name || 'Proveedor', rut: rut || null, category: resolveCategoryId(supplierCategoryMapping[rut] || 'otros') || null, subcategory: (supplierSubcategoryMapping[rut] || '').trim() || null, is_active: true, created_by: userId }]).select('id').single();
        if (error || !created?.id) throw error || new Error('No se pudo crear el proveedor');
        supplierIdByRut.set(rut, created.id);
        return created.id;
      };

      const updateSupplierDefaults = async (supplierId: string, supplierRut: string) => {
        const condition = getSelectedCondition(supplierRut);
        const updateData: Record<string, any> = { category: resolveCategoryId(supplierCategoryMapping[supplierRut] || 'otros') || null, subcategory: (supplierSubcategoryMapping[supplierRut] || '').trim() || null, updated_by: userId };
        if (condition === 'credit') { updateData.credit_date = supplierCreditDate[supplierRut] || null; updateData.default_payment_term_id = null; }
        else if (condition !== 'none') { updateData.default_payment_term_id = condition; updateData.credit_date = null; }
        else { updateData.default_payment_term_id = null; updateData.credit_date = null; }
        const { error } = await supabase.from('inventory_suppliers').update(updateData).eq('id', supplierId);
        if (error) throw error;
      };

      const supplierNameByRut = new Map<string, string>();
      parseResult.suppliers.forEach(s => supplierNameByRut.set(s.rut, s.name || ''));
      for (const rut of selectedSupplierRuts) {
        const supplierId = await ensureSupplierId(rut, supplierNameByRut.get(rut) || '');
        await updateSupplierDefaults(supplierId, rut);
      }

      const existingCostKeys = new Set<string>();
      const existingPaymentKeys = new Set<string>();
      const foliosBySupplierId = new Map<string, string[]>();
      docsToImport.forEach(doc => {
        const supplierId = supplierIdByRut.get(doc.supplier_rut);
        if (!supplierId || !doc.folio) return;
        const list = foliosBySupplierId.get(supplierId) || [];
        list.push(doc.folio);
        foliosBySupplierId.set(supplierId, list);
      });
      for (const [supplierId, folios] of foliosBySupplierId.entries()) {
        const uniqueFolios = Array.from(new Set(folios)).filter(Boolean);
        if (!uniqueFolios.length) continue;
        const { data: paymentData } = await supabase.from('supplier_payments').select('reference_number').eq('supplier_id', supplierId).in('reference_number', uniqueFolios);
        (paymentData || []).forEach((row: any) => { if (row?.reference_number) existingPaymentKeys.add(`${supplierId}|${row.reference_number}`); });
        const { data } = await supabase.from('costs').select('service_folio').eq('supplier_id', supplierId).in('service_folio', uniqueFolios);
        (data || []).forEach((row: any) => { if (row?.service_folio) existingCostKeys.add(`${supplierId}|${row.service_folio}`); });
      }

      for (let i = 0; i < docsToImport.length; i++) {
        const doc = docsToImport[i];
        const documentKey = getDocumentStateKey(doc);
        const effectiveGlosa = getEffectiveGlosa(doc);
        batchProgress.update(i + 1, `${doc.folio} - ${effectiveGlosa.substring(0, 30)}`);
        let createdCostId: string | null = null;

        try {
          const emissionDate = doc.issue_date || format(new Date(), 'yyyy-MM-dd');
          const condition = getSelectedCondition(doc.supplier_rut);
          const isManuallyPaid = !!paidOverrides[documentKey];
          const paymentDate = isManuallyPaid ? (paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd')) : (condition === 'none' ? emissionDate : null);

          const linkCostId = linkDecisions[documentKey];
          if (linkCostId && linkCostId !== 'new') {
            const supplierId = supplierIdByRut.get(doc.supplier_rut);
            if (!supplierId) {
              logger.warn(`[useXmlCostUpload] Proveedor ${doc.supplier_rut} no encontrado en cache, omitiendo documento`);
              failureMessages.push(`Folio ${doc.folio}: no se pudo resolver el proveedor`);
              errorCount++;
              continue;
            }
            const computedDueDate = getComputedDueDate(doc) || emissionDate;
            await linkInvoiceMutation.mutateAsync({ costId: linkCostId, supplierId, invoiceData: { folio: doc.folio, issueDate: emissionDate, dueDate: computedDueDate, amount: doc.total_amount, netAmount: doc.net_amount, taxAmount: doc.vat_amount, description: effectiveGlosa, currency: doc.currency, paidDate: paymentDate || undefined, status: paymentDate ? 'paid' : 'pending' } });
            successCount++;
            continue;
          }

          const mappedCategory = supplierCategoryMapping[doc.supplier_rut] || '';
          let categoryId = resolveCategoryId(mappedCategory) || costCategoriesData[0]?.id || '';
          // Salvaguarda: "Peajes" nunca para montos > $1.000.000 (ej. compra de semiremolque
          // mal categorizada por la palabra "carretera" en el giro del emisor).
          const resolvedCategoryName = activeCategories.find(c => c.id === categoryId)?.name?.toLowerCase();
          if (resolvedCategoryName === 'peajes' && doc.total_amount > 1_000_000) {
            const otrosId = resolveCategoryId('otros') || activeCategories.find(c => c.name.toLowerCase() === 'otros')?.id;
            if (otrosId) categoryId = otrosId;
          }
          const subcatName = supplierSubcategoryMapping[doc.supplier_rut] || null;
          const supplierId = supplierIdByRut.get(doc.supplier_rut);
          if (!supplierId) {
            logger.warn(`[useXmlCostUpload] Proveedor ${doc.supplier_rut} no encontrado en cache, omitiendo documento`);
            failureMessages.push(`Folio ${doc.folio}: no se pudo resolver el proveedor`);
            errorCount++;
            continue;
          }

          const duplicateInfo = getDuplicateInfoForDocument(doc);
          const isDuplicateByCheck = duplicateInfo?.matchType === 'exact' || duplicateInfo?.matchType === 'folio';
          const isDuplicateInDb = doc.folio ? existingCostKeys.has(`${supplierId}|${doc.folio}`) : false;
          const isDuplicatePaymentInDb = doc.folio ? existingPaymentKeys.has(`${supplierId}|${doc.folio}`) : false;
          if (isDuplicateByCheck || isDuplicateInDb || isDuplicatePaymentInDb) { skippedDuplicatesCount++; continue; }

          const docEntity = getDocumentEntity(doc);
          const isLowboyDoc = docEntity === ENTITIES.LOWBOY.key;
          // La bodega es de G5N: nunca sincronizar inventario para gastos LowBoy, aunque el toggle global esté activo.
          const effectiveSyncToInventory = syncToInventory && !isLowboyDoc;

          const costData = {
            date: emissionDate,
            description: effectiveGlosa,
            amount: doc.total_amount,
            category_id: categoryId,
            subcategory: subcatName,
            notes: [
              supplierNameByRut.get(doc.supplier_rut) ? `Proveedor: ${supplierNameByRut.get(doc.supplier_rut)}` : '',
              doc.folio ? `Factura: ${doc.folio}` : '',
              doc.supplier_rut ? `RUT: ${doc.supplier_rut}` : '',
              isLowboyDoc && syncToInventory ? 'Sync Bodega desactivada automáticamente (gasto LowBoy)' : '',
            ].filter(Boolean).join(' | ') || null,
            service_folio: doc.folio || null,
            payment_date: paymentDate,
            supplier_id: supplierId,
            crane_id: isLowboyDoc ? (craneIdByDocument[documentKey] ?? null) : null,
            entity: docEntity,
            paid_by: isLowboyDoc ? (paidByDocument[documentKey] || ENTITIES.GRUAS_5_NORTE.key) : ENTITIES.GRUAS_5_NORTE.key,
            dte_tipo: doc.dte_tipo ?? null,
            dte_folio: doc.folio ? parseInt(doc.folio, 10) || null : null,
            dte_rut_emisor: doc.supplier_rut || null,
            ...(effectiveSyncToInventory && { purchase_quantity: 1, purchase_unit_cost: doc.total_amount, immediate_consumption: false }),
          };

          await new Promise<void>(resolve => {
            addCost(costData, {
              onSuccess: async data => {
                const costRecord = Array.isArray(data) ? data[0] : data;
                createdCostId = costRecord?.id ?? null;
                successCount++;
                if (isLowboyDoc && costRecord?.id && doc.dte_tipo && doc.folio && doc.supplier_rut) {
                  try {
                    await supabase.from('sii_rcv_records')
                      .update({ linked_cost_id: costRecord.id })
                      .eq('book_type', 'compra')
                      .eq('doc_type', doc.dte_tipo)
                      .eq('folio', parseInt(doc.folio, 10))
                      .eq('counterpart_rut', doc.supplier_rut)
                      .is('linked_cost_id', null);
                  } catch (linkErr) { logger.warn('[useXmlCostUpload] Auto-vinculación con sii_rcv_records falló para el costo:', costRecord.id, linkErr); }
                }
                if (effectiveSyncToInventory && costRecord?.id) {
                  try { await createDirectInventoryEntry({ costId: costRecord.id, itemName: effectiveGlosa, quantity: 1, unitCost: doc.total_amount, date: emissionDate, supplierId }); }
                  catch (invErr) { logger.warn('[useXmlCostUpload] Inventory sync failed for cost:', costRecord.id, invErr); }
                }
                resolve();
              },
              onError: error => {
                logger.error(`Error cargando gasto ${doc.folio}:`, error);
                failureMessages.push(`Folio ${doc.folio}: ${getErrorMessage(error)}`);
                errorCount++;
                resolve();
              },
            });
          });

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (docError) {
          logger.error(`Error importando gasto ${doc.folio}:`, docError);
          try { if (createdCostId) await supabase.from('costs').delete().eq('id', createdCostId); } catch (rollbackError) { logger.error(`Error rollback gasto ${doc.folio}:`, rollbackError); }
          failureMessages.push(`Folio ${doc.folio}: ${getErrorMessage(docError)}`);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        batchProgress.complete();
        setTimeout(() => {
          onSuccess?.(successCount);
          if (skippedDuplicatesCount > 0) toast.info(`Se omitieron ${skippedDuplicatesCount} duplicados`);
          reset();
          onClose();
          batchProgress.close();
        }, 1500);
      } else {
        batchProgress.error(failureMessages[0] || `${errorCount} de ${docsToImport.length} con error`);
      }
    } catch (error) {
      logger.error('Upload error:', error);
      batchProgress.error(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive,
    handleAnalyzeFile: triggerAnalyze, reset: resetParsing,
  } = useXMLParsing({
    onFileSelected: () => {
      setUploadProgress(0);
      setDocumentDescriptionOverrides({});
      setSupplierCategoryMapping({});
      setSupplierSubcategoryMapping({});
      setSelectedSuppliers(new Set());
      setSelectedDocuments(new Set());
      setExpandedDocumentDetails({});
      setHistoricalGlosaSuggestions({});
    },
    onParsed: initAfterParse,
  });

  const getDuplicateInfoForDocument = (document: XMLDocumentData): CostDuplicateResult | undefined =>
    duplicateResults.find(d => { const doc = parseResult?.documents[d.index]; return !!doc && getDocumentStateKey(doc) === getDocumentStateKey(document); });

  const handleCategoryChange = (supplierRut: string, category: string) => {
    setSupplierCategoryMapping(prev => ({ ...prev, [supplierRut]: category }));
    setSupplierSubcategoryMapping(prev => ({ ...prev, [supplierRut]: '' }));
  };

  const handleSubcategoryChange = (supplierRut: string, subcategory: string) =>
    setSupplierSubcategoryMapping(prev => ({ ...prev, [supplierRut]: subcategory }));

  const toggleSupplierSelection = (rut: string) =>
    setSelectedSuppliers(prev => {
      const s = new Set(prev);
      if (s.has(rut)) s.delete(rut);
      else s.add(rut);
      return s;
    });

  const toggleDocumentSelection = (key: string) =>
    setSelectedDocuments(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });

  const reset = () => {
    resetParsing();
    setUploadProgress(0);
    setSupplierCategoryMapping({});
    setSupplierSubcategoryMapping({});
    setSelectedSuppliers(new Set());
    setSelectedDocuments(new Set());
    setDueDateOverrides({});
    setSupplierPaymentCondition({});
    setSupplierCreditDate({});
    setPaidOverrides({});
    setPaidDateOverrides({});
    setDocumentDescriptionOverrides({});
    setExpandedDocumentDetails({});
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setMatchedCosts({});
    setLinkDecisions({});
    setHistoricalGlosaSuggestions({});
    setSyncToInventory(false);
    setCraneIdByDocument({});
    setPaidByDocument({});
  };

  const selectedTotal = parseResult
    ? parseResult.documents.filter(d => selectedDocuments.has(getDocumentStateKey(d))).reduce((sum, d) => sum + d.total_amount, 0)
    : 0;

  return {
    // Parsing
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive, triggerAnalyze,
    // Upload state
    isUploading, uploadProgress,
    // Status
    isCheckingDuplicates, isSearchingMatches, showDuplicateWarning, setShowDuplicateWarning,
    // Selections
    selectedSuppliers, selectedDocuments, selectedTotal,
    // Per-item state
    supplierCategoryMapping, supplierSubcategoryMapping,
    supplierPaymentCondition, setSupplierPaymentCondition,
    supplierCreditDate, setSupplierCreditDate,
    dueDateOverrides, setDueDateOverrides,
    paidOverrides, setPaidOverrides,
    paidDateOverrides, setPaidDateOverrides,
    documentDescriptionOverrides, setDocumentDescriptionOverrides,
    expandedDocumentDetails, setExpandedDocumentDetails,
    historicalGlosaSuggestions,
    // Duplicates & matches
    duplicateResults, matchedCosts,
    linkDecisions, setLinkDecisions,
    // Options
    syncToInventory, setSyncToInventory,
    defaultDaysToAdd,
    // Entidad LowBoy
    getDocumentEntity, lowboyCraneOptions,
    craneIdByDocument, setCraneIdByDocument,
    paidByDocument, setPaidByDocument,
    hasLowboyDocuments: parseResult ? parseResult.documents.some(d => getDocumentEntity(d) === ENTITIES.LOWBOY.key) : false,
    // Data
    activeCategories, paymentTerms, loadingTerms, batchProgress,
    // Helpers
    getSupplierCondition, getEffectiveGlosa, getDuplicateInfoForDocument,
    buildSuggestedGlosa, applyConditionToSupplierDocuments, resolveCategoryId,
    // Handlers
    handleUploadCosts, reset,
    handleCategoryChange, handleSubcategoryChange,
    toggleSupplierSelection, toggleDocumentSelection,
  };
}
