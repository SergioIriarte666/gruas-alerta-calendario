
import { useState, useCallback } from 'react';
import { EnhancedCSVUploader, ValidationResult, UploadProgress, UploadResult } from '@/utils/enhancedCsvUpload';
import { MappedServiceData } from '@/utils/dataMapper';
import { useServices } from '@/hooks/useServices';
import { toast } from 'sonner';

export const useEnhancedCSVUpload = () => {
  const { createService,services } = useServices();
  const [uploader] = useState(() => new EnhancedCSVUploader());
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const initializeUploader = useCallback(async () => {
    if (!isInitialized) {
      try {
        await uploader.initialize();
        setIsInitialized(true);
        console.log('CSV uploader initialized successfully');
      } catch (error) {
        console.error('Error initializing CSV uploader:', error);
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
      console.log(`Parsed ${data.length} rows from file`);
      return data;
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error(`Error al procesar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      throw error;
    }
  }, [file, uploader, initializeUploader]);

  const validateData = useCallback(async () => {
    if (csvData.length === 0) {
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
        csvData,
        existingFolios,
        setUploadProgress
      );

      setValidationResult(result);

      if (result.isValid) {
        toast.success(`Validación exitosa: ${result.validCount} servicios listos para cargar`);
      } else {
        toast.warning(`Validación completada: ${result.validCount} válidos, ${result.errorCount} errores`);
      }

      console.log('Validation result:', {
        valid: result.isValid,
        total: result.totalRows,
        validCount: result.validCount,
        errorCount: result.errorCount,
        warningCount: result.warningCount
      });

    } catch (error) {
      console.error('Error validating data:', error);
      toast.error(`Error en validación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsValidating(false);
      setUploadProgress(null);
    }
  }, [csvData, uploader, initializeUploader, services]);

  const uploadServices = useCallback(async (): Promise<UploadResult | null> => {
    if (!validationResult || !validationResult.isValid || validationResult.validRows.length === 0) {
      toast.error('No hay datos válidos para cargar');
      return null;
    }

    try {
      setIsUploading(true);
      setUploadProgress(null);
      setUploadResult(null);

      const result = await uploader.uploadServices(
        validationResult.validRows,
        createService,
        setUploadProgress
      );

      setUploadResult(result);

      if (result.success) {
        toast.success(`Carga exitosa: ${result.processed} servicios creados`);
      } else {
        toast.error(`Carga parcial: ${result.processed} exitosos, ${result.errors} errores`);
      }

      return result;

    } catch (error) {
      console.error('Error uploading services:', error);
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
      setUploadProgress(null);
    }
  }, [validationResult, uploader, createService]);

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
  };
};
