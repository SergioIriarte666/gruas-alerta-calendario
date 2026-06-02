
import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Upload, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  Loader2
} from 'lucide-react';
import { useCSVUpload } from '@/hooks/useCSVUpload';
import { ValidationError } from '@/utils/csvValidations';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { toTitleCase } from '@/lib/utils';
import { toast } from 'sonner';

export interface CSVUploadServicesProps {
  onClose?: () => void;
  onSuccess?: (count: number) => void;
}

export const CSVUploadServices = ({ onClose, onSuccess }: CSVUploadServicesProps) => {
  const {
    file,
    csvData,
    validationResult,
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
    reset
  } = useCSVUpload();

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (selectedFile && allowedTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
    } else {
      toast.error('Por favor seleccione un archivo CSV o Excel válido.');
    }
  }, [setFile]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (droppedFile && allowedTypes.includes(droppedFile.type)) {
      setFile(droppedFile);
    } else {
      toast.error('Por favor seleccione un archivo CSV o Excel válido.');
    }
  }, [setFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // Handle preview
  const handlePreview = async () => {
    const data = await parseFile();
    if (data && data.length > 0) {
      validateData();
    }
  };

  // Handle upload
  const handleUpload = async () => {
    const result = await uploadServices();
    if (result?.success && onSuccess) {
      onSuccess(result.processed);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Group errors by type
  const groupErrorsByType = (errors: ValidationError[]) => {
    const grouped: { [key: string]: ValidationError[] } = {};
    errors.forEach(error => {
      if (!grouped[error.field]) {
        grouped[error.field] = [];
      }
      grouped[error.field].push(error);
    });
    return grouped;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Carga Masiva de Servicios</h2>
          <p className="text-muted-foreground mt-1">
            Importa múltiples servicios desde un archivo CSV o Excel
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Download className="size-4 mr-2" />
            Plantilla CSV
          </Button>
          <Button
            variant="outline"
            onClick={downloadExcelTemplate}
            className="border-info/30 text-info hover:bg-info hover:text-info-foreground"
          >
            <Download className="size-4 mr-2" />
            Plantilla Excel
          </Button>
        </div>
      </div>

      {/* File Upload Area */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-x-2 text-foreground">
            <Upload className="size-5 text-primary" />
            <span>Seleccionar Archivo CSV</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border-2 border-dashed border-border/70 p-8 text-center transition-colors hover:border-primary/40"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">
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
              <Button asChild>
                <span>Seleccionar Archivo</span>
              </Button>
            </label>
          </div>

          {file && (
            <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-3">
                  <FileText className="size-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex gap-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={isValidating}
                    className="border-info/30 text-info hover:bg-info hover:text-info-foreground"
                  >
                    {isValidating ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="size-4 mr-2" />
                    )}
                    Vista Previa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reset}
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

      {/* Validation Results */}
      {validationResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2 text-foreground">
              {validationResult.isValid ? (
                <CheckCircle className="size-5 text-success" />
              ) : (
                <XCircle className="size-5 text-danger" />
              )}
              <span>Resultado de Validación</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-info/10 border border-info/20 p-4 rounded-lg">
                <p className="text-info text-sm">Total de Filas</p>
                <p className="text-2xl font-bold text-foreground">{csvData.length}</p>
              </div>
              <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
                <p className="text-success text-sm">Filas Válidas</p>
                <p className="text-2xl font-bold text-foreground">{validationResult.validRows.length}</p>
              </div>
              <div className="bg-danger/10 border border-danger/20 p-4 rounded-lg">
                <p className="text-danger text-sm">Errores</p>
                <p className="text-2xl font-bold text-foreground">{validationResult.errors.length}</p>
              </div>
            </div>

            {/* Errors Summary */}
            {validationResult.errors.length > 0 && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
                <h4 className="text-danger font-medium mb-2 flex items-center">
                  <AlertTriangle className="size-4 mr-2" />
                  Errores Encontrados
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(groupErrorsByType(validationResult.errors)).map(([field, errors]) => (
                    <div key={field} className="text-sm">
                      <Badge variant="destructive" className="mr-2">{field}</Badge>
                      <span className="text-muted-foreground">{errors.length} error(es)</span>
                      <div className="ml-4 mt-1 text-muted-foreground">
                        {errors.slice(0, 3).map((error, idx) => (
                          <div key={idx}>
                            Fila {error.row + 1}: {error.message}
                          </div>
                        ))}
                        {errors.length > 3 && (
                          <div className="text-muted-foreground">... y {errors.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Table */}
            {csvData.length > 0 && (
              <div>
                <h4 className="text-foreground font-medium mb-2">Vista Previa (primeras 5 filas)</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/70">
                        <TableHead className="text-muted-foreground">Folio</TableHead>
                        <TableHead className="text-muted-foreground">Fecha</TableHead>
                        <TableHead className="text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-muted-foreground">Vehículo</TableHead>
                        <TableHead className="text-muted-foreground">Patente</TableHead>
                        <TableHead className="text-muted-foreground">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, index) => (
                        <TableRow key={index} className="border-border/70">
                          <TableCell className="text-foreground">{row.folio}</TableCell>
                          <TableCell className="text-foreground">{row.serviceDate}</TableCell>
                          <TableCell className="text-foreground">{toTitleCase(row.clientName)}</TableCell>
                          <TableCell className="text-foreground">
                            {formatVehicleInfo(row)}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {shouldShowVehicleInfo(row) ? row.licensePlate : '-'}
                          </TableCell>
                          <TableCell className="text-foreground">${row.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Upload Button */}
            {validationResult.validRows.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-8"
                >
                  {isUploading ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="size-4 mr-2" />
                  )}
                  Cargar {validationResult.validRows.length} Servicios
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">Progreso de Carga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Lote {uploadProgress.currentBatch} de {uploadProgress.totalBatches}</span>
                <span>{uploadProgress.processed} de {uploadProgress.total}</span>
              </div>
              <Progress value={uploadProgress.percentage} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2 text-foreground">
              {uploadResult.success ? (
                <CheckCircle className="size-5 text-success" />
              ) : (
                <XCircle className="size-5 text-danger" />
              )}
              <span>Resultado de Carga</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
                <p className="text-success text-sm">Servicios Procesados</p>
                <p className="text-2xl font-bold text-foreground">{uploadResult.processed}</p>
              </div>
              <div className="bg-danger/10 border border-danger/20 p-4 rounded-lg">
                <p className="text-danger text-sm">Errores</p>
                <p className="text-2xl font-bold text-foreground">{uploadResult.errors}</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">{uploadResult.message}</p>
            {uploadResult.success && onClose && (
              <Button
                onClick={onClose}
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
