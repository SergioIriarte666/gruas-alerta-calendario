import React, { useState } from 'react';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import {
  XMLImportDialogHeader,
  XMLImportProgressCard,
  XMLImportStatsGrid,
} from '@/components/common/XMLImportShared';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle, Loader2, FileSpreadsheet, Users, Receipt, DollarSign, Calendar, Building, ShieldAlert, Link2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { applyCurrentDocumentFolioToSuggestion } from '@/utils/xmlGlosaSuggestion';
import { cn } from '@/lib/utils';
import { findSupplierByIdentity } from '@/utils/supplierIdentity';
import { XMLCompleteParseResult, XMLDocumentData } from '@/types/suppliers';
import { supabase } from '@/integrations/supabase/client';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { useSupplierPayments } from '@/hooks/useSupplierPayments';
import { useSupplierInvoiceDuplicateCheck, SupplierInvoiceDuplicateResult } from '@/hooks/useDuplicateCheck';
import { useLinkInvoiceToCost } from '@/hooks/useCosts';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("XMLDocumentUpload");
// Type for matched cost
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
  historicalRecords: HistoricalGlosaCandidate[]
): HistoricalGlosaSuggestion | null => {
  if (historicalRecords.length === 0) return null;

  const keywords = tokenizeGlosaText(extractDocumentSimilarityText(doc));
  if (keywords.length === 0) return null;

  const groups = new Map<string, { description: string; totalScore: number; count: number }>();
  const frequentDescriptions = new Map<string, { description: string; count: number }>();

  for (const record of historicalRecords) {
    const candidateDescription = record.description?.trim();
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
    const amountBonus = isSimilarAmount(doc.total_amount, Number(record.amount || 0)) ? 0.2 : 0;
    const totalScore = Math.min(1, keywordScore + amountBonus);

    if (overlap.length === 0 || totalScore < 0.45) continue;

    const existing = groups.get(normalizedDescription);
    if (existing) {
      existing.totalScore += totalScore;
      existing.count += 1;
    } else {
      groups.set(normalizedDescription, {
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

    const hasSimilarAmount = historicalRecords.some(record =>
      normalizeGlosaText(record.description || '') === normalizeGlosaText(fallback.description) &&
      isSimilarAmount(doc.total_amount, Number(record.amount || 0))
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

// Inline subcategory select that fetches its own data
const SupplierSubcategorySelect: React.FC<{
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

interface XMLDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
export const XMLDocumentUpload: React.FC<XMLDocumentUploadProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, string>>({});
  const [supplierSubcategoryMapping, setSupplierSubcategoryMapping] = useState<Record<string, string>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [createPayments, setCreatePayments] = useState(true);
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd, setDefaultDaysToAdd] = useState<number>(30);
  
  // Estados para condiciones de pago (tipo Facturas)
  const [supplierPaymentCondition, setSupplierPaymentCondition] = useState<Record<string, 'none' | 'credit' | string>>({});
  const [supplierCreditDate, setSupplierCreditDate] = useState<Record<string, string>>({});
  const [, setBulkDueDate] = useState<string>('');
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'pending' | 'paid'>>({});
  const [documentDescriptionOverrides, setDocumentDescriptionOverrides] = useState<Record<string, string>>({});
  const [expandedDocumentDetails, setExpandedDocumentDetails] = useState<Record<string, boolean>>({});
  const [historicalGlosaSuggestions, setHistoricalGlosaSuggestions] = useState<Record<string, HistoricalGlosaSuggestion>>({});
  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  
  // Estados para duplicados
  const [duplicateResults, setDuplicateResults] = useState<SupplierInvoiceDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  
  // Estados para matching de costos existentes
  const [matchedCosts, setMatchedCosts] = useState<Record<string, MatchedCost[]>>({});
  const [linkDecisions, setLinkDecisions] = useState<Record<string, string | 'new'>>({});
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  const [expandedSearchKeys, setExpandedSearchKeys] = useState<Set<string>>(new Set());
  const [expandingSearchKey, setExpandingSearchKey] = useState<string | null>(null);
  
  const {
    suppliers,
    createSupplier
  } = useSuppliers();
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

  const getSupplierCondition = (supplierRut: string) => supplierPaymentCondition[supplierRut] ?? 'none';
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
      const nextHistoricalGlosaSuggestions: Record<string, HistoricalGlosaSuggestion> = {};
      uniqueSuppliers.forEach(supplier => {
        const parsedSubcategory = (supplier as any).subcategory?.trim();
        categoryMap[supplier.rut] = supplier.category || 'otros';
        if (parsedSubcategory) {
          subcategoryMap[supplier.rut] = parsedSubcategory;
        }
      });
      
      const initialSupplierCondition: Record<string, 'none' | 'credit' | string> = {};
      const initialSupplierCreditDate: Record<string, string> = {};
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
                { data: historicalPayments, error: paymentHistoryError },
                { data: historicalCosts, error: historyError },
              ] = await Promise.all([
                supabase
                  .from('supplier_payments')
                  .select('supplier_id, description, amount, due_date, created_at')
                  .in('supplier_id', supplierIds)
                  .not('description', 'is', null)
                  .order('due_date', { ascending: false })
                  .limit(500),
                supabase
                  .from('costs')
                  .select('supplier_id, description, amount, date, created_at')
                  .in('supplier_id', supplierIds)
                  .not('description', 'is', null)
                  .order('date', { ascending: false })
                  .limit(500),
              ]);

              if ((!paymentHistoryError || !historyError) && (Array.isArray(historicalPayments) || Array.isArray(historicalCosts))) {
                const recordsBySupplierId = new Map<string, HistoricalGlosaCandidate[]>();
                const combinedHistory: HistoricalGlosaCandidate[] = [
                  ...((historicalPayments || []).map((row: any) => ({
                    supplier_id: row.supplier_id,
                    description: row.description,
                    amount: row.amount,
                    date: row.due_date,
                    created_at: row.created_at,
                  })) as HistoricalGlosaCandidate[]),
                  ...((historicalCosts || []) as HistoricalGlosaCandidate[]),
                ];

                combinedHistory.forEach((row: HistoricalGlosaCandidate) => {
                  if (!row?.supplier_id) return;
                  const existing = recordsBySupplierId.get(row.supplier_id) || [];
                  existing.push(row);
                  recordsBySupplierId.set(row.supplier_id, existing);
                });

                result.documents.forEach((doc) => {
                  const supplierId = supplierIdByRut.get(doc.supplier_rut);
                  if (!supplierId) return;
                  const suggestion = buildHistoricalGlosaSuggestion(doc, recordsBySupplierId.get(supplierId) || []);
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
        if (!initialSupplierCondition[s.rut]) initialSupplierCondition[s.rut] = 'none';
      });
      setSupplierCategoryMapping(categoryMap);
      setSupplierSubcategoryMapping(subcategoryMap);
      setSupplierPaymentCondition(initialSupplierCondition);
      setSupplierCreditDate(initialSupplierCreditDate);
      setHistoricalGlosaSuggestions(nextHistoricalGlosaSuggestions);
      
      // Initialize bulkDueDate from first document's issue_date + 30 days
      if (result.documents.length > 0 && result.documents[0].issue_date) {
        const firstIssue = safeParseDateOnly(result.documents[0].issue_date);
        setBulkDueDate(format(addDays(firstIssue, 30), 'yyyy-MM-dd'));
      } else {
        setBulkDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
      }
      
      // Initialize per-document due date overrides from XML dates + default days
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
        
        // Verificar duplicados de documentos
        if (result.documents.length > 0) {
          setIsCheckingDuplicates(true);
          try {
            const itemsToCheck = result.documents.map((doc) => ({
              folio: doc.folio,
              supplier_rut: doc.supplier_rut,
              amount: doc.total_amount
            }));
            
            const duplicates = await checkDuplicates(itemsToCheck);
            setDuplicateResults(duplicates);
            
            // Auto-deseleccionar duplicados exactos por folio
            if (duplicates.length > 0) {
              const exactDuplicates = duplicates.filter(d => d.matchType === 'exact_folio');
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
                  `Se detectaron ${exactDuplicates.length} duplicados reales y ${similarDuplicates.length} coincidencias similares. Los duplicados por folio fueron deseleccionados para revisión.`
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
            const matches: Record<string, MatchedCost[]> = {};
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
                // Auto-select exact match (same amount)
                const exactMatch = data.find((m: any) => Math.abs(m.amount - doc.total_amount) < 1);
                const documentKey = getDocumentStateKey(doc);
                matches[documentKey] = data as MatchedCost[];
                decisions[documentKey] = exactMatch ? (exactMatch as any).id : 'new';
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

  // Re-ejecuta la búsqueda de costos coincidentes para UN documento, opcionalmente con ventana ampliada
  const expandMatchSearchForDoc = async (doc: XMLDocumentData, windowDays = 15) => {
    if (!doc.supplier_rut || !doc.total_amount) {
      toast.warning('Este documento no tiene RUT o monto: no se puede buscar costos.');
      return;
    }
    const documentKey = getDocumentStateKey(doc);
    setExpandingSearchKey(documentKey);
    try {
      const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
      const dateFrom = new Date(issueDate);
      dateFrom.setDate(dateFrom.getDate() - windowDays);
      const dateTo = new Date(issueDate);
      dateTo.setDate(dateTo.getDate() + windowDays);

      const { data, error } = await supabase.rpc('find_matching_costs_for_invoice', {
        p_supplier_rut: doc.supplier_rut,
        p_amount: doc.total_amount,
        p_date_from: format(dateFrom, 'yyyy-MM-dd'),
        p_date_to: format(dateTo, 'yyyy-MM-dd'),
      });

      if (error) throw error;
      const results = (data || []) as MatchedCost[];
      setMatchedCosts(prev => ({ ...prev, [documentKey]: results }));
      setExpandedSearchKeys(prev => {
        const next = new Set(prev);
        next.add(documentKey);
        return next;
      });
      // Auto-seleccionar match exacto si aparece y aún no había decisión
      const exact = results.find(m => Math.abs(Number(m.amount) - doc.total_amount) < 1);
      if (exact && (!linkDecisions[documentKey] || linkDecisions[documentKey] === 'new')) {
        setLinkDecisions(prev => ({ ...prev, [documentKey]: exact.id }));
      }
      if (results.length === 0) {
        toast.info(`No se encontraron costos coincidentes en ±${windowDays} días.`);
      } else {
        toast.success(`${results.length} costo(s) encontrado(s) en ±${windowDays} días.`);
      }
    } catch (e: any) {
      logger.error('expandMatchSearchForDoc error', e);
      toast.error('Error al ampliar la búsqueda de costos.');
    } finally {
      setExpandingSearchKey(null);
    }
  };

  // Etiqueta del grado de coincidencia entre un costo candidato y el documento XML
  const getMatchQuality = (cost: MatchedCost, doc: XMLDocumentData): { label: string; tone: 'exact' | 'similar' | 'possible' } => {
    const diff = Math.abs(Number(cost.amount) - (doc.total_amount || 0));
    if (diff < 1) return { label: '✓ Exacto', tone: 'exact' };
    const ratio = doc.total_amount ? diff / doc.total_amount : 1;
    if (ratio <= 0.02) return { label: '≈ Casi exacto', tone: 'exact' };
    if (ratio <= 0.05) return { label: '≈ Similar', tone: 'similar' };
    return { label: '~ Posible', tone: 'possible' };
  };

  // Días transcurridos entre el costo y la emisión del documento
  const getCostAgeLabel = (cost: MatchedCost, doc: XMLDocumentData): string => {
    try {
      const costDate = safeParseDateOnly(cost.date);
      const issueDate = safeParseDateOnly(doc.issue_date || format(new Date(), 'yyyy-MM-dd'));
      const diffMs = issueDate.getTime() - costDate.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (days === 0) return 'mismo día';
      if (days > 0) return `${days} día${days > 1 ? 's' : ''} antes`;
      return `${Math.abs(days)} día${Math.abs(days) > 1 ? 's' : ''} después`;
    } catch {
      return cost.date;
    }
  };

  // Cambio de decisión con confirmación si el usuario abandona un match exacto
  const handleLinkDecisionChange = (documentKey: string, newValue: string, doc: XMLDocumentData) => {
    const candidates = matchedCosts[documentKey] || [];
    const currentDecision = linkDecisions[documentKey] || 'new';
    const currentSelected = candidates.find(c => c.id === currentDecision);
    const wasExactMatch =
      currentSelected && Math.abs(Number(currentSelected.amount) - (doc.total_amount || 0)) < 1;

    if (wasExactMatch && newValue === 'new') {
      const confirmed = window.confirm(
        '⚠️ Hay un costo existente con monto idéntico sin factura vinculada.\n\n' +
        'Si creas uno nuevo, ese costo quedará huérfano y duplicarás el gasto en el sistema.\n\n' +
        '¿Seguro que quieres crear un costo nuevo en vez de vincular el existente?'
      );
      if (!confirmed) return;
    }
    setLinkDecisions(prev => ({ ...prev, [documentKey]: newValue }));
  };

  const getEffectiveGlosa = (doc: XMLDocumentData) => {
    const documentKey = getDocumentStateKey(doc);
    const hasOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, documentKey);
    const override = hasOverride ? documentDescriptionOverrides[documentKey] : undefined;
    const value = (override ?? buildSuggestedGlosa(doc)).trim();
    return value.length > 0 ? value : buildSuggestedGlosa(doc);
  };
  // Helper: find supplier in DB by normalized RUT (fallback when in-memory list fails)
  const findSupplierInDb = async (rut: string): Promise<string | null> => {
    const normalizedRut = rut.replace(/[^0-9kK]/gi, '').toUpperCase();
    if (!normalizedRut) return null;
    
    // Try exact match first, then normalized match
    const { data } = await supabase
      .from('inventory_suppliers')
      .select('id, rut')
      .order('created_at', { ascending: false });
    
    if (!data) return null;
    
    const match = data.find((s: any) => {
      const dbRut = (s.rut || '').replace(/[^0-9kK]/gi, '').toUpperCase();
      return dbRut === normalizedRut;
    });
    
    return match?.id || null;
  };

  const handleUploadData = async () => {
    if (!parseResult) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const totalItems = selectedSuppliers.size + (createPayments ? selectedDocuments.size : 0);
      let processed = 0;
      let suppliersCreated = 0;
      let suppliersReused = 0;
      let suppliersFailed = 0;
      let paymentsCreated = 0;
      let paymentsFailed = 0;

      // Create suppliers first
      const createdSupplierMap = new Map<string, string>();
      const supplierNameByRut = new Map<string, string>();
      parseResult.suppliers.forEach(s => supplierNameByRut.set(s.rut, s.name || ''));
      for (const supplier of parseResult.suppliers) {
        if (!selectedSuppliers.has(supplier.rut)) continue;
        try {
          // Check if supplier already exists in memory
          const existingSupplier = findSupplierByIdentity(suppliers, supplier);
          if (!existingSupplier) {
            try {
              await new Promise<void>((resolve, reject) => {
                createSupplier({
                  ...supplier,
                  category: resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category),
                  subcategory: (supplierSubcategoryMapping[supplier.rut] || '').trim() || undefined,
                }, {
                  onSuccess: newSupplier => {
                    createdSupplierMap.set(supplier.rut, newSupplier.id);
                    suppliersCreated++;
                    resolve();
                  },
                  onError: reject
                });
              });
            } catch (createError) {
              // Fallback: search directly in DB (handles RLS or race conditions)
              logger.warn(`Create failed for ${supplier.name}, trying DB lookup...`);
              const dbSupplierId = await findSupplierInDb(supplier.rut);
              if (dbSupplierId) {
                createdSupplierMap.set(supplier.rut, dbSupplierId);
                suppliersReused++;
              } else {
                logger.error(`Could not find or create supplier ${supplier.name}`);
                suppliersFailed++;
              }
            }
          } else {
            createdSupplierMap.set(supplier.rut, existingSupplier.id);
            suppliersReused++;
          }
          
          // Persist supplier credit/default payment term configuration
          const mappedId = createdSupplierMap.get(supplier.rut);
          if (mappedId) {
            const condition = getSupplierCondition(supplier.rut);
            const updateData: Record<string, any> = {
              category: resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category || 'otros'),
              subcategory: (supplierSubcategoryMapping[supplier.rut] || '').trim() || null,
            };
            if (condition === 'credit') {
              updateData.credit_date = supplierCreditDate[supplier.rut] || null;
              updateData.default_payment_term_id = null;
            } else if (condition !== 'none') {
              updateData.default_payment_term_id = condition;
              updateData.credit_date = null;
            } else {
              updateData.default_payment_term_id = null;
              updateData.credit_date = null;
            }
            if (Object.keys(updateData).length > 0) {
              try {
                await supabase
                  .from('inventory_suppliers')
                  .update(updateData)
                  .eq('id', mappedId);
              } catch (e) {
                logger.error('Error actualizando configuración de crédito/condición:', e);
              }
            }
          }
          processed++;
          setUploadProgress(processed / totalItems * 100);
        } catch (error) {
          logger.error(`Error processing supplier ${supplier.name}:`, error);
          suppliersFailed++;
        }
      }

      // Create payments if requested
      if (createPayments) {
        const parser = new XMLSupplierParser();
        const paymentsData = parser.convertDocumentsToPayments(
          parseResult.documents.filter(d => selectedDocuments.has(getDocumentStateKey(d))), 
          parseResult.suppliers,
          dueDateOverrides
        );


        let exactFolioUpdated = 0;
        let exactFolioSkipped = 0;
        let linkedCount = 0;

        batchProgress.start('Cargando Documentos desde XML', paymentsData.length);

        for (const paymentData of paymentsData) {
          let createdPaymentId: string | null = null;
          batchProgress.update(paymentsCreated + paymentsFailed, `${paymentData.reference_number}`);
          try {
            let supplierId = createdSupplierMap.get(paymentData.supplier_rut);
            
            // Fallback: try DB lookup if not in map
            if (!supplierId) {
              const dbId = await findSupplierInDb(paymentData.supplier_rut);
              if (dbId) {
                supplierId = dbId;
                createdSupplierMap.set(paymentData.supplier_rut, dbId);
              } else {
                logger.error(`No supplier found for RUT ${paymentData.supplier_rut}, skipping payment`);
                paymentsFailed++;
                continue;
              }
            }
            
            // Determinar status y fecha de pago
            const docFolio = paymentData.reference_number || '';
            const originalDoc = parseResult.documents.find(
              d => d.folio === docFolio && d.supplier_rut === paymentData.supplier_rut
            );
            const documentKey = originalDoc
              ? getDocumentStateKey(originalDoc)
              : `${paymentData.supplier_rut || 'sin-rut'}::${docFolio || 'sin-folio'}`;
            const status = statusOverrides[documentKey] || 'pending';
            const paidDate = status === 'paid' 
              ? paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd')
              : undefined;
            
            // Recalcular due_date si no viene override, según condición del proveedor
            let finalDueDate = paymentData.due_date;
            if (!finalDueDate) {
              const condition = getSupplierCondition(paymentData.supplier_rut);
              if (condition === 'credit') {
                finalDueDate = supplierCreditDate[paymentData.supplier_rut] || finalDueDate;
              } else if (condition !== 'none') {
                if (originalDoc?.issue_date) {
                  const term = paymentTerms.find(t => t.id === condition);
                  if (term) {
                    const issueDate = safeParseDateOnly(originalDoc.issue_date);
                    finalDueDate = format(addDays(issueDate, term.days), 'yyyy-MM-dd');
                  }
                }
              }
            }

            // Pre-check: skip if supplier_payment with same folio already exists
            if (docFolio) {
              const { data: existingPayment } = await supabase
                .from('supplier_payments')
                .select('id')
                .eq('supplier_id', supplierId)
                .eq('reference_number', docFolio)
                .maybeSingle();
              
              if (existingPayment) {
                logger.debug(`Folio ${docFolio} ya existe en supplier_payments, omitiendo`);
                toast.info(`Folio ${docFolio} ya registrado, omitido`);
                processed++;
                continue;
              }
            }

            // Check if user chose to link to existing cost
            const linkCostId = linkDecisions[documentKey];
            if (linkCostId && linkCostId !== 'new') {
              // Find the original document data
              if (originalDoc) {
                await linkInvoiceMutation.mutateAsync({
                  costId: linkCostId,
                  supplierId,
                  invoiceData: {
                    folio: docFolio,
                    issueDate: originalDoc.issue_date,
                    dueDate: originalDoc.due_date || paymentData.due_date,
                    amount: originalDoc.total_amount,
                    netAmount: originalDoc.net_amount,
                    taxAmount: originalDoc.vat_amount,
                    description: originalDoc.description,
                    currency: originalDoc.currency,
                    paidDate: paidDate,
                    status: status as 'pending' | 'paid',
                  },
                });
                linkedCount++;
              }
              processed++;
              continue;
            }

            const duplicateInfo = originalDoc ? getDuplicateInfoForDocument(originalDoc) : undefined;

            // If the folio already exists (exact match), never create a new row.
            // If user is importing as paid, update the existing payment to paid.
            if (duplicateInfo?.matchType === 'exact_folio' && duplicateInfo.existingPayment?.id) {
              if (status === 'paid') {
                await new Promise<void>((resolve, reject) => {
                  updatePayment({
                    id: duplicateInfo.existingPayment!.id,
                    data: {
                      status: 'paid',
                      paid_date: paidDate,
                      paid_amount: paymentData.amount,
                    }
                  }, {
                    onSuccess: () => resolve(),
                    onError: reject
                  });
                });
                exactFolioUpdated++;
              } else {
                exactFolioSkipped++;
              }

              processed++;
              continue;
            }

            // Resolve category name to UUID for DB storage
            const categoryId = resolveCategoryId(supplierCategoryMapping[paymentData.supplier_rut] || paymentData.category) || paymentData.category;
            const subcatName = supplierSubcategoryMapping[paymentData.supplier_rut] || null;

            const effectiveDescription = (() => {
              return originalDoc ? getEffectiveGlosa(originalDoc) : paymentData.description;
            })();

            await new Promise<any>((resolve, reject) => {
              createPayment({
                supplier_id: supplierId,
                amount: paymentData.amount,
                due_date: finalDueDate || paymentData.due_date,
                description: effectiveDescription,
                category: categoryId,
                subcategory: subcatName,
                reference_number: paymentData.reference_number,
                notes: paymentData.notes,
                status: status,
                paid_date: paidDate,
                paid_amount: status === 'paid' ? paymentData.amount : undefined
              }, {
                onSuccess: (data) => {
                  createdPaymentId = (data as any)?.id ?? null;
                  resolve(data);
                },
                onError: reject
              });
            });

            paymentsCreated++;
            // Cost creation is handled automatically by the DB trigger
            // create_cost_from_supplier_payment on supplier_payments INSERT
            processed++;
          } catch (error) {
            logger.error(`Error creating payment for ${paymentData.reference_number}:`, error);
            try {
              if (createdPaymentId) {
                await supabase.from('costs').delete().eq('supplier_payment_id', createdPaymentId);
                await supabase.from('supplier_payments').delete().eq('id', createdPaymentId);
                logger.debug(`Rollback completado para pago ${paymentData.reference_number}`);
              }
            } catch (rollbackError) {
              logger.error(`Error durante rollback de pago ${paymentData.reference_number}:`, rollbackError);
            }
            paymentsFailed++;
          }
        }

        if (paymentsFailed === 0) {
          batchProgress.complete();
          setTimeout(() => { batchProgress.close(); }, 1500);
        } else {
          batchProgress.error(`${paymentsFailed} de ${paymentsData.length} con error`);
        }

        if (exactFolioUpdated > 0 || exactFolioSkipped > 0) {
          toast.message(`Duplicados por folio: ${exactFolioUpdated} actualizado(s), ${exactFolioSkipped} omitido(s)`);
        }
        if (linkedCount > 0) {
          toast.success(`🔗 ${linkedCount} factura(s) vinculada(s) a costos existentes`);
        }
      }

      // Report accurate results
      const totalSuccesses = (suppliersCreated + suppliersReused) + paymentsCreated;
      const totalFailures = suppliersFailed + paymentsFailed;
      
      if (totalFailures > 0 && totalSuccesses === 0) {
        toast.error(`Importación fallida: no se pudieron crear los registros. Verifica tu sesión e intenta nuevamente.`);
      } else if (totalFailures > 0) {
        toast.warning(`Importación parcial: ${paymentsCreated} pago(s) creado(s), ${totalFailures} error(es)`);
        onSuccess();
        onClose();
      } else {
        toast.success(`Importación completada: ${suppliersCreated > 0 ? `${suppliersCreated} proveedor(es) creado(s), ` : ''}${suppliersReused > 0 ? `${suppliersReused} existente(s), ` : ''}${paymentsCreated > 0 ? `${paymentsCreated} pago(s) registrado(s)` : 'sin pagos nuevos'}`);
        onSuccess();
        onClose();
      }
    } catch (error) {
      logger.error('Error uploading data:', error);
      toast.error('Error durante la importación');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  const handleCategoryChange = (supplierRut: string, category: string) => {
    setSupplierCategoryMapping(prev => ({
      ...prev,
      [supplierRut]: category
    }));
    // Reset subcategory when category changes
    setSupplierSubcategoryMapping(prev => ({
      ...prev,
      [supplierRut]: ''
    }));
  };

  const handleSubcategoryChange = (supplierRut: string, subcategory: string) => {
    setSupplierSubcategoryMapping(prev => ({
      ...prev,
      [supplierRut]: subcategory
    }));
  };
  const toggleSupplierSelection = (supplierRut: string) => {
    setSelectedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierRut)) {
        newSet.delete(supplierRut);
      } else {
        newSet.add(supplierRut);
      }
      return newSet;
    });
  };
  const toggleDocumentSelection = (documentKey: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentKey)) {
        newSet.delete(documentKey);
      } else {
        newSet.add(documentKey);
      }
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
    setCreatePayments(true);
    setDueDateOverrides({});
    setDefaultDaysToAdd(30);
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
  
  // Helper para obtener info de duplicado por documento
  const getDuplicateInfoForDocument = (document: XMLDocumentData): SupplierInvoiceDuplicateResult | undefined => {
    return duplicateResults.find(d => {
      const doc = parseResult?.documents[d.index];
      return !!doc && getDocumentStateKey(doc) === getDocumentStateKey(document);
    });
  };

  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[min(99vw,1600px)] max-w-[1600px] max-h-[95vh] overflow-clip border-border/70 bg-card p-0 shadow-2xl flex flex-col">
        <XMLImportDialogHeader
          icon={FileSpreadsheet}
          title="Importar Documentos XML"
          description="Analiza documentos XML, detecta duplicados y registra pagos a proveedores."
          fileName={selectedFile?.name}
          documentCount={parseResult?.totalDocuments}
        />

        <div className="space-y-6 px-6 pb-6 pt-4 overflow-y-auto flex-1 min-h-0">
          <XMLDropzoneArea
            selectedFile={selectedFile}
            parseResult={parseResult}
            isAnalyzing={isAnalyzing}
            isDragActive={isDragActive}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            onAnalyze={triggerAnalyze}
            onReset={reset}
            badges={['Detección de duplicados', 'Pago automático', 'Categorización']}
          />

          {/* Upload Progress */}
          {isUploading && <XMLImportProgressCard label="Subiendo datos..." value={uploadProgress} />}

          {/* Parse Results */}
          {parseResult && <div className="space-y-6">
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
                    title: 'Total Montos',
                    value: `$${parseResult.documents
                      .filter(d => selectedDocuments.has(getDocumentStateKey(d)))
                      .reduce((sum, d) => sum + d.total_amount, 0)
                      .toLocaleString('es-CL')}`,
                    icon: DollarSign,
                    tone: 'info',
                  },
                ]}
              />

              {/* Options */}
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Opciones de Importación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-x-2">
                    <Checkbox id="create-payments" checked={createPayments} onCheckedChange={checked => setCreatePayments(checked === true)} />
                    <label htmlFor="create-payments" className="text-foreground">
                      Crear pagos automáticamente desde los documentos
                    </label>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Duplicate Warning Banner */}
              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-warning/30 bg-warning/10">
                  <ShieldAlert className="size-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <strong>⚠️ Se detectaron coincidencias que requieren revisión.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact_folio').length > 0 && (
                        <Badge variant="destructive" className="mr-2">
                          {duplicateResults.filter(d => d.matchType === 'exact_folio').length} por folio
                        </Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'similar').length > 0 && (
                        <Badge className="border-warning/30 bg-warning/15 text-warning">
                          {duplicateResults.filter(d => d.matchType === 'similar').length} similares
                        </Badge>
                      )}
                    </span>
                    <span className="ml-2 text-sm">
                      Solo los duplicados por folio se deseleccionan automáticamente. Las coincidencias similares son solo referencia.
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
                    Puedes vincular la factura al costo existente o crear un pago nuevo.
                  </AlertDescription>
                </Alert>
              )}

              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && <div className="space-y-2">
                  {parseResult.errors.length > 0 && <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="size-4 text-destructive" />
                      <AlertDescription className="text-destructive">
                        <strong>Errores encontrados:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.errors.slice(0, 5).map((error, index) => <li key={index} className="text-sm">{error}</li>)}
                          {parseResult.errors.length > 5 && <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}

                  {parseResult.warnings.length > 0 && <Alert className="border-warning/30 bg-warning/10">
                      <AlertCircle className="size-4 text-warning" />
                      <AlertDescription className="text-warning">
                        <strong>Advertencias:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.warnings.slice(0, 3).map((warning, index) => <li key={index} className="text-sm">{warning}</li>)}
                          {parseResult.warnings.length > 3 && <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}
                </div>}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 1</p>
                <p className="mt-1 font-medium text-foreground">Revisa proveedor y configuración base</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajusta la forma de pago y la categoría solo si necesitas cambiar cómo se registrarán los documentos de este proveedor.
                </p>
              </div>

              {/* Suppliers Preview */}
              {parseResult.suppliers.length > 0 && <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building className="size-5" />
                      Proveedores Encontrados ({parseResult.suppliers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.suppliers.map((supplier, index) => <div key={index} className="flex items-center justify-between rounded-lg border border-border/70 border-l-4 border-l-primary bg-muted/30 p-3 shadow-sm">
                          <div className="flex items-center gap-x-3">
                            <Checkbox checked={selectedSuppliers.has(supplier.rut)} onCheckedChange={checked => {
                      if (checked === true) {
                        toggleSupplierSelection(supplier.rut);
                      } else if (checked === false) {
                        toggleSupplierSelection(supplier.rut);
                      }
                    }} />
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
                              <Select value={resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category)} onValueChange={value => handleCategoryChange(supplier.rut, value)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeCategories?.map(category => <SelectItem key={category.id} value={category.id}>
                                      {getCategoryLabel(activeCategories, category.id)}
                                    </SelectItem>)}
                                </SelectContent>
                              </Select>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Ayuda a clasificar los costos y reportes asociados al proveedor.
                              </p>
                            </div>
                            {/* Subcategory Select */}
                            {(() => {
                              const categoryId = resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category);
                              if (!categoryId) return null;
                              return (
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1.5 block">Subcategoría</Label>
                                  <SupplierSubcategorySelect
                                    categoryId={categoryId}
                                    value={supplierSubcategoryMapping[supplier.rut] || ''}
                                    onValueChange={(val) => handleSubcategoryChange(supplier.rut, val)}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        </div>)}
                    </div>
                  </CardContent>
                </Card>}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 2</p>
                <p className="mt-1 font-medium text-foreground">Revisa cada documento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Primero valida el estado del documento. Luego, solo si hace falta, abre los detalles para editar la descripción o el vencimiento.
                </p>
              </div>

              {/* Documents Preview */}
              {parseResult.documents.length > 0 && <Card className="overflow-hidden border-border/70 shadow-sm">
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
                        const defaultDueDate = dueDateOverrides[documentKey] ||
                          document.due_date ||
                          (() => {
                            const date = safeParseDateOnly(document.issue_date || format(new Date(), 'yyyy-MM-dd'));
                            date.setDate(date.getDate() + defaultDaysToAdd);
                            return format(date, 'yyyy-MM-dd');
                          })();

                        const duplicateInfo = getDuplicateInfoForDocument(document);
                        const isDuplicate = !!duplicateInfo;
                        const isExactDuplicate = duplicateInfo?.matchType === 'exact_folio';

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
                                  hint: 'Puedes importarlo o ajustar sus detalles si lo necesitas.',
                                };

                        return (
                          <div
                            key={index}
                            className={cn(
                              'flex flex-col gap-3 rounded-lg border p-3 shadow-sm',
                              hasMatches && currentDecision !== 'new'
                                ? 'border-info/30 bg-info/10'
                                : isDuplicate && duplicateInfo.matchType === 'exact_folio'
                                  ? 'border-danger/30 bg-danger/10'
                                  : isDuplicate && duplicateInfo.matchType === 'similar'
                                    ? 'border-warning/30 bg-warning/10'
                                    : 'border-border/60 bg-muted/30'
                            )}
                          >
                            {hasMatches ? (
                              <div className="rounded-md border border-info/30 bg-info/10 p-2.5 text-xs">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 font-medium text-info">
                                    <Link2 className="size-3.5" />
                                    Se encontraron {costsForDoc.length} costo{costsForDoc.length > 1 ? 's' : ''} de este proveedor
                                  </div>
                                  {!expandedSearchKeys.has(documentKey) && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[11px] text-info hover:bg-info/20"
                                      disabled={expandingSearchKey === documentKey}
                                      onClick={() => expandMatchSearchForDoc(document, 15)}
                                    >
                                      {expandingSearchKey === documentKey ? (
                                        <Loader2 className="mr-1 size-3 animate-spin" />
                                      ) : null}
                                      Ampliar ±15 días
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  {costsForDoc.map(cost => {
                                    const quality = getMatchQuality(cost, document);
                                    const ageLabel = getCostAgeLabel(cost, document);
                                    const isSelected = currentDecision === cost.id;
                                    const toneClass =
                                      quality.tone === 'exact'
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : quality.tone === 'similar'
                                          ? 'border-warning/40 bg-warning/10 text-warning'
                                          : 'border-border bg-muted text-muted-foreground';
                                    return (
                                      <label
                                        key={cost.id}
                                        className={cn(
                                          'flex cursor-pointer items-start gap-2 rounded border bg-background p-2 transition-colors',
                                          isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border/60 hover:border-border'
                                        )}
                                      >
                                        <input
                                          type="radio"
                                          name={`link-decision-${documentKey}`}
                                          checked={isSelected}
                                          onChange={() => handleLinkDecisionChange(documentKey, cost.id, document)}
                                          className="mt-0.5 accent-primary"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-medium text-foreground">
                                              ${Number(cost.amount).toLocaleString('es-CL')}
                                            </span>
                                            <span className="text-muted-foreground">·</span>
                                            <span className="text-muted-foreground">{cost.date}</span>
                                            <span className="text-muted-foreground">({ageLabel})</span>
                                            <Badge variant="outline" className={cn('h-5 border px-1.5 text-[10px]', toneClass)}>
                                              {quality.label}
                                            </Badge>
                                          </div>
                                          <p className="mt-0.5 break-words text-[11px] text-muted-foreground line-clamp-2">
                                            {cost.description || 'Sin descripción'}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                  <label
                                    className={cn(
                                      'flex cursor-pointer items-center gap-2 rounded border bg-background p-2 transition-colors',
                                      currentDecision === 'new'
                                        ? 'border-primary ring-1 ring-primary/30'
                                        : 'border-border/60 hover:border-border'
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={`link-decision-${documentKey}`}
                                      checked={currentDecision === 'new'}
                                      onChange={() => handleLinkDecisionChange(documentKey, 'new', document)}
                                      className="accent-primary"
                                    />
                                    <span className="text-foreground">
                                      ➕ Crear costo nuevo (no vincular)
                                    </span>
                                  </label>
                                </div>
                              </div>
                            ) : (
                              !isDuplicate && document.supplier_rut && document.total_amount ? (
                                <div className="flex items-center justify-between gap-2 rounded border border-dashed border-border/70 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                                  <span>Sin costos coincidentes en ±7 días</span>
                                  {!expandedSearchKeys.has(documentKey) && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[11px]"
                                      disabled={expandingSearchKey === documentKey}
                                      onClick={() => expandMatchSearchForDoc(document, 15)}
                                    >
                                      {expandingSearchKey === documentKey ? (
                                        <Loader2 className="mr-1 size-3 animate-spin" />
                                      ) : null}
                                      Buscar en ±15 días
                                    </Button>
                                  )}
                                </div>
                              ) : null
                            )}

                            {isDuplicate && duplicateInfo.existingPayment && (
                              <div
                                className={cn(
                                  'rounded px-2 py-1 text-xs',
                                  duplicateInfo.matchType === 'exact_folio'
                                    ? 'bg-danger/15 text-danger'
                                    : 'bg-warning/15 text-warning'
                                )}
                              >
                                <strong>
                                  {duplicateInfo.matchType === 'exact_folio' ? '⚠️ Folio ya registrado:' : '🔍 Similar:'}
                                </strong>
                                {' '}
                                {duplicateInfo.existingPayment.supplier_name} - $
                                {duplicateInfo.existingPayment.amount.toLocaleString('es-CL')}
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-start gap-x-3">
                                <Checkbox
                                  checked={selectedDocuments.has(documentKey)}
                                  onCheckedChange={checked => {
                                    if (checked === true) {
                                      toggleDocumentSelection(documentKey);
                                    } else if (checked === false) {
                                      toggleDocumentSelection(documentKey);
                                    }
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="break-words whitespace-pre-wrap font-medium text-foreground">
                                    {getEffectiveGlosa(document)}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
                                    <span>Folio: {document.folio}</span>
                                    <span>Total: ${document.total_amount.toLocaleString()}</span>
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
                                  <Label className="mb-1.5 block text-xs text-muted-foreground">Descripción que se guardará</Label>
                                  <Textarea
                                    value={descriptionValue}
                                    onChange={(e) => setDocumentDescriptionOverrides(prev => ({ ...prev, [documentKey]: e.target.value }))}
                                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                    ref={(el) => autoResizeTextarea(el)}
                                    rows={3}
                                    className="resize-y text-sm"
                                  />
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Este texto se usará como descripción del pago o del vínculo con costos.
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
                                  <div className="max-w-[220px] min-w-[180px] flex-1">
                                    <Label className="mb-1.5 block text-xs text-muted-foreground">Forma de pago</Label>
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
                                      Define si el documento queda pagado manualmente o con vencimiento.
                                    </p>
                                  </div>

                                  <div className="max-w-[220px] min-w-[180px] flex-1">
                                    <Label className="mb-1.5 block text-xs text-muted-foreground">Vencimiento</Label>
                                    <DatePickerInput
                                      value={defaultDueDate || ''}
                                      onChange={(date) => setDueDateOverrides(prev => ({ ...prev, [documentKey]: date }))}
                                      className="w-full"
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Puedes ajustarlo si el XML no trae una fecha correcta.
                                    </p>
                                  </div>

                                  <div className="max-w-[260px] min-w-[200px] flex-1">
                                    <Label className="mb-1.5 block text-xs text-muted-foreground">Estado de pago</Label>
                                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background">
                                      <Switch
                                        id={`sup-paid-${documentKey}`}
                                        checked={statusOverrides[documentKey] === 'paid'}
                                        onCheckedChange={(checked) => {
                                          setStatusOverrides(prev => ({
                                            ...prev,
                                            [documentKey]: checked ? 'paid' : 'pending',
                                          }));
                                          if (checked && !paidDateOverrides[documentKey]) {
                                            setPaidDateOverrides(prev => ({
                                              ...prev,
                                              [documentKey]: format(new Date(), 'yyyy-MM-dd'),
                                            }));
                                          }
                                        }}
                                      />
                                      <Label htmlFor={`sup-paid-${documentKey}`} className="text-xs cursor-pointer">
                                        Marcar como pagado
                                      </Label>
                                    </div>
                                    {statusOverrides[documentKey] === 'paid' && (
                                      <div className="mt-2">
                                        <DatePickerInput
                                          value={paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd')}
                                          onChange={(date) => setPaidDateOverrides(prev => ({ ...prev, [documentKey]: date }))}
                                          className="w-full"
                                        />
                                      </div>
                                    )}
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Si el documento ya fue pagado, indica la fecha real del pago.
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
                </Card>}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 3</p>
                <p className="mt-1 font-medium text-foreground">Confirma la importación</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revisa el resumen y luego confirma. Los documentos ya registrados no necesitan cambios salvo que quieras revisar sus detalles.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-border/70 pt-4">
                <div className="text-sm text-muted-foreground">
                  {selectedSuppliers.size > 0 && (
                    <div className="space-y-1">
                      <span className="block">{selectedSuppliers.size} proveedor(es) · {selectedDocuments.size} documento(s)</span>
                      <span className="block">
                        Total seleccionado: $
                        {parseResult.documents
                          .filter(d => selectedDocuments.has(getDocumentStateKey(d)))
                          .reduce((sum, d) => sum + d.total_amount, 0)
                          .toLocaleString('es-CL')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} disabled={isUploading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUploadData} disabled={isUploading || selectedSuppliers.size === 0} variant="default">
                    {isUploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle className="size-4 mr-2" />}
                    Confirmar importación
                    {createPayments && selectedDocuments.size > 0 && ` y ${selectedDocuments.size} Pagos`}
                  </Button>
                </div>
              </div>
            </div>}
        </div>
      </DialogContent>
      <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
    </Dialog>;
};
