import React, { useState } from 'react';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import {
  XMLImportDialogHeader,
  XMLImportProgressCard,
  XMLImportStatsGrid,
} from '@/components/common/XMLImportShared';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DatePickerInput from '@/components/common/DatePickerInput';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

import { cn } from '@/lib/utils';
import {
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  FileSpreadsheet,
  Users,
  Receipt,
  DollarSign,
  Calendar,
  Building,
  ShieldAlert,
  Link2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Package,
  Info,
  Code,
  Database,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { findSupplierByIdentity } from '@/utils/supplierIdentity';
import { applyCurrentDocumentFolioToSuggestion } from '@/utils/xmlGlosaSuggestion';
import { XMLCompleteParseResult, XMLDocumentData, XMLSupplierData } from '@/types/suppliers';
import { supabase } from '@/integrations/supabase/client';
import { createDirectInventoryEntry } from '@/utils/inventoryConsumptionHelper';
import { useAddCost, useLinkInvoiceToCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { useCostDuplicateCheck, CostDuplicateResult } from '@/hooks/useDuplicateCheck';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("XMLCostUpload");
// Inline subcategory select that fetches its own data
const CostSubcategorySelect: React.FC<{
  categoryId: string;
  value: string;
  onValueChange: (val: string) => void;
}> = ({ categoryId, value, onValueChange }) => {
  const { subcategories, isLoading } = useCostSubcategories(categoryId);

  if (isLoading) return <span className="text-xs text-muted-foreground px-2">Cargando...</span>;
  if (subcategories.length === 0) return null;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Subcategoría" />
      </SelectTrigger>
      <SelectContent>
        {subcategories.map((sub) => (
          <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

type HistoricalGlosaCandidate = {
  supplier_id: string;
  description: string | null;
  amount: number | null;
  date?: string | null;
  created_at?: string | null;
};

type HistoricalGlosaSuggestion = {
  description: string;
  matchCount: number;
  confidence: number;
};

const GLOSA_STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'los', 'las', 'del', 'por', 'con', 'para', 'una', 'uno', 'que', 'mas', 'más',
  'folio', 'factura', 'total', 'neto', 'iva', 'documento',
]);

const normalizeGlosaText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeGlosaText = (text: string) =>
  normalizeGlosaText(text)
    .split(' ')
    .filter(token => token.length >= 3 && !GLOSA_STOP_WORDS.has(token) && !/^\d+$/.test(token));

const extractDocumentSimilarityText = (doc: XMLDocumentData) => {
  const itemDescriptions = (doc.items || [])
    .map(item => item.description?.trim())
    .filter(Boolean)
    .join(' ');

  return [doc.description, itemDescriptions, doc.document_type]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const isSimilarAmount = (left?: number | null, right?: number | null) => {
  if (!left || !right || !isFinite(left) || !isFinite(right) || left <= 0 || right <= 0) return false;
  const ratio = Math.abs(left - right) / Math.max(left, right);
  return ratio <= 0.08;
};

const buildHistoricalGlosaSuggestion = (
  doc: XMLDocumentData,
  historicalCosts: HistoricalGlosaCandidate[]
): HistoricalGlosaSuggestion | null => {
  if (historicalCosts.length === 0) return null;

  const keywords = tokenizeGlosaText(extractDocumentSimilarityText(doc));
  if (keywords.length === 0) return null;

  const groups = new Map<string, { description: string; totalScore: number; count: number }>();
  const frequentDescriptions = new Map<string, { description: string; count: number }>();

  for (const cost of historicalCosts) {
    const candidateDescription = cost.description?.trim();
    if (!candidateDescription) continue;

    const normalizedDescription = normalizeGlosaText(candidateDescription);
    const frequentEntry = frequentDescriptions.get(normalizedDescription);
    if (frequentEntry) {
      frequentEntry.count += 1;
    } else {
      frequentDescriptions.set(normalizedDescription, {
        description: candidateDescription,
        count: 1,
      });
    }

    const candidateTokens = tokenizeGlosaText(candidateDescription);
    if (candidateTokens.length === 0) continue;

    const overlap = keywords.filter(keyword =>
      candidateTokens.some(token => token.includes(keyword) || keyword.includes(token))
    );

    const keywordScore = overlap.length / keywords.length;
    const amountBonus = isSimilarAmount(doc.total_amount, Number(cost.amount || 0)) ? 0.2 : 0;
    const totalScore = Math.min(1, keywordScore + amountBonus);

    if (overlap.length === 0 || totalScore < 0.45) continue;

    const key = normalizeGlosaText(candidateDescription);
    const existing = groups.get(key);
    if (existing) {
      existing.totalScore += totalScore;
      existing.count += 1;
    } else {
      groups.set(key, {
        description: candidateDescription,
        totalScore,
        count: 1,
      });
    }
  }

  let best: { description: string; totalScore: number; count: number } | null = null;
  for (const group of groups.values()) {
    if (!best || group.count > best.count || (group.count === best.count && group.totalScore > best.totalScore)) {
      best = group;
    }
  }

  if (!best) return null;

  const confidence = best.totalScore / best.count;
  if (best.count < 2 && confidence < 0.72) {
    let fallback: { description: string; count: number } | null = null;
    for (const entry of frequentDescriptions.values()) {
      if (!fallback || entry.count > fallback.count) {
        fallback = entry;
      }
    }

    if (!fallback) return null;

    const hasSimilarAmount = historicalCosts.some(cost =>
      normalizeGlosaText(cost.description || '') === normalizeGlosaText(fallback.description) &&
      isSimilarAmount(doc.total_amount, Number(cost.amount || 0))
    );

    if (fallback.count >= 2 && hasSimilarAmount) {
      return {
        description: fallback.description,
        matchCount: fallback.count,
        confidence: 0.62,
      };
    }

    return null;
  }

  if (best.count >= 2 && confidence < 0.5) return null;

  return {
    description: best.description,
    matchCount: best.count,
    confidence,
  };
};

const getDocumentStateKey = (doc: Pick<XMLDocumentData, 'supplier_rut' | 'folio'>) =>
  `${doc.supplier_rut || 'sin-rut'}::${doc.folio || 'sin-folio'}`;

interface XMLCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLCostUpload = ({ isOpen, onClose, onSuccess }: XMLCostUploadProps) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [documentDescriptionOverrides, setDocumentDescriptionOverrides] = useState<Record<string, string>>({});

  // Supplier category/subcategory mapping (used later; declared before hook to allow stable callbacks)
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, string>>({});
  const [supplierSubcategoryMapping, setSupplierSubcategoryMapping] = useState<Record<string, string>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd, setDefaultDaysToAdd] = useState<number>(30);
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
  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const batchProgress = useBatchProgress();
  const { mutate: addCost } = useAddCost();
  const linkInvoiceMutation = useLinkInvoiceToCost();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));
  const resolveCategoryId = (rawCategory?: string | null) => {
    const normalized = rawCategory?.trim();
    if (!normalized) return '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
    if (isUuid) return normalized;
    const directMatch = activeCategories.find(category => category.id === normalized);
    if (directMatch) return directMatch.id;
    const normalizedLower = normalized.toLowerCase();
    const nameMatch = activeCategories.find(category => {
      const name = (category.name || '').toLowerCase();
      const label = (category.label || '').toLowerCase();
      return name === normalizedLower || label === normalizedLower;
    });
    return nameMatch?.id || '';
  };
  const { checkDuplicates } = useCostDuplicateCheck();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();

  const {
    selectedFile,
    parseResult,
    isAnalyzing,
    getRootProps,
    getInputProps,
    isDragActive,
    handleAnalyzeFile: triggerAnalyze,
    reset: resetParsing,
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

  const getSupplierCondition = (supplierRut: string) => supplierPaymentCondition[supplierRut] ?? 'none';

  const buildSuggestedGlosa = (doc: XMLDocumentData) => {
    if (doc.items && doc.items.length > 0) {
      const lines = doc.items
        .map((it) => {
          const desc = (it.description || '').trim();
          if (!desc) return '';
          const qty = typeof it.quantity === 'number' && isFinite(it.quantity) && it.quantity > 0 ? it.quantity : null;
          const unit = typeof it.unit_price === 'number' && isFinite(it.unit_price) && it.unit_price > 0 ? it.unit_price : null;
          const tot = typeof it.total === 'number' && isFinite(it.total) && it.total > 0 ? it.total : null;
          const parts: string[] = [desc];
          if (qty && unit && tot) {
            parts.push(`— ${qty} x $${unit.toLocaleString('es-CL', { maximumFractionDigits: 0 })} = $${tot.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`);
          } else if (qty && unit) {
            parts.push(`— ${qty} x $${unit.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`);
          } else if (qty) {
            parts.push(`— ${qty} u.`);
          } else if (tot) {
            parts.push(`— $${tot.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`);
          }
          return parts.join(' ');
        })
        .filter((t) => t.length > 0);
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
    const documentKey = getDocumentStateKey(doc);
    const hasOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, documentKey);
    const override = hasOverride ? documentDescriptionOverrides[documentKey] : undefined;
    const value = (override ?? buildSuggestedGlosa(doc)).trim();
    return value.length > 0 ? value : buildSuggestedGlosa(doc);
  };

  const applyConditionToSupplierDocuments = (supplierRut: string, condition: 'none' | 'credit' | string, creditDate?: string, docs?: XMLDocumentData[]) => {
    const documents = docs ?? parseResult?.documents ?? [];
    if (condition === 'none') return;
    const nextOverrides: Record<string, string> = {};
    documents.forEach((doc) => {
      if (doc.supplier_rut !== supplierRut) return;
      if (!doc.issue_date) return;
      const documentKey = getDocumentStateKey(doc);

      if (condition === 'credit') {
        if (creditDate) nextOverrides[documentKey] = creditDate;
        return;
      }

      const term = paymentTerms.find(t => t.id === condition);
      if (term) {
        const issueDate = safeParseDateOnly(doc.issue_date);
        nextOverrides[documentKey] = format(addDays(issueDate, term.days), 'yyyy-MM-dd');
      }
    });
    setDueDateOverrides(prev => ({ ...prev, ...nextOverrides }));
  };

  // Called by useXMLParsing after base parsing; handles component-specific initialization
  async function initAfterParse(result: XMLCompleteParseResult) {
    const uniqueSuppliers = result.suppliers;

    // Pre-select all valid suppliers and documents
      const validSuppliers = new Set(uniqueSuppliers.filter(s => s.name && s.rut).map(s => s.rut));
      const validDocuments = new Set(result.documents.filter(d => d.folio && d.total_amount > 0).map(getDocumentStateKey));
      setSelectedSuppliers(validSuppliers);
      setSelectedDocuments(validDocuments);

      // Initialize category/subcategory mapping from parsed XML first;
      // later we overwrite with stored supplier defaults when available.
      const categoryMap: Record<string, string> = {};
      const subcategoryMap: Record<string, string> = {};
      uniqueSuppliers.forEach(supplier => {
        const parsedSubcategory = (supplier as any).subcategory?.trim();
        categoryMap[supplier.rut] = supplier.category || 'otros';
        if (parsedSubcategory) {
          subcategoryMap[supplier.rut] = parsedSubcategory;
        }
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
              if (row.category) {
                categoryMap[row.rut] = row.category;
              }
              if (row.subcategory?.trim()) {
                subcategoryMap[row.rut] = row.subcategory.trim();
              }
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
            supplierRowsWithId.forEach((row: any) => {
              supplierIdByRut.set(row.rut, row.id);
            });

            const supplierIds = supplierRowsWithId.map((row: any) => row.id);
            if (supplierIds.length > 0) {
              const [
                { data: historicalCosts, error: historyError },
                { data: historicalPayments, error: paymentHistoryError },
              ] = await Promise.all([
                supabase
                  .from('costs')
                  .select('supplier_id, description, amount, date, created_at')
                  .in('supplier_id', supplierIds)
                  .not('description', 'is', null)
                  .order('date', { ascending: false })
                  .limit(500),
                supabase
                  .from('supplier_payments')
                  .select('supplier_id, description, amount, due_date, created_at')
                  .in('supplier_id', supplierIds)
                  .not('description', 'is', null)
                  .order('due_date', { ascending: false })
                  .limit(500),
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

                result.documents.forEach((doc) => {
                  const supplierId = supplierIdByRut.get(doc.supplier_rut);
                  if (!supplierId) return;
                  const suggestion = buildHistoricalGlosaSuggestion(doc, costsBySupplierId.get(supplierId) || []);
                  if (suggestion) {
                    nextHistoricalGlosaSuggestions[getDocumentStateKey(doc)] = suggestion;
                  }
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
          // Auto-detect from XML FmaPago if available
          const supplierDocs = result.documents.filter(d => d.supplier_rut === s.rut);
          const firstDocWithFmaPago = supplierDocs.find(d => d.payment_method_code !== undefined);
          if (firstDocWithFmaPago?.payment_method_code === 2) {
            // FmaPago=2 → Crédito
            initialSupplierCondition[s.rut] = 'credit';
            if (firstDocWithFmaPago.due_date) {
              initialSupplierCreditDate[s.rut] = firstDocWithFmaPago.due_date;
            }
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

      // Initialize per-document due date overrides
      const initialDueOverrides: Record<string, string> = {};
      result.documents.forEach(doc => {
        if (doc.issue_date) {
          const issueDate = safeParseDateOnly(doc.issue_date);
          initialDueOverrides[getDocumentStateKey(doc)] = format(addDays(issueDate, defaultDaysToAdd), 'yyyy-MM-dd');
        }
      });
      setDueDateOverrides(initialDueOverrides);

      Object.entries(initialSupplierCondition).forEach(([rut, condition]) => {
        if (condition === 'credit') {
          applyConditionToSupplierDocuments(rut, 'credit', initialSupplierCreditDate[rut]);
        } else if (condition !== 'none') {
          applyConditionToSupplierDocuments(rut, condition);
        }
      });

      if (!result.success) {
        toast.error('Se encontraron errores en el archivo XML');
      } else {
        toast.success(`Análisis completado: ${result.totalSuppliers} proveedores, ${result.totalDocuments} documentos. Verificando duplicados...`);

        // Check duplicates
        if (result.documents.length > 0) {
          setIsCheckingDuplicates(true);
          try {
            const itemsToCheck = result.documents.map((doc) => ({
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
                const { data: supplierRows, error: supplierError } = await supabase
                  .from('inventory_suppliers')
                  .select('id, rut')
                  .in('rut', supplierRuts);

                if (!supplierError && Array.isArray(supplierRows)) {
                  const supplierIdByRut = new Map<string, string>();
                  supplierRows.forEach((row: any) => {
                    if (row?.rut && row?.id) supplierIdByRut.set(row.rut, row.id);
                  });

                  for (const rut of supplierRuts) {
                    const supplierId = supplierIdByRut.get(rut);
                    if (!supplierId) continue;
                    const folios = Array.from(new Set(result.documents.filter(d => d.supplier_rut === rut).map(d => d.folio).filter(Boolean)));
                    if (folios.length === 0) continue;

                    const { data: existingPayments, error: paymentsError } = await supabase
                      .from('supplier_payments')
                      .select('id, due_date, description, amount, reference_number, created_at')
                      .eq('supplier_id', supplierId)
                      .in('reference_number', folios);

                    const { data: existingCosts, error: costsError } = await supabase
                      .from('costs')
                      .select('id, date, description, amount, service_folio, created_at')
                      .eq('supplier_id', supplierId)
                      .in('service_folio', folios);

                    if (!paymentsError && Array.isArray(existingPayments) && existingPayments.length > 0) {
                      const existingByFolio = new Map<string, any>();
                      existingPayments.forEach((p: any) => {
                        if (p?.reference_number) existingByFolio.set(p.reference_number, p);
                      });

                      result.documents.forEach((doc, idx) => {
                        if (doc.supplier_rut !== rut) return;
                        if (!doc.folio) return;
                        const existing = existingByFolio.get(doc.folio);
                        if (!existing) return;
                        const candidate: CostDuplicateResult = {
                          index: idx,
                          matchType: 'folio',
                          existingCost: {
                            id: existing.id,
                            date: existing.due_date,
                            description: existing.description,
                            amount: existing.amount,
                            service_folio: existing.reference_number,
                            created_at: existing.created_at,
                          },
                        };
                        const current = duplicatesByIndex.get(idx);
                        if (!current || rank(candidate.matchType) > rank(current.matchType)) {
                          duplicatesByIndex.set(idx, candidate);
                        }
                      });
                    }

                    if (costsError || !Array.isArray(existingCosts) || existingCosts.length === 0) continue;

                    const existingByFolio = new Map<string, any>();
                    existingCosts.forEach((c: any) => {
                      if (c?.service_folio) existingByFolio.set(c.service_folio, c);
                    });

                    result.documents.forEach((doc, idx) => {
                      if (doc.supplier_rut !== rut) return;
                      if (!doc.folio) return;
                      const existing = existingByFolio.get(doc.folio);
                      if (!existing) return;
                      const candidate: CostDuplicateResult = {
                        index: idx,
                        matchType: 'folio',
                        existingCost: {
                          id: existing.id,
                          date: existing.date,
                          description: existing.description,
                          amount: existing.amount,
                          service_folio: existing.service_folio,
                          created_at: existing.created_at,
                        },
                      };
                      const current = duplicatesByIndex.get(idx);
                      if (!current || rank(candidate.matchType) > rank(current.matchType)) {
                        duplicatesByIndex.set(idx, candidate);
                      }
                    });
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
                exactDuplicates.forEach(d => {
                  const doc = result.documents[d.index];
                  if (doc) newSelection.delete(getDocumentStateKey(doc));
                });
                setSelectedDocuments(newSelection);
                setShowDuplicateWarning(true);
                toast.warning(
                  `Se detectaron ${exactDuplicates.length} duplicados reales y ${similarDuplicates.length} coincidencias similares. Los duplicados reales fueron deseleccionados para revisión.`
                );
              } else if (similarDuplicates.length > 0) {
                toast.info(
                  `Se encontraron ${similarDuplicates.length} coincidencias similares para revisar. No se marcó este XML como duplicado ni se deseleccionó automáticamente.`
                );
              }
            }
          } catch (dupError) {
            logger.error('Error checking duplicates:', dupError);
          } finally {
            setIsCheckingDuplicates(false);
          }
        }

        // Search for matching existing costs
        if (result.documents.length > 0) {
          setIsSearchingMatches(true);
          try {
            const matches: Record<string, any[]> = {};
            const decisions: Record<string, string | 'new'> = {};

            for (const doc of result.documents) {
              if (!doc.supplier_rut || !doc.total_amount) continue;
              const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
              const dateFrom = new Date(issueDate);
              dateFrom.setDate(dateFrom.getDate() - 30);
              const dateTo = new Date(issueDate);
              dateTo.setDate(dateTo.getDate() + 30);

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
            if (matchCount > 0) {
              toast.info(`🔗 Se encontraron ${matchCount} costos existentes que coinciden con documentos del XML`);
            }
          } catch (matchError) {
            logger.error('Error searching matches:', matchError);
          } finally {
            setIsSearchingMatches(false);
          }
        }
      }
  };

  // Find supplier by RUT or name in inventory_suppliers
  const findSupplierByRutOrName = async (rut: string, name: string): Promise<string | null> => {
    if (rut && rut.trim()) {
      const { data } = await supabase
        .from('inventory_suppliers')
        .select('id')
        .eq('rut', rut.trim())
        .maybeSingle();
      if (data) return data.id;
    }
    if (name && name.trim()) {
      const { data } = await supabase
        .from('inventory_suppliers')
        .select('id, name')
        .ilike('name', `%${name.trim()}%`)
        .limit(1)
        .maybeSingle();
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

    const docsToImport = parseResult.documents.filter(d =>
      selectedDocuments.has(getDocumentStateKey(d)) && selectedSuppliers.has(d.supplier_rut)
    );

    if (docsToImport.length === 0) {
      toast.error('No hay documentos seleccionados para importar');
      return;
    }

    const selectedSupplierRuts = Array.from(new Set(docsToImport.map(d => d.supplier_rut)));
    const creditSuppliersMissingDate = selectedSupplierRuts.filter(rut => supplierPaymentCondition[rut] === 'credit' && !supplierCreditDate[rut]);
    if (creditSuppliersMissingDate.length > 0) {
      toast.error('Falta fecha de crédito para uno o más proveedores');
      return;
    }
    const invalidCreditDateSuppliers = selectedSupplierRuts.filter(rut => {
      if (supplierPaymentCondition[rut] !== 'credit') return false;
      const creditDate = supplierCreditDate[rut];
      if (!creditDate) return true;
      const minIssue = docsToImport
        .filter(d => d.supplier_rut === rut && d.issue_date)
        .map(d => safeParseDateOnly(d.issue_date!))
        .reduce<Date | null>((min, d) => (min && min.getTime() <= d.getTime() ? min : d), null);
      if (!minIssue) return false;
      const credit = safeParseDateOnly(creditDate);
      return credit.getTime() < minIssue.getTime();
    });
    if (invalidCreditDateSuppliers.length > 0) {
      toast.error('La fecha de crédito no puede ser anterior a la fecha de emisión');
      return;
    }

    setIsUploading(true);
    batchProgress.start('Cargando Gastos desde XML', docsToImport.length);

    let successCount = 0;
    let errorCount = 0;
    let skippedDuplicatesCount = 0;

    try {
      const supplierIdByRut = new Map<string, string>();
      const userId = (await supabase.auth.getUser()).data.user?.id || null;

      const getSelectedCondition = (rut: string) => supplierPaymentCondition[rut] ?? 'none';
      const getComputedDueDate = (doc: XMLDocumentData) => {
        const condition = getSelectedCondition(doc.supplier_rut);
        if (condition === 'credit') {
          const creditDate = supplierCreditDate[doc.supplier_rut];
          if (creditDate) return creditDate;
        } else if (condition !== 'none') {
          const term = paymentTerms.find(t => t.id === condition);
          if (term && doc.issue_date) {
            const issueDate = safeParseDateOnly(doc.issue_date);
            return format(addDays(issueDate, term.days), 'yyyy-MM-dd');
          }
        }
        return null;
      };

      const ensureSupplierId = async (rut: string, name: string) => {
        if (supplierIdByRut.has(rut)) return supplierIdByRut.get(rut)!;
        const existingId = await findSupplierByRutOrName(rut, name);
        if (existingId) {
          supplierIdByRut.set(rut, existingId);
          return existingId;
        }

        const supplierCategory = resolveCategoryId(supplierCategoryMapping[rut] || 'otros');
        const supplierSubcategory = (supplierSubcategoryMapping[rut] || '').trim() || null;
        const { data: created, error } = await supabase
          .from('inventory_suppliers')
          .insert([{
            name: name || 'Proveedor',
            rut: rut || null,
            category: supplierCategory || null,
            subcategory: supplierSubcategory,
            is_active: true,
            created_by: userId,
          }])
          .select('id')
          .single();

        if (error || !created?.id) {
          throw error || new Error('No se pudo crear el proveedor');
        }
        supplierIdByRut.set(rut, created.id);
        return created.id;
      };

      const updateSupplierDefaults = async (supplierId: string, supplierRut: string) => {
        const condition = getSelectedCondition(supplierRut);
        const updateData: Record<string, any> = {
          category: resolveCategoryId(supplierCategoryMapping[supplierRut] || 'otros') || null,
          subcategory: (supplierSubcategoryMapping[supplierRut] || '').trim() || null,
          updated_by: userId,
        };

        if (condition === 'credit') {
          updateData.credit_date = supplierCreditDate[supplierRut] || null;
          updateData.default_payment_term_id = null;
        } else if (condition !== 'none') {
          updateData.default_payment_term_id = condition;
          updateData.credit_date = null;
        } else {
          updateData.default_payment_term_id = null;
          updateData.credit_date = null;
        }

        const { error } = await supabase
          .from('inventory_suppliers')
          .update(updateData)
          .eq('id', supplierId);

        if (error) throw error;
      };

      const supplierNameByRut = new Map<string, string>();
      parseResult.suppliers.forEach(s => supplierNameByRut.set(s.rut, s.name || ''));

      for (const supplierRut of selectedSupplierRuts) {
        const supplierName = supplierNameByRut.get(supplierRut) || '';
        const supplierId = await ensureSupplierId(supplierRut, supplierName);
        await updateSupplierDefaults(supplierId, supplierRut);
      }
      
      const existingCostKeys = new Set<string>();
      const existingPaymentKeys = new Set<string>();
      const foliosBySupplierId = new Map<string, string[]>();
      docsToImport.forEach((doc) => {
        const supplierId = supplierIdByRut.get(doc.supplier_rut);
        if (!supplierId) return;
        if (!doc.folio) return;
        const list = foliosBySupplierId.get(supplierId) || [];
        list.push(doc.folio);
        foliosBySupplierId.set(supplierId, list);
      });
      for (const [supplierId, folios] of foliosBySupplierId.entries()) {
        const uniqueFolios = Array.from(new Set(folios)).filter(Boolean);
        if (uniqueFolios.length === 0) continue;
        const { data: paymentData, error: paymentError } = await supabase
          .from('supplier_payments')
          .select('reference_number')
          .eq('supplier_id', supplierId)
          .in('reference_number', uniqueFolios);
        if (!paymentError) {
          (paymentData || []).forEach((row: any) => {
            if (!row?.reference_number) return;
            existingPaymentKeys.add(`${supplierId}|${row.reference_number}`);
          });
        }
        const { data, error } = await supabase
          .from('costs')
          .select('service_folio')
          .eq('supplier_id', supplierId)
          .in('service_folio', uniqueFolios);
        if (error) continue;
        (data || []).forEach((row: any) => {
          if (!row?.service_folio) return;
          existingCostKeys.add(`${supplierId}|${row.service_folio}`);
        });
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
        // Contado (none) -> pagado inmediatamente con fecha de emisión
        // Crédito -> payment_date = null (pendiente, no pagado aún)
        // Override manual: si el usuario marca "Pagado", usar paidDateOverrides
        const paymentDate = isManuallyPaid
          ? (paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd'))
          : (condition === 'none' ? emissionDate : null);

        // If user chose to link to existing cost, skip creation
        const linkCostId = linkDecisions[documentKey];
        if (linkCostId && linkCostId !== 'new') {
          const supplier = parseResult.suppliers.find(s => s.rut === doc.supplier_rut);
          const supplierId = supplierIdByRut.get(doc.supplier_rut) || await ensureSupplierId(doc.supplier_rut, supplier?.name || '');
          const computedDueDate = getComputedDueDate(doc) || emissionDate;

          await linkInvoiceMutation.mutateAsync({
            costId: linkCostId,
            supplierId,
            invoiceData: {
              folio: doc.folio,
              issueDate: emissionDate,
              dueDate: computedDueDate,
              amount: doc.total_amount,
              netAmount: doc.net_amount,
              taxAmount: doc.vat_amount,
              description: effectiveGlosa,
              currency: doc.currency,
              paidDate: paymentDate || undefined,
              status: paymentDate ? 'paid' : 'pending',
            },
          });

          successCount++;
          continue;
        }

        // Resolve category
        const mappedCategory = supplierCategoryMapping[doc.supplier_rut] || '';
        const categoryId = resolveCategoryId(mappedCategory) || costCategoriesData[0]?.id || '';
        const subcatName = supplierSubcategoryMapping[doc.supplier_rut] || null;

        // Find supplier ID
        const supplier = parseResult.suppliers.find(s => s.rut === doc.supplier_rut);
        const supplierId = supplierIdByRut.get(doc.supplier_rut) || await ensureSupplierId(doc.supplier_rut, supplier?.name || '');

        const duplicateInfo = getDuplicateInfoForDocument(doc);
        const isDuplicateByCheck = duplicateInfo?.matchType === 'exact' || duplicateInfo?.matchType === 'folio';
        const isDuplicateInDb = doc.folio ? existingCostKeys.has(`${supplierId}|${doc.folio}`) : false;
        const isDuplicatePaymentInDb = doc.folio ? existingPaymentKeys.has(`${supplierId}|${doc.folio}`) : false;
        if (isDuplicateByCheck || isDuplicateInDb || isDuplicatePaymentInDb) {
          skippedDuplicatesCount++;
          continue;
        }

        const costData = {
          date: emissionDate,
          description: effectiveGlosa,
          amount: doc.total_amount,
          category_id: categoryId,
          subcategory: subcatName,
          notes: [
            supplier?.name ? `Proveedor: ${supplier.name}` : '',
            doc.folio ? `Factura: ${doc.folio}` : '',
            doc.supplier_rut ? `RUT: ${doc.supplier_rut}` : '',
          ].filter(Boolean).join(' | ') || null,
          service_folio: doc.folio || null,
          payment_date: paymentDate,
          supplier_id: supplierId,
          ...(syncToInventory && {
            purchase_quantity: 1,
            purchase_unit_cost: doc.total_amount,
            immediate_consumption: false,
          }),
        };

        await new Promise<void>((resolve) => {
          addCost(costData, {
            onSuccess: async (data) => {
              const costRecord = Array.isArray(data) ? data[0] : data;
              createdCostId = costRecord?.id ?? null;
              successCount++;

              // Create inventory entry if sync is enabled
              if (syncToInventory && data) {
                if (costRecord?.id) {
                  try {
                    await createDirectInventoryEntry({
                      costId: costRecord.id,
                      itemName: effectiveGlosa,
                      quantity: 1,
                      unitCost: doc.total_amount,
                      date: emissionDate,
                      supplierId: supplierId,
                    });
                  } catch (invErr) {
                    logger.warn('[XMLCostUpload] Inventory sync failed for cost:', costRecord.id, invErr);
                  }
                }
              }

              resolve();
            },
            onError: (error) => {
              logger.error(`Error cargando gasto ${doc.folio}:`, error);
              errorCount++;
              resolve();
            },
          });
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        } catch (docError) {
          logger.error(`Error importando gasto ${doc.folio}, ejecutando rollback:`, docError);
          try {
            if (createdCostId) {
              await supabase.from('costs').delete().eq('id', createdCostId);
              logger.debug(`Rollback completado para gasto ${doc.folio}`);
            }
          } catch (rollbackError) {
            logger.error(`Error durante rollback de gasto ${doc.folio}:`, rollbackError);
          }
          errorCount++;
        }
      }

      if (errorCount === 0) {
        batchProgress.complete();
        setTimeout(() => {
          onSuccess?.(successCount);
          if (skippedDuplicatesCount > 0) {
            toast.info(`Se omitieron ${skippedDuplicatesCount} duplicados`);
          }
          onClose();
          batchProgress.close();
        }, 1500);
      } else {
        batchProgress.error(`${errorCount} de ${docsToImport.length} con error`);
      }
    } catch (error) {
      logger.error('Upload error:', error);
      batchProgress.error('Error durante la carga');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCategoryChange = (supplierRut: string, category: string) => {
    setSupplierCategoryMapping(prev => ({ ...prev, [supplierRut]: category }));
    setSupplierSubcategoryMapping(prev => ({ ...prev, [supplierRut]: '' }));
  };

  const handleSubcategoryChange = (supplierRut: string, subcategory: string) => {
    setSupplierSubcategoryMapping(prev => ({ ...prev, [supplierRut]: subcategory }));
  };

  const toggleSupplierSelection = (supplierRut: string) => {
    setSelectedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierRut)) newSet.delete(supplierRut);
      else newSet.add(supplierRut);
      return newSet;
    });
  };

  const toggleDocumentSelection = (documentKey: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentKey)) newSet.delete(documentKey);
      else newSet.add(documentKey);
      return newSet;
    });
  };

  const reset = () => {
    resetParsing();
    setUploadProgress(0);
    setSupplierCategoryMapping({});
    setSupplierSubcategoryMapping({});
    setSelectedSuppliers(new Set());
    setSelectedDocuments(new Set());
    setDueDateOverrides({});
    setDefaultDaysToAdd(30);
    setSupplierPaymentCondition({});
    setSupplierCreditDate({});
    setPaidOverrides({});
    setPaidDateOverrides({});
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setMatchedCosts({});
    setLinkDecisions({});
    setHistoricalGlosaSuggestions({});
    setSyncToInventory(false);
  };

  const getDuplicateInfoForDocument = (document: XMLDocumentData): CostDuplicateResult | undefined => {
    return duplicateResults.find(d => {
      const doc = parseResult?.documents[d.index];
      return !!doc && getDocumentStateKey(doc) === getDocumentStateKey(document);
    });
  };

  const selectedTotal = parseResult
    ? parseResult.documents
        .filter(d => selectedDocuments.has(getDocumentStateKey(d)))
        .reduce((sum, d) => sum + d.total_amount, 0)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[95vh] w-[min(99vw,1600px)] max-w-[1600px] flex-col overflow-hidden border-border/70 bg-card p-0 shadow-2xl">
        <XMLImportDialogHeader
          icon={Code}
          title="Cargar Gastos desde XML"
          description="Analiza documentos XML, detecta duplicados y registra gastos con categorización automática."
          fileName={selectedFile?.name}
          documentCount={parseResult?.totalDocuments}
        />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-4">
          <XMLDropzoneArea
            selectedFile={selectedFile}
            parseResult={parseResult}
            isAnalyzing={isAnalyzing}
            isDragActive={isDragActive}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            onAnalyze={triggerAnalyze}
            onReset={reset}
            badges={['Detección de duplicados', 'Sync con Bodega', 'Categorización']}
          />

          {/* Upload Progress (non-batch) */}
          {isUploading && uploadProgress > 0 && (
            <XMLImportProgressCard label="Subiendo datos..." value={uploadProgress} />
          )}

          {/* Parse Results */}
          {parseResult && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <XMLImportStatsGrid
                items={[
                  {
                    title: 'Proveedores',
                    value: `${parseResult.validSuppliers}/${parseResult.totalSuppliers}`,
                    icon: Users,
                    tone: 'neutral',
                  },
                  {
                    title: 'Documentos',
                    value: `${parseResult.validDocuments}/${parseResult.totalDocuments}`,
                    icon: Receipt,
                    tone: 'success',
                  },
                  {
                    title: 'Errores',
                    value: parseResult.errors.length,
                    icon: AlertCircle,
                    tone: 'danger',
                  },
                  {
                    title: 'Total Selec.',
                    value: `$${selectedTotal.toLocaleString('es-CL')}`,
                    icon: DollarSign,
                    tone: 'info',
                  },
                ]}
              />

              {/* Import Options */}
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Cómo registrar estos gastos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={syncToInventory}
                      onCheckedChange={setSyncToInventory}
                    />
                    <Label className="text-sm flex items-center gap-2">
                      <Package className="size-4" />
                      Sincronizar con Bodega/Inventario
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Los costos se registrarán como entradas de inventario automáticamente</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {syncToInventory && (
                    <p className="ml-8 text-xs text-success">
                      ✓ Los costos se sincronizarán con el módulo de Bodega
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Activa esta opción solo si además quieres reflejar estos documentos como entradas en inventario.
                  </p>
                </CardContent>
              </Card>

              {/* Duplicate Warning Banner */}
              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-warning/30 bg-warning/10">
                  <ShieldAlert className="size-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <strong>⚠️ Se detectaron coincidencias que requieren revisión.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact').length > 0 && (
                        <Badge variant="destructive" className="mr-2">
                          {duplicateResults.filter(d => d.matchType === 'exact').length} exactos
                        </Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'folio').length > 0 && (
                        <Badge className="mr-2 border-warning/30 bg-warning/15 text-warning">
                          {duplicateResults.filter(d => d.matchType === 'folio').length} por folio
                        </Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'similar').length > 0 && (
                        <Badge className="border-warning/30 bg-warning/15 text-warning">
                          {duplicateResults.filter(d => d.matchType === 'similar').length} similares
                        </Badge>
                      )}
                    </span>
                    <span className="ml-2 text-sm">
                      Solo los coincidencias exactas o por folio se deseleccionan automáticamente. Las similares son solo referencia.
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-4 text-warning hover:bg-warning/10 hover:text-warning"
                      onClick={() => setShowDuplicateWarning(false)}
                    >
                      Ocultar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Checking duplicates indicator */}
              {isCheckingDuplicates && (
                <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3">
                  <Loader2 className="size-4 animate-spin text-info" />
                  <span className="text-sm text-info">Verificando duplicados en la base de datos...</span>
                </div>
              )}

              {/* Searching cost matches indicator */}
              {isSearchingMatches && (
                <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3">
                  <Loader2 className="size-4 animate-spin text-info" />
                  <span className="text-sm text-info">Buscando costos existentes que coincidan...</span>
                </div>
              )}

              {/* Cost matching summary */}
              {Object.keys(matchedCosts).length > 0 && (
                <Alert className="border-info/30 bg-info/10">
                  <Link2 className="size-4 text-info" />
                  <AlertDescription className="text-info">
                    <strong>🔗 {Object.keys(matchedCosts).length} documento(s)</strong> coinciden con costos ya registrados.
                    Puedes vincular la factura al costo existente o crear un gasto nuevo.
                  </AlertDescription>
                </Alert>
              )}

              {/* Errors and Warnings */}
              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                <div className="space-y-2">
                  {parseResult.errors.length > 0 && (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="size-4 text-destructive" />
                      <AlertDescription className="text-destructive">
                        <strong>Errores encontrados:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.errors.slice(0, 5).map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                          {parseResult.errors.length > 5 && (
                            <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {parseResult.warnings.length > 0 && (
                    <Alert className="border-warning/30 bg-warning/10">
                      <AlertCircle className="size-4 text-warning" />
                      <AlertDescription className="text-warning">
                        <strong>Advertencias:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.warnings.slice(0, 3).map((warning, index) => (
                            <li key={index} className="text-sm">{warning}</li>
                          ))}
                          {parseResult.warnings.length > 3 && (
                            <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 1</p>
                <p className="mt-1 font-medium text-foreground">Revisa proveedor y configuración base</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajusta la forma de pago y la categoría solo si quieres cambiar cómo se registrarán los gastos de este proveedor.
                </p>
              </div>

              {/* Suppliers Preview */}
              {parseResult.suppliers.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building className="size-5" />
                      Proveedores Encontrados ({parseResult.suppliers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.suppliers.map((supplier, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border border-border/70 border-l-4 border-l-primary bg-muted/30 p-3 shadow-sm">
                          <div className="flex items-center gap-x-3">
                            <Checkbox
                              checked={selectedSuppliers.has(supplier.rut)}
                              onCheckedChange={() => toggleSupplierSelection(supplier.rut)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-foreground font-medium truncate">{supplier.name}</p>
                                <Badge variant="outline" className="text-xs">{supplier.rut}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:max-w-[720px]">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1.5 block">Forma de pago por defecto</Label>
                              <Select
                                value={getSupplierCondition(supplier.rut)}
                                onValueChange={(val) => {
                                  setSupplierPaymentCondition(prev => ({ ...prev, [supplier.rut]: val as any }));
                                  if (val === 'credit') {
                                    applyConditionToSupplierDocuments(supplier.rut, 'credit', supplierCreditDate[supplier.rut]);
                                  } else {
                                    applyConditionToSupplierDocuments(supplier.rut, val as any);
                                  }
                                }}
                                disabled={loadingTerms}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Sin condición (manual)'} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sin condición (manual)</SelectItem>
                                  <SelectItem value="credit">Crédito (fecha)</SelectItem>
                                  {paymentTerms.map((term) => (
                                    <SelectItem key={term.id} value={term.id}>
                                      {term.name} ({term.days} días)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Se aplicará como sugerencia a los documentos de este proveedor.
                              </p>
                            </div>
                            {getSupplierCondition(supplier.rut) === 'credit' && (
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Fecha de Crédito</Label>
                                <DatePickerInput
                                  value={supplierCreditDate[supplier.rut] || ''}
                                  onChange={(date) => {
                                    setSupplierCreditDate(prev => ({ ...prev, [supplier.rut]: date }));
                                    applyConditionToSupplierDocuments(supplier.rut, 'credit', date);
                                  }}
                                  className="w-full"
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1.5 block">Categoría del gasto</Label>
                              <Select
                                value={resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category)}
                                onValueChange={value => handleCategoryChange(supplier.rut, value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeCategories?.map(category => (
                                    <SelectItem key={category.id} value={category.id}>
                                      {getCategoryLabel(activeCategories, category.id)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Ayuda a clasificar el gasto y sus reportes asociados.
                              </p>
                            </div>
                            {/* Subcategory Select */}
                            {(() => {
                              const categoryId = resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category);
                              if (!categoryId) return null;
                              return (
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1.5 block">Subcategoría</Label>
                                  <CostSubcategorySelect
                                    categoryId={categoryId}
                                    value={supplierSubcategoryMapping[supplier.rut] || ''}
                                    onValueChange={(val) => handleSubcategoryChange(supplier.rut, val)}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 2</p>
                <p className="mt-1 font-medium text-foreground">Revisa cada documento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Primero valida el estado del documento. Luego, solo si hace falta, abre los detalles para editar la descripción o el vencimiento.
                </p>
              </div>

              {/* Documents Preview */}
              {parseResult.documents.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="size-5" />
                      Documentos Encontrados ({parseResult.documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.documents.map((document, index) => {
                        const documentKey = getDocumentStateKey(document);
                        const defaultDueDate =
                          dueDateOverrides[documentKey] ||
                          document.due_date ||
                          (() => {
                            const date = safeParseDateOnly(document.issue_date || format(new Date(), 'yyyy-MM-dd'));
                            date.setDate(date.getDate() + defaultDaysToAdd);
                            return format(date, 'yyyy-MM-dd');
                          })();

                        const duplicateInfo = getDuplicateInfoForDocument(document);
                        const isDuplicate = !!duplicateInfo;
                        const isExactDuplicate = duplicateInfo?.matchType === 'exact' || duplicateInfo?.matchType === 'folio';

                        const costsForDoc = matchedCosts[documentKey] || [];
                        const hasMatches = costsForDoc.length > 0;
                        const currentDecision = linkDecisions[documentKey] || 'new';
                        const showDetails = expandedDocumentDetails[documentKey] ?? !isExactDuplicate;
                        const hasDescriptionOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, documentKey);
                        const descriptionValue = hasDescriptionOverride
                          ? documentDescriptionOverrides[documentKey]
                          : buildSuggestedGlosa(document);
                        const historicalSuggestion = historicalGlosaSuggestions[documentKey];
                        const appliedHistoricalSuggestionDescription = historicalSuggestion
                          ? applyCurrentDocumentFolioToSuggestion(historicalSuggestion.description, document)
                          : '';
                        const shouldShowHistoricalSuggestion =
                          !!historicalSuggestion &&
                          normalizeGlosaText(appliedHistoricalSuggestionDescription) !== normalizeGlosaText(descriptionValue);
                        const statusMeta = hasMatches && currentDecision !== 'new'
                          ? {
                              label: 'Vinculado a costo',
                              badgeClass: 'bg-info/15 text-info',
                              hint: 'Este documento se enlazará con un costo existente.',
                            }
                          : isExactDuplicate
                            ? {
                                label: 'Ya registrado',
                                badgeClass: 'bg-danger/15 text-danger',
                                hint: 'Ya existe en el sistema. Normalmente no necesitas cambiar nada.',
                              }
                            : isDuplicate && duplicateInfo.matchType === 'similar'
                              ? {
                                  label: 'Revisar coincidencia',
                                  badgeClass: 'bg-warning/15 text-warning',
                                  hint: 'Se encontró una coincidencia parecida. Conviene revisarlo antes de importar.',
                                }
                              : {
                                  label: 'Listo para revisar',
                                  badgeClass: 'bg-success/15 text-success',
                                  hint: 'Puedes cargarlo o ajustar sus detalles si lo necesitas.',
                                };

                        return (
                          <div
                            key={index}
                            className={cn(
                              'flex flex-col p-3 rounded-lg gap-2 shadow-sm border',
                              hasMatches && currentDecision !== 'new'
                                ? 'bg-info/10 border-info/30'
                                : isDuplicate && (duplicateInfo.matchType === 'exact' || duplicateInfo.matchType === 'folio')
                                ? 'bg-danger/10 border-danger/30'
                                : isDuplicate && duplicateInfo.matchType === 'similar'
                                ? 'bg-warning/10 border-warning/30'
                                : 'bg-muted/30 border-border/60'
                            )}
                          >
                            {/* Matched cost selector */}
                            {hasMatches && (
                              <div className="flex items-center gap-2 rounded bg-info/15 px-2 py-1.5 text-xs text-info">
                                <Link2 className="size-3.5 flex-shrink-0" />
                                <span className="font-medium">🔗 Costo encontrado:</span>
                                <Select
                                  value={currentDecision}
                                  onValueChange={(val) =>
                                    setLinkDecisions(prev => ({ ...prev, [documentKey]: val }))
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1 min-w-[200px] bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new">➕ Crear nuevo gasto</SelectItem>
                                    {costsForDoc.map((cost: any) => (
                                      <SelectItem key={cost.id} value={cost.id}>
                                        🔗 {cost.description} — ${Number(cost.amount).toLocaleString('es-CL')} — {cost.date}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Duplicate warning */}
                            {isDuplicate && duplicateInfo.existingCost && (
                              <div
                                className={cn(
                                  'text-xs px-2 py-1 rounded',
                                  duplicateInfo.matchType === 'exact' || duplicateInfo.matchType === 'folio'
                                    ? 'bg-danger/15 text-danger'
                                    : 'bg-warning/15 text-warning'
                                )}
                              >
                                <strong>
                                  {(duplicateInfo.matchType === 'exact' || duplicateInfo.matchType === 'folio')
                                    ? '⚠️ Ya registrado:'
                                    : '🔍 Similar:'}
                                </strong>{' '}
                                {duplicateInfo.existingCost.description?.substring(0, 50)} - $
                                {duplicateInfo.existingCost.amount.toLocaleString('es-CL')}
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-x-3 flex-1 min-w-0">
                                <Checkbox
                                  checked={selectedDocuments.has(documentKey)}
                                  onCheckedChange={() => toggleDocumentSelection(documentKey)}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-foreground font-medium break-words whitespace-pre-wrap">{getEffectiveGlosa(document)}</p>
                                  <div className="flex items-center gap-x-4 text-sm text-muted-foreground flex-wrap">
                                    <span>Folio: {document.folio}</span>
                                    <span>Total: ${document.total_amount.toLocaleString('es-CL')}</span>
                                    {document.issue_date && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="size-3" />
                                        Emisión: {document.issue_date}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusMeta.badgeClass)}>
                                      {statusMeta.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{statusMeta.hint}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => setExpandedDocumentDetails(prev => ({ ...prev, [documentKey]: !showDetails }))}
                                >
                                  {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
                                  {showDetails ? <ChevronUp className="ml-1 size-3.5" /> : <ChevronDown className="ml-1 size-3.5" />}
                                </Button>
                              </div>
                            </div>

                            {showDetails ? (
                              <div className="space-y-3 border-t pt-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1.5 block">Descripción que se guardará</Label>
                                  <Textarea
                                    value={descriptionValue}
                                    onChange={(e) =>
                                      setDocumentDescriptionOverrides(prev => ({ ...prev, [documentKey]: e.target.value }))
                                    }
                                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                    ref={(el) => autoResizeTextarea(el)}
                                    placeholder="Ej: Insumo - Mantención"
                                    rows={3}
                                    className="text-sm resize-y"
                                  />
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Este texto se usará como descripción del gasto o del vínculo con un costo existente.
                                  </p>
                                  {shouldShowHistoricalSuggestion && historicalSuggestion && (
                                    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 text-primary">
                                            <Sparkles className="mt-0.5 size-4 flex-shrink-0" />
                                            <span className="font-medium">Glosa sugerida por historial</span>
                                            <Badge variant="secondary" className="text-[11px]">
                                              {historicalSuggestion.matchCount} similar{historicalSuggestion.matchCount > 1 ? 'es' : ''}
                                            </Badge>
                                          </div>
                                          <p className="mt-1 whitespace-pre-wrap break-words text-foreground">
                                            {appliedHistoricalSuggestionDescription}
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            Coincidencia estimada: {Math.round(historicalSuggestion.confidence * 100)}%
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8"
                                          onClick={() =>
                                            setDocumentDescriptionOverrides(prev => ({
                                              ...prev,
                                              [documentKey]: applyCurrentDocumentFolioToSuggestion(historicalSuggestion.description, document),
                                            }))
                                          }
                                        >
                                          Usar sugerencia
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-end gap-4">
                                  <div className="flex-1 min-w-[180px] max-w-[220px]">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">Forma de pago</Label>
                                    <Select
                                      value={getSupplierCondition(document.supplier_rut)}
                                      onValueChange={(val) => {
                                        setSupplierPaymentCondition(prev => ({ ...prev, [document.supplier_rut]: val as any }));
                                        if (val === 'credit') {
                                          applyConditionToSupplierDocuments(document.supplier_rut, 'credit', supplierCreditDate[document.supplier_rut]);
                                        } else {
                                          applyConditionToSupplierDocuments(document.supplier_rut, val as any);
                                        }
                                      }}
                                      disabled={loadingTerms}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Sin condición (manual)'} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Sin condición (manual)</SelectItem>
                                        <SelectItem value="credit">Crédito (fecha)</SelectItem>
                                        {paymentTerms.map((term) => (
                                          <SelectItem key={term.id} value={term.id}>
                                            {term.name} ({term.days} días)
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Define si el gasto queda con vencimiento o se manejará manualmente.
                                    </p>
                                  </div>
                                  <div className="flex-1 min-w-[180px] max-w-[220px]">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">Vencimiento</Label>
                                    <DatePickerInput
                                      value={defaultDueDate || ''}
                                      onChange={(date) =>
                                        setDueDateOverrides(prev => ({ ...prev, [documentKey]: date }))
                                      }
                                      className="w-full"
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Puedes ajustarlo si el XML no trae una fecha correcta.
                                    </p>
                                  </div>
                                  <div className="flex-1 min-w-[200px] max-w-[260px]">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">Estado de pago</Label>
                                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background">
                                      <Switch
                                        id={`paid-${documentKey}`}
                                        checked={!!paidOverrides[documentKey]}
                                        onCheckedChange={(checked) => {
                                          setPaidOverrides(prev => ({ ...prev, [documentKey]: checked }));
                                          if (checked && !paidDateOverrides[documentKey]) {
                                            setPaidDateOverrides(prev => ({
                                              ...prev,
                                              [documentKey]: format(new Date(), 'yyyy-MM-dd'),
                                            }));
                                          }
                                        }}
                                      />
                                      <Label htmlFor={`paid-${documentKey}`} className="text-xs cursor-pointer">
                                        Marcar como pagado
                                      </Label>
                                    </div>
                                    {paidOverrides[documentKey] && (
                                      <div className="mt-2">
                                        <DatePickerInput
                                          value={paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd')}
                                          onChange={(date) =>
                                            setPaidDateOverrides(prev => ({ ...prev, [documentKey]: date }))
                                          }
                                          className="w-full"
                                        />
                                      </div>
                                    )}
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Si ya fue pagado, indica la fecha real del pago.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                                Vista resumida. Abre los detalles solo si necesitas editar la descripción o la fecha de vencimiento.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 3</p>
                <p className="mt-1 font-medium text-foreground">Confirma la carga</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revisa el resumen antes de confirmar. Los documentos ya registrados normalmente no requieren cambios adicionales.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-border/70 pt-4">
                <div className="text-sm text-muted-foreground">
                  {selectedDocuments.size > 0 && (
                    <div className="space-y-1">
                      <span className="block">{selectedDocuments.size} documento(s) seleccionados</span>
                      <span className="block">Total seleccionado: ${selectedTotal.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} disabled={isUploading}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUploadCosts}
                    disabled={isUploading || selectedDocuments.size === 0}
                  >
                    {isUploading ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="size-4 mr-2" />
                    )}
                    Confirmar carga
                    {selectedDocuments.size > 0 && ` (${selectedDocuments.size})`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
      </DialogContent>
    </Dialog>
  );
};
