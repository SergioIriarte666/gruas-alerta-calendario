import { useCallback, useEffect, useMemo, useState } from 'react';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { useCreateInventoryItem, useInventoryCategories, useInventoryItems, useInventoryLocations } from '@/hooks/useInventory';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useServices } from '@/hooks/useServices';
import { UnifiedPurchaseService } from '@/services/UnifiedPurchaseService';
import { supabase } from '@/integrations/supabase/client';
import { XMLDocumentData, XMLDocumentItem, Supplier } from '@/types/suppliers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { findSimilarItems, type SimilarItem, type SimilarityResult } from '@/utils/inventoryHelper';
import { createLogger } from '@/lib/logger';
import { cn, toTitleCase } from '@/lib/utils';
import {
  normalizeText, normalizeCode, isPlaceholderCode,
  buildProductDescription, buildCostDescription, buildImportSuccessMessage,
  getLineKey, computeLineSubtotal, computeLineTaxAmount, computeLineTotal,
} from '@/utils/xml/xmlInventoryHelpers';

const logger = createLogger('useXmlInventoryUpload');

export interface InventoryCatalogItem {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit_cost?: number | null;
}

export interface ValidatedInvoiceLine {
  key: string;
  lineNumber: number;
  item: XMLDocumentItem;
  matchedItem: InventoryCatalogItem | null;
  candidates: InventoryCatalogItem[];
  error: string | null;
  warning: string | null;
}

