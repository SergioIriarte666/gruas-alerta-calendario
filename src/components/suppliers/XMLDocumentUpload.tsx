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
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X, FileSpreadsheet, Users, Receipt, DollarSign, Calendar, Building, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { XMLCompleteParseResult, XMLDocumentData, XMLSupplierData, XMLSupplierPaymentData } from '@/types/suppliers';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { useSupplierPayments } from '@/hooks/useSupplierPayments';
import { toast } from 'sonner';
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
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [createPayments, setCreatePayments] = useState(true);
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const [defaultDaysToAdd, setDefaultDaysToAdd] = useState<number>(30);
  const {
    suppliers,
    createSupplier
  } = useSuppliers();
  const {
    createPayment
  } = useSupplierPayments();
  const { activeCategories } = useSupplierCategoryManager();
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
  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    const parser = new XMLSupplierParser();
    try {
      const result = await parser.parseXMLCompleteFile(selectedFile);
      setParseResult(result);

      // Pre-select all valid suppliers and documents
      const validSuppliers = new Set(result.suppliers.filter(s => s.name && s.rut).map(s => s.rut));
      const validDocuments = new Set(result.documents.filter(d => d.folio && d.total_amount > 0).map(d => d.folio));
      setSelectedSuppliers(validSuppliers);
      setSelectedDocuments(validDocuments);

      // Initialize category mapping
      const categoryMap: Record<string, string> = {};
      result.suppliers.forEach(supplier => {
        categoryMap[supplier.rut] = supplier.category;
      });
      setSupplierCategoryMapping(categoryMap);
      if (!result.success) {
        toast.error('Se encontraron errores en el archivo XML');
      } else {
        toast.success(`Análisis completado: ${result.totalSuppliers} proveedores, ${result.totalDocuments} documentos encontrados`);
      }
    } catch (error) {
      console.error('Error analyzing XML:', error);
      toast.error('Error al analizar el archivo XML');
    } finally {
      setIsAnalyzing(false);
    }
  };
  const handleUploadData = async () => {
    if (!parseResult) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const totalItems = selectedSuppliers.size + (createPayments ? selectedDocuments.size : 0);
      let processed = 0;

      // Create suppliers first
      const createdSupplierMap = new Map<string, string>();
      for (const supplier of parseResult.suppliers) {
        if (!selectedSuppliers.has(supplier.rut)) continue;
        try {
          // Check if supplier already exists
          const existingSupplier = suppliers.find(s => s.rut === supplier.rut);
          if (!existingSupplier) {
            await new Promise<void>((resolve, reject) => {
              createSupplier({
                ...supplier,
                category: supplierCategoryMapping[supplier.rut] || supplier.category
              }, {
                onSuccess: newSupplier => {
                  createdSupplierMap.set(supplier.rut, newSupplier.id);
                  resolve();
                },
                onError: reject
              });
            });
          } else {
            createdSupplierMap.set(supplier.rut, existingSupplier.id);
          }
          processed++;
          setUploadProgress(processed / totalItems * 100);
        } catch (error) {
          console.error(`Error creating supplier ${supplier.name}:`, error);
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
        for (const paymentData of paymentsData) {
          try {
            const supplierId = createdSupplierMap.get(paymentData.supplier_rut);
            if (!supplierId) continue;
            await new Promise<void>((resolve, reject) => {
              createPayment({
                supplier_id: supplierId,
                amount: paymentData.amount,
                due_date: paymentData.due_date,
                description: paymentData.description,
                category: paymentData.category,
                reference_number: paymentData.reference_number,
                notes: paymentData.notes,
                status: paymentData.status
              }, {
                onSuccess: () => resolve(),
                onError: reject
              });
            });
            processed++;
            setUploadProgress(processed / totalItems * 100);
          } catch (error) {
            console.error(`Error creating payment:`, error);
          }
        }
      }
      toast.success(`Importación completada: ${selectedSuppliers.size} proveedores${createPayments ? ` y ${selectedDocuments.size} pagos` : ''} procesados`);
      onSuccess();
      onClose();
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
    setSelectedSuppliers(new Set());
    setSelectedDocuments(new Set());
    setCreatePayments(true);
    setDueDateOverrides({});
    setDefaultDaysToAdd(30);
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
    const newOverrides: Record<string, string> = {};
    parseResult.documents.forEach(doc => {
      if (selectedDocuments.has(doc.folio) && doc.issue_date) {
        const issueDate = new Date(doc.issue_date);
        issueDate.setDate(issueDate.getDate() + defaultDaysToAdd);
        newOverrides[doc.folio] = format(issueDate, 'yyyy-MM-dd');
      }
    });
    setDueDateOverrides(newOverrides);
    toast.success(`Fechas de vencimiento actualizadas a ${defaultDaysToAdd} días desde emisión`);
  };
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card border suppliers-scope">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Documentos XML
          </DialogTitle>
          
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          {!selectedFile && <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted hover:border-border'}`}>
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo XML aquí'}
              </h3>
              <p className="text-muted-foreground mb-4">
                o haz clic para seleccionar un archivo
              </p>
              <Button variant="outline" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xml';
            input.onchange = handleFileSelect;
            input.click();
          }}>
                Seleccionar Archivo
              </Button>
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
                        <p className="text-xl font-bold text-foreground">
                          {parseResult.errors.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Montos</p>
                        <p className="text-xl font-bold text-foreground">
                          ${parseResult.documents.filter(d => selectedDocuments.has(d.folio)).reduce((sum, d) => sum + d.total_amount, 0).toLocaleString()}
                        </p>
                      </div>
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
                  
                  {createPayments && parseResult.documents.length > 0 && (
                    <div className="space-y-3 pt-3 border-t">
                      <h4 className="text-sm font-medium text-foreground">Configuración de Fechas de Vencimiento</h4>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="text-sm text-muted-foreground mb-1 block">
                            Días hasta vencimiento por defecto
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="365"
                            value={defaultDaysToAdd}
                            onChange={(e) => setDefaultDaysToAdd(parseInt(e.target.value) || 30)}
                            className="w-32"
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={applyDefaultDaysToAll}
                          disabled={selectedDocuments.size === 0}
                        >
                          Aplicar a todos los documentos
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Las fechas de vencimiento se calcularán desde la fecha de emisión de cada documento. 
                        También puedes editarlas individualmente en la lista de documentos.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Errors and Warnings */}
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
                          <div className="flex items-center space-x-2">
                            <Select value={supplierCategoryMapping[supplier.rut] || supplier.category} onValueChange={value => handleCategoryChange(supplier.rut, value)}>
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeCategories?.map(category => <SelectItem key={category.id} value={category.name}>
                                    {getCategoryLabel(activeCategories, category.name)}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
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
                            const date = new Date(document.issue_date || new Date());
                            date.setDate(date.getDate() + defaultDaysToAdd);
                            return format(date, 'yyyy-MM-dd');
                          })();
                        const hasCustomDate = !!dueDateOverrides[document.folio];
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded gap-3">
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
                                <p className="text-foreground font-medium truncate">{document.description}</p>
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
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "justify-start text-left font-normal min-w-[200px]",
                                      !defaultDueDate && "text-muted-foreground"
                                    )}
                                    size="sm"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {defaultDueDate ? (
                                      <span className="flex items-center gap-2">
                                        {format(new Date(defaultDueDate), 'dd/MM/yyyy')}
                                        {hasCustomDate && (
                                          <Badge variant="secondary" className="text-xs">
                                            Personalizada
                                          </Badge>
                                        )}
                                      </span>
                                    ) : (
                                      <span>Seleccionar fecha</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <CalendarComponent
                                    mode="single"
                                    selected={defaultDueDate ? new Date(defaultDueDate) : undefined}
                                    onSelect={(date) => handleDueDateChange(document.folio, date)}
                                    disabled={(date) => {
                                      if (!document.issue_date) return false;
                                      return date < new Date(document.issue_date);
                                    }}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                              
                              <Badge variant="outline" className="whitespace-nowrap">
                                {document.document_type}
                              </Badge>
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