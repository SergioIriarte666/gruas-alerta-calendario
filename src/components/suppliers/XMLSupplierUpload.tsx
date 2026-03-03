import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Building2,
  Users,
  Phone,
  Mail,
  ShieldAlert
} from 'lucide-react';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';
import { XMLSupplierData, XMLSupplierParseResult } from '@/types/suppliers';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCategories } from '@/hooks/useCostCategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { useSupplierDuplicateCheck, SupplierDuplicateResult } from '@/hooks/useDuplicateCheck';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface XMLSupplierUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLSupplierUpload = ({ isOpen, onClose, onSuccess }: XMLSupplierUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLSupplierParseResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categoryMappings, setCategoryMappings] = useState<{ [key: string]: string }>({});
  
  // Estado para duplicados
  const [duplicateResults, setDuplicateResults] = useState<SupplierDuplicateResult[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<number>>(new Set());
  
  const { createSupplier } = useSuppliers();
  const { data: costCategoriesData = [] } = useCostCategories();
  const activeCategories = costCategoriesData.map(c => ({ id: c.id, label: c.name, name: c.name }));
  const { checkDuplicates } = useSupplierDuplicateCheck();
  const parser = new XMLSupplierParser();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/xml') {
      setFile(selectedFile);
      setParseResult(null);
    } else {
      toast.error('Por favor seleccione un archivo XML válido');
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/xml') {
      setFile(droppedFile);
      setParseResult(null);
    } else {
      toast.error('Por favor seleccione un archivo XML válido');
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleAnalyzeFile = async () => {
    if (!file) return;
    
    try {
      const result = await parser.parseXMLFile(file);
      setParseResult(result);
      
      if (result.success) {
        // Seleccionar todos por defecto
        const allIndices = new Set(result.data.map((_, i) => i));
        setSelectedSuppliers(allIndices);
        
        toast.success(`XML analizado: ${result.validRows} proveedores encontrados. Verificando duplicados...`);
        
        // Verificar duplicados
        setIsCheckingDuplicates(true);
        try {
          const itemsToCheck = result.data.map(supplier => ({
            rut: supplier.rut,
            name: supplier.name
          }));
          
          const duplicates = await checkDuplicates(itemsToCheck);
          setDuplicateResults(duplicates);
          
          // Auto-deseleccionar duplicados exactos por RUT
          if (duplicates.length > 0) {
            const exactDuplicates = duplicates.filter(d => d.matchType === 'exact_rut');
            if (exactDuplicates.length > 0) {
              const newSelection = new Set(allIndices);
              exactDuplicates.forEach(d => newSelection.delete(d.index));
              setSelectedSuppliers(newSelection);
              setShowDuplicateWarning(true);
              toast.warning(`Se detectaron ${duplicates.length} posibles duplicados. ${exactDuplicates.length} con RUT existente fueron deseleccionados.`);
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

  const handleUploadSuppliers = async () => {
    if (!parseResult || !parseResult.success || selectedSuppliers.size === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    let successCount = 0;
    const selectedIndices = Array.from(selectedSuppliers).sort((a, b) => a - b);
    const total = selectedIndices.length;

    try {
      for (let i = 0; i < selectedIndices.length; i++) {
        const index = selectedIndices[i];
        const xmlSupplier = parseResult.data[index];
        
        const category = categoryMappings[`${index}-category`] || xmlSupplier.category;
        
        const supplierData = {
          name: xmlSupplier.name,
          rut: xmlSupplier.rut,
          email: xmlSupplier.email || '',
          phone: xmlSupplier.phone || '',
          address: xmlSupplier.address || '',
          contact_name: xmlSupplier.contact_name || '',
          category: category,
          notes: xmlSupplier.notes || 'Importado desde XML',
          is_active: xmlSupplier.is_active
        };

        await new Promise<void>((resolve, reject) => {
          createSupplier(supplierData, {
            onSuccess: () => {
              successCount++;
              setUploadProgress(((i + 1) / total) * 100);
              resolve();
            },
            onError: (error) => {
              console.error(`Error creando proveedor ${i + 1}:`, error);
              setUploadProgress(((i + 1) / total) * 100);
              resolve(); // Continuar con el siguiente aunque falle
            }
          });
        });
        
        // Pequeña pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      toast.success(`Carga completada: ${successCount} de ${total} proveedores cargados correctamente`);
      onSuccess?.(successCount);
      onClose();
      
    } catch (error) {
      toast.error('Error durante la carga masiva');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleSupplierSelection = (index: number) => {
    setSelectedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (!parseResult) return;
    
    if (selectedSuppliers.size === parseResult.data.length) {
      setSelectedSuppliers(new Set());
    } else {
      setSelectedSuppliers(new Set(parseResult.data.map((_, i) => i)));
    }
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    setCategoryMappings(prev => ({
      ...prev,
      [`${index}-category`]: categoryId
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
    setUploadProgress(0);
    setDuplicateResults([]);
    setShowDuplicateWarning(false);
    setSelectedSuppliers(new Set());
  };
  
  // Helper para obtener info de duplicado por índice
  const getDuplicateInfo = (index: number): SupplierDuplicateResult | undefined => {
    return duplicateResults.find(d => d.index === index);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Importar Proveedores desde XML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info del sistema */}
          <Card className="border-blue-200/50 bg-blue-50/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <FileX className="w-4 h-4" />
                <span>Soporta facturas electrónicas (DTE), archivos XML de proveedores y formatos personalizados</span>
              </div>
            </CardContent>
          </Card>

          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Seleccionar Archivo XML
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('xml-supplier-upload')?.click()}
              >
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Arrastra tu archivo XML aquí o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="xml-supplier-upload"
                />
                <Button variant="outline">
                  Seleccionar XML
                </Button>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAnalyzeFile} disabled={!file}>
                        <Code className="w-4 h-4 mr-2" />
                        Analizar XML
                      </Button>
                      <Button variant="outline" onClick={reset}>
                        Limpiar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Progress */}
          {isUploading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Creando Proveedores...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Progreso de carga</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parse Results */}
          {parseResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {parseResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  Resultado del Análisis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-blue-600">Total Registros</p>
                        <p className="text-xl font-bold">{parseResult.totalRows}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-green-600">Válidos</p>
                        <p className="text-xl font-bold">{parseResult.validRows}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <div>
                        <p className="text-sm text-destructive">Errores</p>
                        <p className="text-xl font-bold">{parseResult.errors.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duplicate Warning Banner */}
                {duplicateResults.length > 0 && showDuplicateWarning && (
                  <Alert className="border-amber-300 bg-amber-50">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>⚠️ Se detectaron {duplicateResults.length} posibles proveedores duplicados.</strong>
                      <span className="ml-2">
                        {duplicateResults.filter(d => d.matchType === 'exact_rut').length > 0 && (
                          <Badge variant="destructive" className="mr-2">
                            {duplicateResults.filter(d => d.matchType === 'exact_rut').length} por RUT
                          </Badge>
                        )}
                        {duplicateResults.filter(d => d.matchType === 'exact_name' || d.matchType === 'similar_name').length > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            {duplicateResults.filter(d => d.matchType === 'exact_name' || d.matchType === 'similar_name').length} por nombre
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

                {/* Errors and Warnings */}
                {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                  <div className="space-y-2">
                    {parseResult.errors.length > 0 && (
                      <div className="p-3 bg-red-50/50 border border-red-200/50 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-2">Errores:</h4>
                        {parseResult.errors.map((error, idx) => (
                          <p key={idx} className="text-sm text-red-700">• {error}</p>
                        ))}
                      </div>
                    )}
                    
                    {parseResult.warnings.length > 0 && (
                      <div className="p-3 bg-yellow-50/50 border border-yellow-200/50 rounded-lg">
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

                {/* Preview Table */}
                {parseResult.data.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Vista Previa ({selectedSuppliers.size} de {parseResult.data.length} seleccionados)
                      </h4>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={toggleAllSelection}
                        className="text-xs"
                      >
                        {selectedSuppliers.size === parseResult.data.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {parseResult.data.map((supplier, index) => {
                        const duplicateInfo = getDuplicateInfo(index);
                        const isDuplicate = !!duplicateInfo;
                        const isSelected = selectedSuppliers.has(index);
                        
                        return (
                          <div 
                            key={index} 
                            className={cn(
                              "p-3 rounded-lg border",
                              isDuplicate && duplicateInfo.matchType === 'exact_rut'
                                ? "bg-red-50 border-red-200"
                                : isDuplicate
                                ? "bg-yellow-50 border-yellow-200"
                                : isSelected
                                ? "bg-violet-50 border-violet-200"
                                : "bg-muted/50 border-transparent"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSupplierSelection(index)}
                                  className="w-4 h-4 rounded border-gray-300"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium truncate">{supplier.name}</span>
                                    {isDuplicate && (
                                      <Badge 
                                        variant={duplicateInfo.matchType === 'exact_rut' ? 'destructive' : 'secondary'}
                                        className={cn(
                                          "text-xs flex-shrink-0",
                                          duplicateInfo.matchType !== 'exact_rut' && "bg-yellow-100 text-yellow-800"
                                        )}
                                      >
                                        {duplicateInfo.matchType === 'exact_rut' && '⚠️ RUT Existente'}
                                        {duplicateInfo.matchType === 'exact_name' && '📝 Nombre Igual'}
                                        {duplicateInfo.matchType === 'similar_name' && '🔍 Nombre Similar'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="font-mono">{supplier.rut || '-'}</span>
                                    {supplier.email && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {supplier.email}
                                      </span>
                                    )}
                                    {supplier.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {supplier.phone}
                                      </span>
                                    )}
                                  </div>
                                  {isDuplicate && duplicateInfo.existingSupplier && (
                                    <div className={cn(
                                      "text-xs mt-2 p-2 rounded",
                                      duplicateInfo.matchType === 'exact_rut' ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                                    )}>
                                      <strong>Ya existe:</strong> {duplicateInfo.existingSupplier.name} ({duplicateInfo.existingSupplier.rut})
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Select
                                value={categoryMappings[`${index}-category`] || supplier.category}
                                onValueChange={(value) => handleCategoryChange(index, value)}
                              >
                                <SelectTrigger className="w-40 flex-shrink-0">
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
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {parseResult.success && parseResult.validRows > 0 && (
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setParseResult(null)}
                      disabled={isUploading}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleUploadSuppliers}
                      disabled={isUploading || selectedSuppliers.size === 0}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Crear {selectedSuppliers.size} Proveedores
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};