export interface ValidatedDocument {
  doc: XMLDocumentData;
  supplier: Supplier | undefined;
  lines: ValidatedInvoiceLine[];
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface InsertedInvoiceLine { id: string; inventory_item_id: string; line_number: number }

export interface ServiceSearchResult {
  id: string; folio: string; clientName: string; serviceDateLabel: string;
  licensePlate: string; craneLabel: string; operatorLabel: string; searchValue: string; score: number;
}

export interface PendingProductSuggestion {
  doc: XMLDocumentData; line: ValidatedInvoiceLine; similarityResult: SimilarityResult;
}

interface UseXmlInventoryUploadOptions {
  onSuccess: (count: number) => void;
  onClose: () => void;
}

export function useXmlInventoryUpload({ onSuccess, onClose }: UseXmlInventoryUploadOptions) {
  const { data: inventoryItems = [], refetch: refetchInventoryItems } = useInventoryItems();
  const { data: categories = [] } = useInventoryCategories();
  const { data: costCategories = [] } = useCostCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { operationalCranes: cranes = [] } = useCranes();
  const { operators = [] } = useOperators();
  const { getServicesForCosts } = useServices();
  const { data: locations = [] } = useInventoryLocations();
  const createInventoryItem = useCreateInventoryItem();
  const { suppliers = [], createSupplierAsync } = useSuppliers();
  const { invalidateAll, refetchCritical } = useUniversalSync();

  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [lineDescriptionOverrides, setLineDescriptionOverrides] = useState<Record<string, string>>({});
  const [manualMatchedItems, setManualMatchedItems] = useState<Record<string, InventoryCatalogItem>>({});
  const [editedDescriptions, setEditedDescriptions] = useState<Map<string, string>>(new Map());
  const [discardedLines, setDiscardedLines] = useState<Set<string>>(new Set());
  const [catalogSearchOpen, setCatalogSearchOpen] = useState<Record<string, boolean>>({});
  const [creatingProductKeys, setCreatingProductKeys] = useState<Set<string>>(new Set());
  const [selectedCostCategoryId, setSelectedCostCategoryId] = useState<string>('');
  const [selectedCostSubcategory, setSelectedCostSubcategory] = useState<string>('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>('');
  const [selectedCraneId, setSelectedCraneId] = useState<string>('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedServiceFolio, setSelectedServiceFolio] = useState<string>('');
  const [serviceSearchOpen, setServiceSearchOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [showAdvancedAssociations, setShowAdvancedAssociations] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingProductSuggestion, setPendingProductSuggestion] = useState<PendingProductSuggestion | null>(null);
  const [suggestedProductDetails, setSuggestedProductDetails] = useState<SimilarItem | null>(null);

  const servicesForCosts = useMemo(() => getServicesForCosts(), [getServicesForCosts]);
  const { subcategories: costSubcategories = [] } = useCostSubcategories(selectedCostCategoryId || undefined);

  const inventoryCatalog = useMemo<InventoryCatalogItem[]>(
    () => inventoryItems.map(item => ({ id: item.id, name: item.name, sku: item.sku, barcode: item.barcode, unit_cost: item.unit_cost })),
    [inventoryItems]
  );

  const findMatchedInventoryItem = useCallback(
    (line: XMLDocumentItem): { match: InventoryCatalogItem | null; candidates: InventoryCatalogItem[] } => {
      const codeCandidates = [
        !isPlaceholderCode(line.product_code) ? normalizeCode(line.product_code) : '',
        normalizeCode(line.product_name),
        normalizeCode(line.description),
      ].filter(Boolean);

      for (const code of codeCandidates) {
        const exactCodeMatch = inventoryCatalog.find(item =>
          (!isPlaceholderCode(item.sku) && normalizeCode(item.sku) === code) ||
          (!isPlaceholderCode(item.barcode) && normalizeCode(item.barcode) === code) ||
          normalizeCode(item.name) === code
        );
        if (exactCodeMatch) return { match: exactCodeMatch, candidates: [] };
      }

      const normalizedDesc = normalizeText(line.description);
      const exactNameMatch = inventoryCatalog.find(item => normalizeText(item.name) === normalizedDesc);
      if (exactNameMatch) return { match: exactNameMatch, candidates: [] };

      const partialMatches = inventoryCatalog.filter(item => {
        const itemName = normalizeText(item.name);
        return normalizedDesc.length >= 6 && (itemName.includes(normalizedDesc) || normalizedDesc.includes(itemName));
      });

      if (partialMatches.length === 1) return { match: partialMatches[0], candidates: [] };
      return { match: null, candidates: partialMatches };
    },
    [inventoryCatalog]
  );

  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive, reset: resetParsing,
  } = useXMLParsing({
    onFileSelected: () => {
      setSelectedDocuments(new Set());
      setLineDescriptionOverrides({});
      setManualMatchedItems({});
      setDiscardedLines(new Set());
      setEditedDescriptions(new Map());
    },
    onParsed: (result) => {
      const validFolios = new Set(result.documents.filter(doc => doc.folio && (doc.items?.length || 0) > 0).map(doc => doc.folio));
      setSelectedDocuments(validFolios);
      if (!selectedCostCategoryId && costCategories.length > 0) {
        const defaultCat = costCategories.find(c => normalizeText(c.name).includes('inventario')) ||
          costCategories.find(c => normalizeText(c.name).includes('mantenimiento')) || costCategories[0];
        if (defaultCat) setSelectedCostCategoryId(defaultCat.id);
      }
      if (!selectedLocationId && locations.length > 0) {
        const defaultLoc = locations.find(l => l.code === 'MAIN') || locations[0];
        if (defaultLoc) setSelectedLocationId(defaultLoc.id);
      }
    },
  });

  const validatedDocuments = useMemo<ValidatedDocument[]>(() => {
    if (!parseResult) return [];
    return parseResult.documents.map(doc => {
      const supplier = suppliers.find(item => normalizeCode(item.rut) === normalizeCode(doc.supplier_rut));
      const errors: string[] = [];
      const warnings: string[] = [];
      const rawLines = doc.items || [];

      if (rawLines.length === 0) errors.push('La factura no contiene líneas de detalle importables.');

      const lines: ValidatedInvoiceLine[] = rawLines.map((line, index) => {
        const lineNumber = index + 1;
        const editedDescription = lineDescriptionOverrides[getLineKey(doc.folio, lineNumber)];
        const effectiveLine: XMLDocumentItem = { ...line, description: typeof editedDescription === 'string' ? editedDescription : line.description };
        const lineKey = getLineKey(doc.folio, lineNumber);
        const manualMatch = manualMatchedItems[lineKey];
        const finderResult = findMatchedInventoryItem(effectiveLine);
        const matchedItem = manualMatch || finderResult.match;
        const candidates = manualMatch ? [] : (finderResult.match ? [] : finderResult.candidates);
        const resolvedLine: XMLDocumentItem = matchedItem && !effectiveLine.description?.trim() ? { ...effectiveLine, description: matchedItem.name } : effectiveLine;
        const quantity = Number(line.quantity);
        const subtotal = computeLineSubtotal(resolvedLine);
        const total = computeLineTotal(resolvedLine);

        let error: string | null = null;
        let warning: string | null = null;

        if (!Number.isFinite(quantity) || quantity <= 0) { error = 'La cantidad debe ser mayor a 0.'; }
        else if (!Number.isInteger(quantity)) { error = 'La cantidad debe ser un número entero para el inventario.'; }
        else if (!matchedItem) {
          if (!effectiveLine.description?.trim()) error = 'La línea no tiene descripción.';
          else error = candidates.length > 0 ? `${candidates.length} coincidencia(s) parcial(es) encontrada(s). Seleccione una.` : 'No se encontró coincidencia en el catálogo de productos.';
        } else if (subtotal <= 0 && total <= 0) { error = 'La línea no tiene monto válido.'; }
        else if (!effectiveLine.description?.trim()) { warning = 'Sin descripción, se usará el nombre del producto.'; }
        else if (!effectiveLine.product_code && normalizeText(matchedItem.name) !== normalizeText(resolvedLine.description)) { warning = 'Coincidencia realizada por descripción aproximada.'; }

        return { key: lineKey, lineNumber, item: resolvedLine, matchedItem, candidates, error, warning };
      });

      if (!supplier) warnings.push('El proveedor no existe aún y se creará durante la importación.');

      const activeLines = lines.filter(line => !discardedLines.has(line.key));
      errors.push(...activeLines.filter(line => line.error).map(line => `Línea ${line.lineNumber}: ${line.error}`));
      warnings.push(...activeLines.filter(line => line.warning).map(line => `Línea ${line.lineNumber}: ${line.warning}`));

      const totalByLines = activeLines.reduce((sum, line) => sum + computeLineTotal(line.item), 0);
      if (doc.total_amount > 0 && Math.abs(totalByLines - doc.total_amount) > 5) {
        warnings.push('La suma de las líneas no coincide exactamente con el total del documento.');
      }

      return {
        doc: { ...doc, items: lines.map(line => line.item) },
        supplier, lines, errors, warnings,
        isValid: errors.length === 0 && activeLines.length > 0,
      };
    });
  }, [discardedLines, findMatchedInventoryItem, lineDescriptionOverrides, manualMatchedItems, parseResult, suppliers]);

  const selectedValidatedDocuments = useMemo(
    () => validatedDocuments.filter(item => selectedDocuments.has(item.doc.folio)),
    [selectedDocuments, validatedDocuments]
  );

  const supplierNameByRut = useMemo(() => {
    const map = new Map<string, string>();
    parseResult?.suppliers.forEach(supplier => map.set(normalizeCode(supplier.rut), supplier.name));
    return map;
  }, [parseResult]);

  const summary = useMemo(() => ({
    totalDocs: validatedDocuments.length,
    validDocs: validatedDocuments.filter(item => item.isValid).length,
    totalLines: validatedDocuments.reduce((sum, item) => sum + item.lines.filter(l => !discardedLines.has(l.key)).length, 0),
    invalidLines: validatedDocuments.reduce((sum, item) => sum + item.lines.filter(line => !discardedLines.has(line.key) && line.error).length, 0),
  }), [validatedDocuments, discardedLines]);

  const serviceSearchResults = useMemo<ServiceSearchResult[]>(() => {
    const query = normalizeText(serviceSearchQuery);
    return servicesForCosts.map(service => {
      const clientName = toTitleCase(service.client.name || '');
      const serviceDateLabel = format(parseFromDatabase(service.serviceDate), 'dd/MM/yyyy', { locale: es });
      const craneLabel = service.crane?.licensePlate || 'Sin grua';
      const operatorLabel = service.operator?.name || 'Sin operador';
      const licensePlate = service.licensePlate || '';
      const searchValue = [service.folio, clientName, serviceDateLabel, craneLabel, operatorLabel, licensePlate].join(' ');
      let score = 0;
      if (!query) { score = 1; } else {
        if (normalizeText(service.folio) === query) score += 120;
        if (normalizeText(service.folio).startsWith(query)) score += 90;
        if (normalizeText(service.folio).includes(query)) score += 75;
        if (normalizeText(licensePlate) === query) score += 70;
        if (normalizeText(licensePlate).includes(query)) score += 60;
        if (normalizeText(clientName).includes(query)) score += 50;
        if (normalizeText(craneLabel).includes(query)) score += 40;
        if (normalizeText(operatorLabel).includes(query)) score += 35;
        if (normalizeText(serviceDateLabel).includes(query)) score += 20;
      }
      return { id: service.id, folio: service.folio, clientName, serviceDateLabel, licensePlate, craneLabel, operatorLabel, searchValue, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, query ? 30 : 20);
  }, [serviceSearchQuery, servicesForCosts]);

  const selectedService = useMemo(() => servicesForCosts.find(s => s.id === selectedServiceId) || null, [selectedServiceId, servicesForCosts]);
  const selectedLocation = useMemo(() => locations.find(l => l.id === selectedLocationId) || null, [locations, selectedLocationId]);
  const selectedCostCategory = useMemo(() => costCategories.find(c => c.id === selectedCostCategoryId) || null, [costCategories, selectedCostCategoryId]);
  const selectedCostCenter = useMemo(() => costCenters.find(c => c.id === selectedCostCenterId) || null, [costCenters, selectedCostCenterId]);
  const selectedCrane = useMemo(() => cranes.find(c => c.id === selectedCraneId) || null, [cranes, selectedCraneId]);
  const selectedOperator = useMemo(() => operators.find(o => o.id === selectedOperatorId) || null, [operators, selectedOperatorId]);

  useEffect(() => {
    if (!selectedCostCategoryId) return;
    const category = costCategories.find(item => item.id === selectedCostCategoryId);
    if (category?.default_cost_center_id && !selectedCostCenterId) setSelectedCostCenterId(category.default_cost_center_id);
  }, [costCategories, selectedCostCategoryId, selectedCostCenterId]);

  useEffect(() => {
    if (!selectedServiceId) return;
    const service = servicesForCosts.find(s => s.id === selectedServiceId);
    if (!service) return;
    setSelectedCraneId(service.crane?.id || '');
    setSelectedOperatorId(service.operator?.id || '');
    setSelectedServiceFolio(service.folio || '');
  }, [selectedServiceId, servicesForCosts]);

  const resetState = () => {
    resetParsing();
    setSelectedDocuments(new Set());
    setLineDescriptionOverrides({});
    setManualMatchedItems({});
    setDiscardedLines(new Set());
    setEditedDescriptions(new Map());
    setSelectedLocationId('');
    setSelectedCostCategoryId('');
    setSelectedCostSubcategory('');
    setSelectedCostCenterId('');
    setSelectedCraneId('');
    setSelectedOperatorId('');
    setSelectedServiceId('');
    setSelectedServiceFolio('');
    setServiceSearchOpen(false);
    setServiceSearchQuery('');
    setIsPaid(false);
    setShowAdvancedAssociations(false);
    setIsImporting(false);
    setProgress(0);
    setPendingProductSuggestion(null);
    setSuggestedProductDetails(null);
  };

  const handleClose = () => {
    if (isAnalyzing || isImporting) return;
    resetState();
    onClose();
  };

  const toggleSelectedDocument = (folio: string, checked: boolean) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(folio);
      } else {
        next.delete(folio);
      }
      return next;
    });
  };

