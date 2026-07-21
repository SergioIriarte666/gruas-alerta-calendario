import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Download,
  X,
  FileText,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useCostCSVUpload } from '@/hooks/useCostCSVUpload';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateCostCsvTemplate, generateCostExcelTemplate } from '@/utils/costCsvTemplate';
import { createLogger } from "@/lib/logger";


const logger = createLogger("CSVCostUpload");
interface CSVCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

type Step = 'upload' | 'preview' | 'uploading' | 'done';

export const CSVCostUpload = ({ isOpen, onClose, onSuccess }: CSVCostUploadProps) => {
  const [step, setStep] = useState<Step>('upload');
  const queryClient = useQueryClient();
  const {
    file,
    setFile,
    validationResult,
    isUploading: _isUploading,
    uploadProgress: _uploadProgress,
    parseFile,
    validate,
    uploadCosts,
    reset,
  } = useCostCSVUpload();
  const batchProgress = useBatchProgress();

  const handleClose = useCallback(() => {
    reset();
    setStep('upload');
    onClose();
  }, [reset, onClose]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Formato no soportado. Use CSV o Excel (.xlsx)');
      return;
    }

    setFile(selectedFile);

    try {
      const data = await parseFile(selectedFile);
      if (data.length === 0) {
        toast.error('El archivo está vacío');
        return;
      }
      const result = await validate(data);
      setStep('preview');

      if (result.validRows.length > 0 && result.invalidRows.length === 0) {
        toast.success(`${result.validRows.length} costos listos para cargar`);
      } else if (result.validRows.length > 0) {
        toast.warning(`${result.validRows.length} válidos, ${result.invalidRows.length} con errores`);
      } else {
        toast.error('No se encontraron registros válidos');
      }
    } catch (err) {
      toast.error('Error al procesar el archivo');
      logger.error(err);
    }
  }, [parseFile, validate, setFile]);

  const handleDownloadCSVTemplate = useCallback(() => {
    try {
      generateCostCsvTemplate();
    } catch (error) {
      logger.error('Error downloading cost CSV template:', error);
      toast.error('Error al descargar la plantilla CSV');
    }
  }, []);

  const handleDownloadExcelTemplate = useCallback(() => {
    try {
      generateCostExcelTemplate();
    } catch (error) {
      logger.error('Error downloading cost Excel template:', error);
      toast.error('Error al descargar la plantilla Excel');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    noClick: true,
    noKeyboard: true,
    maxFiles: 1,
    multiple: false,
  });

  const handleUpload = useCallback(async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;

    setStep('uploading');
    batchProgress.start('Cargando costos', validationResult.validRows.length);

    try {
      const { created, updated, skipped, errors } = await uploadCosts(validationResult.validRows);

      if (errors === 0) {
        batchProgress.complete();
        const parts = [];
        if (created > 0) parts.push(`${created} creados`);
        if (updated > 0) parts.push(`${updated} actualizados (marcados como pagados)`);
        if (skipped > 0) parts.push(`${skipped} omitidos (duplicados)`);
        toast.success(`Carga completada: ${parts.join(' · ') || 'sin cambios'}`);
        queryClient.invalidateQueries({ queryKey: ['costs'] });
        onSuccess?.(created + updated);
        setStep('done');
      } else {
        batchProgress.error(`${errors} registros con errores`);
        toast.error(`${created + updated} procesados, ${skipped} omitidos, ${errors} con errores`);
        setStep('done');
      }
    } catch (_err) {
      batchProgress.error('Error durante la carga');
      toast.error('Error durante la carga masiva');
      setStep('preview');
    }
  }, [validationResult, uploadCosts, batchProgress, queryClient, onSuccess]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/70">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-success-text" />
              Carga Masiva de Costos
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-success/30 bg-success-soft'
                    : 'border-muted-foreground/25 hover:border-success/30 hover:bg-success-soft'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="size-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo CSV o Excel'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  o usa el botón para seleccionar
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={open}
                >
                  Seleccionar archivo
                </Button>
              </div>

              {/* Template downloads */}
              <div className="flex items-center gap-2 justify-center">
                <span className="text-xs text-muted-foreground">Descargar plantilla:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCSVTemplate}
                >
                    <Download className="size-3 mr-1" />
                    CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExcelTemplate}
                >
                    <Download className="size-3 mr-1" />
                    Excel
                </Button>
              </div>

              {/* Column info */}
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Columnas requeridas:</strong> Fecha, Descripción, Monto, Categoría<br />
                  <strong>Opcionales:</strong> Subcategoría, Notas, Pagado (Sí/No), Fecha Pago
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === 'preview' && validationResult && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-success-text" />
                  <span className="text-sm font-medium truncate max-w-52">{file?.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { reset(); setStep('upload'); }}>
                  <X className="size-4" />
                </Button>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{validationResult.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total filas</p>
                </div>
                <div className="bg-success-soft rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-success-text">{validationResult.validRows.length}</p>
                  <p className="text-xs text-success-text">Válidos</p>
                </div>
                <div className={cn(
                  'rounded-lg p-3 text-center',
                  validationResult.invalidRows.length > 0
                    ? 'bg-danger-soft'
                    : 'bg-muted/50'
                )}>
                  <p className={cn(
                    'text-2xl font-bold',
                    validationResult.invalidRows.length > 0 ? 'text-danger-text' : 'text-muted-foreground'
                  )}>
                    {validationResult.invalidRows.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Errores</p>
                </div>
              </div>

              {/* Total amount preview */}
              {validationResult.validRows.length > 0 && (
                <div className="bg-accent rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Monto total a cargar</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(validationResult.validRows.reduce((s, r) => s + r.monto, 0))}
                  </p>
                </div>
              )}

              {/* Valid rows preview */}
              {validationResult.validRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Fecha</th>
                        <th className="px-2 py-1 text-left">Descripción</th>
                        <th className="px-2 py-1 text-right">Monto</th>
                        <th className="px-2 py-1 text-left">Categoría</th>
                        <th className="px-2 py-1 text-center">Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.validRows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{row.fecha}</td>
                          <td className="px-2 py-1 truncate max-w-36">{row.descripcion}</td>
                          <td className="px-2 py-1 text-right font-mono">{formatCurrency(row.monto)}</td>
                          <td className="px-2 py-1 truncate max-w-28">{row.categoria}</td>
                          <td className="px-2 py-1 text-center">
                            {row.pagado ? (
                              <CheckCircle className="size-3 text-success-text mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {validationResult.validRows.length > 20 && (
                        <tr className="border-t">
                          <td colSpan={5} className="px-2 py-1 text-center text-muted-foreground">
                            ... y {validationResult.validRows.length - 20} más
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Error rows */}
              {validationResult.invalidRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-danger-text flex items-center gap-1">
                    <AlertCircle className="size-4" />
                    Filas con errores ({validationResult.invalidRows.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {validationResult.invalidRows.slice(0, 10).map((row, i) => (
                      <div key={i} className="bg-danger-soft rounded p-2 text-xs">
                        <span className="font-medium">Fila {row.rowIndex}:</span>{' '}
                        {row.errors.join(' | ')}
                      </div>
                    ))}
                    {validationResult.invalidRows.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ... y {validationResult.invalidRows.length - 10} errores más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings - duplicates */}
              {validationResult.validRows.some(r => r.warnings.length > 0) && (() => {
                const dbDupes = validationResult.validRows.filter(r => r.warnings.some(w => w.includes('base de datos')));
                const fileDupes = validationResult.validRows.filter(r => r.warnings.some(w => w.includes('archivo')));
                return (
                  <div className="space-y-2">
                    {dbDupes.length > 0 && (
                      <Alert className="border-warning/30 bg-warning-soft">
                        <AlertTriangle className="size-4 text-warning-text" />
                        <AlertDescription className="text-xs">
                          <strong className="text-warning-text">{dbDupes.length} registro(s) ya existen en la base de datos</strong> (misma fecha, monto y descripción). Se cargarán igualmente si confirmas.
                          <div className="mt-1 max-h-20 overflow-y-auto space-y-0.5">
                            {dbDupes.slice(0, 5).map((r, i) => (
                              <div key={i} className="text-warning-text">Fila {r.rowIndex}: {r.descripcion} - ${r.monto.toLocaleString()}</div>
                            ))}
                            {dbDupes.length > 5 && <div className="text-warning-text">... y {dbDupes.length - 5} más</div>}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    {fileDupes.length > 0 && (
                      <Alert>
                        <AlertTriangle className="size-4" />
                        <AlertDescription className="text-xs">
                          {fileDupes.length} registro(s) duplicados dentro del archivo
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={validationResult.validRows.length === 0}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  <Upload className="size-4 mr-2" />
                  Cargar {validationResult.validRows.length} costos
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle className="size-12 text-success-text mx-auto" />
              <p className="text-lg font-medium">Carga completada</p>
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <BatchProgressModal
        state={batchProgress.state}
        onClose={batchProgress.close}
      />
    </>
  );
};
