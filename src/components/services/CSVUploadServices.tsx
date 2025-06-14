
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

interface CSVUploadServicesProps {
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
    reset
  } = useCSVUpload();

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      alert('Por favor seleccione un archivo CSV válido');
    }
  }, [setFile]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile);
    } else {
      alert('Por favor seleccione un archivo CSV válido');
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
          <h2 className="text-2xl font-bold text-white">Carga Masiva de Servicios</h2>
          <p className="text-gray-400 mt-1">
            Importa múltiples servicios desde un archivo CSV
          </p>
        </div>
        <Button
          variant="outline"
          onClick={downloadTemplate}
          className="border-tms-green text-tms-green hover:bg-tms-green hover:text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar Plantilla
        </Button>
      </div>

      {/* File Upload Area */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Upload className="w-5 h-5 text-tms-green" />
            <span>Seleccionar Archivo CSV</span>
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
              Arrastra tu archivo CSV aquí o haz clic para seleccionar
            </p>
            <input
              type="file"
              accept=".csv"
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
                    disabled={isValidating}
                    className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                  >
                    {isValidating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Vista Previa
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

      {/* Validation Results */}
      {validationResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              {validationResult.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span>Resultado de Validación</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-500/20 p-4 rounded-lg">
                <p className="text-blue-300 text-sm">Total de Filas</p>
                <p className="text-2xl font-bold text-white">{csvData.length}</p>
              </div>
              <div className="bg-green-500/20 p-4 rounded-lg">
                <p className="text-green-300 text-sm">Filas Válidas</p>
                <p className="text-2xl font-bold text-white">{validationResult.validRows.length}</p>
              </div>
              <div className="bg-red-500/20 p-4 rounded-lg">
                <p className="text-red-300 text-sm">Errores</p>
                <p className="text-2xl font-bold text-white">{validationResult.errors.length}</p>
              </div>
            </div>

            {/* Errors Summary */}
            {validationResult.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-300 font-medium mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Errores Encontrados
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(groupErrorsByType(validationResult.errors)).map(([field, errors]) => (
                    <div key={field} className="text-sm">
                      <Badge variant="destructive" className="mr-2">{field}</Badge>
                      <span className="text-gray-300">{errors.length} error(es)</span>
                      <div className="ml-4 mt-1 text-gray-400">
                        {errors.slice(0, 3).map((error, idx) => (
                          <div key={idx}>
                            Fila {error.row + 1}: {error.message}
                          </div>
                        ))}
                        {errors.length > 3 && (
                          <div className="text-gray-500">... y {errors.length - 3} más</div>
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
                <h4 className="text-white font-medium mb-2">Vista Previa (primeras 5 filas)</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700">
                        <TableHead className="text-gray-300">Folio</TableHead>
                        <TableHead className="text-gray-300">Fecha</TableHead>
                        <TableHead className="text-gray-300">Cliente</TableHead>
                        <TableHead className="text-gray-300">Vehículo</TableHead>
                        <TableHead className="text-gray-300">Patente</TableHead>
                        <TableHead className="text-gray-300">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, index) => (
                        <TableRow key={index} className="border-gray-700">
                          <TableCell className="text-gray-300">{row.folio}</TableCell>
                          <TableCell className="text-gray-300">{row.serviceDate}</TableCell>
                          <TableCell className="text-gray-300">{row.clientName}</TableCell>
                          <TableCell className="text-gray-300">{row.vehicleBrand} {row.vehicleModel}</TableCell>
                          <TableCell className="text-gray-300">{row.licensePlate}</TableCell>
                          <TableCell className="text-gray-300">${row.value}</TableCell>
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
                  className="bg-tms-green hover:bg-tms-green-dark text-white px-8"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
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
            <CardTitle className="text-white">Progreso de Carga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-2">
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
            <CardTitle className="flex items-center space-x-2 text-white">
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span>Resultado de Carga</span>
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
