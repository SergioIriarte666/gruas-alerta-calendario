import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, AlertCircle, CheckCircle2, Loader2, Package, Receipt, Plus, Check, ChevronsUpDown, ChevronDown, ChevronUp, Link2, X, RotateCcw } from 'lucide-react';
import { useXMLParsing } from '@/hooks/useXMLParsing';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { XMLCompleteParseResult, XMLDocumentData, XMLDocumentItem, Supplier } from '@/types/suppliers';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { SimilarProductAlert } from '@/components/cranes/forms/SimilarProductAlert';
import { ProductDetailsModal } from '@/components/inventory/ProductDetailsModal';
import { findSimilarItems, type SimilarItem, type SimilarityResult } from '@/utils/inventoryHelper';
import { XMLImportDialogHeader, XMLImportStatsGrid } from '@/components/common/XMLImportShared';
import { createLogger } from "@/lib/logger";


const logger = createLogger("XMLInventoryUpload");
interface XMLInventoryUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

interface InventoryCatalogItem {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit_cost?: number | null;
}

interface ValidatedInvoiceLine {
  key: string;
  lineNumber: number;
  item: XMLDocumentItem;
  matchedItem: InventoryCatalogItem | null;
  candidates: InventoryCatalogItem[];
  error: string | null;
  warning: string | null;
}

