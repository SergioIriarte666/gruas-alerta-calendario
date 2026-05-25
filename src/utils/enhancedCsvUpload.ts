import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataMapper, MappedServiceData } from './dataMapper';

import { toLocalDateString } from '@/utils/timezoneUtils';

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

export interface UploadResult {
  success: boolean;
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

  constructor() {
    this.dataMapper = new DataMapper();
  }

  async initialize() {
    console.log('🔄 Initializing CSV uploader...');
    await this.dataMapper.initialize();
    console.log('✅ CSV uploader initialized successfully');
  }

  async parseFile(file: File, onProgress?: (progress: UploadProgress) => void): Promise<any[]> {
    console.log('📁 Starting file parsing:', file.name, 'Size:', file.size, 'Type:', file.type);
    
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
      console.log('📊 File type detected:', isExcel ? 'Excel' : 'CSV');

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
    console.log('📄 Parsing CSV file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        const trimmed = header.trim();
        console.log('🏷️ Header found:', trimmed);
        return trimmed;
      },
      step: (results, parser) => {
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
          console.error('❌ CSV parsing errors:', results.errors);
          reject(new Error(`Error parsing CSV: ${results.errors[0].message}`));
        } else {
          console.log('✅ CSV parsed successfully. Rows:', results.data.length);
          resolve(results.data as any[]);
        }
      },
      error: (error) => {
        console.error('❌ CSV file reading error:', error);
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
    console.log('📊 Parsing Excel file...');
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
        
        console.log('📋 Excel workbook loaded. Sheet:', sheetName);
        
        // Convert to JSON with raw values so we can safely convert Date cells
        // ourselves using UTC components (avoids local-TZ off-by-one days).
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: true,
        });
        
        console.log('📊 Raw Excel data rows:', jsonData.length);
        
        if (jsonData.length < 2) {
          console.log('⚠️ Excel file has no data rows');
          resolve([]);
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        console.log('🏷️ Excel headers found:', headers);
        console.log('📊 Excel data rows:', rows.length);

        const processedData = rows
          .filter(row => {
            const hasData = row.some(cell => cell !== '');
            if (!hasData) {
              console.log('🗑️ Skipping empty row');
            }
            return hasData;
          })
          .map((row, index) => {
            const rowObject: any = {};
            headers.forEach((header, headerIndex) => {
              let value = row[headerIndex];
              
              // Excel serial dates arrive as Date objects (cellDates:true).
              // Use UTC components to preserve the literal day the user typed,
              // regardless of the browser timezone.
              if (value instanceof Date) {
                const y = value.getUTCFullYear();
                const m = String(value.getUTCMonth() + 1).padStart(2, '0');
                const d = String(value.getUTCDate()).padStart(2, '0');
                value = `${y}-${m}-${d}`;
              } else if (typeof value === 'number' && (XLSX as any).SSF?.parse_date_code) {
                // Defensive: numeric Excel serial dates → YYYY-MM-DD
                const parsed = (XLSX as any).SSF.parse_date_code(value);
                if (parsed && parsed.y) {
                  const y = parsed.y;
                  const m = String(parsed.m).padStart(2, '0');
                  const d = String(parsed.d).padStart(2, '0');
                  value = `${y}-${m}-${d}`;
                }
              } else if (typeof value === 'string') {
                // Handle DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
                const trimmed = value.trim();
                const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
                const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
                if (ddmmyyyy) {
                  const [, d, m, y] = ddmmyyyy;
                  value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                  console.log(`📅 Converted date ${trimmed} to ${value}`);
                } else if (yyyymmdd) {
                  const [, y, m, d] = yyyymmdd;
                  value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
              }
              
              rowObject[header.trim()] = value || '';
            });
            
            if (index === 0) {
              console.log('🔍 Sample processed row:', rowObject);
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

        console.log('✅ Excel parsed successfully. Final processed rows:', processedData.length);
        resolve(processedData);
      } catch (error) {
        console.error('❌ Excel processing error:', error);
        reject(new Error(`Error processing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      console.error('❌ File reading error');
      reject(new Error('Error reading file'));
    };
    
    reader.readAsArrayBuffer(file);
  }

  async validateAndMapData(
    csvData: any[],
    existingFolios: string[] = [],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ValidationResult> {
    console.log('🔍 Starting validation and mapping for', csvData.length, 'rows');
    
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
      console.log('🏷️ Headers to validate:', headers);
      
      const headerValidation = this.dataMapper.validateHeaders(headers);
      console.log('📋 Header validation result:', headerValidation);
      
      if (!headerValidation.valid) {
        console.log('❌ Missing required headers:', headerValidation.missing);
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
        console.log('⚠️ Extra headers found:', nonEmptyExtras);
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
      console.log(`🔍 Processing row ${i + 1}:`, row);
      
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
      console.log(`🗺️ Row ${i + 1} header mapping:`, Object.keys(row), '→', mappedHeaders);
      
      Object.keys(row).forEach((key, index) => {
        mappedRow[mappedHeaders[index]] = row[key];
      });
      
      console.log(`🔄 Row ${i + 1} mapped data:`, mappedRow);

      // Validate required fields
      const requiredFields = [
        'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName', 'clientDepartment',
        'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
        'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
      ];
      
      console.log(`🔍 Row ${i + 1} checking required fields:`, requiredFields);
      
      for (const field of requiredFields) {
        const value = mappedRow[field];
        const isEmpty = !value || value.toString().trim() === '';
        
        if (isEmpty) {
          console.log(`❌ Row ${i + 1} missing field '${field}':`, value);
          errors.push({
            row: i,
            field,
            message: `Campo requerido faltante: ${field}`,
            value: mappedRow[field],
            severity: 'error'
          });
        } else {
          console.log(`✅ Row ${i + 1} field '${field}' ok:`, value);
        }
      }

      // Check for duplicate folios
      if (mappedRow.folio && existingFolios.includes(mappedRow.folio.toString())) {
        console.log(`❌ Row ${i + 1} duplicate folio:`, mappedRow.folio);
        errors.push({
          row: i,
          field: 'folio',
          message: `Folio duplicado: ${mappedRow.folio}`,
          value: mappedRow.folio,
          severity: 'error'
        });
      }

      // Map data to IDs and validate
      console.log(`🔄 Row ${i + 1} starting data mapping...`);
      const mappingResult = await this.dataMapper.mapRowData(mappedRow);
      console.log(`📊 Row ${i + 1} mapping result:`, mappingResult);
      
      if (!mappingResult.success) {
        console.log(`❌ Row ${i + 1} mapping failed:`, mappingResult.errors);
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
        console.log(`✅ Row ${i + 1} mapping successful`);
        validRows.push(mappingResult.data!);
      }

      // Add warnings
      if (mappingResult.warnings) {
        console.log(`⚠️ Row ${i + 1} warnings:`, mappingResult.warnings);
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
    
    console.log('📊 Final validation result:', {
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
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const total = services.length;
    const totalBatches = Math.ceil(total / this.batchSize);
    let processed = 0;
    let errors = 0;
    const failedRows: number[] = [];
    const errorDetails: ValidationError[] = [];
    const insertedFolios: string[] = [];

    console.log('🚀 Starting service upload:', {
      total,
      batchSize: this.batchSize,
      totalBatches
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
        const batch = services.slice(i * this.batchSize, (i + 1) * this.batchSize);
        const currentBatch = i + 1;

        console.log(`📦 Processing batch ${currentBatch}/${totalBatches} with ${batch.length} services`);

        for (let j = 0; j < batch.length; j++) {
          const service = batch[j];
          const globalIndex = i * this.batchSize + j;

          console.log(`🔄 Creating service ${globalIndex + 1}/${total}:`, service);

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
              status: 'pending' as const,
              observations: service.observations || '',
              hasExcess: false
            };

            console.log(`📤 Sending service data:`, serviceData);

            await createService(serviceData);
            processed++;
            insertedFolios.push(service.folio);
            console.log(`✅ Service ${globalIndex + 1} created successfully`);
          } catch (error) {
            console.error(`❌ Error creating service at row ${globalIndex}:`, error);
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
          console.log('⏳ Waiting between batches...');
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

      console.log('📊 Upload completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Error during batch upload:', error);
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
