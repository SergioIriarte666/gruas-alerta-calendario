import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
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
  DollarSign
} from 'lucide-react';
import { XMLCostParser } from '@/utils/xmlParser/xmlCostParser';
import { XMLCostData, XMLParseResult } from '@/types/costs';
import { useAddCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';

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
  const batchProgress = useBatchProgress();
  
  const { mutate: addCost } = useAddCost();
  const { data: categories = [] } = useCostCategories();
  const parser = new XMLCostParser();

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
        toast.success(`XML analizado correctamente: ${result.validRows} gastos encontrados`);
      } else {
        toast.error(`Error analizando XML: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      toast.error('Error procesando el archivo XML');
      console.error('XML parsing error:', error);
    }
  };

  const getDefaultCategoryId = (categoria?: string): string => {
    if (!categoria) return categories[0]?.id || '';
    
    const normalizedCategory = categoria.toLowerCase();
    
    // Mapeo inteligente de categorías
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

  const handleUploadCosts = async () => {
    if (!parseResult || !parseResult.success) return;
    
    setIsUploading(true);
    batchProgress.start('Cargando Gastos desde XML', parseResult.data.length);
    
    let successCount = 0;
    let errorCount = 0;
    const total = parseResult.data.length;

    try {
      for (let i = 0; i < parseResult.data.length; i++) {
        const xmlCost = parseResult.data[i];
        batchProgress.update(i + 1, xmlCost.descripcion.substring(0, 40));
        
        const categoryId = categoryMappings[`${i}-categoria`] || getDefaultCategoryId(xmlCost.categoria);
        
        const costData = {
          date: typeof xmlCost.fecha === 'string' ? xmlCost.fecha : xmlCost.fecha.toISOString().split('T')[0],
          description: xmlCost.descripcion,
          amount: xmlCost.monto,
          category_id: categoryId,
          subcategory: xmlCost.subcategoria || null,
          notes: [
            xmlCost.proveedor ? `Proveedor: ${xmlCost.proveedor}` : '',
            xmlCost.numeroFactura ? `Factura: ${xmlCost.numeroFactura}` : '',
            xmlCost.rut ? `RUT: ${xmlCost.rut}` : '',
            xmlCost.telefono ? `Tel: ${xmlCost.telefono}` : '',
            xmlCost.notas || ''
          ].filter(Boolean).join(' | ') || null,
          service_folio: xmlCost.numeroFactura || null
        };

        await new Promise<void>((resolve) => {
          addCost(costData, {
            onSuccess: () => {
              successCount++;
              resolve();
            },
            onError: (error) => {
              console.error(`Error cargando gasto ${i + 1}:`, error);
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
        batchProgress.error(`${errorCount} de ${total} con error`);
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-tms-green" />
            Cargar Gastos desde XML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info del sistema */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <FileX className="w-4 h-4" />
                <span>Soporta archivos XML de facturas electrónicas (DTE), reportes de gastos y formatos personalizados</span>
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
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-tms-green transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('xml-upload')?.click()}
              >
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  Arrastra tu archivo XML aquí o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="xml-upload"
                />
                <Button variant="outline">
                  Seleccionar XML
                </Button>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-tms-green" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-gray-500 text-sm">{formatFileSize(file.size)}</p>
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

          {/* Parse Results */}
          {parseResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {parseResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  Resultado del Análisis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-blue-600">Total Registros</p>
                        <p className="text-xl font-bold">{parseResult.totalRows}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-green-600">Válidos</p>
                        <p className="text-xl font-bold">{parseResult.validRows}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-sm text-red-600">Errores</p>
                        <p className="text-xl font-bold">{parseResult.errors.length}</p>
                      </div>
                    </div>
                  </div>
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

                {/* Preview Table */}
                {parseResult.data.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Vista Previa y Mapeo de Categorías
                    </h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Categoría</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parseResult.data.slice(0, 10).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {typeof item.fecha === 'string' 
                                  ? new Date(item.fecha).toLocaleDateString('es-CL')
                                  : item.fecha.toLocaleDateString('es-CL')
                                }
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {item.descripcion}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {item.monto.toLocaleString('es-CL')}
                                </div>
                              </TableCell>
                              <TableCell>{item.proveedor || '-'}</TableCell>
                              <TableCell>
                                <Select
                                  value={categoryMappings[`${index}-categoria`] || getDefaultCategoryId(item.categoria)}
                                  onValueChange={(value) => handleCategoryChange(index, value)}
                                >
                                  <SelectTrigger className="w-48">
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
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {parseResult.data.length > 10 && (
                      <p className="text-sm text-gray-500 mt-2">
                        Mostrando 10 de {parseResult.data.length} registros
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {parseResult.success && parseResult.validRows > 0 && (
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleUploadCosts}
                      disabled={isUploading}
                      className="bg-tms-green hover:bg-tms-green/80"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4 mr-2" />
                      )}
                      Cargar {parseResult.validRows} Gastos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>

      <BatchProgressModal
        state={batchProgress.state}
        onClose={batchProgress.close}
      />
    </Dialog>
  );
};