import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { XMLSupplierInvoiceParser } from '@/utils/xmlParser/xmlSupplierInvoiceParser';
import { XMLSupplierInvoiceData, XMLSupplierParseResult } from '@/types/supplierPayments';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface XMLSupplierInvoiceUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function XMLSupplierInvoiceUpload({ isOpen, onClose, onSuccess }: XMLSupplierInvoiceUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLSupplierParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [supplierMappings, setSupplierMappings] = useState<Record<string, string>>({});
  // Remover esta línea: const { toast } = useToast();

  const parser = new XMLSupplierInvoiceParser();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/xml' || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setParseResult(null);
      } else {
        toast.error('Por favor selecciona un archivo XML válido.');
      }
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.type === 'text/xml' || file.name.endsWith('.xml'))) {
      setSelectedFile(file);
      setParseResult(null);
    } else {
      toast.error('Por favor arrastra un archivo XML válido.');
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleParseXML = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const result = await parser.parseXMLFile(selectedFile);
      
      // Analizar proveedores automáticamente
      if (result.success && result.data.length > 0) {
        const supplierAnalysis = await parser.analyzeSuppliers(result.data);
        
        // Agregar información de análisis de proveedores al resultado
        result.supplierAnalysis = supplierAnalysis;
      }
      
      setParseResult(result);
      
      if (result.success) {
        const newSuppliersCount = result.supplierAnalysis?.newSuppliers?.length || 0;
        const existingSuppliersCount = result.supplierAnalysis?.existingSuppliers?.length || 0;
        
        let message = `XML procesado exitosamente. Se encontraron ${result.validRows} facturas válidas de ${result.totalRows} registros.`;
        if (newSuppliersCount > 0) {
          message += ` Se detectaron ${newSuppliersCount} proveedores nuevos.`;
        }
        if (existingSuppliersCount > 0) {
          message += ` ${existingSuppliersCount} proveedores ya existen.`;
        }
        
        toast.success(message);
      } else {
        toast.error(`Se encontraron ${result.errors.length} errores. Revisa los detalles.`);
      }
    } catch (error) {
      console.error('Error procesando XML:', error);
      toast.error('Ocurrió un error inesperado al procesar el archivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSupplierMapping = (invoiceIndex: number, supplierId: string) => {
    setSupplierMappings(prev => ({
      ...prev,
      [invoiceIndex]: supplierId
    }));
  };

  const handleUploadInvoices = async () => {
    if (!parseResult?.data.length) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Usar el nuevo método de mapeo automático
      const result = await parser.processAndSaveInvoicesWithAutoMapping(parseResult.data);
      
      if (result.success) {
        const { processedInvoices, createdSuppliers, errors } = result;
        
        // Actualizar progreso
        setUploadProgress(100);
        
        // Mostrar resultados
        let message = `Facturas procesadas exitosamente: ${processedInvoices} facturas`;
        if (createdSuppliers > 0) {
          message += `, ${createdSuppliers} proveedores nuevos creados`;
        }
        if (errors.length > 0) {
          message += `, ${errors.length} errores encontrados`;
        }
        
        toast.success(message);
        
        // Mostrar errores si los hay
        if (errors.length > 0) {
          console.warn('Errores durante el procesamiento:', errors);
          toast.warning(`Se encontraron ${errors.length} errores. Revisa la consola para más detalles.`);
        }
      } else {
        toast.error(`Error en el procesamiento: ${result.error}`);
      }
      
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error cargando facturas:', error);
      toast.error('Error al cargar las facturas a la base de datos.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setParseResult(null);
    setIsProcessing(false);
    setIsUploading(false);
    setUploadProgress(0);
    setSupplierMappings({});
    onClose();
  };

  const formatCurrency = (amount: number, currency: string = 'CLP') => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cargar Facturas desde XML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información sobre formatos soportados */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Soporta archivos XML de facturas electrónicas (DTE), reportes de facturas y formatos personalizados.
              Los campos requeridos son: fecha de emisión, número de factura, RUT del proveedor, nombre del proveedor y monto total.
            </AlertDescription>
          </Alert>

          {/* Área de carga de archivos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Seleccionar Archivo XML</h3>
            
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg mb-2">Arrastra tu archivo XML aquí o haz clic para seleccionar</p>
              <p className="text-sm text-gray-500 mb-4">Archivos XML hasta 10MB</p>
              
              <input
                type="file"
                accept=".xml,text/xml"
                onChange={handleFileSelect}
                className="hidden"
                id="xml-file-input"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('xml-file-input')?.click()}
              >
                Seleccionar XML
              </Button>
            </div>

            {/* Archivo seleccionado */}
            {selectedFile && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleParseXML}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {isProcessing ? 'Analizando...' : 'Analizar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Progreso de carga */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cargando facturas...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Resultados del análisis */}
          {parseResult && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">Total Registros</p>
                  <p className="text-2xl font-bold text-blue-900">{parseResult.totalRows}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Válidos</p>
                  <p className="text-2xl font-bold text-green-900">{parseResult.validRows}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600">Advertencias</p>
                  <p className="text-2xl font-bold text-yellow-900">{parseResult.warnings.length}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600">Errores</p>
                  <p className="text-2xl font-bold text-red-900">{parseResult.errors.length}</p>
                </div>
              </div>

              {/* Errores y advertencias */}
              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                <div className="space-y-2">
                  {parseResult.errors.map((error, index) => (
                    <Alert key={`error-${index}`} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Fila {error.row}, Campo {error.field}:</strong> {error.message}
                        {error.suggestion && <span className="block text-sm mt-1">Sugerencia: {error.suggestion}</span>}
                      </AlertDescription>
                    </Alert>
                  ))}
                  {parseResult.warnings.map((warning, index) => (
                    <Alert key={`warning-${index}`}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Fila {warning.row}, Campo {warning.field}:</strong> {warning.message}
                        {warning.suggestion && <span className="block text-sm mt-1">Sugerencia: {warning.suggestion}</span>}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Información de proveedores */}
              {(parseResult.newSuppliers.length > 0 || parseResult.duplicateInvoices.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parseResult.newSuppliers.length > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Nuevos proveedores ({parseResult.newSuppliers.length}):</strong>
                        <div className="mt-2 space-y-1">
                          {parseResult.newSuppliers.slice(0, 5).map((supplier, index) => (
                            <Badge key={index} variant="secondary" className="mr-1">
                              {supplier}
                            </Badge>
                          ))}
                          {parseResult.newSuppliers.length > 5 && (
                            <Badge variant="outline">+{parseResult.newSuppliers.length - 5} más</Badge>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {parseResult.duplicateInvoices.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Facturas duplicadas ({parseResult.duplicateInvoices.length}):</strong>
                        <div className="mt-2 space-y-1">
                          {parseResult.duplicateInvoices.slice(0, 3).map((invoice, index) => (
                            <Badge key={index} variant="destructive" className="mr-1">
                              {invoice}
                            </Badge>
                          ))}
                          {parseResult.duplicateInvoices.length > 3 && (
                            <Badge variant="outline">+{parseResult.duplicateInvoices.length - 3} más</Badge>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Vista previa de datos */}
              {parseResult.data.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Vista previa de facturas</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha Emisión</TableHead>
                          <TableHead>N° Factura</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>RUT</TableHead>
                          <TableHead>Monto Total</TableHead>
                          <TableHead>Fecha Venc.</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.data.slice(0, 10).map((invoice, index) => {
                          const hasError = parseResult.errors.some(error => error.row === index + 1 && error.severity === 'error');
                          return (
                            <TableRow key={index} className={hasError ? 'bg-red-50' : ''}>
                              <TableCell>{new Date(invoice.fechaEmision).toLocaleDateString('es-CL')}</TableCell>
                              <TableCell className="font-mono">{invoice.numeroFactura}</TableCell>
                              <TableCell>{invoice.nombreProveedor}</TableCell>
                              <TableCell className="font-mono">{invoice.rutProveedor}</TableCell>
                              <TableCell>{formatCurrency(invoice.montoTotal, invoice.moneda)}</TableCell>
                              <TableCell>
                                {invoice.fechaVencimiento ? 
                                  new Date(invoice.fechaVencimiento).toLocaleDateString('es-CL') : 
                                  '-'
                                }
                              </TableCell>
                              <TableCell>
                                {hasError ? (
                                  <Badge variant="destructive">Error</Badge>
                                ) : (
                                  <Badge variant="secondary">Válida</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {parseResult.data.length > 10 && (
                      <div className="p-3 text-center text-sm text-gray-500 border-t">
                        Mostrando 10 de {parseResult.data.length} facturas
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {parseResult && parseResult.validRows > 0 && (
              <Button
                onClick={handleUploadInvoices}
                disabled={isUploading || parseResult.errors.some(e => e.severity === 'error')}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? 'Cargando...' : `Cargar ${parseResult.validRows} Facturas`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}