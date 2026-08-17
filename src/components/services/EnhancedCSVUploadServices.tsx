import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import { formatCurrency } from '@/utils/statusHelpers';
import { BatchUploadAnimations } from './BatchUploadAnimations';
import { AnimatedProgress } from './AnimatedProgress';
import { AnimatedStatCard } from './AnimatedStatCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("EnhancedCSVUploadServices");

const getPreviewValue = (
  row: Record<string, unknown>,
  spreadsheetHeader: string,
  mappedField: string
): unknown => row[spreadsheetHeader] ?? row[mappedField] ?? '';

const getPreviewVehicle = (row: Record<string, unknown>): string => {
  const brand = String(getPreviewValue(row, 'Vehículo Marca', 'vehicleBrand')).trim();
  const model = String(getPreviewValue(row, 'Vehículo Modelo', 'vehicleModel')).trim();
  return [brand, model].filter(Boolean).join(' ') || '-';
};

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
    isCancelling,
    uploadProgress,
    uploadResult,
    setFile,
    parseFile,
    validateData,
    uploadServices,
    cancelUpload,
    downloadTemplate,
    downloadExcelTemplate,
    reset,
    initializeUploader
  } = useEnhancedCSVUpload();

  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [markAsCompleted, setMarkAsCompleted] = useState(false);

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
      setMarkAsCompleted(false);
      setFile(selectedFile);
    } else {
      toast.error('Por favor seleccione un archivo CSV o Excel válido.');
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
      setMarkAsCompleted(false);
      setFile(droppedFile);
    } else {
      toast.error('Por favor seleccione un archivo CSV o Excel válido.');
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
      logger.debug('⏳ Preview already in progress, ignoring click');
      return;
    }
    
    try {
      logger.debug('🚀 Starting preview process...');
      
      // Parse the file first and get the data directly
      logger.debug('📁 Parsing file...');
      const parsedData = await parseFile();
      logger.debug('✅ File parsed successfully');
      
      // Then validate the parsed data using the returned value
      if (parsedData && parsedData.length > 0) {
        logger.debug('🔍 Validating parsed data...');
        await validateData(parsedData);
        logger.debug('✅ Validation completed successfully');
      } else {
        logger.warn('⚠️ No data found in file');
        toast.error('No se encontraron datos válidos en el archivo');
      }
    } catch (error) {
      logger.error('❌ Error in preview process:', error);
      toast.error(`Error al procesar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleReset = useCallback(() => {
    setMarkAsCompleted(false);
    reset();
  }, [reset]);

  const handleUpload = async () => {
    const result = await uploadServices({ markAsCompleted });
    if (result?.success && onSuccess) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      onSuccess(result.processed);
    }
  };

  useEffect(() => {
    if (uploadProgress?.percentage === 100) {
      setShowConfetti(true);
      const id = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(id);
    }
  }, [uploadProgress?.percentage]);

  const handleDownloadExcelTemplate = () => {
    try {
      downloadExcelTemplate();
    } catch (error) {
      logger.error('Error downloading Excel template:', error);
      toast.error('Error al descargar la plantilla de Excel');
    }
  };

  const handleDownloadCSVTemplate = () => {
    try {
      downloadTemplate();
    } catch (error) {
      logger.error('Error downloading CSV template:', error);
      toast.error('Error al descargar la plantilla CSV');
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
              "size-6",
              isUploading ? "animate-bounce-in text-primary" : "text-primary"
            )} />
            Carga Masiva Inteligente
            {isUploading && <Sparkles className="size-5 text-primary animate-pulse-glow" />}
          </h2>
          <p className="text-muted-foreground mt-1">
            Sistema avanzado de importación con validación automática y mapeo inteligente
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCSVTemplate}
            className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Download className="size-4 mr-2" />
            Plantilla CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadExcelTemplate}
            className="border-info/30 text-info hover:bg-info hover:text-info-foreground"
          >
            <Download className="size-4 mr-2" />
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
                <CheckCircle className="size-5 text-success" />
              ) : (
                <Loader2 className="size-5 text-warning animate-spin" />
              )}
              <span className={`text-sm ${isInitialized ? 'text-success' : 'text-warning'}`}>
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
          <CardTitle className="flex items-center gap-x-2 text-foreground">
            <FileText className="size-5 text-primary" />
            <span>Seleccionar Archivo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300",
              isDragging 
                ? "scale-[1.02] border-primary bg-primary/5 shadow-glow-primary"
                : "border-border hover:border-primary",
              !file && "animate-breathe"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className={cn(
              "size-12 mx-auto mb-4 transition-all duration-300",
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
                <div className="flex items-center gap-x-3">
                  <FileText className="size-5 text-primary" />
                  <div>
                    <p className="text-foreground font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex gap-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={isValidating || !isInitialized}
                    className={cn(
                      "border-info/30 text-info hover:bg-info hover:text-info-foreground transition-all duration-300",
                      isValidating && "animate-pulse-glow"
                    )}
                  >
                    {isValidating ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="size-4 mr-2" />
                    )}
                    Analizar & Validar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="border-border/70 bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <Card className="glass-card animate-slide-up overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-foreground flex items-center gap-2">
                <BarChart3 className={cn(
                  "size-5",
                  uploadProgress.stage === 'uploading' && "animate-rotate-slow"
                )} />
                {getProgressStageText(uploadProgress.stage)}
              </CardTitle>
              {uploadProgress.stage === 'uploading' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelUpload}
                  disabled={isCancelling}
                  className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                >
                  {isCancelling ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 size-4" />
                  )}
                  {isCancelling ? 'Cancelando…' : 'Cancelar'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4" ref={progressBarRef}>
            <div>
              <div className="flex justify-between text-sm text-foreground mb-2">
                <span className="animate-fade-in">
                  {uploadProgress.stage === 'uploading' ? `Lote ${uploadProgress.currentBatch} de ${uploadProgress.totalBatches}` : 'Progreso'}
                </span>
                <span className="font-mono font-semibold tabular-nums animate-fade-in">
                  {uploadProgress.processed} de {uploadProgress.total}
                  {' · '}
                  {Math.min(100, Math.max(0, Math.round(uploadProgress.percentage)))}%
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
            <CardTitle className="flex items-center gap-x-2 text-foreground">
              {validationResult.isValid ? (
                <CheckCircle className="size-5 text-success-text animate-bounce-in" />
              ) : (
                <AlertCircle className="size-5 text-warning-text animate-bounce-in" />
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
                ? 'bg-success/10 border-success/20' 
                : 'bg-warning/10 border-warning/20',
              validationResult.isValid && "shadow-lg"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {validationResult.isValid ? (
                  <CheckCircle className="size-5 text-success animate-bounce-in" />
                ) : (
                  <AlertTriangle className="size-5 text-warning animate-scale-pulse" />
                )}
                <h4 className={cn(
                  "font-medium",
                  validationResult.isValid ? 'text-success' : 'text-warning'
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
                  <AlertTriangle className="size-4" />
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
                            className={isError ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"}
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
                <h4 className="text-foreground font-medium mb-2">
                  Vista Previa ({csvData.length} {csvData.length === 1 ? 'fila' : 'filas'})
                </h4>
                <div className="max-h-[50vh] overflow-y-auto overflow-x-auto overscroll-contain rounded-lg border border-border/60 bg-muted/50">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
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
                      {csvData.map((row, index) => {
                        const previewRow = row as Record<string, unknown>;
                        const hasError = validationResult.errors.some(
                          error => error.row === index && error.severity === 'error'
                        );
                        const hasWarning = validationResult.errors.some(
                          error => error.row === index && error.severity === 'warning'
                        );

                        return (
                          <TableRow key={index} className="border">
                            <TableCell className="text-foreground">
                              {String(getPreviewValue(previewRow, 'Folio', 'folio'))}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {String(getPreviewValue(previewRow, 'Fecha Servicio', 'serviceDate'))}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {String(getPreviewValue(previewRow, 'Cliente Nombre', 'clientName'))}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {getPreviewVehicle(previewRow)}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {String(getPreviewValue(previewRow, 'Patente', 'licensePlate') || '-')}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {formatCurrency(Number(getPreviewValue(previewRow, 'Valor', 'value')))}
                            </TableCell>
                            <TableCell>
                              {hasError ? (
                                <Badge className="border-danger/30 bg-danger/10 text-danger">Error</Badge>
                              ) : hasWarning ? (
                                <Badge className="border-warning/30 bg-warning/10 text-warning">Advertencia</Badge>
                              ) : (
                                <Badge className="border-success/30 bg-success/10 text-success">Válido</Badge>
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

            {/* Estado del lote + Upload Button */}
            {validationResult.validCount > 0 && (
              <div className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="mark-as-completed"
                    checked={markAsCompleted}
                    onCheckedChange={(value) => setMarkAsCompleted(value === true)}
                    disabled={isUploading}
                  />
                  <Label htmlFor="mark-as-completed" className="cursor-pointer">
                    Marcar los servicios como completados
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Se cargarán con estado:{' '}
                  <strong className="text-foreground">
                    {markAsCompleted ? 'Completado' : 'Pendiente'}
                  </strong>
                </p>
                <div className="flex justify-center">
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
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        {isCancelling ? 'Cancelando…' : 'Cargando...'}
                      </>
                    ) : (
                      <>
                        <Upload className="size-4 mr-2" />
                        Cargar {validationResult.validCount} Servicios
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <Card className={cn(
          "glass-card animate-slide-up transition-all duration-500",
          uploadResult.success && "shadow-glow-success"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2 text-foreground">
              {uploadResult.success ? (
                <CheckCircle className="size-5 text-success animate-bounce-in" />
              ) : (
                <XCircle className="size-5 text-danger animate-scale-pulse" />
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
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-4 animate-slide-up">
                <h4 className="text-danger font-medium mb-2">Detalles de Errores</h4>
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