  const updateLineDescription = (folio: string, lineNumber: number, description: string) => {
    setLineDescriptionOverrides(prev => ({ ...prev, [getLineKey(folio, lineNumber)]: description }));
  };

  const ensureSupplier = async (doc: XMLDocumentData, supplier: Supplier | undefined): Promise<string> => {
    if (supplier?.id) return supplier.id;
    const supplierNameFromXml = supplierNameByRut.get(normalizeCode(doc.supplier_rut));
    const created = await createSupplierAsync({
      name: supplierNameFromXml || doc.description?.split(' - ').pop()?.trim() || `Proveedor XML ${doc.supplier_rut || doc.folio}`,
      rut: doc.supplier_rut || undefined,
      is_active: true,
      category: 'otros',
      notes: 'Proveedor creado automáticamente desde importación XML de inventario',
    });
    return created.id;
  };

  const cleanupStaleInventoryXMLInvoice = async (supplierInvoiceId: string): Promise<boolean> => {
    const { data: linkedCosts, error: linkedCostsError } = await supabase.from('costs').select('id').eq('supplier_invoice_id', supplierInvoiceId);
    if (linkedCostsError) throw new Error(`No se pudo validar costos vinculados: ${linkedCostsError.message}`);
    if ((linkedCosts || []).length > 0) return false;

    const { data: linkedMovements, error: linkedMovementsError } = await supabase.from('inventory_movements').select('id').eq('supplier_invoice_id', supplierInvoiceId);
    if (linkedMovementsError) throw new Error(`No se pudo validar movimientos vinculados: ${linkedMovementsError.message}`);

    const movementIds = (linkedMovements || []).map(m => m.id);
    if (movementIds.length > 0) {
      const { error: deleteCranePartsError } = await supabase.from('crane_parts').delete().in('inventory_movement_id', movementIds);
      if (deleteCranePartsError) throw new Error(`No se pudieron limpiar piezas de grúa huérfanas: ${deleteCranePartsError.message}`);
      const { error: deleteMovementsError } = await supabase.from('inventory_movements').delete().in('id', movementIds);
      if (deleteMovementsError) throw new Error(`No se pudieron limpiar movimientos huérfanos: ${deleteMovementsError.message}`);
    }

    const { error: deletePaymentsError } = await supabase.from('supplier_payments').delete().eq('supplier_invoice_id', supplierInvoiceId);
    if (deletePaymentsError) throw new Error(`No se pudieron limpiar pagos huérfanos: ${deletePaymentsError.message}`);
    const { error: deleteInvoiceError } = await supabase.from('supplier_invoices').delete().eq('id', supplierInvoiceId);
    if (deleteInvoiceError) throw new Error(`No se pudo limpiar la factura huérfana: ${deleteInvoiceError.message}`);
    return true;
  };

