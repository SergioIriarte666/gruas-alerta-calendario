import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Mail
} from 'lucide-react';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';
import { XMLSupplierData, XMLSupplierParseResult } from '@/types/suppliers';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { toast } from 'sonner';

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
  
  const { createSupplier } = useSuppliers();
  const { activeCategories } = useSupplierCategoryManager();
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
        toast.success(`XML analizado correctamente: ${result.validRows} proveedores encontrados`);
      } else {
        toast.error(`Error analizando XML: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      toast.error('Error procesando el archivo XML');
      console.error('XML parsing error:', error);
    }
  };

  const handleUploadSuppliers = async () => {
    if (!parseResult || !parseResult.success) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    let successCount = 0;
    const total = parseResult.data.length;

    try {
      for (let i = 0; i < parseResult.data.length; i++) {
        const xmlSupplier = parseResult.data[i];
        
        const category = categoryMappings[`${i}-category`] || xmlSupplier.category;
        
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
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Vista Previa y Mapeo de Categorías
                    </h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>RUT</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Categoría</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parseResult.data.slice(0, 10).map((supplier, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-muted-foreground" />
                                  {supplier.name}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {supplier.rut || '-'}
                              </TableCell>
                              <TableCell>
                                {supplier.email ? (
                                  <div className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    <span className="text-sm">{supplier.email}</span>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {supplier.phone ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <span className="text-sm">{supplier.phone}</span>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={categoryMappings[`${index}-category`] || supplier.category}
                                  onValueChange={(value) => handleCategoryChange(index, value)}
                                >
                                  <SelectTrigger className="w-48">
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
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {parseResult.data.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Mostrando 10 de {parseResult.data.length} registros
                      </p>
                    )}
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
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Crear {parseResult.validRows} Proveedores
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