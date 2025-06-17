
import { useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  Loader2,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { useEnhancedCSVUpload } from '@/hooks/useEnhancedCSVUpload';
import { ValidationError } from '@/utils/enhancedCsvUpload';

interface EnhancedCSVUploadServicesProps {
  onClose?: () => void;
  onSuccess?: (count: number) => void;
}

export const EnhancedCSVUploadServices = ({ onClose, onSuccess }: EnhancedCSVUploadServicesProps) => {
  const {
    file,
    csvData,
    validationResult,
    isInitialized,
    isValidating,
    isUploading,
    uploadProgress,
    uploadResult,
    setFile,
    parseFile,
    validateData,
    uploadServices,
    downloadTemplate,
    downloadExcelTemplate,
    reset,
    initializeUploader
  } = useEnhancedCSVUpload();

  useEffect(() => {
    initializeUploader();
  }, [initializeUploader]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    const allowedTypes = [
      'text/csv', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel'
    ];
    
    if (selectedFile && allowedTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
    } else {
      alert('Por favor seleccione un archivo CSV o Excel válido.');
    }
  }, [setFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    const allowedTypes = [
      'text/csv', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel'
    ];
    
    if (droppedFile && allowedTypes.includes(droppedFile.type)) {
      setFile(droppedFile);
    } else {
      alert('Por favor seleccione un archivo CSV o Excel válido.');
    }
  }, [setFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handlePreview = async () => {
    try {
      const data = await parseFile();
      if (data && data.length > 0) {
        await validateData();
      }
    } catch (error) {
      console.error('Error in preview:', error);
    }
  };

  const handleUpload = async () => {
    const result = await uploadServices();
    if (result?.success && onSuccess) {
      onSuccess(result.processed);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const groupErrorsByType = (errors: ValidationError[]) => {
    const grouped: { [key: string]: ValidationError[] } = {};
    errors.forEach(error => {
      const key = error.severity === 'error' ? `error_${error.field}` : `warning_${error.field}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(error);
    });
    return grouped;
  };

  const getProgressStageText = (stage: string) => {
    switch (stage) {
      case 'parsing': return 'Procesando archivo...';
      case 'validating': return 'Validando datos...';
      case 'mapping': return 'Mapeando relaciones...';
      case 'uploading': return 'Cargando servicios...';
      default: return 'Procesando...';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with improved design */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Upload className="w-6 h-6 text-tms-green" />
            Carga Masiva Inteligente
          </h2>
          <p className="text-gray-400 mt-1">
            Sistema avanzado de importación con validación automática y mapeo inteligente
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-tms-green text-tms-green hover:bg-tms-green hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Plantilla CSV
          </Button>
          <Button
            variant="outline"
            onClick={downloadExcelTemplate}
            className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Plantilla Excel
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isInitialized ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
              )}
              <span className={`text-sm ${isInitialized ? 'text-green-400' : 'text-yellow-400'}`}>
                {isInitialized ? 'Sistema listo' : 'Inicializando sistema...'}
              </span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="text-sm text-gray-400">
              Validación automática • Mapeo inteligente • Corrección de datos
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <FileText className="w-5 h-5 text-tms-green" />
            <span>Seleccionar Archivo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-tms-green transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">
              Arrastra tu archivo CSV o Excel aquí o haz clic para seleccionar
            </p>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button className="bg-tms-green hover:bg-tms-green-dark text-white" asChild>
                <span>Seleccionar Archivo</span>
              </Button>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-tms-green" />
                  <div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-gray-400 text-sm">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={isValidating || !isInitialized}
                    className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                  >
                    {isValidating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Analizar & Validar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reset}
                    className="border-gray-500 text-gray-400 hover:bg-gray-500 hover:text-white"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress indicator */}
      {uploadProgress && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {getProgressStageText(uploadProgress.stage)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>{uploadProgress.stage === 'uploading' ? `Lote ${uploadProgress.currentBatch} de ${uploadProgress.totalBatches}` : 'Progreso'}</span>
                <span>{uploadProgress.processed} de {uploadProgress.total}</span>
              </div>
              <Progress value={uploadProgress.percentage} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validationResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              {validationResult.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-500" />
              )}
              <span>Resultado del Análisis Inteligente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-500/20 p-4 rounded-lg">
                <p className="text-blue-300 text-sm">Total de Filas</p>
                <p className="text-2xl font-bold text-white">{validationResult.totalRows}</p>
              </div>
              <div className="bg-green-500/20 p-4 rounded-lg">
                <p className="text-green-300 text-sm">Válidas</p>
                <p className="text-2xl font-bold text-white">{validationResult.validCount}</p>
              </div>
              <div className="bg-red-500/20 p-4 rounded-lg">
                <p className="text-red-300 text-sm">Errores</p>
                <p className="text-2xl font-bold text-white">{validationResult.errorCount}</p>
              </div>
              <div className="bg-yellow-500/20 p-4 rounded-lg">
                <p className="text-yellow-300 text-sm">Advertencias</p>
                <p className="text-2xl font-bold text-white">{validationResult.warningCount}</p>
              </div>
            </div>

            {/* Validation Status */}
            <div className={`p-4 rounded-lg border ${validationResult.isValid ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {validationResult.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                )}
                <h4 className={`font-medium ${validationResult.isValid ? 'text-green-300' : 'text-orange-300'}`}>
                  {validationResult.isValid ? 'Validación Exitosa' : 'Validación con Observaciones'}
                </h4>
              </div>
              <p className="text-gray-300 text-sm">
                {validationResult.isValid 
                  ? `Todos los ${validationResult.validCount} servicios están listos para cargar.`
                  : `${validationResult.validCount} servicios válidos de ${validationResult.totalRows} total. Revisa los errores antes de continuar.`
                }
              </p>
            </div>

            {/* Errors and Warnings Summary */}
            {validationResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Detalles de Validación
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-800/50 rounded-lg p-4">
                  {Object.entries(groupErrorsByType(validationResult.errors)).map(([key, errors]) => {
                    const isError = key.startsWith('error_');
                    const field = key.replace(/^(error_|warning_)/, '');
                    
                    return (
                      <div key={key} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant={isError ? "destructive" : "secondary"}
                            className={isError ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}
                          >
                            {field}
                          </Badge>
                          <span className="text-gray-300">
                            {errors.length} {isError ? 'error(es)' : 'advertencia(s)'}
                          </span>
                        </div>
                        <div className="ml-4 space-y-1">
                          {errors.slice(0, 3).map((error, idx) => (
                            <div key={idx} className="text-gray-400 text-xs">
                              {error.row >= 0 ? `Fila ${error.row + 1}: ` : ''}{error.message}
                            </div>
                          ))}
                          {errors.length > 3 && (
                            <div className="text-gray-500 text-xs">
                              ... y {errors.length - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preview Table */}
            {csvData.length > 0 && (
              <div>
                <h4 className="text-white font-medium mb-2">Vista Previa (primeras 5 filas)</h4>
                <div className="overflow-x-auto bg-gray-800/50 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700">
                        <TableHead className="text-gray-300">Folio</TableHead>
                        <TableHead className="text-gray-300">Fecha</TableHead>
                        <TableHead className="text-gray-300">Cliente</TableHead>
                        <TableHead className="text-gray-300">Vehículo</TableHead>
                        <TableHead className="text-gray-300">Patente</TableHead>
                        <TableHead className="text-gray-300">Valor</TableHead>
                        <TableHead className="text-gray-300">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, index) => {
                        const hasError = validationResult.errors.some(
                          error => error.row === index && error.severity === 'error'
                        );
                        const hasWarning = validationResult.errors.some(
                          error => error.row === index && error.severity === 'warning'
                        );

                        return (
                          <TableRow key={index} className="border-gray-700">
                            <TableCell className="text-gray-300">{row.Folio || row.folio}</TableCell>
                            <TableCell className="text-gray-300">{row['Fecha Servicio'] || row.serviceDate}</TableCell>
                            <TableCell className="text-gray-300">{row['Cliente Nombre'] || row.clientName}</TableCell>
                            <TableCell className="text-gray-300">
                              {(row['Vehículo Marca'] || row.vehicleBrand)} {(row['Vehículo Modelo'] || row.vehicleModel)}
                            </TableCell>
                            <TableCell className="text-gray-300">{row.Patente || row.licensePlate}</TableCell>
                            <TableCell className="text-gray-300">${row.Valor || row.value}</TableCell>
                            <TableCell>
                              {hasError ? (
                                <Badge variant="destructive" className="bg-red-500/20 text-red-300">Error</Badge>
                              ) : hasWarning ? (
                                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">Advertencia</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-500/20 text-green-300">Válido</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Upload Button */}
            {validationResult.validCount > 0 && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="bg-tms-green hover:bg-tms-green-dark text-white px-8"
                  size="lg"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Cargar {validationResult.validCount} Servicios
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span>Resultado de la Carga</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-green-500/20 p-4 rounded-lg">
                <p className="text-green-300 text-sm">Servicios Procesados</p>
                <p className="text-2xl font-bold text-white">{uploadResult.processed}</p>
              </div>
              <div className="bg-red-500/20 p-4 rounded-lg">
                <p className="text-red-300 text-sm">Errores</p>
                <p className="text-2xl font-bold text-white">{uploadResult.errors}</p>
              </div>
            </div>
            <p className="text-gray-300 mb-4">{uploadResult.message}</p>
            
            {/* Error details */}
            {uploadResult.errorDetails && uploadResult.errorDetails.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <h4 className="text-red-300 font-medium mb-2">Detalles de Errores</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.errorDetails.slice(0, 10).map((error, idx) => (
                    <div key={idx} className="text-sm text-gray-300">
                      Fila {error.row + 1}: {error.message}
                    </div>
                  ))}
                  {uploadResult.errorDetails.length > 10 && (
                    <div className="text-sm text-gray-400">
                      ... y {uploadResult.errorDetails.length - 10} errores más
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadResult.success && onClose && (
              <Button
                onClick={onClose}
                className="bg-tms-green hover:bg-tms-green-dark text-white"
              >
                Cerrar y Ver Servicios
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