  const cleanupStaleIncompleteCostAttempt = async (supplierId: string, folio: string) => {
    const { data: candidateCosts, error } = await supabase.from('costs').select('id, supplier_invoice_id, supplier_payment_id, inventory_movement_id').eq('supplier_id', supplierId).eq('document_number', folio);
    if (error) throw new Error(`No se pudieron validar costos previos del folio ${folio}: ${error.message}`);

    for (const candidateCost of candidateCosts || []) {
      const [paymentResult, movementResult, cranePartResult] = await Promise.all([
        supabase.from('supplier_payments').select('id, reference_number, supplier_invoice_id').eq('cost_id', candidateCost.id).maybeSingle(),
        supabase.from('inventory_movements').select('id', { count: 'exact', head: true }).eq('cost_id', candidateCost.id),
        supabase.from('crane_parts').select('id', { count: 'exact', head: true }).eq('cost_id', candidateCost.id),
      ]);
      if (paymentResult.error) throw new Error(`No se pudo validar el pago previo del folio ${folio}: ${paymentResult.error.message}`);
      if (movementResult.error) throw new Error(`No se pudieron validar movimientos previos del folio ${folio}: ${movementResult.error.message}`);
      if (cranePartResult.error) throw new Error(`No se pudieron validar consumos previos del folio ${folio}: ${cranePartResult.error.message}`);

      const existingPayment = paymentResult.data;
      const isStale = Boolean(!candidateCost.supplier_invoice_id && !candidateCost.inventory_movement_id && (movementResult.count || 0) === 0 && (cranePartResult.count || 0) === 0 && existingPayment?.id && !existingPayment.reference_number && !existingPayment.supplier_invoice_id);
      if (!isStale) continue;

      const { error: deletePaymentError } = await supabase.from('supplier_payments').delete().eq('cost_id', candidateCost.id);
      if (deletePaymentError) throw new Error(`No se pudo limpiar el pago huérfano del folio ${folio}: ${deletePaymentError.message}`);
      const { error: deleteCostError } = await supabase.from('costs').delete().eq('id', candidateCost.id);
      if (deleteCostError) throw new Error(`No se pudo limpiar el costo huérfano del folio ${folio}: ${deleteCostError.message}`);
      toast.info(`Se limpió un intento incompleto previo para el folio ${folio}.`);
    }
  };

