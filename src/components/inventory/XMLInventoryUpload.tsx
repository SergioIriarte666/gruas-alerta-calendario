import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Package, Receipt, Plus, Check, ChevronsUpDown, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';
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

const normalizeText = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeCode = (value: string | null | undefined) =>
  (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

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
  const primaryLine = (doc.items || [])
    .map((item) => item.description?.trim())
    .find((description) => description && description.length > 0);

  const segments = [
    supplierName?.trim(),
    doc.folio ? `Factura ${doc.folio}` : null,
    primaryLine || doc.description?.trim() || null,
  ].filter(Boolean);

  const description = segments.join(' - ').trim();
  return (description || `Factura XML Bodega ${doc.folio}`).slice(0, 255);
};

const getLineKey = (folio: string, lineNumber: number) => `${folio}-${lineNumber}`;

export const XMLInventoryUpload: React.FC<XMLInventoryUploadProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const parser = useMemo(() => new XMLSupplierParser(), []);
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLCompleteParseResult | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [lineDescriptionOverrides, setLineDescriptionOverrides] = useState<Record<string, string>>({});
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { subcategories: costSubcategories = [] } = useCostSubcategories(selectedCostCategoryId || undefined);
  const servicesForCosts = useMemo(() => getServicesForCosts(), [getServicesForCosts]);
  const selectedService = useMemo(
    () => servicesForCosts.find((service) => service.id === selectedServiceId) || null,
    [selectedServiceId, servicesForCosts]
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
    (line: XMLDocumentItem) => {
      const codeCandidates = [
        normalizeCode(line.product_code),
        normalizeCode(line.product_name),
        normalizeCode(line.description),
      ].filter(Boolean);

      for (const code of codeCandidates) {
        const exactCodeMatch = inventoryCatalog.find(
          (item) =>
            normalizeCode(item.sku) === code ||
            normalizeCode(item.barcode) === code ||
            normalizeCode(item.name) === code
        );
        if (exactCodeMatch) return exactCodeMatch;
      }

      const normalizedDescription = normalizeText(line.description);
      const exactNameMatch = inventoryCatalog.find((item) => normalizeText(item.name) === normalizedDescription);
      if (exactNameMatch) return exactNameMatch;

      const partialMatches = inventoryCatalog.filter((item) => {
        const itemName = normalizeText(item.name);
        return (
          normalizedDescription.length >= 6 &&
          (itemName.includes(normalizedDescription) || normalizedDescription.includes(itemName))
        );
      });

      if (partialMatches.length === 1) return partialMatches[0];
      return null;
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
        const matchedItem = findMatchedInventoryItem(effectiveLine);
        const quantity = Number(line.quantity);
        const subtotal = computeLineSubtotal(effectiveLine);
        const total = computeLineTotal(effectiveLine);

        let error: string | null = null;
        let warning: string | null = null;

        if (!effectiveLine.description?.trim()) {
          error = 'La línea no tiene descripción.';
        } else if (!Number.isFinite(quantity) || quantity <= 0) {
          error = 'La cantidad debe ser mayor a 0.';
        } else if (!Number.isInteger(quantity)) {
          error = 'La cantidad debe ser un número entero para el inventario.';
        } else if (!matchedItem) {
          error = 'No se encontró coincidencia en el catálogo de productos.';
        } else if (subtotal <= 0 && total <= 0) {
          error = 'La línea no tiene monto válido.';
        } else if (!effectiveLine.product_code && matchedItem && normalizeText(matchedItem.name) !== normalizeText(effectiveLine.description)) {
          warning = 'Coincidencia realizada por descripción aproximada.';
        }

        return {
          key: getLineKey(doc.folio, lineNumber),
          lineNumber,
          item: effectiveLine,
          matchedItem,
          error,
          warning,
        };
      });

      if (!supplier) {
        warnings.push('El proveedor no existe aún y se creará durante la importación.');
      }

      const lineErrors = lines.filter((line) => line.error).map((line) => `Línea ${line.lineNumber}: ${line.error}`);
      const lineWarnings = lines.filter((line) => line.warning).map((line) => `Línea ${line.lineNumber}: ${line.warning}`);

      errors.push(...lineErrors);
      warnings.push(...lineWarnings);

      const totalByLines = lines.reduce((sum, line) => sum + computeLineTotal(line.item), 0);
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
        isValid: errors.length === 0,
      };
    });
  }, [findMatchedInventoryItem, lineDescriptionOverrides, parseResult, suppliers]);

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
    const totalLines = validatedDocuments.reduce((sum, item) => sum + item.lines.length, 0);
    const invalidLines = validatedDocuments.reduce(
      (sum, item) => sum + item.lines.filter((line) => line.error).length,
      0
    );

    return { totalDocs, validDocs, totalLines, invalidLines };
  }, [validatedDocuments]);

  const resetState = () => {
    setSelectedFile(null);
    setParseResult(null);
    setSelectedDocuments(new Set());
    setLineDescriptionOverrides({});
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
    setIsAnalyzing(false);
    setIsImporting(false);
    setProgress(0);
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

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    setSelectedFile(file);
    setParseResult(null);
    setSelectedDocuments(new Set());
    setLineDescriptionOverrides({});
    setProgress(0);

    try {
      const result = await parser.parseXMLCompleteFile(file);
      setParseResult(result);

      if (!selectedCostCategoryId && costCategories.length > 0) {
        const defaultCostCategory =
          costCategories.find((category) => normalizeText(category.name).includes('inventario')) ||
          costCategories.find((category) => normalizeText(category.name).includes('mantenimiento')) ||
          costCategories[0];
        if (defaultCostCategory) {
          setSelectedCostCategoryId(defaultCostCategory.id);
        }
      }

      if (!selectedLocationId && locations.length > 0) {
        const defaultLocation = locations.find((location) => location.code === 'MAIN') || locations[0];
        if (defaultLocation) setSelectedLocationId(defaultLocation.id);
      }

      const validFolios = new Set(
        result.documents
          .filter((doc) => doc.folio && (doc.items?.length || 0) > 0)
          .map((doc) => doc.folio)
      );
      setSelectedDocuments(validFolios);
    } catch (error) {
      console.error('Error analyzing inventory XML:', error);
      toast.error('No se pudo analizar el XML de inventario');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.toLowerCase().endsWith('.xml')) {
        void analyzeFile(file);
        return;
      }

      toast.error('Selecciona un archivo XML válido');
    },
    [costCategories, locations.length, parser, selectedCostCategoryId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
    },
    multiple: false,
  });

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
      const normalizedCode = line.item.product_code?.trim() || null;
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
      console.error('Error creating missing inventory product:', error);
    } finally {
      setCreatingProductKeys((prev) => {
        const next = new Set(prev);
        next.delete(lineKey);
        return next;
      });
    }
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

        const supplierId = await ensureSupplier(doc, supplier);

        const { data: existingInvoice, error: existingInvoiceError } = await supabase
          .from('supplier_invoices')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('invoice_number', doc.folio)
          .maybeSingle();

        if (existingInvoiceError) {
          throw new Error(`No se pudo validar duplicados para la factura ${doc.folio}: ${existingInvoiceError.message}`);
        }

        if (existingInvoice?.id) {
          throw new Error(`La factura ${doc.folio} ya existe para ese proveedor.`);
        }

        const productServiceDescription = buildProductDescription(doc);
        const supplierName = supplier?.name || doc.description?.split(' - ').pop()?.trim() || 'Proveedor XML';
        const costDescription = buildCostDescription(doc, supplierName);
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
            description: `Factura de bodega ${doc.folio} - ${supplierName}`,
            product_service_description: productServiceDescription,
            status: isPaid ? 'paid' : 'pending',
            paid_amount: isPaid ? doc.total_amount : 0,
            balance: isPaid ? 0 : doc.total_amount,
            source_module: 'inventory_xml',
            xml_file_name: selectedFile?.name || null,
          })
          .select('id')
          .single();

        if (invoiceError || !invoice) {
          throw new Error(`No se pudo crear la factura ${doc.folio}: ${invoiceError?.message || 'Error desconocido'}`);
        }

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

        const { data: supplierPayment, error: supplierPaymentError } = await supabase
          .from('supplier_payments')
          .insert({
            supplier_id: supplierId,
            supplier_invoice_id: invoice.id,
            cost_id: cost.id,
            amount: doc.total_amount,
            due_date: doc.due_date || doc.issue_date,
            description: costDescription,
            category: selectedCostCategoryId,
            subcategory: selectedCostSubcategory || 'Importación XML Bodega',
            reference_number: doc.folio,
            notes: sharedNotes,
            status: isPaid ? 'paid' : 'pending',
            paid_amount: isPaid ? doc.total_amount : 0,
            paid_date: isPaid ? doc.issue_date : null,
            crane_id: selectedCraneId || null,
            add_to_inventory: false,
            part_name: primaryLineDescription,
          })
          .select('id')
          .single();

        if (supplierPaymentError || !supplierPayment) {
          throw new Error(
            `No se pudo crear el registro de proveedor para la factura ${doc.folio}: ${supplierPaymentError?.message || 'Error desconocido'}`
          );
        }

        const { error: linkCostPaymentError } = await supabase
          .from('costs')
          .update({ supplier_payment_id: supplierPayment.id })
          .eq('id', cost.id);

        if (linkCostPaymentError) {
          throw new Error(`No se pudo enlazar el pago del proveedor al costo ${doc.folio}: ${linkCostPaymentError.message}`);
        }

        const linesPayload = validatedDoc.lines.map((line) => ({
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
        const lineByNumber = new Map(insertedLines.map((line) => [line.line_number, line]));
        let firstExitMovementId: string | null = null;

        for (const validatedLine of validatedDoc.lines) {
          const insertedLine = lineByNumber.get(validatedLine.lineNumber);
          if (!insertedLine) {
            throw new Error(`No se pudo resolver la línea ${validatedLine.lineNumber} de la factura ${doc.folio}`);
          }

          const movementQuantity = Math.trunc(Number(validatedLine.item.quantity));
          const movementSubtotal = computeLineSubtotal(validatedLine.item);

          const { data: movement, error: movementError } = await supabase
            .from('inventory_movements')
            .insert({
              item_id: insertedLine.inventory_item_id,
              location_id: selectedLocationId,
              movement_type: 'entry',
              quantity: movementQuantity,
              unit_cost: Number(validatedLine.item.unit_price) || 0,
              total_cost: movementSubtotal,
              movement_date: doc.issue_date,
              reason: 'Importación XML de inventario',
              observations: `Factura ${doc.folio} - Línea ${validatedLine.lineNumber}`,
              status: 'active',
              supplier_id: supplierId,
              supplier_name: supplierName,
              reference_document: doc.folio,
              supplier_invoice_id: invoice.id,
              supplier_invoice_item_id: insertedLine.id,
            })
            .select('id')
            .single();

          if (movementError || !movement) {
            throw new Error(
              `No se pudo crear el movimiento para la línea ${validatedLine.lineNumber} de la factura ${doc.folio}: ${movementError?.message || 'Error desconocido'}`
            );
          }

          const { error: updateLineError } = await supabase
            .from('supplier_invoice_items')
            .update({ movement_id: movement.id })
            .eq('id', insertedLine.id);

          if (updateLineError) {
            throw new Error(`No se pudo enlazar la línea ${validatedLine.lineNumber} con su movimiento: ${updateLineError.message}`);
          }

          if (selectedCraneId) {
            const { data: exitMovement, error: exitMovementError } = await supabase
              .from('inventory_movements')
              .insert({
                item_id: insertedLine.inventory_item_id,
                location_id: selectedLocationId,
                movement_type: 'exit',
                quantity: movementQuantity,
                unit_cost: Number(validatedLine.item.unit_price) || 0,
                total_cost: movementSubtotal,
                movement_date: doc.issue_date,
                reason: 'Consumo inmediato desde importación XML',
                observations: `Factura ${doc.folio} - Línea ${validatedLine.lineNumber} - Consumo inmediato`,
                status: 'active',
                crane_id: selectedCraneId,
                operator_id: selectedOperatorId || null,
                supplier_id: supplierId,
                supplier_name: supplierName,
                reference_document: doc.folio,
                cost_id: cost.id,
                supplier_invoice_id: invoice.id,
                supplier_invoice_item_id: insertedLine.id,
              })
              .select('id')
              .single();

            if (exitMovementError || !exitMovement) {
              throw new Error(
                `No se pudo crear el consumo inmediato para la línea ${validatedLine.lineNumber} de la factura ${doc.folio}: ${exitMovementError?.message || 'Error desconocido'}`
              );
            }

            const { error: cranePartError } = await supabase
              .from('crane_parts')
              .insert({
                crane_id: selectedCraneId,
                cost_id: cost.id,
                inventory_movement_id: exitMovement.id,
                part_name: validatedLine.item.description,
                supplier: supplierName,
                supplier_id: supplierId,
                quantity: movementQuantity,
                unit_price: Number(validatedLine.item.unit_price) || 0,
                total_value: movementSubtotal,
                date: doc.issue_date,
                notes: `Compra de bodega con consumo inmediato. Factura ${doc.folio}.`,
              });

            if (cranePartError) {
              throw new Error(
                `No se pudo registrar la pieza para la grúa en la línea ${validatedLine.lineNumber} de la factura ${doc.folio}: ${cranePartError.message}`
              );
            }

            if (!firstExitMovementId) {
              firstExitMovementId = exitMovement.id;
            }
          }
        }

        if (firstExitMovementId) {
          const { error: updateCostMovementError } = await supabase
            .from('costs')
            .update({ inventory_movement_id: firstExitMovementId })
            .eq('id', cost.id);

          if (updateCostMovementError) {
            throw new Error(`No se pudo enlazar el costo al consumo inmediato de la factura ${doc.folio}: ${updateCostMovementError.message}`);
          }
        }

        importedCount += 1;
        setProgress(Math.round(((index + 1) / selectedValidatedDocuments.length) * 100));
      }

      invalidateAll();
      await refetchCritical();
      toast.success(`${importedCount} factura(s) XML importada(s) a bodega correctamente`);
      onSuccess(importedCount);
      handleClose();
    } catch (error) {
      console.error('Error importing inventory XML:', error);
      toast.error(error instanceof Error ? error.message : 'Error desconocido durante la importación');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[min(98vw,1400px)] max-w-7xl h-[92vh] overflow-hidden border-border/60 bg-gradient-to-b from-background to-muted/20 p-0 shadow-2xl">
        <DialogHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4 dark:from-slate-950 dark:via-background dark:to-slate-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Receipt className="h-5 w-5" />
                </span>
                Importar XML a Bodega
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Valida documentos, corrige glosas, crea productos faltantes y sincroniza Bodega, Costos y Proveedores.
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
              <Badge variant="secondary" className="px-3 py-1 text-xs">
                {summary.totalDocs} doc(s)
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <div className="space-y-4 py-4">
            <div
              {...getRootProps()}
              className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                  : 'border-border/80 bg-background/80 hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_45%)]" />
              <input {...getInputProps()} />
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <Upload className="h-8 w-8" />
              </div>
              <p className="relative font-semibold text-base">
                {selectedFile ? selectedFile.name : 'Arrastra un XML o haz clic para seleccionarlo'}
              </p>
              <p className="relative mt-1 text-sm text-muted-foreground">
                Se leerá el detalle línea por línea y se validará contra el catálogo de productos.
              </p>
              <div className="relative mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary" className="bg-background/80">Validación por líneas</Badge>
                <Badge variant="secondary" className="bg-background/80">Match con catálogo</Badge>
                <Badge variant="secondary" className="bg-background/80">Trazabilidad completa</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50 shadow-sm dark:from-background dark:to-muted/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Facturas Detectadas</p>
                    <div className="text-2xl font-semibold">{summary.totalDocs}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white shadow-sm dark:from-emerald-950/30 dark:to-background">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Facturas Válidas</p>
                    <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.validDocs}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50 to-white shadow-sm dark:from-blue-950/20 dark:to-background">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Líneas Totales</p>
                    <div className="text-2xl font-semibold">{summary.totalLines}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200/80 bg-gradient-to-br from-red-50 to-white shadow-sm dark:from-red-950/20 dark:to-background">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-xl bg-red-100 p-3 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Líneas con Error</p>
                    <div className="text-2xl font-semibold text-red-600 dark:text-red-400">{summary.invalidLines}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <ScrollArea className="min-h-0 rounded-2xl border border-border/60 bg-background/90 shadow-sm backdrop-blur">
              <div className="space-y-4 p-4">
                {parseResult?.errors?.length ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{parseResult.errors.join(' ')}</AlertDescription>
                  </Alert>
                ) : null}

                {validatedDocuments.length === 0 && !parseResult?.errors?.length && (
                  <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-none">
                    <CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center">
                      <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary">
                        <FileText className="h-10 w-10" />
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
                              <FileText className="h-4 w-4" />
                              {validatedDoc.doc.folio}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {validatedDoc.doc.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={validatedDoc.isValid ? 'default' : 'destructive'}>
                            {validatedDoc.isValid ? 'Lista para importar' : 'Con errores'}
                          </Badge>
                          <Badge variant="outline">
                            {validatedDoc.lines.length} línea(s)
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
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{validatedDoc.errors.join(' ')}</AlertDescription>
                        </Alert>
                      )}

                      {validatedDoc.warnings.length > 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
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
                              <th className="pb-2">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validatedDoc.lines.map((line) => (
                              <tr key={line.key} className="border-b last:border-0 align-top">
                                <td className="py-2 pr-3">{line.lineNumber}</td>
                                <td className="py-2 pr-3 font-mono text-xs">{line.item.product_code || '-'}</td>
                                <td className="py-2 pr-3 min-w-[280px]">
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
                                <td className="py-2 pr-3">
                                  {line.matchedItem ? (
                                    <div>
                                      <div className="font-medium">{line.matchedItem.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {line.matchedItem.sku || line.matchedItem.barcode || 'Sin SKU'}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <span className="text-muted-foreground block">Sin coincidencia</span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={isImporting || creatingProductKeys.has(line.key)}
                                        onClick={() => void handleCreateMissingProduct(validatedDoc.doc, line)}
                                      >
                                        {creatingProductKeys.has(line.key) ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Creando...
                                          </>
                                        ) : (
                                          <>
                                            <Plus className="h-3 w-3" />
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
                                      <CheckCircle2 className="h-3 w-3" />
                                      OK
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Card className="min-h-0 overflow-hidden border-border/70 bg-background/95 shadow-sm lg:h-full lg:flex lg:flex-col">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4 dark:from-slate-950/40 dark:to-background">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Package className="h-4 w-4" />
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
              <CardContent className="min-h-0 space-y-4 pt-4 lg:flex-1 lg:overflow-hidden">
                <ScrollArea className="lg:h-full lg:pr-3">
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
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                              Asociaciones avanzadas
                            </span>
                            {showAdvancedAssociations ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                        <Check className={cn('mr-2 h-4 w-4', !selectedServiceId ? 'opacity-100' : 'opacity-0')} />
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
                                              'mr-2 mt-0.5 h-4 w-4 shrink-0',
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

                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
