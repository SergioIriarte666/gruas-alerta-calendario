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
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X, FileSpreadsheet, Users, Receipt, DollarSign, Calendar, Building } from 'lucide-react';
import { XMLCompleteParseResult, XMLDocumentData, XMLSupplierData, XMLSupplierPaymentData, SupplierCategory } from '@/types/suppliers';
import { useSuppliers, useSupplierCategories, getCategoryLabel } from '@/hooks/useSuppliers';
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
  const [supplierCategoryMapping, setSupplierCategoryMapping] = useState<Record<string, SupplierCategory>>({});
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [createPayments, setCreatePayments] = useState(true);
  const {
    suppliers,
    createSupplier
  } = useSuppliers();
  const {
    createPayment
  } = useSupplierPayments();
  const categories = useSupplierCategories();
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
      const categoryMap: Record<string, SupplierCategory> = {};
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
        const paymentsData = parser.convertDocumentsToPayments(parseResult.documents.filter(d => selectedDocuments.has(d.folio)), parseResult.suppliers);
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
  const handleCategoryChange = (supplierRut: string, category: SupplierCategory) => {
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
  };
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Documentos XML
          </DialogTitle>
          
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          {!selectedFile && <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-400 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo XML aquí'}
              </h3>
              <p className="text-gray-400 mb-4">
                o haz clic para seleccionar un archivo
              </p>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:text-white" onClick={() => {
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
          {selectedFile && !parseResult && <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-400">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleAnalyzeFile} disabled={isAnalyzing} className="bg-blue-600 hover:bg-blue-700">
                      {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      Analizar XML
                    </Button>
                    <Button variant="outline" onClick={reset} className="border-gray-600 text-gray-300 hover:text-white">
                      <X className="h-4 w-4 mr-2" />
                      Quitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>}

          {/* Upload Progress */}
          {isUploading && <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
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
                <Card className="bg-gray-700 border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="text-sm text-gray-400">Proveedores</p>
                        <p className="text-xl font-bold text-white">
                          {parseResult.validSuppliers}/{parseResult.totalSuppliers}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-700 border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Receipt className="h-5 w-5 text-green-400" />
                      <div>
                        <p className="text-sm text-gray-400">Documentos</p>
                        <p className="text-xl font-bold text-white">
                          {parseResult.validDocuments}/{parseResult.totalDocuments}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-700 border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <div>
                        <p className="text-sm text-gray-400">Errores</p>
                        <p className="text-xl font-bold text-white">
                          {parseResult.errors.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-700 border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-yellow-400" />
                      <div>
                        <p className="text-sm text-gray-400">Total Montos</p>
                        <p className="text-xl font-bold text-white">
                          ${parseResult.documents.filter(d => selectedDocuments.has(d.folio)).reduce((sum, d) => sum + d.total_amount, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Options */}
              <Card className="bg-gray-700 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">Opciones de Importación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="create-payments" checked={createPayments} onCheckedChange={checked => setCreatePayments(checked === true)} />
                    <label htmlFor="create-payments" className="text-white">
                      Crear pagos automáticamente desde los documentos
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Errors and Warnings */}
              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && <div className="space-y-2">
                  {parseResult.errors.length > 0 && <Alert className="border-red-500 bg-red-500/10">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <AlertDescription className="text-red-300">
                        <strong>Errores encontrados:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.errors.slice(0, 5).map((error, index) => <li key={index} className="text-sm">{error}</li>)}
                          {parseResult.errors.length > 5 && <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}

                  {parseResult.warnings.length > 0 && <Alert className="border-yellow-500 bg-yellow-500/10">
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <AlertDescription className="text-yellow-300">
                        <strong>Advertencias:</strong>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {parseResult.warnings.slice(0, 3).map((warning, index) => <li key={index} className="text-sm">{warning}</li>)}
                          {parseResult.warnings.length > 3 && <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>}
                        </ul>
                      </AlertDescription>
                    </Alert>}
                </div>}

              {/* Suppliers Preview */}
              {parseResult.suppliers.length > 0 && <Card className="bg-gray-700 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Proveedores Encontrados ({parseResult.suppliers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {parseResult.suppliers.map((supplier, index) => <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                          <div className="flex items-center space-x-3">
                            <Checkbox checked={selectedSuppliers.has(supplier.rut)} onCheckedChange={checked => {
                      if (checked === true) {
                        toggleSupplierSelection(supplier.rut);
                      } else if (checked === false) {
                        toggleSupplierSelection(supplier.rut);
                      }
                    }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-medium truncate">{supplier.name}</p>
                              <p className="text-sm text-gray-400">{supplier.rut}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Select value={supplierCategoryMapping[supplier.rut] || supplier.category} onValueChange={value => handleCategoryChange(supplier.rut, value as SupplierCategory)}>
                              <SelectTrigger className="w-40 bg-gray-600 border-gray-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-700 border-gray-600">
                                {categories.map(category => <SelectItem key={category} value={category}>
                                    {getCategoryLabel(category)}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>)}
                    </div>
                  </CardContent>
                </Card>}

              {/* Documents Preview */}
              {parseResult.documents.length > 0 && <Card className="bg-gray-700 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Documentos Encontrados ({parseResult.documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {parseResult.documents.map((document, index) => <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                          <div className="flex items-center space-x-3">
                            <Checkbox checked={selectedDocuments.has(document.folio)} onCheckedChange={checked => {
                      if (checked === true) {
                        toggleDocumentSelection(document.folio);
                      } else if (checked === false) {
                        toggleDocumentSelection(document.folio);
                      }
                    }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-medium">{document.description}</p>
                              <div className="flex items-center space-x-4 text-sm text-gray-400">
                                <span>Folio: {document.folio}</span>
                                <span>Total: ${document.total_amount.toLocaleString()}</span>
                                {document.due_date && <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {document.due_date}
                                  </span>}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="border-gray-500 text-gray-300">
                            {document.document_type}
                          </Badge>
                        </div>)}
                    </div>
                  </CardContent>
                </Card>}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={reset} disabled={isUploading} className="border-gray-600 text-gray-300 hover:text-white">
                  Cancelar
                </Button>
                <Button onClick={handleUploadData} disabled={isUploading || selectedSuppliers.size === 0} className="bg-green-600 hover:bg-green-700">
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