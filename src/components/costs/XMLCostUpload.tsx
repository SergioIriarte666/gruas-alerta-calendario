import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import DatePickerInput from '@/components/common/DatePickerInput';
import XMLPaymentConfig from '@/components/common/XMLPaymentConfig';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { 
  Upload, 
  FileX,
  CheckCircle, 
  AlertTriangle,
  AlertCircle,
  FileText,
  Loader2,
  Code,
  Database,
  Calendar,
  DollarSign,
  Wand2,
  Pencil,
  CreditCard,
  Banknote,
  ShieldAlert,
  Info,
  Package
} from 'lucide-react';
import { XMLCostParser } from '@/utils/xmlParser/xmlCostParser';
import { XMLCostData, XMLParseResult } from '@/types/costs';
import { useAddCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostDuplicateCheck, CostDuplicateResult } from '@/hooks/useDuplicateCheck';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { toast } from 'sonner';
import { format, parse, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface XMLCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLCostUpload = ({ isOpen, onClose, onSuccess }: XMLCostUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLParseResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryMappings, setCategoryMappings] = useState<{ [key: string]: string }>({});
  
  // Nuevos estados para edición
  const [editedData, setEditedData] = useState<{ [key: number]: Partial<XMLCostData> }>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [bulkDate, setBulkDate] = useState<string>('');
  const [bulkAmountAdjustment, setBulkAmountAdjustment] = useState<string>('');
  const [showAllRows, setShowAllRows] = useState(false);
  
  // Estados para condiciones de pago (tipo Facturas)
  const [paymentTermId, setPaymentTermId] = useState<string>('none');
  const [bulkDueDate, setBulkDueDate] = useState<string>('');
  const [paymentDateOverrides, setPaymentDateOverrides] = useState<Record<number, string>>({});
  
  // Estado para duplicados
  const [duplicateResults, setDuplicateResults] = useState<CostDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  
  // Estado para sincronización con inventario
  const [syncToInventory, setSyncToInventory] = useState(false);
  
  const batchProgress = useBatchProgress();
  
  const { mutate: addCost } = useAddCost();
  const { data: categories = [] } = useCostCategories();
  const { checkDuplicates } = useCostDuplicateCheck();
  const { paymentTerms, loading: loadingTerms } = usePaymentTerms();
  const parser = new XMLCostParser();

  // Validación mejorada de archivos XML
  const isValidXMLFile = useCallback((file: File): boolean => {
    return file.type === 'text/xml' || 
           file.type === 'application/xml' || 
           file.name.toLowerCase().endsWith('.xml');
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && isValidXMLFile(selectedFile)) {
      setFile(selectedFile);
      setParseResult(null);
      setEditedData({});
      setSelectedRows(new Set());
    } else {
      toast.error('Por favor seleccione un archivo XML válido');
    }
  }, [isValidXMLFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && isValidXMLFile(droppedFile)) {
      setFile(droppedFile);
      setParseResult(null);
      setEditedData({});
      setSelectedRows(new Set());
    } else {
      toast.error('Por favor seleccione un archivo XML válido');
    }
  }, [isValidXMLFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleAnalyzeFile = async () => {
    if (!file) return;
    
    try {
      const result = await parser.parseXMLFile(file);
      setParseResult(result);
      
      // Auto-seleccionar todas las filas válidas
      if (result.success && result.data.length > 0) {
        const allIndices = new Set(result.data.map((_, i) => i));
        setSelectedRows(allIndices);
        toast.success(`XML analizado: ${result.validRows} gastos encontrados. Verificando duplicados...`);
        
        // Verificar duplicados automáticamente
        setIsCheckingDuplicates(true);
        try {
          const itemsToCheck = result.data.map(item => ({
            date: typeof item.fecha === 'string' ? item.fecha : format(item.fecha, 'yyyy-MM-dd'),
            amount: item.monto,
            description: item.descripcion,
            folio: item.numeroFactura || undefined
          }));
          
          const duplicates = await checkDuplicates(itemsToCheck);
          setDuplicateResults(duplicates);
          
          // Auto-deseleccionar duplicados exactos
          if (duplicates.length > 0) {
            const exactDuplicates = duplicates.filter(d => d.matchType === 'exact');
            if (exactDuplicates.length > 0) {
              const newSelection = new Set(allIndices);
              exactDuplicates.forEach(d => newSelection.delete(d.index));
              setSelectedRows(newSelection);
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
      } else {
        toast.error(`Error analizando XML: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      toast.error('Error procesando el archivo XML');
      console.error('XML parsing error:', error);
    }
  };

  // Función para obtener valor editado o original
  const getEditedValue = <K extends keyof XMLCostData>(
    index: number, 
    field: K, 
    original: XMLCostData[K]
  ): XMLCostData[K] => {
    return (editedData[index]?.[field] ?? original) as XMLCostData[K];
  };

  // Verificar si un campo fue modificado
  const isFieldModified = (index: number, field: keyof XMLCostData): boolean => {
    return editedData[index]?.[field] !== undefined;
  };

  // Función para editar campo individual
  const handleFieldChange = (
    index: number, 
    field: keyof XMLCostData, 
    value: string | number | Date
  ) => {
    setEditedData(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  // Función para seleccionar/deseleccionar fila
  const toggleRowSelection = (index: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Función para seleccionar/deseleccionar todas
  const toggleAllSelection = () => {
    if (!parseResult) return;
    
    if (selectedRows.size === parseResult.data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(parseResult.data.map((_, i) => i)));
    }
  };

  // Aplicar fecha masiva
  const handleBulkDateChange = () => {
    if (!bulkDate || selectedRows.size === 0) return;
    
    const updates: { [key: number]: Partial<XMLCostData> } = {};
    selectedRows.forEach(index => {
      updates[index] = {
        ...editedData[index],
        fecha: bulkDate
      };
    });
    
    setEditedData(prev => ({ ...prev, ...updates }));
    toast.success(`Fecha actualizada en ${selectedRows.size} registros`);
  };

  // Aplicar ajuste de monto masivo
  const handleBulkAmountAdjustment = () => {
    const adjustment = parseFloat(bulkAmountAdjustment);
    if (isNaN(adjustment) || adjustment === 0 || selectedRows.size === 0 || !parseResult) return;
    
    const updates: { [key: number]: Partial<XMLCostData> } = {};
    selectedRows.forEach(index => {
      const original = parseResult.data[index];
      const currentAmount = getEditedValue(index, 'monto', original.monto);
      const newAmount = currentAmount * (1 + adjustment / 100);
      
      updates[index] = {
        ...editedData[index],
        monto: Math.round(newAmount)
      };
    });
    
    setEditedData(prev => ({ ...prev, ...updates }));
    toast.success(`Monto ajustado ${adjustment > 0 ? '+' : ''}${adjustment}% en ${selectedRows.size} registros`);
    setBulkAmountAdjustment('');
  };

  // Calcular fecha de vencimiento según condición de pago
  const getPaymentDate = (index: number, emissionDate: string): string => {
    // Si hay override individual, usarlo
    if (paymentDateOverrides?.[index]) {
      return paymentDateOverrides[index];
    }
    
    // Si hay un término de pago seleccionado, calcular emisión + días
    if (paymentTermId && paymentTermId !== 'none') {
      const term = paymentTerms.find(t => t.id === paymentTermId);
      if (term) {
        const date = new Date(emissionDate);
        return format(addDays(date, term.days), 'yyyy-MM-dd');
      }
    }
    
    // Default: emisión + 30 días
    const date = new Date(emissionDate);
    return format(addDays(date, 30), 'yyyy-MM-dd');
  };

  // Aplicar configuración de pago masiva
  const handleApplyPaymentToAll = () => {
    if (selectedRows.size === 0 || !parseResult) return;

    const updates: Record<number, string> = {};
    selectedRows.forEach(index => {
      const item = parseResult.data[index];
      if (!item) return;
      const emissionDateStr = formatDateForInput(editedData[index]?.fecha ?? item.fecha);
      updates[index] = getPaymentDate(index, emissionDateStr);
    });
    setPaymentDateOverrides(prev => ({ ...prev, ...updates }));
    toast.success(`Fecha de vencimiento aplicada a ${selectedRows.size} registros`);
  };

  const getDefaultCategoryId = (categoria?: string): string => {
    if (!categoria) return categories[0]?.id || '';
    
    const normalizedCategory = categoria.toLowerCase();
    
    if (normalizedCategory.includes('combustible') || normalizedCategory.includes('gasolina')) {
      return categories.find(c => c.name.toLowerCase().includes('combustible'))?.id || categories[0]?.id || '';
    }
    
    if (normalizedCategory.includes('mantenimiento') || normalizedCategory.includes('reparacion')) {
      return categories.find(c => c.name.toLowerCase().includes('mantenimiento'))?.id || categories[0]?.id || '';
    }
    
    if (normalizedCategory.includes('administrativo') || normalizedCategory.includes('oficina')) {
      return categories.find(c => c.name.toLowerCase().includes('administrativo'))?.id || categories[0]?.id || '';
    }
    
    return categories[0]?.id || '';
  };

  // Convertir fecha a formato yyyy-MM-dd
  const formatDateForInput = (fecha: string | Date): string => {
    if (typeof fecha === 'string') {
      // Si ya está en formato yyyy-MM-dd, devolverlo
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return fecha;
      }
      // Intentar parsear
      try {
        const date = new Date(fecha);
        return format(date, 'yyyy-MM-dd');
      } catch {
        return fecha;
      }
    }
    return format(fecha, 'yyyy-MM-dd');
  };

  // Función para buscar proveedor por RUT o nombre
  const findSupplierByRutOrName = async (rut: string, name: string): Promise<string | null> => {
    // Buscar en inventory_suppliers (fuente única de verdad)
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
    if (!parseResult || !parseResult.success || selectedRows.size === 0) return;
    
    setIsUploading(true);
    batchProgress.start('Cargando Gastos desde XML', selectedRows.size);
    
    let successCount = 0;
    let errorCount = 0;
    const selectedIndices = Array.from(selectedRows).sort((a, b) => a - b);

    try {
      for (let i = 0; i < selectedIndices.length; i++) {
        const index = selectedIndices[i];
        const xmlCost = parseResult.data[index];
        const edited = editedData[index] || {};
        
        // Usar valores editados o originales
        const finalDate = edited.fecha ?? xmlCost.fecha;
        const finalMonto = edited.monto ?? xmlCost.monto;
        const finalDescripcion = edited.descripcion ?? xmlCost.descripcion;
        const finalProveedor = edited.proveedor ?? xmlCost.proveedor;
        
        batchProgress.update(i + 1, String(finalDescripcion).substring(0, 40));
        
        const categoryId = categoryMappings[`${index}-categoria`] || getDefaultCategoryId(xmlCost.categoria);
        
        const emissionDateStr = typeof finalDate === 'string' ? finalDate : format(finalDate, 'yyyy-MM-dd');
        const paymentDate = getPaymentDate(index, emissionDateStr);
        
        // NUEVO: Buscar proveedor por RUT o nombre para vincular
        const supplierId = await findSupplierByRutOrName(xmlCost.rut || '', finalProveedor || '');
        
        const costData = {
          date: emissionDateStr,
          description: String(finalDescripcion),
          amount: Number(finalMonto),
          category_id: categoryId,
          subcategory: xmlCost.subcategoria || null,
          notes: [
            finalProveedor ? `Proveedor: ${finalProveedor}` : '',
            xmlCost.numeroFactura ? `Factura: ${xmlCost.numeroFactura}` : '',
            xmlCost.rut ? `RUT: ${xmlCost.rut}` : '',
            xmlCost.telefono ? `Tel: ${xmlCost.telefono}` : '',
            xmlCost.notas || ''
          ].filter(Boolean).join(' | ') || null,
          service_folio: xmlCost.numeroFactura || null,
          payment_date: paymentDate,
          // NUEVO: Vinculación con proveedor para trigger de sincronización
          supplier_id: supplierId,
          // NUEVO: Datos para sincronización con inventario (si está habilitado)
          ...(syncToInventory && {
            purchase_quantity: xmlCost.cantidad || 1,
            purchase_unit_cost: Number(finalMonto) / (xmlCost.cantidad || 1),
            immediate_consumption: false
          })
        };

        await new Promise<void>((resolve) => {
          addCost(costData, {
            onSuccess: () => {
              successCount++;
              resolve();
            },
            onError: (error) => {
              console.error(`Error cargando gasto ${index + 1}:`, error);
              errorCount++;
              resolve();
            }
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
        batchProgress.error(`${errorCount} de ${selectedRows.size} con error`);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      batchProgress.error('Error durante la carga');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    setCategoryMappings(prev => ({
      ...prev,
      [`${index}-categoria`]: categoryId
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const reset = () => {
    setFile(null);
    setParseResult(null);
    setCategoryMappings({});
    setEditedData({});
    setSelectedRows(new Set());
    setBulkDate('');
    setBulkAmountAdjustment('');
    setShowAllRows(false);
    setPaymentTermId('none');
    setBulkDueDate('');
    setPaymentDateOverrides({});
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setSyncToInventory(false);
  };
  
  // Helper para obtener info de duplicado por índice
  const getDuplicateInfo = (index: number): CostDuplicateResult | undefined => {
    return duplicateResults.find(d => d.index === index);
  };

  // Calcular datos visibles
  const visibleData = useMemo(() => {
    if (!parseResult) return [];
    return showAllRows ? parseResult.data : parseResult.data.slice(0, 20);
  }, [parseResult, showAllRows]);

  // Calcular total de seleccionados
  const selectedTotal = useMemo(() => {
    if (!parseResult) return 0;
    return Array.from(selectedRows).reduce((sum, index) => {
      const original = parseResult.data[index];
      if (!original) return sum;
      return sum + (getEditedValue(index, 'monto', original.monto) as number);
    }, 0);
  }, [parseResult, selectedRows, editedData]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-tms-green" />
            Cargar Gastos desde XML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info del sistema */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <FileX className="w-4 h-4" />
                <span>Soporta XML de facturas electrónicas (DTE), reportes de gastos y formatos personalizados. Los campos son editables antes de importar.</span>
              </div>
            </CardContent>
          </Card>

          {/* Upload Area */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="w-5 h-5" />
                Seleccionar Archivo XML
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-tms-green transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('xml-upload')?.click()}
              >
                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-3">
                  Arrastra tu archivo XML aquí o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="xml-upload"
                />
                <Button variant="outline" size="sm">
                  Seleccionar XML
                </Button>
              </div>

              {file && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-tms-green" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-gray-500 text-sm">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAnalyzeFile} disabled={!file} size="sm">
                        <Code className="w-4 h-4 mr-2" />
                        Analizar XML
                      </Button>
                      <Button variant="outline" onClick={reset} size="sm">
                        Limpiar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parse Results */}
          {parseResult && (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-blue-600">Total</p>
                        <p className="text-lg font-bold">{parseResult.totalRows}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-xs text-green-600">Válidos</p>
                        <p className="text-lg font-bold">{parseResult.validRows}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-violet-50 border-violet-200">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-violet-500" />
                      <div>
                        <p className="text-xs text-violet-600">Seleccionados</p>
                        <p className="text-lg font-bold">{selectedRows.size}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-amber-600">Total Selec.</p>
                        <p className="text-lg font-bold">${selectedTotal.toLocaleString('es-CL')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Errors and Warnings */}
              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                <div className="space-y-2">
                  {parseResult.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-2">Errores:</h4>
                      {parseResult.errors.map((error, idx) => (
                        <p key={idx} className="text-sm text-red-700">• {error}</p>
                      ))}
                    </div>
                  )}
                  
                  {parseResult.warnings.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">Advertencias:</h4>
                      {parseResult.warnings.slice(0, 5).map((warning, idx) => (
                        <p key={idx} className="text-sm text-yellow-700">• {warning}</p>
                      ))}
                      {parseResult.warnings.length > 5 && (
                        <p className="text-sm text-yellow-600">... y {parseResult.warnings.length - 5} más</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Warning Banner */}
              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert variant="destructive" className="border-amber-300 bg-amber-50">
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

              {parseResult.data.length > 0 && (
                <Card className="border-violet-200 bg-violet-50/50">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-violet-600" />
                      Acciones Masivas ({selectedRows.size} seleccionados)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Ajuste de fecha */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-muted-foreground w-28">Cambiar fecha:</span>
                      <DatePickerInput
                        value={bulkDate}
                        onChange={setBulkDate}
                        placeholder="Nueva fecha"
                        className="w-40"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleBulkDateChange}
                        disabled={!bulkDate || selectedRows.size === 0}
                      >
                        Aplicar a seleccionados
                      </Button>
                    </div>
                    
                    {/* Ajuste de monto */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-muted-foreground w-28">Ajustar montos:</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={bulkAmountAdjustment}
                          onChange={(e) => setBulkAmountAdjustment(e.target.value)}
                          placeholder="+/- %"
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleBulkAmountAdjustment}
                        disabled={!bulkAmountAdjustment || parseFloat(bulkAmountAdjustment) === 0 || selectedRows.size === 0}
                      >
                        Aplicar ajuste
                      </Button>
                    </div>

                    {/* Separador */}
                    <div className="border-t pt-3 mt-3">
                      <XMLPaymentConfig
                        paymentType={paymentType}
                        onPaymentTypeChange={setPaymentType}
                        creditDays={creditDays}
                        onCreditDaysChange={setCreditDays}
                        paidDate={bulkPaymentDate}
                        onPaidDateChange={setBulkPaymentDate}
                        onApplyToAll={handleApplyPaymentToAll}
                        selectedCount={selectedRows.size}
                        idPrefix="cost-payment"
                      />
                    </div>

                    {/* Sincronización con Inventario */}
                    <div className="border-t pt-3 mt-3">
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
                        <p className="text-xs text-green-600 mt-2 ml-8">
                          ✓ Los costos se sincronizarán con el módulo de Bodega
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Editable Preview Table */}
              {parseResult.data.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Pencil className="w-4 h-4" />
                        Vista Previa Editable
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={toggleAllSelection}
                          className="text-xs"
                        >
                          {selectedRows.size === parseResult.data.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </Button>
                        {parseResult.data.length > 20 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllRows(!showAllRows)}
                            className="text-xs"
                          >
                            {showAllRows ? `Mostrar primeros 20` : `Ver todos (${parseResult.data.length})`}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Cards View */}
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {visibleData.map((item, idx) => {
                        const actualIndex = parseResult.data.indexOf(item);
                        const isSelected = selectedRows.has(actualIndex);
                        const editedFecha = getEditedValue(actualIndex, 'fecha', item.fecha);
                        const editedMonto = getEditedValue(actualIndex, 'monto', item.monto);
                        const editedDescripcion = getEditedValue(actualIndex, 'descripcion', item.descripcion);
                        const editedProveedor = getEditedValue(actualIndex, 'proveedor', item.proveedor);
                        const emissionDateStr = formatDateForInput(editedFecha);
                        const computedPaymentDate = paymentDateOverrides[actualIndex] || getPaymentDate(actualIndex, emissionDateStr);
                        const isImmediate = computedPaymentDate === emissionDateStr;
                        
                        const isModified = isFieldModified(actualIndex, 'fecha') || 
                          isFieldModified(actualIndex, 'descripcion') || 
                          isFieldModified(actualIndex, 'monto') ||
                          isFieldModified(actualIndex, 'proveedor') ||
                          paymentDateOverrides[actualIndex];
                        
                        // Obtener info de duplicado
                        const duplicateInfo = getDuplicateInfo(actualIndex);
                        const isDuplicate = !!duplicateInfo;
                        
                        return (
                          <div 
                            key={actualIndex} 
                            className={cn(
                              "border rounded-lg transition-all",
                              isDuplicate && duplicateInfo.matchType === 'exact'
                                ? "border-red-300 bg-red-50/30"
                                : isDuplicate && duplicateInfo.matchType === 'folio'
                                ? "border-orange-300 bg-orange-50/30"
                                : isDuplicate && duplicateInfo.matchType === 'similar'
                                ? "border-yellow-300 bg-yellow-50/30"
                                : isSelected 
                                ? "border-violet-300 bg-violet-50/30" 
                                : "border-gray-200 bg-white"
                            )}
                          >
                            {/* Card Header */}
                            <div className={cn(
                              "flex items-center justify-between p-3 border-b rounded-t-lg",
                              isDuplicate && duplicateInfo.matchType === 'exact'
                                ? "bg-red-50"
                                : isDuplicate && duplicateInfo.matchType === 'folio'
                                ? "bg-orange-50"
                                : isDuplicate && duplicateInfo.matchType === 'similar'
                                ? "bg-yellow-50"
                                : "bg-gray-50/50"
                            )}>
                              <div className="flex items-center gap-3">
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleRowSelection(actualIndex)}
                                />
                                <span className="text-sm font-medium text-gray-600">
                                  Registro {actualIndex + 1} de {parseResult.data.length}
                                </span>
                                {isDuplicate && (
                                  <Badge 
                                    variant={duplicateInfo.matchType === 'exact' ? 'destructive' : 'secondary'}
                                    className={cn(
                                      "text-xs",
                                      duplicateInfo.matchType === 'folio' && "bg-orange-100 text-orange-800",
                                      duplicateInfo.matchType === 'similar' && "bg-yellow-100 text-yellow-800"
                                    )}
                                  >
                                    {duplicateInfo.matchType === 'exact' && '⚠️ Duplicado Exacto'}
                                    {duplicateInfo.matchType === 'folio' && '📄 Folio Existente'}
                                    {duplicateInfo.matchType === 'similar' && '🔍 Similar'}
                                  </Badge>
                                )}
                                {isModified && !isDuplicate && (
                                  <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs">
                                    Editado
                                  </Badge>
                                )}
                              </div>
                              <Badge className="bg-green-100 text-green-800 font-semibold">
                                ${Number(editedMonto).toLocaleString('es-CL')}
                              </Badge>
                            </div>
                            
                            {/* Duplicate Alert */}
                            {isDuplicate && duplicateInfo.existingCost && (
                              <div className={cn(
                                "px-4 py-2 text-sm border-b",
                                duplicateInfo.matchType === 'exact' ? "bg-red-100 text-red-800" :
                                duplicateInfo.matchType === 'folio' ? "bg-orange-100 text-orange-800" :
                                "bg-yellow-100 text-yellow-800"
                              )}>
                                <strong>
                                  {duplicateInfo.matchType === 'exact' && 'Ya existe un gasto idéntico:'}
                                  {duplicateInfo.matchType === 'folio' && 'Factura ya registrada:'}
                                  {duplicateInfo.matchType === 'similar' && 'Gasto similar encontrado:'}
                                </strong>
                                <span className="ml-2">
                                  {format(new Date(duplicateInfo.existingCost.date), 'dd/MM/yyyy')} - 
                                  ${duplicateInfo.existingCost.amount.toLocaleString('es-CL')} - 
                                  "{duplicateInfo.existingCost.description.substring(0, 50)}..."
                                </span>
                              </div>
                            )}
                            
                            {/* Card Body */}
                            <div className="p-4 space-y-4">
                              {/* Descripción - Ancho completo */}
                              <div>
                                <Label className="text-xs text-gray-500 mb-1.5 block">Descripción</Label>
                                <Textarea
                                  value={String(editedDescripcion)}
                                  onChange={(e) => handleFieldChange(actualIndex, 'descripcion', e.target.value)}
                                  className="w-full resize-none"
                                  rows={2}
                                />
                              </div>
                              
                              {/* Proveedor - Ancho completo */}
                              <div>
                                <Label className="text-xs text-gray-500 mb-1.5 block">Proveedor</Label>
                                <Input
                                  value={String(editedProveedor || '')}
                                  onChange={(e) => handleFieldChange(actualIndex, 'proveedor', e.target.value)}
                                  placeholder="Sin proveedor"
                                  className="w-full"
                                />
                              </div>
                              
                              {/* Grid: Fecha Emisión | Categoría | Monto */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                  <Label className="text-xs text-gray-500 mb-1.5 block">Fecha Emisión</Label>
                                  <DatePickerInput
                                    value={formatDateForInput(editedFecha)}
                                    onChange={(date) => handleFieldChange(actualIndex, 'fecha', date)}
                                    className="w-full"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500 mb-1.5 block">Categoría</Label>
                                  <Select
                                    value={categoryMappings[`${actualIndex}-categoria`] || getDefaultCategoryId(item.categoria)}
                                    onValueChange={(value) => handleCategoryChange(actualIndex, value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>
                                          {category.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500 mb-1.5 block">Monto</Label>
                                  <Input
                                    type="number"
                                    value={editedMonto}
                                    onChange={(e) => handleFieldChange(actualIndex, 'monto', parseFloat(e.target.value) || 0)}
                                    className="w-full"
                                  />
                                </div>
                              </div>
                              
                              {/* Fecha de Pago */}
                              <div className="flex flex-wrap items-end gap-4 pt-3 border-t">
                                <div className="flex-1 min-w-[180px] max-w-[220px]">
                                  <Label className="text-xs text-gray-500 mb-1.5 block">Fecha de Pago</Label>
                                  <DatePickerInput
                                    value={computedPaymentDate || ''}
                                    onChange={(date) => setPaymentDateOverrides(prev => ({...prev, [actualIndex]: date}))}
                                    className="w-full"
                                  />
                                </div>
                                {isImmediate && (
                                  <div className="flex items-center gap-1.5 text-green-600 text-sm pb-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Pago inmediato</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!showAllRows && parseResult.data.length > 20 && (
                      <p className="text-sm text-muted-foreground mt-3 text-center">
                        Mostrando 20 de {parseResult.data.length} registros - 
                        <button 
                          onClick={() => setShowAllRows(true)}
                          className="text-violet-600 hover:underline ml-1"
                        >
                          Ver todos
                        </button>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              {parseResult.success && parseResult.validRows > 0 && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    {Object.keys(editedData).length > 0 && (
                      <span className="text-violet-600">
                        {Object.keys(editedData).length} registros modificados
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleUploadCosts}
                      disabled={isUploading || selectedRows.size === 0}
                      className="bg-tms-green hover:bg-tms-green/80"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4 mr-2" />
                      )}
                      Cargar {selectedRows.size} Gastos
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <BatchProgressModal
          state={batchProgress.state}
          onClose={batchProgress.close}
        />
      </DialogContent>
    </Dialog>
  );
};
