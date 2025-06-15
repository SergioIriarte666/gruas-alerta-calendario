import { useState, useCallback } from 'react';
import { CSVServiceUploader, UploadProgress, UploadResult } from '@/utils/csvUpload';
import { UploadedServiceRow, ValidationResult, validateUploadedData } from '@/utils/csvValidations';
import { Service } from '@/types';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperators } from './useOperators';
import { useServices } from './useServices';

interface CSVUploadState {
  file: File | null;
  csvData: UploadedServiceRow[];
  validationResult: ValidationResult | null;
  isValidating: boolean;
  isUploading: boolean;
  uploadProgress: UploadProgress | null;
  uploadResult: UploadResult | null;
}

export const useCSVUpload = () => {
  const [state, setState] = useState<CSVUploadState>({
    file: null,
    csvData: [],
    validationResult: null,
    isValidating: false,
    isUploading: false,
    uploadProgress: null,
    uploadResult: null
  });

  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();
  const { services, createService } = useServices();
  const csvUploader = new CSVServiceUploader();

  // Set selected file
  const setFile = useCallback((file: File | null) => {
    setState(prev => ({
      ...prev,
      file,
      csvData: [],
      validationResult: null,
      uploadResult: null
    }));
  }, []);

  // Parse CSV file
  const parseFile = useCallback(async () => {
    if (!state.file) return;

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      let parsedData: UploadedServiceRow[];
      if (state.file.name.endsWith('.csv')) {
        parsedData = await csvUploader.parseCSV(state.file);
      } else if (/\.(xlsx|xls)$/i.test(state.file.name)) {
        parsedData = await csvUploader.parseExcel(state.file);
      } else {
        throw new Error('Tipo de archivo no soportado. Por favor, suba un archivo .csv o .xlsx.');
      }
      
      setState(prev => ({
        ...prev,
        csvData: parsedData,
        isValidating: false
      }));
      return parsedData;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setState(prev => ({
        ...prev,
        isValidating: false,
        validationResult: {
          isValid: false,
          errors: [{
            row: 0,
            field: 'file',
            message: error instanceof Error ? error.message : 'Error parsing file',
            value: state.file?.name
          }],
          validRows: []
        }
      }));
      return [];
    }
  }, [state.file, csvUploader]);

  // Validate CSV data
  const validateData = useCallback(() => {
    if (state.csvData.length === 0) return;

    setState(prev => ({ ...prev, isValidating: true }));

    const existingFolios = services.map(s => s.folio);
    const validationResult = validateUploadedData(
      state.csvData,
      clients,
      cranes,
      operators,
      existingFolios
    );

    setState(prev => ({
      ...prev,
      validationResult,
      isValidating: false
    }));

    return validationResult;
  }, [state.csvData, clients, cranes, operators, services]);

  // Upload validated services
  const uploadServices = useCallback(async () => {
    if (!state.validationResult?.validRows.length) return;

    setState(prev => ({ ...prev, isUploading: true, uploadProgress: null }));

    try {
      // Convert CSV rows to Service objects
      const servicesToCreate = state.validationResult.validRows.map(csvRow =>
        csvUploader.convertToService(csvRow, clients, cranes, operators)
      );

      // Process in batches with progress callback
      const result = await csvUploader.processBatch(
        servicesToCreate,
        createService,
        (progress) => {
          setState(prev => ({ ...prev, uploadProgress: progress }));
        }
      );

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadResult: result
      }));

      return result;
    } catch (error) {
      console.error('Error uploading services:', error);
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadResult: {
          success: false,
          processed: 0,
          errors: state.validationResult?.validRows.length || 0,
          message: error instanceof Error ? error.message : 'Error uploading services'
        }
      }));
    }
  }, [state.validationResult, clients, cranes, operators, createService, csvUploader]);

  // Download template
  const downloadTemplate = useCallback(() => {
    csvUploader.downloadTemplate();
  }, [csvUploader]);

  // Download Excel template
  const downloadExcelTemplate = useCallback(() => {
    csvUploader.downloadExcelTemplate();
  }, [csvUploader]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      file: null,
      csvData: [],
      validationResult: null,
      isValidating: false,
      isUploading: false,
      uploadProgress: null,
      uploadResult: null
    });
  }, []);

  return {
    ...state,
    setFile,
    parseFile,
    validateData,
    uploadServices,
    downloadTemplate,
    downloadExcelTemplate,
    reset
  };
};
