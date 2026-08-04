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
import { supabase } from '@/integrations/supabase/client';
import { XMLDocumentData, XMLDocumentItem, Supplier } from '@/types/suppliers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { findSimilarItems, type SimilarItem, type SimilarityResult } from '@/utils/inventoryHelper';
import { createLogger } from '@/lib/logger';
import { toTitleCase } from '@/lib/utils';
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

  const selectAllDocuments = () => {
    setSelectedDocuments(new Set(validatedDocuments.filter(item => item.isValid).map(item => item.doc.folio)));
  };

  const clearSelectedDocuments = () => setSelectedDocuments(new Set());

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

        try {
          const supplierId = await ensureSupplier(doc, supplier);

          const editedDesc = editedDescriptions.get(doc.folio);
          const docWithEditedDesc = editedDesc ? { ...doc, description: editedDesc } : doc;
          const productServiceDescription = buildProductDescription(docWithEditedDesc);
          const supplierName = supplier?.name || docWithEditedDesc.description?.split(' - ').pop()?.trim() || 'Proveedor XML';
          const costDescription = buildCostDescription(docWithEditedDesc, supplierName);
          const primaryLineDescription = (doc.items || []).map(item => item.description?.trim()).find(Boolean) || doc.description || 'N/A';
          const sharedNotes = [`Proveedor: ${supplierName}`, `Factura: ${doc.folio}`, `Glosa principal: ${primaryLineDescription}`, `Archivo XML: ${selectedFile?.name || 'N/A'}`].join(' | ');

          const activeLines = validatedDoc.lines.filter(line => !discardedLines.has(line.key));
          const linesPayload = activeLines.map(line => ({
            line_number: line.lineNumber, inventory_item_id: line.matchedItem!.id,
            product_code: line.item.product_code || line.matchedItem?.sku || line.matchedItem?.barcode || null,
            product_name: line.item.product_name || line.matchedItem?.name || null, description: line.item.description,
            quantity: Math.trunc(Number(line.item.quantity)), unit_price: Number(line.item.unit_price) || 0,
            subtotal: computeLineSubtotal(line.item), tax_rate: typeof line.item.tax_rate === 'number' ? line.item.tax_rate : 0,
            tax_amount: computeLineTaxAmount(line.item), total_amount: computeLineTotal(line.item),
          }));

          // Toda la escritura (factura, costo, pago, líneas, movimientos y consumo a grúa)
          // ocurre dentro de una sola transacción de Postgres: si cualquier paso falla,
          // no queda ningún registro parcial (ver import_xml_inventory_invoice_rpc.sql).
          const { error: importError } = await supabase.rpc('import_xml_inventory_invoice', {
            p_supplier_id: supplierId,
            p_folio: doc.folio,
            p_issue_date: doc.issue_date,
            p_due_date: doc.due_date || doc.issue_date,
            p_total_amount: doc.total_amount,
            p_net_amount: doc.net_amount || activeLines.reduce((sum, line) => sum + computeLineSubtotal(line.item), 0),
            p_vat_amount: doc.vat_amount || activeLines.reduce((sum, line) => sum + computeLineTaxAmount(line.item), 0),
            p_currency: doc.currency || 'CLP',
            p_document_type: doc.document_type || 'Factura',
            p_description: costDescription,
            p_product_service_description: productServiceDescription,
            p_xml_file_name: selectedFile?.name || null,
            p_is_paid: isPaid,
            p_location_id: selectedLocationId,
            p_cost_category_id: selectedCostCategoryId,
            p_cost_subcategory: selectedCostSubcategory || 'Importación XML Bodega',
            p_cost_center_id: selectedCostCenterId || null,
            p_crane_id: selectedCraneId || null,
            p_operator_id: selectedOperatorId || null,
            p_service_id: selectedServiceId || null,
            p_service_folio: selectedServiceFolio || doc.folio,
            p_notes: sharedNotes,
            p_lines: linesPayload,
          });
          if (importError) throw new Error(importError.message);

          importedCount += 1;
          setProgress(Math.round(((index + 1) / selectedValidatedDocuments.length) * 100));
        } catch (docError) {
          logger.error(`Error importando factura ${doc.folio}:`, docError);
          throw docError;
        }
      }

      invalidateAll('full');
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
    selectedDocuments, toggleSelectedDocument, selectAllDocuments, clearSelectedDocuments,
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