  const ensureSupplierPaymentLink = async (params: {
    costId: string; supplierId: string; supplierInvoiceId: string; amount: number; dueDate: string;
    description: string; referenceNumber: string; notes: string; status: 'paid' | 'pending';
    paidAmount: number; paidDate: string | null; craneId: string | null; partName: string;
  }): Promise<string> => {
    const paymentPayload = {
      supplier_id: params.supplierId, supplier_invoice_id: params.supplierInvoiceId, cost_id: params.costId,
      amount: params.amount, due_date: params.dueDate, description: params.description,
      category: selectedCostCategory?.name || 'Costos', subcategory: selectedCostSubcategory || 'Importación XML Bodega',
      reference_number: params.referenceNumber, notes: params.notes, status: params.status,
      paid_amount: params.paidAmount, paid_date: params.paidDate, crane_id: params.craneId,
      add_to_inventory: false, part_name: params.partName,
    };
    const { data: existingPayment, error: existingPaymentError } = await supabase.from('supplier_payments').select('id').eq('cost_id', params.costId).maybeSingle();
    if (existingPaymentError) throw new Error(`No se pudo validar el pago para ${params.referenceNumber}: ${existingPaymentError.message}`);
    if (existingPayment?.id) {
      const { error } = await supabase.from('supplier_payments').update(paymentPayload).eq('id', existingPayment.id);
      if (error) throw new Error(`No se pudo actualizar el pago para ${params.referenceNumber}: ${error.message}`);
      return existingPayment.id;
    }
    const { data: createdPayment, error: createError } = await supabase.from('supplier_payments').insert(paymentPayload).select('id').single();
    if (createError || !createdPayment) throw new Error(`No se pudo crear el pago para ${params.referenceNumber}: ${createError?.message || 'Error desconocido'}`);
    return createdPayment.id;
  };

  const createMissingProductDirect = async (doc: XMLDocumentData, line: ValidatedInvoiceLine, lineKey: string) => {
    const name = line.item.description?.trim();
    if (!name) { toast.error('La glosa es obligatoria para crear el producto'); return; }
    try {
      const rawCode = line.item.product_code?.trim() || null;
      const normalizedCode = !isPlaceholderCode(rawCode) ? rawCode : null;
      const preferredCategory = categories.find(c => normalizeText(c.name).includes('implement')) || categories.find(c => normalizeText(c.name).includes('repuesto')) || null;
      await createInventoryItem.mutateAsync({
        name, description: `Creado desde importación XML ${doc.folio}`, sku: normalizedCode, barcode: null,
        category_id: preferredCategory?.id || null, unit_of_measure: 'unidad',
        minimum_stock: 0, maximum_stock: 0, safety_stock: 0,
        unit_cost: Number(line.item.unit_price) || 0, is_active: true, is_critical: false, has_expiration: false,
      });
      await refetchInventoryItems();
      toast.success(`Producto "${name}" creado y agregado al catálogo`);
    } catch (error) {
      logger.error('Error creating missing inventory product:', error);
    } finally {
      setPendingProductSuggestion(null);
      setCreatingProductKeys(prev => { const next = new Set(prev); next.delete(lineKey); return next; });
    }
  };

  const handleCreateMissingProduct = async (doc: XMLDocumentData, line: ValidatedInvoiceLine) => {
    const lineKey = getLineKey(doc.folio, line.lineNumber);
    if (!line.item.description?.trim()) { toast.error('La glosa es obligatoria para crear el producto'); return; }
    setCreatingProductKeys(prev => { const next = new Set(prev); next.add(lineKey); return next; });
    try {
      const similarityResult = await findSimilarItems(line.item.description.trim());
      if (similarityResult.shouldAlert) { setPendingProductSuggestion({ doc, line, similarityResult }); return; }
      await createMissingProductDirect(doc, line, lineKey);
    } catch (error) {
      logger.error('Error validating similar products before creation:', error);
      toast.error('No se pudo validar productos similares antes de crear el item');
    } finally {
      setCreatingProductKeys(prev => { const next = new Set(prev); next.delete(lineKey); return next; });
    }
  };

