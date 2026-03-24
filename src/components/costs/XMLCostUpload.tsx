import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import DatePickerInput from '@/components/common/DatePickerInput';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

import { cn } from '@/lib/utils';
import {
  Upload,
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
  Package,
  Info,
  Code,
  Database,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { dedupeSuppliersByIdentity, findSupplierByIdentity } from '@/utils/supplierIdentity';
import { XMLCompleteParseResult, XMLDocumentData, XMLSupplierData } from '@/types/suppliers';
import { supabase } from '@/integrations/supabase/client';
import { useAddCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { useCostDuplicateCheck, CostDuplicateResult } from '@/hooks/useDuplicateCheck';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { toast } from 'sonner';

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

interface XMLCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLCostUpload = ({ isOpen, onClose, onSuccess }: XMLCostUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLCompleteParseResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Supplier category/subcategory mapping
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, string>>({});
  const [supplierSubcategoryMapping, setSupplierSubcategoryMapping] = useState<Record<string, string>>({});

  // Selections
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  // Payment terms / due dates
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd, setDefaultDaysToAdd] = useState<number>(30);
  const [paymentTermId, setPaymentTermId] = useState<string>('none');

  // Duplicates
  const [duplicateResults, setDuplicateResults] = useState<CostDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Sync to inventory
  const [syncToInventory, setSyncToInventory] = useState(false);

  // Cost matching
  const [matchedCosts, setMatchedCosts] = useState<Record<string, any[]>>({});
  const [linkDecisions, setLinkDecisions] = useState<Record<string, string | 'new'>>({});
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);

  const batchProgress = useBatchProgress();
  const { mutate: addCost } = useAddCost();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));
  const { checkDuplicates } = useCostDuplicateCheck();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setParseResult(null);
        setUploadProgress(0);
        setSupplierCategoryMapping({});
        setSupplierSubcategoryMapping({});
        setSelectedSuppliers(new Set());
        setSelectedDocuments(new Set());
      } else {
        toast.error('Por favor selecciona un archivo XML válido');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml'], 'application/xml': ['.xml'] },
    multiple: false,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement> | Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) onDrop([file]);
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    const parser = new XMLSupplierParser();
    try {
      const result = await parser.parseXMLCompleteFile(selectedFile);
      const uniqueSuppliers = dedupeSuppliersByIdentity(result.suppliers);
      const normalizedResult: XMLCompleteParseResult = {
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

      // Initialize per-document due date overrides
      const initialDueOverrides: Record<string, string> = {};
      result.documents.forEach(doc => {
        if (doc.issue_date) {
          const issueDate = safeParseDateOnly(doc.issue_date);
          initialDueOverrides[doc.folio] = format(addDays(issueDate, defaultDaysToAdd), 'yyyy-MM-dd');
        }
      });
      setDueDateOverrides(initialDueOverrides);

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
            const duplicates = await checkDuplicates(itemsToCheck);
            setDuplicateResults(duplicates);

            if (duplicates.length > 0) {
              const exactDuplicates = duplicates.filter(d => d.matchType === 'exact' || d.matchType === 'folio');
              if (exactDuplicates.length > 0) {
                const newSelection = new Set(validDocuments);
                exactDuplicates.forEach(d => {
                  const doc = result.documents[d.index];
                  if (doc) newSelection.delete(doc.folio);
                });
                setSelectedDocuments(newSelection);
                setShowDuplicateWarning(true);
                toast.warning(`Se detectaron ${duplicates.length} posibles duplicados. ${exactDuplicates.length} exactos fueron deseleccionados.`);
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
            const matches: Record<string, any[]> = {};
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
                matches[doc.folio] = data;
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

  // Find supplier by RUT or name in inventory_suppliers
  const findSupplierByRutOrName = async (rut: string, name: string): Promise<string | null> => {
    if (rut && rut.trim()) {
      const { data } = await (supabase as any)
        .from('inventory_suppliers')
        .select('id')
        .eq('rut', rut.trim())
        .maybeSingle();
      if (data) return data.id;
    }
    if (name && name.trim()) {
      const { data } = await (supabase as any)
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

    const docsToImport = parseResult.documents.filter(d =>
      selectedDocuments.has(d.folio) && selectedSuppliers.has(d.supplier_rut)
    );

    if (docsToImport.length === 0) {
      toast.error('No hay documentos seleccionados para importar');
      return;
    }

    setIsUploading(true);
    batchProgress.start('Cargando Gastos desde XML', docsToImport.length);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < docsToImport.length; i++) {
        const doc = docsToImport[i];
        batchProgress.update(i + 1, `${doc.folio} - ${doc.description?.substring(0, 30) || ''}`);

        // If user chose to link to existing cost, skip creation
        const linkCostId = linkDecisions[doc.folio];
        if (linkCostId && linkCostId !== 'new') {
          // TODO: link invoice to existing cost if needed
          successCount++;
          continue;
        }

        // Resolve category
        const catName = supplierCategoryMapping[doc.supplier_rut] || '';
        const catObj = activeCategories?.find(c => c.name === catName);
        const categoryId = catObj?.id || costCategoriesData[0]?.id || '';
        const subcatName = supplierSubcategoryMapping[doc.supplier_rut] || null;

        // Find supplier ID
        const supplier = parseResult.suppliers.find(s => s.rut === doc.supplier_rut);
        const supplierId = await findSupplierByRutOrName(doc.supplier_rut, supplier?.name || '');

        const emissionDate = doc.issue_date || format(new Date(), 'yyyy-MM-dd');
        const paymentDate = dueDateOverrides[doc.folio] || format(addDays(safeParseDateOnly(emissionDate), 30), 'yyyy-MM-dd');

        const costData = {
          date: emissionDate,
          description: doc.description || `Factura ${doc.folio}`,
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
            onSuccess: () => {
              successCount++;
              resolve();
            },
            onError: (error) => {
              console.error(`Error cargando gasto ${doc.folio}:`, error);
              errorCount++;
              resolve();
            },
          });
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (errorCount === 0) {
        batchProgress.complete();
        setTimeout(() => {
          onSuccess?.(successCount);
          onClose();
          batchProgress.close();
        }, 1500);
      } else {
        batchProgress.error(`${errorCount} de ${docsToImport.length} con error`);
      }
    } catch (error) {
      console.error('Upload error:', error);
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

  const toggleDocumentSelection = (documentFolio: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentFolio)) newSet.delete(documentFolio);
      else newSet.add(documentFolio);
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
    setDueDateOverrides({});
    setDefaultDaysToAdd(30);
    setPaymentTermId('none');
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setMatchedCosts({});
    setLinkDecisions({});
    setSyncToInventory(false);
  };

  const getDuplicateInfoByFolio = (folio: string): CostDuplicateResult | undefined => {
    return duplicateResults.find(d => {
      const doc = parseResult?.documents[d.index];
      return doc?.folio === folio;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const selectedTotal = parseResult
    ? parseResult.documents
        .filter(d => selectedDocuments.has(d.folio))
        .reduce((sum, d) => sum + d.total_amount, 0)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Code className="w-5 h-5 text-tms-green" />
            Cargar Gastos desde XML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          {!selectedFile && (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/10' : 'border-muted hover:border-border'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo XML aquí'}
              </h3>
              <p className="text-muted-foreground mb-4">o haz clic para seleccionar un archivo</p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xml';
                  input.onchange = handleFileSelect;
                  input.click();
                }}
              >
                Seleccionar Archivo
              </Button>
            </div>
          )}

          {/* File Info */}
          {selectedFile && !parseResult && (
            <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-foreground font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleAnalyzeFile} disabled={isAnalyzing} variant="default">
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
            </Card>
          )}

          {/* Upload Progress (non-batch) */}
          {isUploading && uploadProgress > 0 && (
            <Card className="bg-card border">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-foreground">
                    <span>Subiendo datos...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parse Results */}
          {parseResult && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Proveedores</p>
                        <p className="text-xl font-bold text-foreground">
                          {parseResult.validSuppliers}/{parseResult.totalSuppliers}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Documentos</p>
                        <p className="text-xl font-bold text-foreground">
                          {parseResult.validDocuments}/{parseResult.totalDocuments}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="text-sm text-muted-foreground">Errores</p>
                        <p className="text-xl font-bold text-foreground">{parseResult.errors.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Selec.</p>
                        <p className="text-xl font-bold text-foreground">
                          ${selectedTotal.toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Import Options */}
              <Card className="bg-card border">
                <CardHeader>
                  <CardTitle className="text-foreground">Opciones de Importación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={syncToInventory}
                      onCheckedChange={setSyncToInventory}
                    />
                    <Label className="text-sm flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Sincronizar con Bodega/Inventario
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Los costos se registrarán como entradas de inventario automáticamente</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {syncToInventory && (
                    <p className="text-xs text-green-600 ml-8">
                      ✓ Los costos se sincronizarán con el módulo de Bodega
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Duplicate Warning Banner */}
              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-amber-300 bg-amber-50">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>⚠️ Se detectaron {duplicateResults.length} posibles duplicados.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact').length > 0 && (
                        <Badge variant="destructive" className="mr-2">
                          {duplicateResults.filter(d => d.matchType === 'exact').length} exactos
                        </Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'folio').length > 0 && (
                        <Badge className="bg-orange-100 text-orange-800 mr-2">
                          {duplicateResults.filter(d => d.matchType === 'folio').length} por folio
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
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700">Buscando costos existentes que coincidan...</span>
                </div>
              )}

              {/* Cost matching summary */}
              {Object.keys(matchedCosts).length > 0 && (
                <Alert className="border-blue-300 bg-blue-50">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
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
                      <AlertCircle className="h-4 w-4 text-destructive" />
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
                    <Alert className="border-yellow-600 bg-yellow-600/10">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-600">
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

              {/* Suppliers Preview */}
              {parseResult.suppliers.length > 0 && (
                <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Proveedores Encontrados ({parseResult.suppliers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {parseResult.suppliers.map((supplier, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={selectedSuppliers.has(supplier.rut)}
                              onCheckedChange={() => toggleSupplierSelection(supplier.rut)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground font-medium truncate">{supplier.name}</p>
                              <p className="text-sm text-muted-foreground">{supplier.rut}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Select
                              value={supplierCategoryMapping[supplier.rut] || supplier.category}
                              onValueChange={value => handleCategoryChange(supplier.rut, value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeCategories?.map(category => (
                                  <SelectItem key={category.id} value={category.name}>
                                    {getCategoryLabel(activeCategories, category.name)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Subcategory Select */}
                            {(() => {
                              const catName = supplierCategoryMapping[supplier.rut] || supplier.category;
                              const catObj = activeCategories?.find(c => c.name === catName);
                              if (!catObj) return null;
                              return (
                                <CostSubcategorySelect
                                  categoryId={catObj.id}
                                  value={supplierSubcategoryMapping[supplier.rut] || ''}
                                  onValueChange={(val) => handleSubcategoryChange(supplier.rut, val)}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents Preview */}
              {parseResult.documents.length > 0 && (
                <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Documentos Encontrados ({parseResult.documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {parseResult.documents.map((document, index) => {
                        const defaultDueDate =
                          dueDateOverrides[document.folio] ||
                          document.due_date ||
                          (() => {
                            const date = safeParseDateOnly(document.issue_date || format(new Date(), 'yyyy-MM-dd'));
                            date.setDate(date.getDate() + defaultDaysToAdd);
                            return format(date, 'yyyy-MM-dd');
                          })();

                        const duplicateInfo = getDuplicateInfoByFolio(document.folio);
                        const isDuplicate = !!duplicateInfo;

                        const costsForDoc = matchedCosts[document.folio] || [];
                        const hasMatches = costsForDoc.length > 0;
                        const currentDecision = linkDecisions[document.folio] || 'new';

                        return (
                          <div
                            key={index}
                            className={cn(
                              'flex flex-col p-3 rounded gap-2',
                              hasMatches && currentDecision !== 'new'
                                ? 'bg-blue-50 border border-blue-200'
                                : isDuplicate && (duplicateInfo.matchType === 'exact' || duplicateInfo.matchType === 'folio')
                                ? 'bg-red-50 border border-red-200'
                                : isDuplicate && duplicateInfo.matchType === 'similar'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : 'bg-muted/50'
                            )}
                          >
                            {/* Matched cost selector */}
                            {hasMatches && (
                              <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-800">
                                <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">🔗 Costo encontrado:</span>
                                <Select
                                  value={currentDecision}
                                  onValueChange={(val) =>
                                    setLinkDecisions(prev => ({ ...prev, [document.folio]: val }))
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
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
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

                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <Checkbox
                                  checked={selectedDocuments.has(document.folio)}
                                  onCheckedChange={() => toggleDocumentSelection(document.folio)}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-foreground font-medium truncate">{document.description}</p>
                                  <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap">
                                    <span>Folio: {document.folio}</span>
                                    <span>Total: ${document.total_amount.toLocaleString('es-CL')}</span>
                                    {document.issue_date && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Emisión: {document.issue_date}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Payment term & due date */}
                              <div className="flex flex-wrap items-end gap-4 pt-3 border-t">
                                <div className="flex-1 min-w-[180px] max-w-[220px]">
                                  <Label className="text-xs text-muted-foreground mb-1.5 block">Condición de Pago</Label>
                                  <Select
                                    value={paymentTermId}
                                    onValueChange={(id) => {
                                      setPaymentTermId(id);
                                      if (id !== 'none') {
                                        const term = paymentTerms.find(t => t.id === id);
                                        if (term && document.issue_date) {
                                          const issueDate = safeParseDateOnly(document.issue_date);
                                          const newDate = format(addDays(issueDate, term.days), 'yyyy-MM-dd');
                                          setDueDateOverrides(prev => ({ ...prev, [document.folio]: newDate }));
                                        }
                                      }
                                    }}
                                    disabled={loadingTerms}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Sin condición (manual)'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sin condición (manual)</SelectItem>
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
                                    onChange={(date) =>
                                      setDueDateOverrides(prev => ({ ...prev, [document.folio]: date }))
                                    }
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
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={reset} disabled={isUploading}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadCosts}
                  disabled={isUploading || selectedDocuments.size === 0}
                  className="bg-tms-green hover:bg-tms-green/80"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Cargar {selectedDocuments.size} Gastos
                </Button>
              </div>
            </div>
          )}
        </div>

        <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
      </DialogContent>
    </Dialog>
  );
};
