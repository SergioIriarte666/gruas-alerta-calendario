import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useEnhancedCSVUpload } from '@/hooks/useEnhancedCSVUpload';
import { ValidationError } from '@/utils/enhancedCsvUpload';
import { shouldShowVehicleInfo, formatVehicleInfo } from '@/utils/statusHelpers';
import { BatchUploadAnimations } from './BatchUploadAnimations';
import { AnimatedProgress } from './AnimatedProgress';
import { AnimatedStatCard } from './AnimatedStatCard';
import { cn } from '@/lib/utils';

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

  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    setIsDragging(false);
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
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handlePreview = async () => {
    if (isValidating) {
      console.log('⏳ Preview already in progress, ignoring click');
      return;
    }
    
    try {
      console.log('🚀 Starting preview process...');
      
      // Parse the file first and get the data directly
      console.log('📁 Parsing file...');
      const parsedData = await parseFile();
      console.log('✅ File parsed successfully');
      
      // Then validate the parsed data using the returned value
      if (parsedData && parsedData.length > 0) {
        console.log('🔍 Validating parsed data...');
        await validateData(parsedData);
        console.log('✅ Validation completed successfully');
      } else {
        console.warn('⚠️ No data found in file');
        alert('No se encontraron datos válidos en el archivo');
      }
    } catch (error) {
      console.error('❌ Error in preview process:', error);
      alert(`Error al procesar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleUpload = async () => {
    const result = await uploadServices();
    if (result?.success && onSuccess) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      onSuccess(result.processed);
    }
  };

  useEffect(() => {
    if (uploadProgress?.percentage === 100) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [uploadProgress?.percentage]);

  const handleDownloadExcelTemplate = () => {
    try {
      downloadExcelTemplate();
    } catch (error) {
      console.error('Error downloading Excel template:', error);
      alert('Error al descargar la plantilla de Excel');
    }
  };

  const handleDownloadCSVTemplate = () => {
    try {
      downloadTemplate();
    } catch (error) {
      console.error('Error downloading CSV template:', error);
      alert('Error al descargar la plantilla CSV');
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
      {/* Particle Animation System */}
      <BatchUploadAnimations
        isActive={isUploading}
        onComplete={showConfetti}
        sourceRef={uploadButtonRef}
        targetRef={progressBarRef}
      />

      {/* Header with improved design */}
      <div className="flex items-center justify-between">
        <div className="animate-fade-in">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Upload className={cn(
              "w-6 h-6",
              isUploading ? "animate-bounce-in text-primary" : "text-primary"
            )} />
            Carga Masiva Inteligente
            {isUploading && <Sparkles className="w-5 h-5 text-primary animate-pulse-glow" />}
          </h2>
          <p className="text-muted-foreground mt-1">
            Sistema avanzado de importación con validación automática y mapeo inteligente
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCSVTemplate}
            className="border-tms-green text-tms-green hover:bg-tms-green hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Plantilla CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadExcelTemplate}
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
              <span className={`text-sm ${isInitialized ? 'text-green-600' : 'text-yellow-600'}`}>
                {isInitialized ? 'Sistema listo' : 'Inicializando sistema...'}
              </span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="text-sm text-muted-foreground">
              Validación automática • Mapeo inteligente • Corrección de datos
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <FileText className="w-5 h-5 text-tms-green" />
            <span>Seleccionar Archivo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300",
              isDragging 
                ? "border-primary bg-primary/5 scale-[1.02] shadow-[0_0_30px_rgba(156,250,36,0.3)]" 
                : "border-border hover:border-primary",
              !file && "animate-breathe"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className={cn(
              "w-12 h-12 mx-auto mb-4 transition-all duration-300",
              isDragging ? "text-primary scale-110 animate-bounce-in" : "text-muted-foreground"
            )} />
            <p className="text-foreground mb-4">
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
              <Button 
                className={cn(
                  "bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300",
                  isDragging && "animate-scale-pulse"
                )} 
                asChild
              >
                <span>Seleccionar Archivo</span>
              </Button>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg animate-slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-tms-green" />
                  <div>
                    <p className="text-foreground font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={isValidating || !isInitialized}
                    className={cn(
                      "border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white transition-all duration-300",
                      isValidating && "animate-pulse-glow"
                    )}
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
        <Card className="glass-card animate-slide-up">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className={cn(
                "w-5 h-5",
                uploadProgress.stage === 'uploading' && "animate-rotate-slow"
              )} />
              {getProgressStageText(uploadProgress.stage)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" ref={progressBarRef}>
            <div>
              <div className="flex justify-between text-sm text-foreground mb-2">
                <span className="animate-fade-in">
                  {uploadProgress.stage === 'uploading' ? `Lote ${uploadProgress.currentBatch} de ${uploadProgress.totalBatches}` : 'Progreso'}
                </span>
                <span className="font-mono font-semibold animate-fade-in">
                  {uploadProgress.processed} de {uploadProgress.total}
                </span>
              </div>
              <AnimatedProgress 
                value={uploadProgress.percentage} 
                className="w-full" 
                showPulse={true}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validationResult && (
        <Card className="glass-card animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-foreground">
              {validationResult.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500 animate-bounce-in" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-500 animate-bounce-in" />
              )}
              <span>Resultado del Análisis Inteligente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AnimatedStatCard
                label="Total de Filas"
                value={validationResult.totalRows}
                variant="total"
                isAnimating={isValidating}
              />
              <AnimatedStatCard
                label="Válidas"
                value={validationResult.validCount}
                variant="valid"
                isAnimating={isValidating}
              />
              <AnimatedStatCard
                label="Errores"
                value={validationResult.errorCount}
                variant="error"
                isAnimating={validationResult.errorCount > 0}
              />
              <AnimatedStatCard
                label="Advertencias"
                value={validationResult.warningCount}
                variant="warning"
                isAnimating={validationResult.warningCount > 0}
              />
            </div>

            {/* Validation Status */}
            <div className={cn(
              "p-4 rounded-lg border transition-all duration-500 animate-slide-up",
              validationResult.isValid 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-orange-500/10 border-orange-500/30',
              validationResult.isValid && "shadow-[0_0_20px_rgba(34,197,94,0.2)]"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {validationResult.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-400 animate-bounce-in" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-400 animate-scale-pulse" />
                )}
                <h4 className={cn(
                  "font-medium",
                  validationResult.isValid ? 'text-green-600' : 'text-orange-600'
                )}>
                  {validationResult.isValid ? 'Validación Exitosa' : 'Validación con Observaciones'}
                </h4>
              </div>
              <p className="text-foreground text-sm">
                {validationResult.isValid 
                  ? `Todos los ${validationResult.validCount} servicios están listos para cargar.`
                  : `${validationResult.validCount} servicios válidos de ${validationResult.totalRows} total. Revisa los errores antes de continuar.`
                }
              </p>
            </div>

            {/* Errors and Warnings Summary */}
            {validationResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-foreground font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Detalles de Validación
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-muted/50 rounded-lg p-4">
                  {Object.entries(groupErrorsByType(validationResult.errors)).map(([key, errors]) => {
                    const isError = key.startsWith('error_');
                    const field = key.replace(/^(error_|warning_)/, '');
                    
                    return (
                      <div key={key} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant={isError ? "destructive" : "secondary"}
                            className={isError ? "bg-red-500/20 text-red-600" : "bg-yellow-500/20 text-yellow-600"}
                          >
                            {field}
                          </Badge>
                          <span className="text-foreground">
                            {errors.length} {isError ? 'error(es)' : 'advertencia(s)'}
                          </span>
                        </div>
                        <div className="ml-4 space-y-1">
                          {errors.slice(0, 3).map((error, idx) => (
                            <div key={idx} className="text-muted-foreground text-xs">
                              {error.row >= 0 ? `Fila ${error.row + 1}: ` : ''}{error.message}
                            </div>
                          ))}
                          {errors.length > 3 && (
                            <div className="text-muted-foreground text-xs">
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
                <h4 className="text-foreground font-medium mb-2">Vista Previa (primeras 5 filas)</h4>
                <div className="overflow-x-auto bg-muted/50 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="border">
                        <TableHead className="text-muted-foreground">Folio</TableHead>
                        <TableHead className="text-muted-foreground">Fecha</TableHead>
                        <TableHead className="text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-muted-foreground">Vehículo</TableHead>
                        <TableHead className="text-muted-foreground">Patente</TableHead>
                        <TableHead className="text-muted-foreground">Valor</TableHead>
                        <TableHead className="text-muted-foreground">Estado</TableHead>
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
                          <TableRow key={index} className="border">
                            <TableCell className="text-foreground">{row.Folio || row.folio}</TableCell>
                            <TableCell className="text-foreground">{row['Fecha Servicio'] || row.serviceDate}</TableCell>
                            <TableCell className="text-foreground">{row['Cliente Nombre'] || row.clientName}</TableCell>
                            <TableCell className="text-foreground">
                              {shouldShowVehicleInfo(row) ? 
                                `${(row['Vehículo Marca'] || row.vehicleBrand)} ${(row['Vehículo Modelo'] || row.vehicleModel)}` : 
                                'No aplica'
                              }
                            </TableCell>
                            <TableCell className="text-foreground">
                              {shouldShowVehicleInfo(row) ? (row.Patente || row.licensePlate) : 'No aplica'}
                            </TableCell>
                            <TableCell className="text-foreground">${row.Valor || row.value}</TableCell>
                            <TableCell>
                              {hasError ? (
                                <Badge variant="destructive" className="bg-red-500/20 text-red-600">Error</Badge>
                              ) : hasWarning ? (
                                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Advertencia</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-500/20 text-green-600">Válido</Badge>
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
                  ref={uploadButtonRef}
                  onClick={handleUpload}
                  disabled={isUploading}
                  className={cn(
                    "bg-primary hover:bg-primary/90 text-primary-foreground px-8 transition-all duration-500",
                    isUploading && "animate-pulse-glow scale-105"
                  )}
                  size="lg"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Cargar {validationResult.validCount} Servicios
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <Card className={cn(
          "glass-card animate-slide-up transition-all duration-500",
          uploadResult.success && "shadow-[0_0_40px_rgba(34,197,94,0.3)]"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-foreground">
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 animate-bounce-in" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 animate-scale-pulse" />
              )}
              <span>Resultado de la Carga</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <AnimatedStatCard
                label="Servicios Procesados"
                value={uploadResult.processed}
                variant="valid"
                isAnimating={uploadResult.success}
              />
              <AnimatedStatCard
                label="Errores"
                value={uploadResult.errors}
                variant="error"
                isAnimating={uploadResult.errors > 0}
              />
            </div>
            <p className="text-foreground mb-4 animate-fade-in">{uploadResult.message}</p>
            
            {/* Error details */}
            {uploadResult.errorDetails && uploadResult.errorDetails.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 animate-slide-up">
                <h4 className="text-red-600 font-medium mb-2">Detalles de Errores</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.errorDetails.slice(0, 10).map((error, idx) => (
                    <div 
                      key={idx} 
                      className="text-sm text-foreground animate-fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      Fila {error.row + 1}: {error.message}
                    </div>
                  ))}
                  {uploadResult.errorDetails.length > 10 && (
                    <div className="text-sm text-muted-foreground animate-fade-in">
                      ... y {uploadResult.errorDetails.length - 10} errores más
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadResult.success && onClose && (
              <Button
                onClick={onClose}
                className="bg-primary hover:bg-primary/90 text-primary-foreground animate-bounce-in"
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
