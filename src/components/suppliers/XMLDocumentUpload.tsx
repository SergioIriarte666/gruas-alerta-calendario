import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X, FileSpreadsheet, Users, Receipt, DollarSign, Calendar, Building, CalendarIcon, Banknote, CreditCard, ShieldAlert, Link2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { dedupeSuppliersByIdentity, findSupplierByIdentity } from '@/utils/supplierIdentity';
import { XMLCompleteParseResult, XMLDocumentData, XMLSupplierData, XMLSupplierPaymentData } from '@/types/suppliers';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLCompleteParseResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
  const [bulkDueDate, setBulkDueDate] = useState<string>('');
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'pending' | 'paid'>>({});
  const [documentDescriptionOverrides, setDocumentDescriptionOverrides] = useState<Record<string, string>>({});
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
  
  const {
    suppliers,
    createSupplier
  } = useSuppliers();
  const { createPayment, updatePayment } = useSupplierPayments();
  const { checkDuplicates } = useSupplierInvoiceDuplicateCheck();
  const linkInvoiceMutation = useLinkInvoiceToCost();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));
  
  const getSupplierCondition = (supplierRut: string) => supplierPaymentCondition[supplierRut] ?? 'none';
  const applyConditionToSupplierDocuments = (supplierRut: string, condition: 'none' | 'credit' | string, creditDate?: string) => {
    if (!parseResult) return;
    if (condition === 'none') return;
    const nextOverrides: Record<string, string> = {};
    parseResult.documents.forEach((doc) => {
      if (doc.supplier_rut !== supplierRut) return;
      if (!doc.issue_date) return;
      if (condition === 'credit') {
        if (creditDate) nextOverrides[doc.folio] = creditDate;
        return;
      }
      const term = paymentTerms.find(t => t.id === condition);
      if (term) {
        const issueDate = safeParseDateOnly(doc.issue_date);
        nextOverrides[doc.folio] = format(addDays(issueDate, term.days), 'yyyy-MM-dd');
      }
    });
    setDueDateOverrides(prev => ({ ...prev, ...nextOverrides }));
  };
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setParseResult(null);
        setUploadProgress(0);
        setSupplierCategoryMapping({});
        setSelectedSuppliers(new Set());
        setSelectedDocuments(new Set());
        setDocumentDescriptionOverrides({});
        handleAnalyzeFile(file);
      } else {
        toast.error('Por favor selecciona un archivo XML válido');
      }
    }
  }, []);
  const {
    getRootProps,
    getInputProps,
    isDragActive
  } = useDropzone({
    onDrop,
    accept: {
      'text/xml': ['.xml'],
      'application/xml': ['.xml']
    },
    multiple: false
  });
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement> | Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      onDrop([file]);
    }
  };
  const handleAnalyzeFile = async (fileParam?: File) => {
    const fileToAnalyze = fileParam ?? selectedFile;
    if (!fileToAnalyze) return;
    setIsAnalyzing(true);
    const parser = new XMLSupplierParser();
    try {
      const result = await parser.parseXMLCompleteFile(fileToAnalyze);
      const uniqueSuppliers = dedupeSuppliersByIdentity(result.suppliers);
      const normalizedResult = {
        ...result,
        suppliers: uniqueSuppliers,
        totalSuppliers: uniqueSuppliers.length,
        validSuppliers: uniqueSuppliers.filter(item => item.name && item.name.trim().length > 0).length,
      };
      setParseResult(normalizedResult);

      // Pre-select all valid suppliers and documents
      const validSuppliers = new Set(uniqueSuppliers.filter(s => s.name && s.rut).map(s => s.rut));
      const validDocuments = new Set(result.documents.filter(d => d.folio && d.total_amount > 0).map(d => d.folio));
      setSelectedSuppliers(validSuppliers);
      setSelectedDocuments(validDocuments);

      // Initialize category mapping
      const categoryMap: Record<string, string> = {};
      uniqueSuppliers.forEach(supplier => {
        categoryMap[supplier.rut] = supplier.category;
      });
      setSupplierCategoryMapping(categoryMap);
      
      const initialSupplierCondition: Record<string, 'none' | 'credit' | string> = {};
      const initialSupplierCreditDate: Record<string, string> = {};
      try {
        const supplierRuts = uniqueSuppliers.map(s => s.rut).filter(Boolean);
        if (supplierRuts.length > 0) {
          const { data, error } = await (supabase as any)
            .from('inventory_suppliers')
            .select('rut, default_payment_term_id, credit_date')
            .in('rut', supplierRuts);
          if (!error && Array.isArray(data)) {
            data.forEach((row: any) => {
              if (!row?.rut) return;
              if (row.credit_date) {
                initialSupplierCondition[row.rut] = 'credit';
                initialSupplierCreditDate[row.rut] = row.credit_date;
              } else if (row.default_payment_term_id) {
                initialSupplierCondition[row.rut] = row.default_payment_term_id;
              } else {
                initialSupplierCondition[row.rut] = 'none';
              }
            });
          }
        }
      } catch (error) {
        console.error('Error cargando configuración de crédito:', error);
      }
      uniqueSuppliers.forEach(s => {
        if (!initialSupplierCondition[s.rut]) initialSupplierCondition[s.rut] = 'none';
      });
      setSupplierPaymentCondition(initialSupplierCondition);
      setSupplierCreditDate(initialSupplierCreditDate);
      
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
          initialDueOverrides[doc.folio] = format(addDays(issueDate, defaultDaysToAdd), 'yyyy-MM-dd');
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
            const itemsToCheck = result.documents.map((doc, index) => ({
              folio: doc.folio,
              supplier_rut: doc.supplier_rut,
              amount: doc.total_amount
            }));
            
            const duplicates = await checkDuplicates(itemsToCheck);
            setDuplicateResults(duplicates);
            
            // Auto-deseleccionar duplicados exactos por folio
            if (duplicates.length > 0) {
              const exactDuplicates = duplicates.filter(d => d.matchType === 'exact_folio');
              if (exactDuplicates.length > 0) {
                const newSelection = new Set(validDocuments);
                exactDuplicates.forEach(d => {
                  const doc = result.documents[d.index];
                  if (doc) newSelection.delete(doc.folio);
                });
                setSelectedDocuments(newSelection);
                setShowDuplicateWarning(true);
                toast.warning(`Se detectaron ${duplicates.length} posibles duplicados. ${exactDuplicates.length} por folio fueron deseleccionados.`);
              } else {
                toast.warning(`Se detectaron ${duplicates.length} posibles duplicados. Revísalos antes de importar.`);
              }
            }
          } catch (dupError) {
            console.error('Error checking duplicates:', dupError);
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
              dateFrom.setDate(dateFrom.getDate() - 7);
              const dateTo = new Date(issueDate);
              dateTo.setDate(dateTo.getDate() + 7);
              
              const { data, error } = await supabase.rpc('find_matching_costs_for_invoice', {
                p_supplier_rut: doc.supplier_rut,
                p_amount: doc.total_amount,
                p_date_from: format(dateFrom, 'yyyy-MM-dd'),
                p_date_to: format(dateTo, 'yyyy-MM-dd'),
              });
              
              if (!error && data && data.length > 0) {
                matches[doc.folio] = data as MatchedCost[];
                // Auto-select exact match (same amount)
                const exactMatch = data.find((m: any) => Math.abs(m.amount - doc.total_amount) < 1);
                decisions[doc.folio] = exactMatch ? (exactMatch as any).id : 'new';
              }
            }
            
            setMatchedCosts(matches);
            setLinkDecisions(decisions);
            
            const matchCount = Object.keys(matches).length;
            if (matchCount > 0) {
              toast.info(`🔗 Se encontraron ${matchCount} costos existentes que coinciden con documentos del XML`);
            }
          } catch (matchError) {
            console.error('Error searching matches:', matchError);
          } finally {
            setIsSearchingMatches(false);
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing XML:', error);
      toast.error('Error al analizar el archivo XML');
    } finally {
      setIsAnalyzing(false);
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
  const getEffectiveGlosa = (doc: XMLDocumentData) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, doc.folio);
    const override = hasOverride ? documentDescriptionOverrides[doc.folio] : undefined;
    const value = (override ?? buildSuggestedGlosa(doc)).trim();
    return value.length > 0 ? value : buildSuggestedGlosa(doc);
  };
  // Helper: find supplier in DB by normalized RUT (fallback when in-memory list fails)
  const findSupplierInDb = async (rut: string): Promise<string | null> => {
    const normalizedRut = rut.replace(/[^0-9kK]/gi, '').toUpperCase();
    if (!normalizedRut) return null;
    
    // Try exact match first, then normalized match
    const { data } = await (supabase as any)
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
                  category: supplierCategoryMapping[supplier.rut] || supplier.category
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
              console.warn(`Create failed for ${supplier.name}, trying DB lookup...`);
              const dbSupplierId = await findSupplierInDb(supplier.rut);
              if (dbSupplierId) {
                createdSupplierMap.set(supplier.rut, dbSupplierId);
                suppliersReused++;
              } else {
                console.error(`Could not find or create supplier ${supplier.name}`);
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
            const updateData: Record<string, any> = {};
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
                await (supabase as any)
                  .from('inventory_suppliers')
                  .update(updateData)
                  .eq('id', mappedId);
              } catch (e) {
                console.error('Error actualizando configuración de crédito/condición:', e);
              }
            }
          }
          processed++;
          setUploadProgress(processed / totalItems * 100);
        } catch (error) {
          console.error(`Error processing supplier ${supplier.name}:`, error);
          suppliersFailed++;
        }
      }

      // Create payments if requested
      if (createPayments) {
        const parser = new XMLSupplierParser();
        const paymentsData = parser.convertDocumentsToPayments(
          parseResult.documents.filter(d => selectedDocuments.has(d.folio)), 
          parseResult.suppliers,
          dueDateOverrides
        );


        let exactFolioUpdated = 0;
        let exactFolioSkipped = 0;
        let linkedCount = 0;

        for (const paymentData of paymentsData) {
          try {
            let supplierId = createdSupplierMap.get(paymentData.supplier_rut);
            
            // Fallback: try DB lookup if not in map
            if (!supplierId) {
              const dbId = await findSupplierInDb(paymentData.supplier_rut);
              if (dbId) {
                supplierId = dbId;
                createdSupplierMap.set(paymentData.supplier_rut, dbId);
              } else {
                console.error(`No supplier found for RUT ${paymentData.supplier_rut}, skipping payment`);
                paymentsFailed++;
                continue;
              }
            }
            
            // Determinar status y fecha de pago
            const docFolio = paymentData.reference_number || '';
            const status = statusOverrides[docFolio] || 'pending';
            const paidDate = status === 'paid' 
              ? paidDateOverrides[docFolio] || format(new Date(), 'yyyy-MM-dd')
              : undefined;
            
            // Recalcular due_date si no viene override, según condición del proveedor
            let finalDueDate = paymentData.due_date;
            if (!finalDueDate) {
              const condition = getSupplierCondition(paymentData.supplier_rut);
              if (condition === 'credit') {
                finalDueDate = supplierCreditDate[paymentData.supplier_rut] || finalDueDate;
              } else if (condition !== 'none') {
                const originalDoc = parseResult.documents.find(d => d.folio === docFolio);
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
                console.log(`Folio ${docFolio} ya existe en supplier_payments, omitiendo`);
                toast.info(`Folio ${docFolio} ya registrado, omitido`);
                processed++;
                setUploadProgress(processed / totalItems * 100);
                continue;
              }
            }

            // Check if user chose to link to existing cost
            const linkCostId = linkDecisions[docFolio];
            if (linkCostId && linkCostId !== 'new') {
              // Find the original document data
              const originalDoc = parseResult.documents.find(d => d.folio === docFolio);
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
              setUploadProgress(processed / totalItems * 100);
              continue;
            }

            const duplicateInfo = docFolio ? getDuplicateInfoByFolio(docFolio) : undefined;

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
              setUploadProgress(processed / totalItems * 100);
              continue;
            }
            
            // Resolve category name to UUID for DB storage
            const catName = supplierCategoryMapping[paymentData.supplier_rut] || paymentData.category;
            const catObj = activeCategories?.find(c => c.name === catName);
            const categoryId = catObj?.id || paymentData.category;
            const subcatName = supplierSubcategoryMapping[paymentData.supplier_rut] || null;

            const effectiveDescription = (() => {
              const originalDoc = parseResult.documents.find(d => d.folio === docFolio);
              return originalDoc ? getEffectiveGlosa(originalDoc) : paymentData.description;
            })();

            const createdPayment = await new Promise<any>((resolve, reject) => {
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
                onSuccess: (data) => resolve(data),
                onError: reject
              });
            });

            paymentsCreated++;
            // Cost creation is handled automatically by the DB trigger
            // create_cost_from_supplier_payment on supplier_payments INSERT
            processed++;
            setUploadProgress(processed / totalItems * 100);
          } catch (error) {
            console.error(`Error creating payment:`, error);
            paymentsFailed++;
          }
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
      console.error('Error uploading data:', error);
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
  const toggleDocumentSelection = (documentFolio: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentFolio)) {
        newSet.delete(documentFolio);
      } else {
        newSet.add(documentFolio);
      }
      return newSet;
    });
  };
  const reset = () => {
    setSelectedFile(null);
    setParseResult(null);
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
  };
  
  // Helper para obtener info de duplicado por folio
  const getDuplicateInfoByFolio = (folio: string): SupplierInvoiceDuplicateResult | undefined => {
    return duplicateResults.find(d => {
      const doc = parseResult?.documents[d.index];
      return doc?.folio === folio;
    });
  };

  const handleDueDateChange = (documentFolio: string, date: Date | undefined) => {
    if (date) {
      setDueDateOverrides(prev => ({
        ...prev,
        [documentFolio]: format(date, 'yyyy-MM-dd')
      }));
    }
  };

  const applyDefaultDaysToAll = () => {
    if (!parseResult) return;
    const daysToAdd = defaultDaysToAdd;
    const newOverrides: Record<string, string> = {};
    parseResult.documents.forEach(doc => {
      if (selectedDocuments.has(doc.folio) && doc.issue_date) {
        const issueDate = safeParseDateOnly(doc.issue_date);
        newOverrides[doc.folio] = format(addDays(issueDate, daysToAdd), 'yyyy-MM-dd');
      }
    });
    setDueDateOverrides(newOverrides);
    toast.success(`Fechas de vencimiento actualizadas a ${daysToAdd} días desde emisión`);
  };
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[min(99vw,1600px)] max-w-[1600px] max-h-[95vh] overflow-y-auto border-border/60 bg-gradient-to-b from-background to-muted/20 p-0 shadow-2xl suppliers-scope">
        <DialogHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4 dark:from-slate-950 dark:via-background dark:to-slate-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                Importar Documentos XML
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Analiza documentos XML, detecta duplicados y registra pagos a proveedores.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedFile ? (
                <Badge variant="outline" className="bg-background/70 px-3 py-1 text-xs">
                  Archivo: {selectedFile.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-background/70 px-3 py-1 text-xs">
                  Esperando XML
                </Badge>
              )}
              {parseResult && (
                <Badge variant="secondary" className="px-3 py-1 text-xs">
                  {parseResult.totalDocuments} doc(s)
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6 pt-4">
          {/* Upload Area */}
          {!selectedFile && <div {...getRootProps()} className={cn(
            'relative overflow-hidden border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
            isDragActive
              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
              : 'border-border/80 bg-background/80 hover:border-primary/50 hover:bg-primary/5'
          )}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_45%)]" />
              <input {...getInputProps()} />
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <Upload className="h-8 w-8" />
              </div>
              <p className="relative font-semibold text-base">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo XML o haz clic para seleccionarlo'}
              </p>
              <p className="relative mt-1 text-sm text-muted-foreground">
                o haz clic para seleccionar un archivo
              </p>
              <div className="relative mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary" className="bg-background/80">Detección de duplicados</Badge>
                <Badge variant="secondary" className="bg-background/80">Pago automático</Badge>
                <Badge variant="secondary" className="bg-background/80">Categorización</Badge>
              </div>
            </div>}

          {/* File Info */}
          {selectedFile && !parseResult && <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={() => handleAnalyzeFile()} disabled={isAnalyzing} variant="default">
                      {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      Analizar XML
                    </Button>
                    <Button variant="outline" onClick={reset}>
                      <X className="h-4 w-4 mr-2" />
                      Quitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>}

          {/* Upload Progress */}
          {isUploading && <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-foreground">
                    <span>Subiendo datos...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>}

          {/* Parse Results */}
          {parseResult && <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50 shadow-sm dark:from-background dark:to-muted/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proveedores</p>
                      <div className="text-2xl font-semibold">{parseResult.validSuppliers}/{parseResult.totalSuppliers}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white shadow-sm dark:from-emerald-950/30 dark:to-background">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentos</p>
                      <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{parseResult.validDocuments}/{parseResult.totalDocuments}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200/80 bg-gradient-to-br from-red-50 to-white shadow-sm dark:from-red-950/20 dark:to-background">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-xl bg-red-100 p-3 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Errores</p>
                      <div className="text-2xl font-semibold text-red-600 dark:text-red-400">{parseResult.errors.length}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50 to-white shadow-sm dark:from-blue-950/20 dark:to-background">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Montos</p>
                      <div className="text-2xl font-semibold">${parseResult.documents.filter(d => selectedDocuments.has(d.folio)).reduce((sum, d) => sum + d.total_amount, 0).toLocaleString()}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Options */}
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Opciones de Importación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="create-payments" checked={createPayments} onCheckedChange={checked => setCreatePayments(checked === true)} />
                    <label htmlFor="create-payments" className="text-foreground">
                      Crear pagos automáticamente desde los documentos
                    </label>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Duplicate Warning Banner */}
              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>⚠️ Se detectaron {duplicateResults.length} posibles duplicados de facturas.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact_folio').length > 0 && (
                        <Badge variant="destructive" className="mr-2">
                          {duplicateResults.filter(d => d.matchType === 'exact_folio').length} por folio
                        </Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'similar').length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {duplicateResults.filter(d => d.matchType === 'similar').length} similares
                        </Badge>
                      )}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-4 text-amber-700 hover:text-amber-900"
                      onClick={() => setShowDuplicateWarning(false)}
                    >
                      Ocultar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Checking duplicates indicator */}
              {isCheckingDuplicates && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700">Verificando duplicados en la base de datos...</span>
                </div>
              )}

              {/* Searching cost matches indicator */}
              {isSearchingMatches && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-800">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">Buscando costos existentes que coincidan...</span>
                </div>
              )}

              {/* Cost matching summary */}
              {Object.keys(matchedCosts).length > 0 && (
                <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/20">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>🔗 {Object.keys(matchedCosts).length} documento(s)</strong> coinciden con costos ya registrados.
                    Puedes vincular la factura al costo existente o crear un pago nuevo.
                  </AlertDescription>
                </Alert>
              )}

              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && <div className="space-y-2">
                  {parseResult.errors.length > 0 && <Alert className="border-destructive bg-destructive/10">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-destructive">
                        <strong>Errores encontrados:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.errors.slice(0, 5).map((error, index) => <li key={index} className="text-sm">{error}</li>)}
                          {parseResult.errors.length > 5 && <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}

                  {parseResult.warnings.length > 0 && <Alert className="border-yellow-600 bg-yellow-600/10">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-600">
                        <strong>Advertencias:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.warnings.slice(0, 3).map((warning, index) => <li key={index} className="text-sm">{warning}</li>)}
                          {parseResult.warnings.length > 3 && <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}
                </div>}

              {/* Suppliers Preview */}
              {parseResult.suppliers.length > 0 && <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Proveedores Encontrados ({parseResult.suppliers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {parseResult.suppliers.map((supplier, index) => <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                          <div className="flex items-center space-x-3">
                            <Checkbox checked={selectedSuppliers.has(supplier.rut)} onCheckedChange={checked => {
                      if (checked === true) {
                        toggleSupplierSelection(supplier.rut);
                      } else if (checked === false) {
                        toggleSupplierSelection(supplier.rut);
                      }
                    }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground font-medium truncate">{supplier.name}</p>
                              <p className="text-sm text-muted-foreground">{supplier.rut}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:max-w-[720px]">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1.5 block">Condición</Label>
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
                              <Label className="text-xs text-muted-foreground mb-1.5 block">Categoría</Label>
                              <Select value={supplierCategoryMapping[supplier.rut] || supplier.category} onValueChange={value => handleCategoryChange(supplier.rut, value)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeCategories?.map(category => <SelectItem key={category.id} value={category.name}>
                                      {getCategoryLabel(activeCategories, category.name)}
                                    </SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Subcategory Select */}
                            {(() => {
                              const catName = supplierCategoryMapping[supplier.rut] || supplier.category;
                              const catObj = activeCategories?.find(c => c.name === catName);
                              if (!catObj) return null;
                              return (
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1.5 block">Subcategoría</Label>
                                  <SupplierSubcategorySelect
                                    categoryId={catObj.id}
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

              {/* Documents Preview */}
              {parseResult.documents.length > 0 && <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Documentos Encontrados ({parseResult.documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {parseResult.documents.map((document, index) => {
                        const parser = new XMLSupplierParser();
                        const defaultDueDate = dueDateOverrides[document.folio] || 
                          document.due_date || 
                          (() => {
                            const date = safeParseDateOnly(document.issue_date || format(new Date(), 'yyyy-MM-dd'));
                            date.setDate(date.getDate() + defaultDaysToAdd);
                            return format(date, 'yyyy-MM-dd');
                          })();
                        const hasCustomDate = !!dueDateOverrides[document.folio];
                        
                        // Obtener info de duplicado
                        const duplicateInfo = getDuplicateInfoByFolio(document.folio);
                        const isDuplicate = !!duplicateInfo;
                        
                        // Obtener costos coincidentes
                        const costsForDoc = matchedCosts[document.folio] || [];
                        const hasMatches = costsForDoc.length > 0;
                        const currentDecision = linkDecisions[document.folio] || 'new';
                        
                        return (
                          <div key={index} className={cn(
                            "flex flex-col p-3 rounded gap-2",
                            hasMatches && currentDecision !== 'new'
                              ? "bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                              : isDuplicate && duplicateInfo.matchType === 'exact_folio'
                              ? "bg-red-50 border border-red-200"
                              : isDuplicate && duplicateInfo.matchType === 'similar'
                              ? "bg-yellow-50 border border-yellow-200"
                              : "bg-muted/50"
                          )}>
                            {/* Matched cost selector */}
                            {hasMatches && (
                              <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                                <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">🔗 Costo encontrado:</span>
                                <Select 
                                  value={currentDecision} 
                                  onValueChange={(val) => setLinkDecisions(prev => ({ ...prev, [document.folio]: val }))}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1 min-w-[200px] bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new">➕ Crear nuevo pago</SelectItem>
                                    {costsForDoc.map(cost => (
                                      <SelectItem key={cost.id} value={cost.id}>
                                        🔗 {cost.description} — ${Number(cost.amount).toLocaleString('es-CL')} — {cost.date}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {/* Duplicate warning */}
                            {isDuplicate && duplicateInfo.existingPayment && (
                              <div className={cn(
                                "text-xs px-2 py-1 rounded",
                                duplicateInfo.matchType === 'exact_folio' ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                              )}>
                                <strong>
                                  {duplicateInfo.matchType === 'exact_folio' ? '⚠️ Folio ya registrado:' : '🔍 Similar:'}
                                </strong>
                                {' '}{duplicateInfo.existingPayment.supplier_name} - ${duplicateInfo.existingPayment.amount.toLocaleString('es-CL')}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <Checkbox 
                                checked={selectedDocuments.has(document.folio)} 
                                onCheckedChange={checked => {
                                  if (checked === true) {
                                    toggleDocumentSelection(document.folio);
                                  } else if (checked === false) {
                                    toggleDocumentSelection(document.folio);
                                  }
                                }} 
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground font-medium break-words whitespace-pre-wrap">{getEffectiveGlosa(document)}</p>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap">
                                  <span>Folio: {document.folio}</span>
                                  <span>Total: ${document.total_amount.toLocaleString()}</span>
                                  {document.issue_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      Emisión: {document.issue_date}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2">
                                  <Label className="text-xs text-muted-foreground mb-1.5 block">Glosa del documento</Label>
                                  <Textarea
                                    value={Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, document.folio)
                                      ? documentDescriptionOverrides[document.folio]
                                      : buildSuggestedGlosa(document)}
                                    onChange={(e) => setDocumentDescriptionOverrides(prev => ({ ...prev, [document.folio]: e.target.value }))}
                                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                    ref={(el) => autoResizeTextarea(el)}
                                    rows={3}
                                    className="text-sm resize-y"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Condición de Pago y Fecha de Vencimiento */}
                            <div className="flex flex-wrap items-end gap-4 pt-3 border-t">
                              <div className="flex-1 min-w-[180px] max-w-[220px]">
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Condición de Pago</Label>
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
                              </div>
                              <div className="flex-1 min-w-[180px] max-w-[220px]">
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Fecha de Vencimiento</Label>
                                <DatePickerInput
                                  value={defaultDueDate || ''}
                                  onChange={(date) => setDueDateOverrides(prev => ({...prev, [document.folio]: date}))}
                                  className="w-full"
                                />
                              </div>
                            </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={reset} disabled={isUploading}>
                  Cancelar
                </Button>
                <Button onClick={handleUploadData} disabled={isUploading || selectedSuppliers.size === 0} variant="default">
                  {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Importar {selectedSuppliers.size} Proveedores
                  {createPayments && selectedDocuments.size > 0 && ` y ${selectedDocuments.size} Pagos`}
                </Button>
              </div>
            </div>}
        </div>
      </DialogContent>
    </Dialog>;
};
