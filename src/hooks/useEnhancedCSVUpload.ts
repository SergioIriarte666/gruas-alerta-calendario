
import { useState, useCallback } from 'react';
import { EnhancedCSVUploader, ValidationResult, UploadProgress, UploadResult, ServiceStatus } from '@/utils/enhancedCsvUpload';
import { useServices } from '@/hooks/useServices';
import { useFolioGenerator } from '@/hooks/useFolioGenerator';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useEnhancedCSVUpload");
export const useEnhancedCSVUpload = () => {
  const { createService, services, refetch } = useServices();
  const { syncAllFoliosAfterBulkUpload } = useFolioGenerator();
  const [uploader] = useState(() => new EnhancedCSVUploader());
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const initializeUploader = useCallback(async () => {
    if (!isInitialized) {
      try {
        await uploader.initialize();
        setIsInitialized(true);
        logger.debug('CSV uploader initialized successfully');
      } catch (error) {
        logger.error('Error initializing CSV uploader:', error);
        toast.error('Error al inicializar el cargador de archivos');
      }
    }
  }, [uploader, isInitialized]);

  const parseFile = useCallback(async (): Promise<any[]> => {
    if (!file) {
      throw new Error('No file selected');
    }

    await initializeUploader();

    try {
      setUploadProgress(null);
      const data = await uploader.parseFile(file, setUploadProgress);
      setCsvData(data);
      logger.debug(`Parsed ${data.length} rows from file`);
      return data;
    } catch (error) {
      logger.error('Error parsing file:', error);
      toast.error(`Error al procesar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      throw error;
    }
  }, [file, uploader, initializeUploader]);

  const validateData = useCallback(async (dataToValidate?: any[]) => {
    const dataToUse = dataToValidate || csvData;
    
    if (dataToUse.length === 0) {
      toast.error('No hay datos para validar');
      return;
    }

    await initializeUploader();

    try {
      setIsValidating(true);
      setUploadProgress(null);

      // Get existing folios to check for duplicates
      const existingFolios = services.map(service => service.folio);

      const result = await uploader.validateAndMapData(
        dataToUse,
        existingFolios,
        setUploadProgress
      );

      setValidationResult(result);

      if (result.isValid) {
        toast.success(`Validación exitosa: ${result.validCount} servicios listos para cargar`);
      } else {
        toast.warning(`Validación completada: ${result.validCount} válidos, ${result.errorCount} errores`);
      }

      logger.debug('Validation result:', {
        valid: result.isValid,
        total: result.totalRows,
        validCount: result.validCount,
        errorCount: result.errorCount,
        warningCount: result.warningCount
      });

    } catch (error) {
      logger.error('Error validating data:', error);
      toast.error(`Error en validación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsValidating(false);
      setUploadProgress(null);
    }
  }, [csvData, uploader, initializeUploader, services]);

  const uploadServices = useCallback(async (
    { markAsCompleted = false }: { markAsCompleted?: boolean } = {}
  ): Promise<UploadResult | null> => {
    if (!validationResult || !validationResult.isValid || validationResult.validRows.length === 0) {
      toast.error('No hay datos válidos para cargar');
      return null;
    }

    // La planilla no trae columna de estado: el estado del lote lo decide
    // exclusivamente la casilla del modal.
    const status: ServiceStatus = markAsCompleted ? 'completed' : 'pending';

    try {
      setIsUploading(true);
      setIsCancelling(false);
      setUploadProgress(null);
      setUploadResult(null);

      const result = await uploader.uploadServices(
        validationResult.validRows,
        (serviceData) => createService(serviceData, {
          silent: true,
          tolerateResourceSyncFailure: true,
          skipInvalidation: true,
          skipRefetch: true,
        }),
        setUploadProgress,
        { status }
      );

      setUploadResult(result);

      if (result.cancelled) {
        toast.info(result.message);
      } else if (result.success) {
        toast.success(
          `${result.processed} servicios cargados como ${markAsCompleted ? 'completados' : 'pendientes'}`
        );
      } else {
        toast.error(`Carga parcial: ${result.processed} exitosos, ${result.errors} errores`);
      }

      // Sincronizar el contador de folios después de la carga masiva
      if (result.insertedFolios && result.insertedFolios.length > 0) {
        logger.debug('🔄 Syncing folio counter after bulk upload...');
        await syncAllFoliosAfterBulkUpload(result.insertedFolios);
        await refetch();
      }

      return result;

    } catch (error) {
      logger.error('Error uploading services:', error);
      const errorResult: UploadResult = {
        success: false,
        processed: 0,
        errors: validationResult.validRows.length,
        message: `Error durante la carga: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
      setUploadResult(errorResult);
      toast.error(errorResult.message);
      return errorResult;
    } finally {
      setIsUploading(false);
      setIsCancelling(false);
      setUploadProgress(null);
    }
  }, [validationResult, uploader, createService, refetch, syncAllFoliosAfterBulkUpload]);

  const cancelUpload = useCallback(() => {
    if (!isUploading || isCancelling) return;

    setIsCancelling(true);
    uploader.cancelUpload();
    toast.info('Cancelando carga después del servicio en curso...');
  }, [isUploading, isCancelling, uploader]);

  const downloadTemplate = useCallback(() => {
    uploader.generateTemplate();
  }, [uploader]);

  const downloadExcelTemplate = useCallback(() => {
    uploader.generateExcelTemplate();
  }, [uploader]);

  const reset = useCallback(() => {
    setFile(null);
    setCsvData([]);
    setValidationResult(null);
    setUploadProgress(null);
    setUploadResult(null);
  }, []);

  return {
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
  };
};