  const handleUseSuggestedProduct = (item: SimilarItem) => {
    const pending = pendingProductSuggestion;
    if (!pending) return;
    const inventoryItem = inventoryCatalog.find(ci => ci.id === item.id);
    if (!inventoryItem) { toast.error('No se encontró el producto sugerido en el catálogo actual'); return; }
    setManualMatchedItems(prev => ({ ...prev, [pending.line.key]: inventoryItem }));
    setPendingProductSuggestion(null);
    toast.success(`Se usará "${inventoryItem.name}" para la línea ${pending.line.lineNumber}`);
  };

  const handleCreateSuggestedNew = async () => {
    const pending = pendingProductSuggestion;
    if (!pending) return;
    setCreatingProductKeys(prev => { const next = new Set(prev); next.add(pending.line.key); return next; });
    await createMissingProductDirect(pending.doc, pending.line, pending.line.key);
  };

  const handleImport = async () => {
    if (!selectedLocationId) { toast.error('Selecciona una ubicación de bodega'); return; }
    if (!selectedCostCategoryId) { toast.error('Selecciona una categoría de costo'); return; }
    if (selectedValidatedDocuments.length === 0) { toast.error('Selecciona al menos una factura válida para importar'); return; }
    if (selectedValidatedDocuments.some(item => !item.isValid)) { toast.error('Hay facturas seleccionadas con errores bloqueantes'); return; }

    setIsImporting(true);
    setProgress(0);
    try {
      let importedCount = 0;
      for (let index = 0; index < selectedValidatedDocuments.length; index++) {
        const validatedDoc = selectedValidatedDocuments[index];
        const { doc, supplier } = validatedDoc;
        let createdInvoiceId: string | null = null, createdCostId: string | null = null, createdSupplierPaymentId: string | null = null;
        const createdMovementIds: string[] = [], createdCranePartIds: string[] = [], createdInvoiceLineIds: string[] = [];

        try {
          const supplierId = await ensureSupplier(doc, supplier);
          await cleanupStaleIncompleteCostAttempt(supplierId, doc.folio);

          const { data: existingInvoice, error: existingInvoiceError } = await supabase.from('supplier_invoices').select('id, source_module').eq('supplier_id', supplierId).eq('invoice_number', doc.folio).maybeSingle();
          if (existingInvoiceError) throw new Error(`No se pudo validar duplicados para la factura ${doc.folio}: ${existingInvoiceError.message}`);
          if (existingInvoice?.id) {
            if (existingInvoice.source_module === 'inventory_xml') {
              const cleaned = await cleanupStaleInventoryXMLInvoice(existingInvoice.id);
              if (cleaned) toast.info(`Se limpió una factura XML huérfana para volver a importar el folio ${doc.folio}.`);
              else throw new Error(`La factura ${doc.folio} ya existe para ese proveedor.`);
            } else {
              throw new Error(`La factura ${doc.folio} ya existe para ese proveedor.`);
            }
          }

          const editedDesc = editedDescriptions.get(doc.folio);
          const docWithEditedDesc = editedDesc ? { ...doc, description: editedDesc } : doc;
          const productServiceDescription = buildProductDescription(docWithEditedDesc);
          const supplierName = supplier?.name || docWithEditedDesc.description?.split(' - ').pop()?.trim() || 'Proveedor XML';
          const costDescription = buildCostDescription(docWithEditedDesc, supplierName);
          const primaryLineDescription = (doc.items || []).map(item => item.description?.trim()).find(Boolean) || doc.description || 'N/A';
          const sharedNotes = [`Proveedor: ${supplierName}`, `Factura: ${doc.folio}`, `Glosa principal: ${primaryLineDescription}`, `Archivo XML: ${selectedFile?.name || 'N/A'}`].join(' | ');

          const { data: invoice, error: invoiceError } = await supabase.from('supplier_invoices').insert({
            supplier_id: supplierId, invoice_number: doc.folio, issue_date: doc.issue_date, due_date: doc.due_date || doc.issue_date,
            amount: doc.total_amount, net_amount: doc.net_amount || validatedDoc.lines.reduce((sum, line) => sum + computeLineSubtotal(line.item), 0),
            tax_amount: doc.vat_amount || validatedDoc.lines.reduce((sum, line) => sum + computeLineTaxAmount(line.item), 0),
            currency: doc.currency || 'CLP', description: `${supplierName} ${productServiceDescription || ''}`.trim(),
            product_service_description: productServiceDescription, status: isPaid ? 'paid' : 'pending',
            paid_amount: isPaid ? doc.total_amount : 0, source_module: 'inventory_xml', xml_file_name: selectedFile?.name || null,
          }).select('id').single();
          if (invoiceError || !invoice) throw new Error(`No se pudo crear la factura ${doc.folio}: ${invoiceError?.message || 'Error desconocido'}`);
          createdInvoiceId = invoice.id;

          const { data: cost, error: costError } = await supabase.from('costs').insert({
            amount: doc.total_amount, category_id: selectedCostCategoryId, date: doc.issue_date, description: costDescription, notes: sharedNotes,
            document_type: doc.document_type || 'Factura', document_number: doc.folio, crane_id: selectedCraneId || null, operator_id: selectedOperatorId || null,
            immediate_consumption: Boolean(selectedCraneId), payment_date: isPaid ? doc.issue_date : null, service_id: selectedServiceId || null,
            supplier_id: supplierId, supplier_invoice_id: invoice.id, cost_center_id: selectedCostCenterId || null,
            service_folio: selectedServiceFolio || doc.folio, subcategory: selectedCostSubcategory || 'Importación XML Bodega',
          }).select('id').single();
          if (costError || !cost) throw new Error(`No se pudo crear el costo para ${doc.folio}: ${costError?.message || 'Error desconocido'}`);
          createdCostId = cost.id;

          const supplierPaymentId = await ensureSupplierPaymentLink({
            costId: cost.id, supplierId, supplierInvoiceId: invoice.id, amount: doc.total_amount,
            dueDate: doc.due_date || doc.issue_date, description: costDescription, referenceNumber: doc.folio, notes: sharedNotes,
            status: isPaid ? 'paid' : 'pending', paidAmount: isPaid ? doc.total_amount : 0, paidDate: isPaid ? doc.issue_date : null,
            craneId: selectedCraneId || null, partName: primaryLineDescription,
          });
          createdSupplierPaymentId = supplierPaymentId;

          const { error: linkCostPaymentError } = await supabase.from('costs').update({ supplier_payment_id: supplierPaymentId }).eq('id', cost.id);
          if (linkCostPaymentError) throw new Error(`No se pudo enlazar el pago al costo ${doc.folio}: ${linkCostPaymentError.message}`);

          const activeLines = validatedDoc.lines.filter(line => !discardedLines.has(line.key));
          const linesPayload = activeLines.map(line => ({
            supplier_invoice_id: invoice.id, inventory_item_id: line.matchedItem!.id, line_number: line.lineNumber,
            product_code: line.item.product_code || line.matchedItem?.sku || line.matchedItem?.barcode || null,
            product_name: line.item.product_name || line.matchedItem?.name || null, description: line.item.description,
            quantity: Math.trunc(Number(line.item.quantity)), unit_price: Number(line.item.unit_price) || 0,
            subtotal: computeLineSubtotal(line.item), tax_rate: typeof line.item.tax_rate === 'number' ? line.item.tax_rate : 0,
            tax_amount: computeLineTaxAmount(line.item), total_amount: computeLineTotal(line.item),
          }));

          const { data: insertedLinesData, error: insertedLinesError } = await supabase.from('supplier_invoice_items').insert(linesPayload)
            .select('id, line_number, inventory_item_id, quantity, unit_price, subtotal, total_amount, description, product_code');
          if (insertedLinesError || !insertedLinesData) throw new Error(`No se pudieron crear las líneas de la factura ${doc.folio}: ${insertedLinesError?.message || 'Error desconocido'}`);

          const insertedLines = insertedLinesData as InsertedInvoiceLine[];
          insertedLines.forEach(l => createdInvoiceLineIds.push(l.id));
          const lineByNumber = new Map(insertedLines.map(line => [line.line_number, line]));
          let firstEntryMovementId: string | null = null;

          for (const validatedLine of activeLines) {
            const insertedLine = lineByNumber.get(validatedLine.lineNumber);
            if (!insertedLine) throw new Error(`No se pudo resolver la línea ${validatedLine.lineNumber} de la factura ${doc.folio}`);
            const movementQuantity = Math.trunc(Number(validatedLine.item.quantity));
            const movementSubtotal = computeLineSubtotal(validatedLine.item);
            const entryCostId = createdMovementIds.some(Boolean) ? null : cost.id;
            const currentUserId = (await supabase.auth.getUser()).data.user?.id || null;
            const { data: movement, error: movementError } = await supabase.from('inventory_movements').insert({
              item_id: validatedLine.matchedItem!.id, location_id: selectedLocationId, movement_type: 'entry',
              quantity: movementQuantity, unit_cost: movementSubtotal / movementQuantity, total_cost: movementSubtotal,
              supplier_id: supplierId, supplier_name: supplier?.name || doc.description || '',
              reference_document: doc.folio, observations: `Ingreso XML Bodega - ${validatedLine.item.description || ''}`,
              supplier_invoice_id: invoice.id, supplier_invoice_item_id: insertedLine.id, cost_id: entryCostId,
              status: 'active', created_by: currentUserId,
            }).select('id').single();
            if (movementError || !movement) throw new Error(`No se pudo crear el movimiento de inventario para la línea ${validatedLine.lineNumber}: ${movementError?.message || 'Error desconocido'}`);
            createdMovementIds.push(movement.id);
            if (!firstEntryMovementId) firstEntryMovementId = movement.id;
            const { error: linkInvoiceItemMovementError } = await supabase.from('supplier_invoice_items').update({ movement_id: movement.id }).eq('id', insertedLine.id);
            if (linkInvoiceItemMovementError) throw new Error(`No se pudo enlazar la línea ${validatedLine.lineNumber} con su movimiento: ${linkInvoiceItemMovementError.message}`);
          }

          if (selectedCraneId) {
            await UnifiedPurchaseService.syncImportedInvoiceConsumption({
              costId: cost.id, supplierInvoiceId: invoice.id, craneId: selectedCraneId, date: doc.issue_date,
              supplierId, supplierName: supplier?.name || supplierName, referenceDocument: doc.folio,
            });
          } else if (firstEntryMovementId) {
            const { error: updateCostMovementError } = await supabase.from('costs').update({ inventory_movement_id: firstEntryMovementId }).eq('id', cost.id);
            if (updateCostMovementError) throw new Error(`No se pudo enlazar el costo al movimiento de bodega: ${updateCostMovementError.message}`);
          }

          importedCount += 1;
          setProgress(Math.round(((index + 1) / selectedValidatedDocuments.length) * 100));
        } catch (docError) {
          logger.error(`Error importando factura ${doc.folio}, ejecutando rollback:`, docError);
          try {
            const movementIdsToRollback = new Set(createdMovementIds);
            const supplierPaymentIdsToRollback = new Set<string>();
            if (createdSupplierPaymentId) supplierPaymentIdsToRollback.add(createdSupplierPaymentId);
            if (createdCostId || createdInvoiceId) {
              const filters = [createdCostId ? `cost_id.eq.${createdCostId}` : null, createdInvoiceId ? `supplier_invoice_id.eq.${createdInvoiceId}` : null].filter(Boolean).join(',');
              if (filters) {
                const { data: rollbackPayments } = await supabase.from('supplier_payments').select('id').or(filters);
                (rollbackPayments || []).forEach(p => supplierPaymentIdsToRollback.add(p.id));
                const { data: rollbackMovements } = await supabase.from('inventory_movements').select('id').or(filters);
                (rollbackMovements || []).forEach(m => movementIdsToRollback.add(m.id));
              }
            }
            const movementIds = Array.from(movementIdsToRollback);
            if (createdCranePartIds.length > 0) await supabase.from('crane_parts').delete().in('id', createdCranePartIds);
            if (movementIds.length > 0) { await supabase.from('crane_parts').delete().in('inventory_movement_id', movementIds); await supabase.from('inventory_movements').delete().in('id', movementIds); }
            if (createdInvoiceLineIds.length > 0) await supabase.from('supplier_invoice_items').delete().in('id', createdInvoiceLineIds);
            if (supplierPaymentIdsToRollback.size > 0) await supabase.from('supplier_payments').delete().in('id', Array.from(supplierPaymentIdsToRollback));
            if (createdCostId) await supabase.from('costs').delete().eq('id', createdCostId);
            if (createdInvoiceId) await supabase.from('supplier_invoices').delete().eq('id', createdInvoiceId);
            logger.debug(`Rollback completado para factura ${doc.folio}`);
          } catch (rollbackError) { logger.error(`Error durante rollback de factura ${doc.folio}:`, rollbackError); }
          throw docError;
        }
      }

      invalidateAll();
      await refetchCritical();
      const importSuccessMessage = buildImportSuccessMessage({ importedCount, hasImmediateConsumption: Boolean(selectedCraneId), craneLabel: selectedCrane?.licensePlate || null });
      toast.success(importSuccessMessage.title, { description: importSuccessMessage.description });
      onSuccess(importedCount);
      handleClose();
    } catch (error) {
      logger.error('Error importing inventory XML:', error);
      toast.error(error instanceof Error ? error.message : 'Error desconocido durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  return {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive,
    validatedDocuments, selectedValidatedDocuments, summary, inventoryCatalog, serviceSearchResults,
    selectedDocuments, toggleSelectedDocument,
    lineDescriptionOverrides, updateLineDescription,
    manualMatchedItems, setManualMatchedItems,
    editedDescriptions, setEditedDescriptions,
    discardedLines, setDiscardedLines,
    catalogSearchOpen, setCatalogSearchOpen,
    creatingProductKeys,
    selectedCostCategoryId, setSelectedCostCategoryId,
    selectedCostSubcategory, setSelectedCostSubcategory,
    selectedCostCenterId, setSelectedCostCenterId,
    selectedCraneId, setSelectedCraneId,
    selectedOperatorId, setSelectedOperatorId,
    selectedServiceId, setSelectedServiceId,
    selectedServiceFolio, setSelectedServiceFolio,
    serviceSearchOpen, setServiceSearchOpen,
    serviceSearchQuery, setServiceSearchQuery,
    isPaid, setIsPaid,
    showAdvancedAssociations, setShowAdvancedAssociations,
    selectedLocationId, setSelectedLocationId,
    isImporting, progress,
    pendingProductSuggestion, setPendingProductSuggestion,
    suggestedProductDetails, setSuggestedProductDetails,
    selectedService, selectedLocation, selectedCostCategory, selectedCostCenter, selectedCrane, selectedOperator,
    locations, costCategories, costSubcategories, costCenters, cranes, operators,
    handleImport, handleClose, resetState,
    handleCreateMissingProduct, handleUseSuggestedProduct, handleCreateSuggestedNew,
  };
}