interface ValidatedDocument {
  doc: XMLDocumentData;
  supplier: Supplier | undefined;
  lines: ValidatedInvoiceLine[];
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface InsertedInvoiceLine {
  id: string;
  inventory_item_id: string;
  line_number: number;
}

interface ServiceSearchResult {
  id: string;
  folio: string;
  clientName: string;
  serviceDateLabel: string;
  licensePlate: string;
  craneLabel: string;
  operatorLabel: string;
  searchValue: string;
  score: number;
}

interface PendingProductSuggestion {
  doc: XMLDocumentData;
  line: ValidatedInvoiceLine;
  similarityResult: SimilarityResult;
}

const normalizeText = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeCode = (value: string | null | undefined) =>
  (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

// Placeholder codes ("0", "", solo ceros) NO deben usarse para matching/SKU,
// porque XMLs como los de Jomial traen VlrCodigo=0 para todas las líneas y
// terminan fusionando productos distintos en uno solo.
const isPlaceholderCode = (value: string | null | undefined) => {
  const n = normalizeCode(value);
  return !n || /^0+$/.test(n);
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const computeLineSubtotal = (line: XMLDocumentItem) => {
  if (typeof line.subtotal === 'number' && Number.isFinite(line.subtotal)) return line.subtotal;
  if (typeof line.quantity === 'number' && typeof line.unit_price === 'number') {
    return Number(line.quantity) * Number(line.unit_price);
  }
  return 0;
};

const computeLineTaxAmount = (line: XMLDocumentItem) => {
  if (typeof line.tax_amount === 'number' && Number.isFinite(line.tax_amount)) return line.tax_amount;
  const subtotal = computeLineSubtotal(line);
  const taxRate = typeof line.tax_rate === 'number' && Number.isFinite(line.tax_rate) ? line.tax_rate : 0;
  return subtotal * (taxRate / 100);
};

const computeLineTotal = (line: XMLDocumentItem) => {
  if (typeof line.total === 'number' && Number.isFinite(line.total) && line.total > 0) return line.total;
  return computeLineSubtotal(line) + computeLineTaxAmount(line);
};

const buildProductDescription = (doc: XMLDocumentData) => {
  const base = (doc.items || [])
    .slice(0, 8)
    .map((item) => {
      const code = item.product_code ? `[${item.product_code}] ` : '';
      return `${code}${item.description}`.trim();
    })
    .filter(Boolean)
    .join(', ');

  const value = base || doc.description || `Factura ${doc.folio}`;
  const trimmed = value.trim();
  if (trimmed.length >= 10) return trimmed.slice(0, 500);
  return `Factura importada ${doc.folio}`.slice(0, 500);
};

const buildCostDescription = (doc: XMLDocumentData, supplierName: string) => {
  const itemDescriptions = (doc.items || [])
    .map((item) => item.description?.trim())
    .filter((d) => d && d.length > 0);

  const isSingleItem = itemDescriptions.length <= 1;

  // Single item: "Proveedor ItemName" | Multiple items: just "Proveedor"
  const segments = [supplierName?.trim()];
  if (isSingleItem && itemDescriptions.length === 1) {
    segments.push(itemDescriptions[0]!);
  }

  const description = segments.filter(Boolean).join(' ').trim();
  return (description || `Factura XML Bodega ${doc.folio}`).slice(0, 255);
};

const buildImportSuccessMessage = (params: {
  importedCount: number;
  hasImmediateConsumption: boolean;
  craneLabel?: string | null;
}) => {
  const documentsLabel = `${params.importedCount} factura(s) XML`;

  if (params.hasImmediateConsumption) {
    return {
      title: `${documentsLabel} importada(s) correctamente`,
      description: `Se registró la entrada a bodega y la salida inmediata hacia ${params.craneLabel || 'la grúa seleccionada'}.`,
    };
  }

  return {
    title: `${documentsLabel} importada(s) correctamente`,
    description: 'Se registró el ingreso a bodega y la trazabilidad en Costos y Proveedores.',
  };
};

const getLineKey = (folio: string, lineNumber: number) => `${folio}-${lineNumber}`;

export const XMLInventoryUpload: React.FC<XMLInventoryUploadProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { data: inventoryItems = [], refetch: refetchInventoryItems } = useInventoryItems();
  const { data: categories = [] } = useInventoryCategories();
  const { data: costCategories = [] } = useCostCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { cranes = [] } = useCranes();
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

  const {
    selectedFile,
    parseResult,
    isAnalyzing,
    getRootProps,
    getInputProps,
    isDragActive,
    reset: resetParsing,
  } = useXMLParsing({
    onFileSelected: () => {
      setSelectedDocuments(new Set());
      setLineDescriptionOverrides({});
      setManualMatchedItems({});
      setDiscardedLines(new Set());
      setEditedDescriptions(new Map());
    },
    onParsed: (result) => {
      const validFolios = new Set(
        result.documents
          .filter((doc) => doc.folio && (doc.items?.length || 0) > 0)
          .map((doc) => doc.folio)
      );
      setSelectedDocuments(validFolios);

      if (!selectedCostCategoryId && costCategories.length > 0) {
        const defaultCostCategory =
          costCategories.find((c) => normalizeText(c.name).includes('inventario')) ||
          costCategories.find((c) => normalizeText(c.name).includes('mantenimiento')) ||
          costCategories[0];
        if (defaultCostCategory) setSelectedCostCategoryId(defaultCostCategory.id);
      }

      if (!selectedLocationId && locations.length > 0) {
        const defaultLocation = locations.find((l) => l.code === 'MAIN') || locations[0];
        if (defaultLocation) setSelectedLocationId(defaultLocation.id);
      }
    },
  });

  const { subcategories: costSubcategories = [] } = useCostSubcategories(selectedCostCategoryId || undefined);
  const servicesForCosts = useMemo(() => getServicesForCosts(), [getServicesForCosts]);
  const selectedService = useMemo(
    () => servicesForCosts.find((service) => service.id === selectedServiceId) || null,
    [selectedServiceId, servicesForCosts]
  );
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );
  const selectedCostCategory = useMemo(
    () => costCategories.find((category) => category.id === selectedCostCategoryId) || null,
    [costCategories, selectedCostCategoryId]
  );
  const selectedCostCenter = useMemo(
    () => costCenters.find((center) => center.id === selectedCostCenterId) || null,
    [costCenters, selectedCostCenterId]
  );
  const selectedCrane = useMemo(
    () => cranes.find((crane) => crane.id === selectedCraneId) || null,
    [cranes, selectedCraneId]
  );
  const selectedOperator = useMemo(
    () => operators.find((operator) => operator.id === selectedOperatorId) || null,
    [operators, selectedOperatorId]
  );
  const serviceSearchResults = useMemo<ServiceSearchResult[]>(() => {
    const query = normalizeText(serviceSearchQuery);

    return servicesForCosts
      .map((service) => {
        const clientName = toTitleCase(service.client.name || '');
        const serviceDateLabel = format(parseFromDatabase(service.serviceDate), 'dd/MM/yyyy', { locale: es });
        const craneLabel = service.crane?.licensePlate || 'Sin grua';
        const operatorLabel = service.operator?.name || 'Sin operador';
        const licensePlate = service.licensePlate || '';
        const searchValue = [
          service.folio,
          clientName,
          serviceDateLabel,
          craneLabel,
          operatorLabel,
          licensePlate,
        ].join(' ');

        let score = 0;
        if (!query) {
          score = 1;
        } else {
          const normalizedFolio = normalizeText(service.folio);
          const normalizedClient = normalizeText(clientName);
          const normalizedDate = normalizeText(serviceDateLabel);
          const normalizedCrane = normalizeText(craneLabel);
          const normalizedOperator = normalizeText(operatorLabel);
          const normalizedPlate = normalizeText(licensePlate);

          if (normalizedFolio === query) score += 120;
          if (normalizedFolio.startsWith(query)) score += 90;
          if (normalizedFolio.includes(query)) score += 75;
          if (normalizedPlate === query) score += 70;
          if (normalizedPlate.includes(query)) score += 60;
          if (normalizedClient.includes(query)) score += 50;
          if (normalizedCrane.includes(query)) score += 40;
          if (normalizedOperator.includes(query)) score += 35;
          if (normalizedDate.includes(query)) score += 20;
        }

        return {
          id: service.id,
          folio: service.folio,
          clientName,
          serviceDateLabel,
          licensePlate,
          craneLabel,
          operatorLabel,
          searchValue,
          score,
        };
      })
      .filter((service) => service.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query ? 30 : 20);
  }, [serviceSearchQuery, servicesForCosts]);

  const inventoryCatalog = useMemo<InventoryCatalogItem[]>(
    () =>
      inventoryItems.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        unit_cost: item.unit_cost,
      })),
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
        const exactCodeMatch = inventoryCatalog.find(
          (item) =>
            (!isPlaceholderCode(item.sku) && normalizeCode(item.sku) === code) ||
            (!isPlaceholderCode(item.barcode) && normalizeCode(item.barcode) === code) ||
            normalizeCode(item.name) === code
        );
        if (exactCodeMatch) return { match: exactCodeMatch, candidates: [] };
      }

      const normalizedDescription = normalizeText(line.description);
      const exactNameMatch = inventoryCatalog.find((item) => normalizeText(item.name) === normalizedDescription);
      if (exactNameMatch) return { match: exactNameMatch, candidates: [] };

      const partialMatches = inventoryCatalog.filter((item) => {
        const itemName = normalizeText(item.name);
        return (
          normalizedDescription.length >= 6 &&
          (itemName.includes(normalizedDescription) || normalizedDescription.includes(itemName))
        );
      });

      if (partialMatches.length === 1) return { match: partialMatches[0], candidates: [] };
      return { match: null, candidates: partialMatches };
    },
    [inventoryCatalog]
  );

  const validatedDocuments = useMemo<ValidatedDocument[]>(() => {
    if (!parseResult) return [];

    return parseResult.documents.map((doc) => {
      const supplier = suppliers.find((item) => normalizeCode(item.rut) === normalizeCode(doc.supplier_rut));
      const errors: string[] = [];
      const warnings: string[] = [];
      const rawLines = doc.items || [];

      if (rawLines.length === 0) {
        errors.push('La factura no contiene líneas de detalle importables.');
      }

      const lines: ValidatedInvoiceLine[] = rawLines.map((line, index) => {
        const lineNumber = index + 1;
        const editedDescription = lineDescriptionOverrides[getLineKey(doc.folio, lineNumber)];
        const effectiveLine: XMLDocumentItem = {
          ...line,
          description: typeof editedDescription === 'string' ? editedDescription : line.description,
        };
        const lineKey = getLineKey(doc.folio, lineNumber);
        const manualMatch = manualMatchedItems[lineKey];
        const finderResult = findMatchedInventoryItem(effectiveLine);
        const matchedItem = manualMatch || finderResult.match;
        const candidates = manualMatch ? [] : (finderResult.match ? [] : finderResult.candidates);
        const resolvedLine: XMLDocumentItem =
          matchedItem && !effectiveLine.description?.trim()
            ? { ...effectiveLine, description: matchedItem.name }
            : effectiveLine;
        const quantity = Number(line.quantity);
        const subtotal = computeLineSubtotal(resolvedLine);
        const total = computeLineTotal(resolvedLine);

        let error: string | null = null;
        let warning: string | null = null;

        if (!Number.isFinite(quantity) || quantity <= 0) {
          error = 'La cantidad debe ser mayor a 0.';
        } else if (!Number.isInteger(quantity)) {
          error = 'La cantidad debe ser un número entero para el inventario.';
        } else if (!matchedItem) {
          if (!effectiveLine.description?.trim()) {
            error = 'La línea no tiene descripción.';
          } else {
            error = candidates.length > 0
              ? `${candidates.length} coincidencia(s) parcial(es) encontrada(s). Seleccione una.`
              : 'No se encontró coincidencia en el catálogo de productos.';
          }
        } else if (subtotal <= 0 && total <= 0) {
          error = 'La línea no tiene monto válido.';
        } else if (!effectiveLine.description?.trim()) {
          warning = 'Sin descripción, se usará el nombre del producto.';
        } else if (!effectiveLine.product_code && normalizeText(matchedItem.name) !== normalizeText(resolvedLine.description)) {
          warning = 'Coincidencia realizada por descripción aproximada.';
        }

        return {
          key: lineKey,
          lineNumber,
          item: resolvedLine,
          matchedItem,
          candidates,
          error,
          warning,
        };
      });

      if (!supplier) {
        warnings.push('El proveedor no existe aún y se creará durante la importación.');
      }

      const activeLines = lines.filter((line) => !discardedLines.has(line.key));
      const lineErrors = activeLines.filter((line) => line.error).map((line) => `Línea ${line.lineNumber}: ${line.error}`);
      const lineWarnings = activeLines.filter((line) => line.warning).map((line) => `Línea ${line.lineNumber}: ${line.warning}`);

      errors.push(...lineErrors);
      warnings.push(...lineWarnings);

      const totalByLines = activeLines.reduce((sum, line) => sum + computeLineTotal(line.item), 0);
      if (doc.total_amount > 0 && Math.abs(totalByLines - doc.total_amount) > 5) {
        warnings.push('La suma de las líneas no coincide exactamente con el total del documento.');
      }

      const effectiveDoc: XMLDocumentData = {
        ...doc,
        items: lines.map((line) => line.item),
      };

      return {
        doc: effectiveDoc,
        supplier,
        lines,
        errors,
        warnings,
        isValid: errors.length === 0 && activeLines.length > 0,
      };
    });
  }, [discardedLines, findMatchedInventoryItem, lineDescriptionOverrides, manualMatchedItems, parseResult, suppliers]);

  const selectedValidatedDocuments = useMemo(
    () => validatedDocuments.filter((item) => selectedDocuments.has(item.doc.folio)),
    [selectedDocuments, validatedDocuments]
  );

  const supplierNameByRut = useMemo(() => {
    const map = new Map<string, string>();
    parseResult?.suppliers.forEach((supplier) => {
      map.set(normalizeCode(supplier.rut), supplier.name);
    });
    return map;
  }, [parseResult]);

  const summary = useMemo(() => {
    const totalDocs = validatedDocuments.length;
    const validDocs = validatedDocuments.filter((item) => item.isValid).length;
    const totalLines = validatedDocuments.reduce((sum, item) => sum + item.lines.filter(l => !discardedLines.has(l.key)).length, 0);
    const invalidLines = validatedDocuments.reduce(
      (sum, item) => sum + item.lines.filter((line) => !discardedLines.has(line.key) && line.error).length,
      0
    );

    return { totalDocs, validDocs, totalLines, invalidLines };
  }, [validatedDocuments]);

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

  useEffect(() => {
    if (!selectedCostCategoryId) return;

    const category = costCategories.find((item) => item.id === selectedCostCategoryId);
    if (category?.default_cost_center_id && !selectedCostCenterId) {
      setSelectedCostCenterId(category.default_cost_center_id);
    }
  }, [costCategories, selectedCostCategoryId, selectedCostCenterId]);

  useEffect(() => {
    if (!selectedServiceId) return;

    const selectedService = servicesForCosts.find((service) => service.id === selectedServiceId);
    if (!selectedService) return;

    setSelectedCraneId(selectedService.crane?.id || '');
    setSelectedOperatorId(selectedService.operator?.id || '');
    setSelectedServiceFolio(selectedService.folio || '');
  }, [selectedServiceId, servicesForCosts]);

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
    setLineDescriptionOverrides((prev) => ({
      ...prev,
      [getLineKey(folio, lineNumber)]: description,
    }));
  };

  const createMissingProductDirect = async (doc: XMLDocumentData, line: ValidatedInvoiceLine, lineKey: string) => {
    const name = line.item.description?.trim();

    if (!name) {
      toast.error('La glosa es obligatoria para crear el producto');
      return;
    }

    try {
      const rawCode = line.item.product_code?.trim() || null;
      const normalizedCode = !isPlaceholderCode(rawCode) ? rawCode : null;
      const preferredCategory =
        categories.find((category) => normalizeText(category.name).includes('implement')) ||
        categories.find((category) => normalizeText(category.name).includes('repuesto')) ||
        null;

      await createInventoryItem.mutateAsync({
        name,
        description: `Creado desde importación XML ${doc.folio}`,
        sku: normalizedCode,
        barcode: null,
        category_id: preferredCategory?.id || null,
        unit_of_measure: 'unidad',
        minimum_stock: 0,
        maximum_stock: 0,
        safety_stock: 0,
        unit_cost: Number(line.item.unit_price) || 0,
        is_active: true,
        is_critical: false,
        has_expiration: false,
      });

      await refetchInventoryItems();
      toast.success(`Producto "${name}" creado y agregado al catálogo`);
    } catch (error) {
      logger.error('Error creating missing inventory product:', error);
    } finally {
      setPendingProductSuggestion(null);
      setCreatingProductKeys((prev) => {
        const next = new Set(prev);
        next.delete(lineKey);
        return next;
      });
    }
  };

  const handleCreateMissingProduct = async (doc: XMLDocumentData, line: ValidatedInvoiceLine) => {
    const lineKey = getLineKey(doc.folio, line.lineNumber);
    const name = line.item.description?.trim();

    if (!name) {
      toast.error('La glosa es obligatoria para crear el producto');
      return;
    }

    setCreatingProductKeys((prev) => {
      const next = new Set(prev);
      next.add(lineKey);
      return next;
    });

    try {
      const similarityResult = await findSimilarItems(name);

      if (similarityResult.shouldAlert) {
        setPendingProductSuggestion({ doc, line, similarityResult });
        return;
      }

      await createMissingProductDirect(doc, line, lineKey);
    } catch (error) {
      logger.error('Error validating similar products before creation:', error);
      toast.error('No se pudo validar productos similares antes de crear el item');
    } finally {
      setCreatingProductKeys((prev) => {
        const next = new Set(prev);
        next.delete(lineKey);
        return next;
      });
    }
  };

  const handleUseSuggestedProduct = (item: SimilarItem) => {
    const pending = pendingProductSuggestion;
    if (!pending) return;

    const inventoryItem = inventoryCatalog.find((catalogItem) => catalogItem.id === item.id);
    if (!inventoryItem) {
      toast.error('No se encontró el producto sugerido en el catálogo actual');
      return;
    }

    setManualMatchedItems((prev) => ({
      ...prev,
      [pending.line.key]: inventoryItem,
    }));

    setPendingProductSuggestion(null);
    toast.success(`Se usará "${inventoryItem.name}" para la línea ${pending.line.lineNumber}`);
  };

  const handleCreateSuggestedNew = async () => {
    const pending = pendingProductSuggestion;
    if (!pending) return;

    setCreatingProductKeys((prev) => {
      const next = new Set(prev);
      next.add(pending.line.key);
      return next;
    });

    await createMissingProductDirect(pending.doc, pending.line, pending.line.key);
  };

  const ensureSupplier = async (doc: XMLDocumentData, supplier: Supplier | undefined) => {
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

  const cleanupStaleInventoryXMLInvoice = async (supplierInvoiceId: string) => {
    const { data: linkedCosts, error: linkedCostsError } = await supabase
      .from('costs')
      .select('id')
      .eq('supplier_invoice_id', supplierInvoiceId);

    if (linkedCostsError) {
      throw new Error(`No se pudo validar costos vinculados: ${linkedCostsError.message}`);
    }

    if ((linkedCosts || []).length > 0) {
      return false;
    }

    const { data: linkedMovements, error: linkedMovementsError } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('supplier_invoice_id', supplierInvoiceId);

    if (linkedMovementsError) {
      throw new Error(`No se pudo validar movimientos vinculados: ${linkedMovementsError.message}`);
    }

    const movementIds = (linkedMovements || []).map((movement) => movement.id);

    if (movementIds.length > 0) {
      const { error: deleteCranePartsError } = await supabase
        .from('crane_parts')
        .delete()
        .in('inventory_movement_id', movementIds);

      if (deleteCranePartsError) {
        throw new Error(`No se pudieron limpiar piezas de grúa huérfanas: ${deleteCranePartsError.message}`);
      }

      const { error: deleteMovementsError } = await supabase
        .from('inventory_movements')
        .delete()
        .in('id', movementIds);

      if (deleteMovementsError) {
        throw new Error(`No se pudieron limpiar movimientos huérfanos: ${deleteMovementsError.message}`);
      }
    }

    const { error: deletePaymentsError } = await supabase
      .from('supplier_payments')
      .delete()
      .eq('supplier_invoice_id', supplierInvoiceId);

    if (deletePaymentsError) {
      throw new Error(`No se pudieron limpiar pagos huérfanos: ${deletePaymentsError.message}`);
    }

    const { error: deleteInvoiceError } = await supabase
      .from('supplier_invoices')
      .delete()
      .eq('id', supplierInvoiceId);

    if (deleteInvoiceError) {
      throw new Error(`No se pudo limpiar la factura huérfana: ${deleteInvoiceError.message}`);
    }

    return true;
  };

  const cleanupStaleIncompleteCostAttempt = async (supplierId: string, folio: string) => {
    const { data: candidateCosts, error: candidateCostsError } = await supabase
      .from('costs')
      .select('id, supplier_invoice_id, supplier_payment_id, inventory_movement_id')
      .eq('supplier_id', supplierId)
      .eq('document_number', folio);

    if (candidateCostsError) {
      throw new Error(`No se pudieron validar costos previos del folio ${folio}: ${candidateCostsError.message}`);
    }

    for (const candidateCost of candidateCosts || []) {
      const [paymentResult, movementResult, cranePartResult] = await Promise.all([
        supabase
          .from('supplier_payments')
          .select('id, reference_number, supplier_invoice_id')
          .eq('cost_id', candidateCost.id)
          .maybeSingle(),
        supabase
          .from('inventory_movements')
          .select('id', { count: 'exact', head: true })
          .eq('cost_id', candidateCost.id),
        supabase
          .from('crane_parts')
          .select('id', { count: 'exact', head: true })
          .eq('cost_id', candidateCost.id),
      ]);

      if (paymentResult.error) {
        throw new Error(`No se pudo validar el pago previo del folio ${folio}: ${paymentResult.error.message}`);
      }

      if (movementResult.error) {
        throw new Error(`No se pudieron validar movimientos previos del folio ${folio}: ${movementResult.error.message}`);
      }

      if (cranePartResult.error) {
        throw new Error(`No se pudieron validar consumos previos del folio ${folio}: ${cranePartResult.error.message}`);
      }

      const existingPayment = paymentResult.data;
      const movementCount = movementResult.count || 0;
      const cranePartCount = cranePartResult.count || 0;

      const isStaleAttempt = Boolean(
        !candidateCost.supplier_invoice_id &&
          !candidateCost.inventory_movement_id &&
          movementCount === 0 &&
          cranePartCount === 0 &&
          existingPayment?.id &&
          !existingPayment.reference_number &&
          !existingPayment.supplier_invoice_id
      );

      if (!isStaleAttempt) {
        continue;
      }

      const { error: deletePaymentError } = await supabase
        .from('supplier_payments')
        .delete()
        .eq('cost_id', candidateCost.id);

      if (deletePaymentError) {
        throw new Error(`No se pudo limpiar el pago huérfano del folio ${folio}: ${deletePaymentError.message}`);
      }

      const { error: deleteCostError } = await supabase
        .from('costs')
        .delete()
        .eq('id', candidateCost.id);

      if (deleteCostError) {
        throw new Error(`No se pudo limpiar el costo huérfano del folio ${folio}: ${deleteCostError.message}`);
      }

      toast.info(`Se limpió un intento incompleto previo para el folio ${folio}.`);
    }
  };

  const ensureSupplierPaymentLink = async (params: {
    costId: string;
    supplierId: string;
    supplierInvoiceId: string;
    amount: number;
    dueDate: string;
    description: string;
    referenceNumber: string;
    notes: string;
    status: 'paid' | 'pending';
    paidAmount: number;
    paidDate: string | null;
    craneId: string | null;
    partName: string;
  }) => {
    const paymentPayload = {
      supplier_id: params.supplierId,
      supplier_invoice_id: params.supplierInvoiceId,
      cost_id: params.costId,
      amount: params.amount,
      due_date: params.dueDate,
      description: params.description,
      category: selectedCostCategory?.name || 'Costos',
      subcategory: selectedCostSubcategory || 'Importación XML Bodega',
      reference_number: params.referenceNumber,
      notes: params.notes,
      status: params.status,
      paid_amount: params.paidAmount,
      paid_date: params.paidDate,
      crane_id: params.craneId,
      add_to_inventory: false,
      part_name: params.partName,
    };

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('supplier_payments')
      .select('id')
      .eq('cost_id', params.costId)
      .maybeSingle();

    if (existingPaymentError) {
      throw new Error(`No se pudo validar el pago del proveedor para el costo ${params.referenceNumber}: ${existingPaymentError.message}`);
    }

    if (existingPayment?.id) {
      const { error: updatePaymentError } = await supabase
        .from('supplier_payments')
        .update(paymentPayload)
        .eq('id', existingPayment.id);

      if (updatePaymentError) {
        throw new Error(`No se pudo actualizar el pago del proveedor para la factura ${params.referenceNumber}: ${updatePaymentError.message}`);
      }

      return existingPayment.id;
    }

    const { data: createdPayment, error: createPaymentError } = await supabase
      .from('supplier_payments')
      .insert(paymentPayload)
      .select('id')
      .single();

    if (createPaymentError || !createdPayment) {
      throw new Error(
        `No se pudo crear el registro de proveedor para la factura ${params.referenceNumber}: ${createPaymentError?.message || 'Error desconocido'}`
      );
    }

    return createdPayment.id;
  };

  const handleImport = async () => {
    if (!selectedLocationId) {
      toast.error('Selecciona una ubicación de bodega');
      return;
    }

    if (!selectedCostCategoryId) {
      toast.error('Selecciona una categoría de costo');
      return;
    }

    if (selectedValidatedDocuments.length === 0) {
      toast.error('Selecciona al menos una factura válida para importar');
      return;
    }

    const invalidSelected = selectedValidatedDocuments.filter((item) => !item.isValid);
    if (invalidSelected.length > 0) {
      toast.error('Hay facturas seleccionadas con errores bloqueantes');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      let importedCount = 0;

      for (let index = 0; index < selectedValidatedDocuments.length; index += 1) {
        const validatedDoc = selectedValidatedDocuments[index];
        const { doc, supplier } = validatedDoc;

        // Track created IDs for compensatory rollback
        let createdInvoiceId: string | null = null;
        let createdCostId: string | null = null;
        let createdSupplierPaymentId: string | null = null;
        const createdMovementIds: string[] = [];
        const createdCranePartIds: string[] = [];
        const createdInvoiceLineIds: string[] = [];

        try {
        const supplierId = await ensureSupplier(doc, supplier);

        await cleanupStaleIncompleteCostAttempt(supplierId, doc.folio);

        const { data: existingInvoice, error: existingInvoiceError } = await supabase
          .from('supplier_invoices')
          .select('id, source_module')
          .eq('supplier_id', supplierId)
          .eq('invoice_number', doc.folio)
          .maybeSingle();

        if (existingInvoiceError) {
          throw new Error(`No se pudo validar duplicados para la factura ${doc.folio}: ${existingInvoiceError.message}`);
        }

        if (existingInvoice?.id) {
          if (existingInvoice.source_module === 'inventory_xml') {
            const cleaned = await cleanupStaleInventoryXMLInvoice(existingInvoice.id);
            if (cleaned) {
              toast.info(`Se limpió una factura XML huérfana para volver a importar el folio ${doc.folio}.`);
            } else {
              throw new Error(`La factura ${doc.folio} ya existe para ese proveedor.`);
            }
          } else {
            throw new Error(`La factura ${doc.folio} ya existe para ese proveedor.`);
          }
        }

        const editedDesc = editedDescriptions.get(doc.folio);
        const docWithEditedDesc = editedDesc ? { ...doc, description: editedDesc } : doc;
        const productServiceDescription = buildProductDescription(docWithEditedDesc);
        const supplierName = supplier?.name || docWithEditedDesc.description?.split(' - ').pop()?.trim() || 'Proveedor XML';
        const costDescription = buildCostDescription(docWithEditedDesc, supplierName);
        const primaryLineDescription =
          (doc.items || []).map((item) => item.description?.trim()).find(Boolean) || doc.description || 'N/A';
        const sharedNotes = [
          `Proveedor: ${supplierName}`,
          `Factura: ${doc.folio}`,
          `Glosa principal: ${primaryLineDescription}`,
          `Archivo XML: ${selectedFile?.name || 'N/A'}`,
        ].join(' | ');

        const { data: invoice, error: invoiceError } = await supabase
          .from('supplier_invoices')
          .insert({
            supplier_id: supplierId,
            invoice_number: doc.folio,
            issue_date: doc.issue_date,
            due_date: doc.due_date || doc.issue_date,
            amount: doc.total_amount,
            net_amount: doc.net_amount || validatedDoc.lines.reduce((sum, line) => sum + computeLineSubtotal(line.item), 0),
            tax_amount: doc.vat_amount || validatedDoc.lines.reduce((sum, line) => sum + computeLineTaxAmount(line.item), 0),
            currency: doc.currency || 'CLP',
            description: `${supplierName} ${productServiceDescription || ''}`.trim(),
            product_service_description: productServiceDescription,
            status: isPaid ? 'paid' : 'pending',
            paid_amount: isPaid ? doc.total_amount : 0,
            source_module: 'inventory_xml',
            xml_file_name: selectedFile?.name || null,
          })
          .select('id')
          .single();

        if (invoiceError || !invoice) {
          throw new Error(`No se pudo crear la factura ${doc.folio}: ${invoiceError?.message || 'Error desconocido'}`);
        }
        createdInvoiceId = invoice.id;

        const { data: cost, error: costError } = await supabase
          .from('costs')
          .insert({
            amount: doc.total_amount,
            category_id: selectedCostCategoryId,
            date: doc.issue_date,
            description: costDescription,
            notes: sharedNotes,
            document_type: doc.document_type || 'Factura',
            document_number: doc.folio,
            crane_id: selectedCraneId || null,
            operator_id: selectedOperatorId || null,
            immediate_consumption: Boolean(selectedCraneId),
            payment_date: isPaid ? doc.issue_date : null,
            service_id: selectedServiceId || null,
            supplier_id: supplierId,
            supplier_invoice_id: invoice.id,
            cost_center_id: selectedCostCenterId || null,
            service_folio: selectedServiceFolio || doc.folio,
            subcategory: selectedCostSubcategory || 'Importación XML Bodega',
          })
          .select('id')
          .single();

        if (costError || !cost) {
          throw new Error(`No se pudo crear el costo para la factura ${doc.folio}: ${costError?.message || 'Error desconocido'}`);
        }
        createdCostId = cost.id;

        const supplierPaymentId = await ensureSupplierPaymentLink({
          costId: cost.id,
          supplierId,
          supplierInvoiceId: invoice.id,
          amount: doc.total_amount,
          dueDate: doc.due_date || doc.issue_date,
          description: costDescription,
          referenceNumber: doc.folio,
          notes: sharedNotes,
          status: isPaid ? 'paid' : 'pending',
          paidAmount: isPaid ? doc.total_amount : 0,
          paidDate: isPaid ? doc.issue_date : null,
          craneId: selectedCraneId || null,
          partName: primaryLineDescription,
        });
        createdSupplierPaymentId = supplierPaymentId;

        const { error: linkCostPaymentError } = await supabase
          .from('costs')
          .update({ supplier_payment_id: supplierPaymentId })
          .eq('id', cost.id);

        if (linkCostPaymentError) {
          throw new Error(`No se pudo enlazar el pago del proveedor al costo ${doc.folio}: ${linkCostPaymentError.message}`);
        }

        const activeLines = validatedDoc.lines.filter((line) => !discardedLines.has(line.key));
        const linesPayload = activeLines.map((line) => ({
          supplier_invoice_id: invoice.id,
          inventory_item_id: line.matchedItem!.id,
          line_number: line.lineNumber,
          product_code: line.item.product_code || line.matchedItem?.sku || line.matchedItem?.barcode || null,
          product_name: line.item.product_name || line.matchedItem?.name || null,
          description: line.item.description,
          quantity: Math.trunc(Number(line.item.quantity)),
          unit_price: Number(line.item.unit_price) || 0,
          subtotal: computeLineSubtotal(line.item),
          tax_rate: typeof line.item.tax_rate === 'number' ? line.item.tax_rate : 0,
          tax_amount: computeLineTaxAmount(line.item),
          total_amount: computeLineTotal(line.item),
        }));

        const { data: insertedLinesData, error: insertedLinesError } = await supabase
          .from('supplier_invoice_items')
          .insert(linesPayload)
          .select('id, line_number, inventory_item_id, quantity, unit_price, subtotal, total_amount, description, product_code');

        if (insertedLinesError || !insertedLinesData) {
          throw new Error(`No se pudieron crear las líneas de la factura ${doc.folio}: ${insertedLinesError?.message || 'Error desconocido'}`);
        }

        const insertedLines = insertedLinesData as InsertedInvoiceLine[];
        insertedLines.forEach((l) => createdInvoiceLineIds.push(l.id));
        const lineByNumber = new Map(insertedLines.map((line) => [line.line_number, line]));
        let firstEntryMovementId: string | null = null;

        for (const validatedLine of activeLines) {
          const insertedLine = lineByNumber.get(validatedLine.lineNumber);
          if (!insertedLine) {
            throw new Error(`No se pudo resolver la línea ${validatedLine.lineNumber} de la factura ${doc.folio}`);
          }

          const movementQuantity = Math.trunc(Number(validatedLine.item.quantity));
          const movementSubtotal = computeLineSubtotal(validatedLine.item);
          const entryCostId = createdMovementIds.some((movementId) => movementId) ? null : cost.id;

          const currentUserId = (await supabase.auth.getUser()).data.user?.id || null;
          const { data: movement, error: movementError } = await supabase
            .from('inventory_movements')
            .insert({
              item_id: validatedLine.matchedItem!.id,
              location_id: selectedLocationId,
              movement_type: 'entry',
              quantity: movementQuantity,
              unit_cost: movementSubtotal / movementQuantity,
              total_cost: movementSubtotal,
              supplier_id: supplierId,
              supplier_name: supplier?.name || doc.description || '',
              reference_document: doc.folio,
              observations: `Ingreso XML Bodega - ${validatedLine.item.description || ''}`,
              supplier_invoice_id: invoice.id,
              supplier_invoice_item_id: insertedLine.id,
              cost_id: entryCostId,
              status: 'active',
              created_by: currentUserId,
            })
            .select('id')
            .single();

          if (movementError || !movement) {
            throw new Error(
              `No se pudo crear el movimiento de inventario para la línea ${validatedLine.lineNumber} de la factura ${doc.folio}: ${movementError?.message || 'Error desconocido'}`
            );
          }
          createdMovementIds.push(movement.id);

          if (!firstEntryMovementId) {
            firstEntryMovementId = movement.id;
          }

          const { error: linkInvoiceItemMovementError } = await supabase
            .from('supplier_invoice_items')
            .update({ movement_id: movement.id })
            .eq('id', insertedLine.id);

          if (linkInvoiceItemMovementError) {
            throw new Error(
              `No se pudo enlazar la línea ${validatedLine.lineNumber} con su movimiento de bodega en la factura ${doc.folio}: ${linkInvoiceItemMovementError.message}`
            );
          }

        }

        if (selectedCraneId) {
          await UnifiedPurchaseService.syncImportedInvoiceConsumption({
            costId: cost.id,
            supplierInvoiceId: invoice.id,
            craneId: selectedCraneId,
            date: doc.issue_date,
            supplierId,
            supplierName: supplier?.name || supplierName,
            referenceDocument: doc.folio,
          });
        } else if (firstEntryMovementId) {
          const { error: updateCostMovementError } = await supabase
            .from('costs')
            .update({ inventory_movement_id: firstEntryMovementId })
            .eq('id', cost.id);

          if (updateCostMovementError) {
            throw new Error(`No se pudo enlazar el costo al movimiento de bodega de la factura ${doc.folio}: ${updateCostMovementError.message}`);
          }
        }

        importedCount += 1;
        setProgress(Math.round(((index + 1) / selectedValidatedDocuments.length) * 100));

        } catch (docError) {
          // Compensatory rollback: delete created records in reverse order
          logger.error(`Error importando factura ${doc.folio}, ejecutando rollback:`, docError);

          try {
            const movementIdsToRollback = new Set(createdMovementIds);
            const supplierPaymentIdsToRollback = new Set<string>();

            if (createdSupplierPaymentId) {
              supplierPaymentIdsToRollback.add(createdSupplierPaymentId);
            }

            if (createdCostId || createdInvoiceId) {
              const paymentRollbackFilters = [
                createdCostId ? `cost_id.eq.${createdCostId}` : null,
                createdInvoiceId ? `supplier_invoice_id.eq.${createdInvoiceId}` : null,
              ]
                .filter(Boolean)
                .join(',');

              if (paymentRollbackFilters) {
                const { data: rollbackPayments, error: rollbackPaymentsError } = await supabase
                  .from('supplier_payments')
                  .select('id')
                  .or(paymentRollbackFilters);

                if (rollbackPaymentsError) {
                  throw rollbackPaymentsError;
                }

                (rollbackPayments || []).forEach((payment) => supplierPaymentIdsToRollback.add(payment.id));
              }
            }

            if (createdInvoiceId || createdCostId) {
              const movementRollbackQuery = supabase
                .from('inventory_movements')
                .select('id')
                .or(
                  [
                    createdInvoiceId ? `supplier_invoice_id.eq.${createdInvoiceId}` : null,
                    createdCostId ? `cost_id.eq.${createdCostId}` : null,
                  ]
                    .filter(Boolean)
                    .join(',')
                );

              const { data: rollbackMovements, error: rollbackMovementsError } = await movementRollbackQuery;

              if (rollbackMovementsError) {
                throw rollbackMovementsError;
              }

              (rollbackMovements || []).forEach((movement) => movementIdsToRollback.add(movement.id));
            }

            const movementIds = Array.from(movementIdsToRollback);

            if (createdCranePartIds.length > 0) {
              await supabase.from('crane_parts').delete().in('id', createdCranePartIds);
            }

            if (movementIds.length > 0) {
              await supabase.from('crane_parts').delete().in('inventory_movement_id', movementIds);
              await supabase.from('inventory_movements').delete().in('id', movementIds);
            }
            if (createdInvoiceLineIds.length > 0) {
              await supabase.from('supplier_invoice_items').delete().in('id', createdInvoiceLineIds);
            }
            if (supplierPaymentIdsToRollback.size > 0) {
              await supabase.from('supplier_payments').delete().in('id', Array.from(supplierPaymentIdsToRollback));
            }
            if (createdCostId) {
              await supabase.from('costs').delete().eq('id', createdCostId);
            }
            if (createdInvoiceId) {
              await supabase.from('supplier_invoices').delete().eq('id', createdInvoiceId);
            }
            logger.debug(`Rollback completado para factura ${doc.folio}`);
          } catch (rollbackError) {
            logger.error(`Error durante rollback de factura ${doc.folio}:`, rollbackError);
          }

          throw docError;
        }
      }

      invalidateAll();
      await refetchCritical();
      const importSuccessMessage = buildImportSuccessMessage({
        importedCount,
        hasImmediateConsumption: Boolean(selectedCraneId),
        craneLabel: selectedCrane?.licensePlate || null,
      });
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="h-[95vh] w-[min(99vw,1600px)] max-w-[1600px] overflow-clip border-border/70 bg-card p-0 shadow-2xl">
        <XMLImportDialogHeader
          icon={Receipt}
          title="Importar XML a Bodega"
          description="Valida documentos, corrige glosas, crea productos faltantes y sincroniza Bodega, Costos y Proveedores."
          fileName={selectedFile?.name}
          documentCount={summary.totalDocs}
        />

        <div className="grid min-h-0 flex-1 gap-4 px-6 pb-6 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 gap-y-4 lg:flex lg:flex-col">
            <XMLDropzoneArea
              selectedFile={selectedFile}
              parseResult={parseResult}
              isAnalyzing={isAnalyzing}
              isDragActive={isDragActive}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              onAnalyze={() => {}}
              onReset={resetState}
              badges={['Validación por líneas', 'Match con catálogo', 'Trazabilidad completa']}
            />

            <XMLImportStatsGrid
              className="sm:grid-cols-2"
              items={[
                {
                  title: 'Facturas Detectadas',
                  value: summary.totalDocs,
                  icon: FileText,
                  tone: 'neutral',
                },
                {
                  title: 'Facturas Válidas',
                  value: summary.validDocs,
                  icon: CheckCircle2,
                  tone: 'success',
                },
                {
                  title: 'Líneas Totales',
                  value: summary.totalLines,
                  icon: Package,
                  tone: 'info',
                },
                {
                  title: 'Líneas con Error',
                  value: summary.invalidLines,
                  icon: AlertCircle,
                  tone: 'danger',
                },
              ]}
            />

            <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/60 bg-background/90 shadow-sm backdrop-blur">
              <div className="space-y-4 p-4">
                {parseResult?.errors?.length ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{parseResult.errors.join(' ')}</AlertDescription>
                  </Alert>
                ) : null}

                {validatedDocuments.length === 0 && !parseResult?.errors?.length && (
                  <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-none">
                    <CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center">
                      <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary">
                        <FileText className="size-10" />
                      </div>
                      <p className="font-semibold text-lg">Aún no hay facturas cargadas</p>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Carga un XML para ver el detalle de documentos, editar glosas, validar productos y revisar
                        errores antes de importar.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Badge variant="outline">XML estructurado</Badge>
                        <Badge variant="outline">Validación previa</Badge>
                        <Badge variant="outline">Importación segura</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {validatedDocuments.map((validatedDoc) => (
                  <Card key={validatedDoc.doc.folio} className="overflow-hidden border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedDocuments.has(validatedDoc.doc.folio)}
                            onCheckedChange={(checked) => toggleSelectedDocument(validatedDoc.doc.folio, checked === true)}
                            disabled={!validatedDoc.isValid || isImporting}
                          />
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="size-4" />
                              {validatedDoc.doc.folio}
                            </CardTitle>
                            <Textarea
                              rows={2}
                              className="mt-1 text-sm resize-y"
                              value={editedDescriptions.get(validatedDoc.doc.folio) ?? validatedDoc.doc.description ?? ''}
                              onChange={(e) => {
                                setEditedDescriptions(prev => {
                                  const next = new Map(prev);
                                  next.set(validatedDoc.doc.folio, e.target.value);
                                  return next;
                                });
                              }}
                              disabled={isImporting}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={validatedDoc.isValid ? 'default' : 'destructive'}>
                            {validatedDoc.isValid ? 'Lista para importar' : 'Con errores'}
                          </Badge>
                          <Badge variant="outline">
                            {validatedDoc.lines.filter(l => !discardedLines.has(l.key)).length} línea(s)
                          </Badge>
                          <Badge variant="secondary">
                            {formatCurrency(validatedDoc.doc.total_amount)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {validatedDoc.errors.length > 0 && (
                        <Alert variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertDescription>{validatedDoc.errors.join(' ')}</AlertDescription>
                        </Alert>
                      )}

                      {validatedDoc.warnings.length > 0 && (
                        <Alert>
                          <AlertCircle className="size-4" />
                          <AlertDescription>{validatedDoc.warnings.join(' ')}</AlertDescription>
                        </Alert>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-2 pr-3">#</th>
                              <th className="pb-2 pr-3">Codigo XML</th>
                              <th className="pb-2 pr-3">Descripcion</th>
                              <th className="pb-2 pr-3">Cantidad</th>
                              <th className="pb-2 pr-3">Unitario</th>
                              <th className="pb-2 pr-3">Total</th>
                              <th className="pb-2 pr-3">Producto</th>
                              <th className="pb-2 pr-3">Estado</th>
                              <th className="pb-2 text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validatedDoc.lines.map((line) => {
                              const isDiscarded = discardedLines.has(line.key);
                              return (
                              <tr key={line.key} className={cn("border-b last:border-0 align-top transition-opacity", isDiscarded && "opacity-40")}>
                                <td className="py-2 pr-3">{line.lineNumber}</td>
                                <td className="py-2 pr-3 font-mono text-xs">{line.item.product_code || '-'}</td>
                                <td className="py-2 pr-3 min-w-[320px]">
                                  <div className="space-y-1">
                                    <Textarea
                                      value={line.item.description}
                                      onChange={(event) =>
                                        updateLineDescription(validatedDoc.doc.folio, line.lineNumber, event.target.value)
                                      }
                                      disabled={isImporting}
                                      rows={2}
                                      className="min-h-[72px] resize-y"
                                      placeholder="Edita la glosa para mejorar la coincidencia con el catálogo"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      La validación y la coincidencia se recalculan al editar la glosa.
                                    </p>
                                  </div>
                                </td>
                                <td className="py-2 pr-3">{line.item.quantity}</td>
                                <td className="py-2 pr-3">{formatCurrency(line.item.unit_price)}</td>
                                <td className="py-2 pr-3">{formatCurrency(computeLineTotal(line.item))}</td>
                                <td className="py-2 pr-3 min-w-[280px]">
                                  {line.matchedItem ? (
                                    <div>
                                      <div className="font-medium">{line.matchedItem.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {line.matchedItem.sku || line.matchedItem.barcode || 'Sin SKU'}
                                      </div>
                                      {manualMatchedItems[line.key] && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 px-1 text-xs text-muted-foreground hover:text-destructive mt-1"
                                          onClick={() => setManualMatchedItems(prev => {
                                            const next = { ...prev };
                                            delete next[line.key];
                                            return next;
                                          })}
                                          disabled={isImporting}
                                        >
                                          <X className="size-3 mr-0.5" />
                                          Quitar selección
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {line.candidates.length > 0 && (
                                        <div className="space-y-1">
                                          <span className="text-xs font-medium text-muted-foreground block">
                                            {line.candidates.length} sugerencia(s):
                                          </span>
                                          <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                            {line.candidates.slice(0, 5).map((candidate) => (
                                              <div
                                                key={candidate.id}
                                                className="flex items-center justify-between gap-1 p-1.5 rounded border bg-muted/50 text-xs"
                                              >
                                                <div className="min-w-0 flex-1">
                                                  <div className="font-medium truncate">{candidate.name}</div>
                                                  <div className="text-muted-foreground">{candidate.sku || 'Sin SKU'}</div>
                                                </div>
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 px-2 text-xs shrink-0"
                                                  disabled={isImporting}
                                                  onClick={() => setManualMatchedItems(prev => ({
                                                    ...prev,
                                                    [line.key]: candidate,
                                                  }))}
                                                >
                                                  <Check className="size-3 mr-0.5" />
                                                  Usar
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {line.candidates.length === 0 && (
                                        <span className="text-muted-foreground block text-xs">Sin coincidencia</span>
                                      )}
                                      {/* Manual search combobox */}
                                      <Popover
                                        open={catalogSearchOpen[line.key] || false}
                                        onOpenChange={(open) => setCatalogSearchOpen(prev => ({ ...prev, [line.key]: open }))}
                                      >
                                        <PopoverTrigger asChild>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="w-full justify-between text-xs h-7"
                                            disabled={isImporting}
                                          >
                                            <span>Buscar en catálogo...</span>
                                            <ChevronsUpDown className="size-3 opacity-50" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 w-[280px]" align="start">
                                          <Command>
                                            <CommandInput placeholder="Buscar por nombre o SKU..." />
                                            <CommandList>
                                              <CommandEmpty>No se encontró producto.</CommandEmpty>
                                              <CommandGroup>
                                                {inventoryCatalog.map((catalogItem) => (
                                                  <CommandItem
                                                    key={catalogItem.id}
                                                    value={`${catalogItem.name} ${catalogItem.sku || ''}`}
                                                    onSelect={() => {
                                                      setManualMatchedItems(prev => ({
                                                        ...prev,
                                                        [line.key]: catalogItem,
                                                      }));
                                                      setCatalogSearchOpen(prev => ({ ...prev, [line.key]: false }));
                                                    }}
                                                  >
                                                    <div className="flex flex-col">
                                                      <span className="text-sm">{catalogItem.name}</span>
                                                      <span className="text-xs text-muted-foreground">
                                                        {catalogItem.sku || 'Sin SKU'}
                                                      </span>
                                                    </div>
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs h-7"
                                        disabled={isImporting || creatingProductKeys.has(line.key)}
                                        onClick={() => void handleCreateMissingProduct(validatedDoc.doc, line)}
                                      >
                                        {creatingProductKeys.has(line.key) ? (
                                          <>
                                            <Loader2 className="size-3 animate-spin" />
                                            Creando...
                                          </>
                                        ) : (
                                          <>
                                            <Plus className="size-3" />
                                            Crear producto
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2">
                                  {line.error ? (
                                    <Badge variant="destructive">{line.error}</Badge>
                                  ) : line.warning ? (
                                    <Badge variant="secondary">{line.warning}</Badge>
                                  ) : (
                                    <Badge variant="default" className="gap-1">
                                      <CheckCircle2 className="size-3" />
                                      OK
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-2 text-center">
                                  {isDiscarded ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="size-7 p-0 text-success hover:bg-success/10 hover:text-success"
                                      onClick={() => setDiscardedLines(prev => { const next = new Set(prev); next.delete(line.key); return next; })}
                                      disabled={isImporting}
                                      title="Restaurar línea"
                                    >
                                      <RotateCcw className="size-3.5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="size-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setDiscardedLines(prev => new Set(prev).add(line.key))}
                                      disabled={isImporting}
                                      title="Descartar línea"
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

            <Card className="min-h-0 overflow-hidden border-border/70 bg-background/95 shadow-sm lg:h-full lg:flex lg:flex-col">
            <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Package className="size-4" />
                    </span>
                    Parametros de Ingreso
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedLocationId ? 'default' : 'outline'} className="px-2.5 py-1">
                    {selectedLocationId ? 'Bodega configurada' : 'Falta bodega'}
                  </Badge>
                  <Badge variant={selectedCostCategoryId ? 'secondary' : 'outline'} className="px-2.5 py-1">
                    {selectedCostCategoryId ? 'Costo configurado' : 'Falta categoría'}
                  </Badge>
                  <Badge variant={selectedCraneId ? 'secondary' : 'outline'} className="px-2.5 py-1">
                    {selectedCraneId ? 'Consumo inmediato' : 'Solo ingreso a bodega'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 gap-y-4 pt-4 lg:flex-1 lg:overflow-hidden">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-4 pb-4">
                    <div className="space-y-2">
                      <Label>Ubicación de Bodega</Label>
                      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una ubicación" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name} ({location.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Categoría de Costo</Label>
                      <Select
                        value={selectedCostCategoryId}
                        onValueChange={(value) => {
                          setSelectedCostCategoryId(value);
                          setSelectedCostSubcategory('');
                          const selectedCategory = costCategories.find((category) => category.id === value);
                          if (!selectedCostCenterId && selectedCategory?.default_cost_center_id) {
                            setSelectedCostCenterId(selectedCategory.default_cost_center_id);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Subcategoría</Label>
                      <Select
                        value={selectedCostSubcategory || 'none'}
                        onValueChange={(value) => setSelectedCostSubcategory(value === 'none' ? '' : value)}
                        disabled={!selectedCostCategoryId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin subcategoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin subcategoría</SelectItem>
                          {costSubcategories.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.name}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Collapsible open={showAdvancedAssociations} onOpenChange={setShowAdvancedAssociations}>
                      <div className="rounded-lg border border-border/60 bg-muted/20">
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="flex w-full items-center justify-between px-3 py-2 h-auto hover:bg-transparent"
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <Link2 className="size-4 text-muted-foreground" />
                              Asociaciones avanzadas
                            </span>
                            {showAdvancedAssociations ? (
                              <ChevronUp className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 border-t px-3 py-3">
                          <div className="space-y-2">
                            <Label>Centro de Costo</Label>
                            <Select
                              value={selectedCostCenterId || 'none'}
                              onValueChange={(value) => setSelectedCostCenterId(value === 'none' ? '' : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sin centro de costo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin centro de costo</SelectItem>
                                {costCenters
                                  .filter((center) => center.is_active)
                                  .map((center) => (
                                    <SelectItem key={center.id} value={center.id}>
                                      {center.code} - {center.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Servicio</Label>
                            <Popover
                              open={serviceSearchOpen}
                              onOpenChange={(open) => {
                                setServiceSearchOpen(open);
                                if (!open) setServiceSearchQuery('');
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={serviceSearchOpen}
                                  className={cn('w-full justify-between', !selectedServiceId ? 'text-muted-foreground' : '')}
                                >
                                  <span className="truncate">
                                    {selectedService
                                      ? `${selectedService.folio} - ${toTitleCase(selectedService.client.name)}`
                                      : 'Sin asociar'}
                                  </span>
                                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[420px] p-0" align="start">
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    placeholder="Buscar por folio, cliente, patente, grua, operador o fecha..."
                                    value={serviceSearchQuery}
                                    onValueChange={setServiceSearchQuery}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      <div className="p-3 text-sm text-muted-foreground">
                                        {serviceSearchQuery.trim()
                                          ? 'No se encontraron servicios con ese criterio.'
                                          : 'Escribe para buscar servicios.'}
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem
                                        value="none"
                                        onSelect={() => {
                                          setSelectedServiceId('');
                                          setSelectedServiceFolio('');
                                          setServiceSearchOpen(false);
                                        }}
                                      >
                                        <Check className={cn('mr-2 size-4', !selectedServiceId ? 'opacity-100' : 'opacity-0')} />
                                        Sin asociar
                                      </CommandItem>
                                      {serviceSearchResults.map((service) => (
                                        <CommandItem
                                          key={service.id}
                                          value={service.searchValue}
                                          onSelect={() => {
                                            setSelectedServiceId(service.id);
                                            setServiceSearchOpen(false);
                                          }}
                                          className="items-start"
                                        >
                                          <Check
                                            className={cn(
                                              'mr-2 mt-0.5 size-4 shrink-0',
                                              selectedServiceId === service.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                          />
                                          <div className="flex min-w-0 flex-col">
                                            <span className="font-medium">
                                              {service.folio} - {service.clientName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {service.serviceDateLabel} · Patente {service.licensePlate || 'N/A'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              Grúa {service.craneLabel} · Operador {service.operatorLabel}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground">
                              Busca por folio, cliente, patente, grúa, operador o fecha. Se priorizan coincidencias exactas.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label>Grúa</Label>
                            <Select
                              value={selectedCraneId || 'none'}
                              onValueChange={(value) => setSelectedCraneId(value === 'none' ? '' : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sin asociar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin asociar</SelectItem>
                                {cranes.map((crane) => (
                                  <SelectItem key={crane.id} value={crane.id}>
                                    {crane.licensePlate}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Operador</Label>
                            <Select
                              value={selectedOperatorId || 'none'}
                              onValueChange={(value) => setSelectedOperatorId(value === 'none' ? '' : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sin asociar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin asociar</SelectItem>
                                {operators.map((operator) => (
                                  <SelectItem key={operator.id} value={operator.id}>
                                    {operator.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Folio de Servicio</Label>
                            <Textarea
                              value={selectedServiceFolio}
                              onChange={(event) => setSelectedServiceFolio(event.target.value)}
                              rows={2}
                              className="min-h-[56px] resize-none"
                              placeholder="Ej: F-1234"
                              disabled={isImporting}
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 p-3">
                      <Checkbox
                        id="inventory-xml-is-paid"
                        checked={isPaid}
                        onCheckedChange={(checked) => setIsPaid(Boolean(checked))}
                        disabled={isImporting}
                      />
                      <div className="space-y-0.5">
                        <label htmlFor="inventory-xml-is-paid" className="text-sm font-medium text-foreground cursor-pointer">
                          Marcar compra como pagada
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Al importar, se registrará la fecha del costo como fecha de pago y la factura quedará pagada.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-background p-4 text-sm text-muted-foreground space-y-2">
                      <p className="font-medium text-foreground">Resumen del flujo</p>
                      <p>- Factura de proveedor</p>
                      <p>- Costo consolidado en el módulo de Costos</p>
                      <p>- Líneas con vínculo a producto y movimiento</p>
                      <p>- Entradas de inventario una por cada línea válida</p>
                      {selectedCraneId && <p>- Salida inmediata a grúa y registro en piezas/consumos</p>}
                    </div>

                    <Collapsible>
                      <div className="rounded-xl border border-border/60 bg-background/95 shadow-sm">
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="flex h-auto w-full items-center justify-between px-3 py-3 hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-2 text-left">
                              <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                                <Receipt className="size-4" />
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-foreground">Resumen activo</p>
                                <p className="text-xs text-muted-foreground">
                                  Ver configuración aplicada a {selectedValidatedDocuments.length || 0} documento(s)
                                </p>
                              </div>
                            </div>
                            <ChevronDown className="size-4 text-muted-foreground" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="border-t px-3 py-3">
                          <div className="grid grid-cols-1 gap-2 text-xs">
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Bodega</span>
                              <span className="font-medium text-foreground">
                                {selectedLocation ? `${selectedLocation.name} (${selectedLocation.code})` : 'Sin seleccionar'}
                              </span>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Costo</span>
                              <span className="font-medium text-foreground">
                                {selectedCostCategory?.name || 'Sin categoría'}
                                {selectedCostSubcategory ? ` · ${selectedCostSubcategory}` : ''}
                              </span>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Centro de costo</span>
                              <span className="font-medium text-foreground">
                                {selectedCostCenter ? `${selectedCostCenter.code} - ${selectedCostCenter.name}` : 'Sin asignar'}
                              </span>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Destino</span>
                              <span className="font-medium text-foreground">
                                {selectedCrane
                                  ? `Grúa ${selectedCrane.licensePlate}${selectedOperator ? ` · ${selectedOperator.name}` : ''}`
                                  : 'Solo ingreso a bodega'}
                              </span>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Servicio</span>
                              <span className="font-medium text-foreground">
                                {selectedService ? `${selectedService.folio} - ${toTitleCase(selectedService.client.name)}` : 'Sin asociar'}
                              </span>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Pago</span>
                              <span className="font-medium text-foreground">
                                {isPaid ? 'Compra marcada como pagada' : 'Compra pendiente de pago'}
                              </span>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {(isAnalyzing || isImporting) && (
                      <div className="space-y-2">
                        <Progress value={progress} />
                        <p className="text-xs text-muted-foreground">
                          {isAnalyzing ? 'Analizando XML...' : 'Importando transacciones...'}
                        </p>
                      </div>
                    )}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="border-t bg-muted/20 p-4 space-y-2">
              <Button
                className="w-full h-11 text-sm font-semibold shadow-sm"
                onClick={handleImport}
                disabled={isAnalyzing || isImporting || selectedValidatedDocuments.length === 0 || !selectedLocationId}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar a Bodega'
                )}
              </Button>

              <Button variant="outline" className="w-full h-11" onClick={handleClose} disabled={isAnalyzing || isImporting}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingProductSuggestion}
        onOpenChange={(open) => {
          if (!open) setPendingProductSuggestion(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Validación de producto antes de crear
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se detectaron productos similares en el catálogo. Para no afectar el flujo actual de importación,
              puedes reutilizar uno existente o confirmar conscientemente la creación de uno nuevo.
            </p>

            {pendingProductSuggestion && (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div><strong>Factura:</strong> {pendingProductSuggestion.doc.folio}</div>
                  <div><strong>Línea:</strong> {pendingProductSuggestion.line.lineNumber}</div>
                  <div><strong>Descripción XML:</strong> {pendingProductSuggestion.line.item.description}</div>
                </div>

                <SimilarProductAlert
                  similarityResult={pendingProductSuggestion.similarityResult}
                  onUseExisting={handleUseSuggestedProduct}
                  onCreateNew={() => void handleCreateSuggestedNew()}
                  onViewDetails={setSuggestedProductDetails}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProductDetailsModal
        isOpen={!!suggestedProductDetails}
        onClose={() => setSuggestedProductDetails(null)}
        product={suggestedProductDetails}
      />
    </>
  );
};
