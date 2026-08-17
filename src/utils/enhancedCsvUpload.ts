import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataMapper, MappedServiceData } from './dataMapper';
import type { Database } from '@/integrations/supabase/types';

import { createLogger } from '@/lib/logger';

const logger = createLogger('EnhancedCsvUpload');

const normalizeHeaderForComparison = (header: string): string =>
  header
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');

const EXCEL_DATE_HEADERS = new Set([
  'fechasolicitud',
  'fechaservicio',
  'requestdate',
  'servicedate',
]);

export const normalizeExcelCellValue = (header: string, cellValue: unknown): unknown => {
  const isDateColumn = EXCEL_DATE_HEADERS.has(normalizeHeaderForComparison(header));

  if (!isDateColumn) {
    return cellValue ?? '';
  }

  if (cellValue instanceof Date) {
    const year = cellValue.getUTCFullYear();
    const month = String(cellValue.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cellValue.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof cellValue === 'number' && (XLSX as any).SSF?.parse_date_code) {
    const parsed = (XLSX as any).SSF.parse_date_code(cellValue);
    if (parsed?.y) {
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${month}-${day}`;
    }
  }

  if (typeof cellValue === 'string') {
    const trimmed = cellValue.trim();
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);

    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    if (yyyymmdd) {
      const [, year, month, day] = yyyymmdd;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return trimmed;
  }

  return cellValue ?? '';
};

export const isMissingRequiredValue = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === '';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validRows: MappedServiceData[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
}

export interface UploadProgress {
  total: number;
  processed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  stage: 'parsing' | 'validating' | 'mapping' | 'uploading';
}

export type ServiceStatus = Database['public']['Enums']['service_status'];

export interface UploadOptions {
  /**
   * Estado con el que se insertan los servicios del lote.
   * La planilla no trae columna de estado: lo decide la casilla del modal.
   */
  status: ServiceStatus;
}

export interface UploadResult {
  success: boolean;
  cancelled?: boolean;
  processed: number;
  errors: number;
  message: string;
  failedRows?: number[];
  errorDetails?: ValidationError[];
  insertedFolios?: string[];
}

export class EnhancedCSVUploader {
  private dataMapper: DataMapper;
  private batchSize = 25;
  private uploadCancelled = false;

  constructor() {
    this.dataMapper = new DataMapper();
  }

  async initialize() {
    logger.debug('🔄 Initializing CSV uploader...');
    await this.dataMapper.initialize();
    logger.debug('✅ CSV uploader initialized successfully');
  }

  cancelUpload(): void {
    this.uploadCancelled = true;
  }

  async parseFile(file: File, onProgress?: (progress: UploadProgress) => void): Promise<any[]> {
    logger.debug('📁 Starting file parsing:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    return new Promise((resolve, reject) => {
      if (onProgress) {
        onProgress({
          total: 100,
          processed: 0,
          percentage: 0,
          currentBatch: 1,
          totalBatches: 1,
          stage: 'parsing'
        });
      }

      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      logger.debug('📊 File type detected:', isExcel ? 'Excel' : 'CSV');

      if (isExcel) {
        this.parseExcelFile(file, resolve, reject, onProgress);
      } else {
        this.parseCSVFile(file, resolve, reject, onProgress);
      }
    });
  }

  private parseCSVFile(
    file: File, 
    resolve: (value: any[]) => void, 
    reject: (reason: any) => void,
    onProgress?: (progress: UploadProgress) => void
  ) {
    logger.debug('📄 Parsing CSV file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        const trimmed = header.trim();
        logger.debug('🏷️ Header found:', trimmed);
        return trimmed;
      },
      step: (results, _parser) => {
        if (onProgress) {
          const progress = Math.round((results.meta.cursor / file.size) * 100);
          onProgress({
            total: 100,
            processed: progress,
            percentage: progress,
            currentBatch: 1,
            totalBatches: 1,
            stage: 'parsing'
          });
        }
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          logger.error('❌ CSV parsing errors:', results.errors);
          reject(new Error(`Error parsing CSV: ${results.errors[0].message}`));
        } else {
          logger.debug('✅ CSV parsed successfully. Rows:', results.data.length);
          resolve(results.data as any[]);
        }
      },
      error: (error) => {
        logger.error('❌ CSV file reading error:', error);
        reject(new Error(`Error reading CSV file: ${error.message}`));
      }
    });
  }

  private parseExcelFile(
    file: File, 
    resolve: (value: any[]) => void, 
    reject: (reason: any) => void,
    onProgress?: (progress: UploadProgress) => void
  ) {
    logger.debug('📊 Parsing Excel file...');
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        if (onProgress) {
          onProgress({
            total: 100,
            processed: 25,
            percentage: 25,
            currentBatch: 1,
            totalBatches: 1,
            stage: 'parsing'
          });
        }

        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        logger.debug('📋 Excel workbook loaded. Sheet:', sheetName);
        
        // Convert to JSON with raw values so we can safely convert Date cells
        // ourselves using UTC components (avoids local-TZ off-by-one days).
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: true,
        });
        
        logger.debug('📊 Raw Excel data rows:', jsonData.length);
        
        if (jsonData.length < 2) {
          logger.debug('⚠️ Excel file has no data rows');
          resolve([]);
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        logger.debug('🏷️ Excel headers found:', headers);
        logger.debug('📊 Excel data rows:', rows.length);

        const processedData = rows
          .filter(row => {
            const hasData = row.some(cell => cell !== '');
            if (!hasData) {
              logger.debug('🗑️ Skipping empty row');
            }
            return hasData;
          })
          .map((row, index) => {
            const rowObject: any = {};
            headers.forEach((header, headerIndex) => {
              const cleanHeader = String(header ?? '').trim();
              rowObject[cleanHeader] = normalizeExcelCellValue(cleanHeader, row[headerIndex]);
            });
            
            if (index === 0) {
              logger.debug('🔍 Sample processed row:', rowObject);
            }
            
            return rowObject;
          });

        if (onProgress) {
          onProgress({
            total: 100,
            processed: 100,
            percentage: 100,
            currentBatch: 1,
            totalBatches: 1,
            stage: 'parsing'
          });
        }

        logger.debug('✅ Excel parsed successfully. Final processed rows:', processedData.length);
        resolve(processedData);
      } catch (error) {
        logger.error('❌ Excel processing error:', error);
        reject(new Error(`Error processing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      logger.error('❌ File reading error');
      reject(new Error('Error reading file'));
    };
    
    reader.readAsArrayBuffer(file);
  }

  async validateAndMapData(
    csvData: any[],
    existingFolios: string[] = [],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ValidationResult> {
    logger.debug('🔍 Starting validation and mapping for', csvData.length, 'rows');
    
    const errors: ValidationError[] = [];
    const validRows: MappedServiceData[] = [];
    let warningCount = 0;

    if (onProgress) {
      onProgress({
        total: csvData.length,
        processed: 0,
        percentage: 0,
        currentBatch: 1,
        totalBatches: 1,
        stage: 'validating'
      });
    }

    // Validate headers first
    if (csvData.length > 0) {
      const headers = Object.keys(csvData[0]);
      logger.debug('🏷️ Headers to validate:', headers);
      
      const headerValidation = this.dataMapper.validateHeaders(headers);
      logger.debug('📋 Header validation result:', headerValidation);
      
      if (!headerValidation.valid) {
        logger.debug('❌ Missing required headers:', headerValidation.missing);
        headerValidation.missing.forEach(missing => {
          errors.push({
            row: -1,
            field: 'headers',
            message: `Columna requerida faltante: ${missing}`,
            value: missing,
            severity: 'error'
          });
        });
      }

      // Filtrar columnas vacías antes de advertir
      const nonEmptyExtras = headerValidation.extra.filter(extra => extra && extra.trim() !== '');
      
      if (nonEmptyExtras.length > 0) {
        logger.debug('⚠️ Extra headers found:', nonEmptyExtras);
        nonEmptyExtras.forEach(extra => {
          errors.push({
            row: -1,
            field: 'headers',
            message: `Columna no reconocida: ${extra}`,
            value: extra,
            severity: 'warning'
          });
        });
        warningCount += nonEmptyExtras.length;
      }
    }

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      logger.debug(`🔍 Processing row ${i + 1}:`, row);
      
      if (onProgress) {
        onProgress({
          total: csvData.length,
          processed: i + 1,
          percentage: Math.round(((i + 1) / csvData.length) * 100),
          currentBatch: 1,
          totalBatches: 1,
          stage: 'mapping'
        });
      }

      // Map headers to expected format
      const mappedRow: any = {};
      const mappedHeaders = this.dataMapper.mapHeaders(Object.keys(row));
      logger.debug(`🗺️ Row ${i + 1} header mapping:`, Object.keys(row), '→', mappedHeaders);
      
      Object.keys(row).forEach((key, index) => {
        mappedRow[mappedHeaders[index]] = row[key];
      });
      
      logger.debug(`🔄 Row ${i + 1} mapped data:`, mappedRow);

      // Validate required fields
      const requiredFields = [
        'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName', 'clientDepartment',
        'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
        'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
      ];
      
      logger.debug(`🔍 Row ${i + 1} checking required fields:`, requiredFields);
      
      for (const field of requiredFields) {
        const value = mappedRow[field];
        const isEmpty = isMissingRequiredValue(value);
        
        if (isEmpty) {
          logger.debug(`❌ Row ${i + 1} missing field '${field}':`, value);
          errors.push({
            row: i,
            field,
            message: `Campo requerido faltante: ${field}`,
            value: mappedRow[field],
            severity: 'error'
          });
        } else {
          logger.debug(`✅ Row ${i + 1} field '${field}' ok:`, value);
        }
      }

      // Check for duplicate folios
      if (mappedRow.folio && existingFolios.includes(mappedRow.folio.toString())) {
        logger.debug(`❌ Row ${i + 1} duplicate folio:`, mappedRow.folio);
        errors.push({
          row: i,
          field: 'folio',
          message: `Folio duplicado: ${mappedRow.folio}`,
          value: mappedRow.folio,
          severity: 'error'
        });
      }

      // Map data to IDs and validate
      logger.debug(`🔄 Row ${i + 1} starting data mapping...`);
      const mappingResult = await this.dataMapper.mapRowData(mappedRow);
      logger.debug(`📊 Row ${i + 1} mapping result:`, mappingResult);
      
      if (!mappingResult.success) {
        logger.debug(`❌ Row ${i + 1} mapping failed:`, mappingResult.errors);
        mappingResult.errors.forEach(error => {
          errors.push({
            row: i,
            field: 'mapping',
            message: error,
            value: mappedRow,
            severity: 'error'
          });
        });
      } else {
        logger.debug(`✅ Row ${i + 1} mapping successful`);
        validRows.push(mappingResult.data!);
      }

      // Add warnings
      if (mappingResult.warnings) {
        logger.debug(`⚠️ Row ${i + 1} warnings:`, mappingResult.warnings);
        mappingResult.warnings.forEach(warning => {
          errors.push({
            row: i,
            field: 'warning',
            message: warning,
            value: mappedRow,
            severity: 'warning'
          });
          warningCount++;
        });
      }
    }

    const errorCount = errors.filter(e => e.severity === 'error').length;
    
    const finalResult = {
      isValid: errorCount === 0,
      errors,
      validRows,
      totalRows: csvData.length,
      validCount: validRows.length,
      errorCount,
      warningCount
    };
    
    logger.debug('📊 Final validation result:', {
      isValid: finalResult.isValid,
      totalRows: finalResult.totalRows,
      validCount: finalResult.validCount,
      errorCount: finalResult.errorCount,
      warningCount: finalResult.warningCount
    });
    
    return finalResult;
  }

  async uploadServices(
    services: MappedServiceData[],
    createService: (service: any) => Promise<any>,
    onProgress?: (progress: UploadProgress) => void,
    options: UploadOptions = { status: 'pending' }
  ): Promise<UploadResult> {
    this.uploadCancelled = false;
    const status: ServiceStatus = options.status;
    const total = services.length;
    const totalBatches = Math.ceil(total / this.batchSize);
    let processed = 0;
    let errors = 0;
    const failedRows: number[] = [];
    const errorDetails: ValidationError[] = [];
    const insertedFolios: string[] = [];
    const cancelledResult = (): UploadResult => ({
      success: false,
      cancelled: true,
      processed,
      errors,
      message: `Carga cancelada: ${processed} de ${total} servicios creados`,
      failedRows: failedRows.length > 0 ? failedRows : undefined,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      insertedFolios: insertedFolios.length > 0 ? insertedFolios : undefined
    });

    logger.debug('🚀 Starting service upload:', {
      total,
      batchSize: this.batchSize,
      totalBatches,
      status
    });

    if (onProgress) {
      onProgress({
        total,
        processed: 0,
        percentage: 0,
        currentBatch: 1,
        totalBatches,
        stage: 'uploading'
      });
    }

    try {
      for (let i = 0; i < totalBatches; i++) {
        if (this.uploadCancelled) {
          return cancelledResult();
        }

        const batch = services.slice(i * this.batchSize, (i + 1) * this.batchSize);
        const currentBatch = i + 1;

        logger.debug(`📦 Processing batch ${currentBatch}/${totalBatches} with ${batch.length} services`);

        for (let j = 0; j < batch.length; j++) {
          if (this.uploadCancelled) {
            return cancelledResult();
          }

          const service = batch[j];
          const globalIndex = i * this.batchSize + j;

          logger.debug(`🔄 Creating service ${globalIndex + 1}/${total}:`, service);

          try {
            // Validate required fields before creating service
            const requiredFields = ['folio', 'clientId', 'craneId', 'operatorId'];
            for (const field of requiredFields) {
              if (!service[field as keyof MappedServiceData]) {
                throw new Error(`Campo requerido faltante: ${field}`);
              }
            }

            const serviceData = {
              folio: service.folio,
              requestDate: service.requestDate,
              serviceDate: service.serviceDate,
              client: service.clientId,
              vehicleBrand: service.vehicleBrand,
              vehicleModel: service.vehicleModel,
              licensePlate: service.licensePlate,
              origin: service.origin,
              destination: service.destination,
              serviceType: service.serviceTypeId,
              value: service.value,
              crane: service.craneId,
              operators: [{
                operatorId: service.operatorId,
                commission: service.operatorCommission
              }],
              status,
              observations: service.observations || '',
              hasExcess: false
            };

            logger.debug(`📤 Sending service data:`, serviceData);

            await createService(serviceData);
            processed++;
            insertedFolios.push(service.folio);
            logger.debug(`✅ Service ${globalIndex + 1} created successfully`);
          } catch (error) {
            logger.error(`❌ Error creating service at row ${globalIndex}:`, error);
            errors++;
            failedRows.push(globalIndex);
            
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            errorDetails.push({
              row: globalIndex,
              field: 'creation',
              message: `Error al crear servicio: ${errorMessage}`,
              value: service,
              severity: 'error'
            });
          }

          if (onProgress) {
            onProgress({
              total,
              processed: processed + errors,
              percentage: Math.round(((processed + errors) / total) * 100),
              currentBatch,
              totalBatches,
              stage: 'uploading'
            });
          }
        }

        // Small delay between batches to avoid overwhelming the API
        if (i < totalBatches - 1) {
          logger.debug('⏳ Waiting between batches...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const result = {
        success: errors === 0,
        processed,
        errors,
        message: errors === 0 
          ? `${processed} servicios cargados exitosamente`
          : `${processed} servicios cargados, ${errors} errores`,
        failedRows: failedRows.length > 0 ? failedRows : undefined,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        insertedFolios: insertedFolios.length > 0 ? insertedFolios : undefined
      };

      logger.debug('📊 Upload completed:', result);
      return result;

    } catch (error) {
      logger.error('❌ Error during batch upload:', error);
      return {
        success: false,
        processed,
        errors: total - processed,
        message: `Error durante la carga: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        failedRows,
        errorDetails
      };
    }
  }

  generateTemplate(): void {
    const headers = [
      'Folio',
      'Fecha Solicitud',
      'Fecha Servicio',
      'Cliente RUT',
      'Cliente Nombre',
      'Cliente Departamento',
      'Vehículo Marca',
      'Vehículo Modelo',
      'Patente',
      'Origen',
      'Destino',
      'Tipo Servicio',
      'Valor',
      'Grúa Patente',
      'Operador RUT',
      'Comisión Operador',
      'Observaciones'
    ];

    const sampleData = [
      'SRV-001',
      '2024-01-15',
      '2024-01-16',
      '12.345.678-9',
      'Transportes Ejemplo Ltda.',
      'Seguros',
      'Mercedes',
      'Actros',
      'ABCD-12',
      'Santiago Centro',
      'Las Condes',
      'Grúa Pesada',
      '150000',
      'GRUA-01',
      '16.123.456-7',
      '15000',
      'Servicio de ejemplo'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_servicios.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  generateExcelTemplate(): void {
    const sampleData = [{
      'Folio': 'SRV-001',
      'Fecha Solicitud': '2024-01-15',
      'Fecha Servicio': '2024-01-16',
      'Cliente RUT': '12.345.678-9',
      'Cliente Nombre': 'Transportes Ejemplo Ltda.',
      'Cliente Departamento': 'Seguros',
      'Vehículo Marca': 'Mercedes',
      'Vehículo Modelo': 'Actros',
      'Patente': 'ABCD-12',
      'Origen': 'Santiago Centro',
      'Destino': 'Las Condes',
      'Tipo Servicio': 'Grúa Pesada',
      'Valor': 150000,
      'Grúa Patente': 'GRUA-01',
      'Operador RUT': '16.123.456-7',
      'Comisión Operador': 15000,
      'Observaciones': 'Servicio de ejemplo'
    }];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Servicios');

    XLSX.writeFile(workbook, 'plantilla_servicios.xlsx');
  }
}
