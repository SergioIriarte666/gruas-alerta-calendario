
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataMapper, MappedServiceData } from './dataMapper';

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
}

export class EnhancedCSVUploader {
  private dataMapper: DataMapper;
  private batchSize = 25;

  constructor() {
    this.dataMapper = new DataMapper();
  }

  async initialize() {
    await this.dataMapper.initialize();
  }

  async parseFile(file: File, onProgress?: (progress: UploadProgress) => void): Promise<any[]> {
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
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        return header.trim();
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
          reject(new Error(`Error parsing CSV: ${results.errors[0].message}`));
        } else {
          resolve(results.data as any[]);
        }
      },
      error: (error) => {
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
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        if (onProgress) {
          onProgress({
            total: 100,
            processed: 50,
            percentage: 50,
            currentBatch: 1,
            totalBatches: 1,
            stage: 'parsing'
          });
        }

        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with proper handling of dates and empty cells
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '', 
          raw: false,
          dateNF: 'yyyy-mm-dd'
        });
        
        if (jsonData.length < 2) {
          resolve([]);
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        const processedData = rows
          .filter(row => row.some(cell => cell !== ''))
          .map(row => {
            const rowObject: any = {};
            headers.forEach((header, index) => {
              let value = row[index];
              
              // Handle date conversion for Excel
              if (typeof value === 'string' && value.includes('/')) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  value = date.toISOString().split('T')[0];
                }
              }
              
              rowObject[header.trim()] = value || '';
            });
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

        resolve(processedData);
      } catch (error) {
        reject(new Error(`Error processing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  }

  async validateAndMapData(
    csvData: any[],
    existingFolios: string[] = [],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ValidationResult> {
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
      const headerValidation = this.dataMapper.validateHeaders(headers);
      
      if (!headerValidation.valid) {
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

      if (headerValidation.extra.length > 0) {
        headerValidation.extra.forEach(extra => {
          errors.push({
            row: -1,
            field: 'headers',
            message: `Columna no reconocida: ${extra}`,
            value: extra,
            severity: 'warning'
          });
        });
        warningCount += headerValidation.extra.length;
      }
    }

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
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
      Object.keys(row).forEach((key, index) => {
        mappedRow[mappedHeaders[index]] = row[key];
      });

      // Validate required fields
      const requiredFields = ['folio', 'requestDate', 'serviceDate', 'clientRut', 'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination', 'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'];
      
      for (const field of requiredFields) {
        if (!mappedRow[field] || mappedRow[field].toString().trim() === '') {
          errors.push({
            row: i,
            field,
            message: `Campo requerido faltante: ${field}`,
            value: mappedRow[field],
            severity: 'error'
          });
        }
      }

      // Check for duplicate folios
      if (mappedRow.folio && existingFolios.includes(mappedRow.folio.toString())) {
        errors.push({
          row: i,
          field: 'folio',
          message: `Folio duplicado: ${mappedRow.folio}`,
          value: mappedRow.folio,
          severity: 'error'
        });
      }

      // Map data to IDs and validate
      const mappingResult = await this.dataMapper.mapRowData(mappedRow);
      
      if (!mappingResult.success) {
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
        validRows.push(mappingResult.data!);
      }

      // Add warnings
      if (mappingResult.warnings) {
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

    return {
      isValid: errorCount === 0,
      errors,
      validRows,
      totalRows: csvData.length,
      validCount: validRows.length,
      errorCount,
      warningCount
    };
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

        for (let j = 0; j < batch.length; j++) {
          const service = batch[j];
          const globalIndex = i * this.batchSize + j;

          try {
            const serviceData = {
              folio: service.folio,
              requestDate: service.requestDate,
              serviceDate: service.serviceDate,
              client: { id: service.clientId },
              vehicleBrand: service.vehicleBrand,
              vehicleModel: service.vehicleModel,
              licensePlate: service.licensePlate,
              origin: service.origin,
              destination: service.destination,
              serviceType: { id: service.serviceTypeId },
              value: service.value,
              crane: { id: service.craneId },
              operator: { id: service.operatorId },
              operatorCommission: service.operatorCommission,
              status: 'pending' as const,
              observations: service.observations
            };

            await createService(serviceData);
            processed++;
          } catch (error) {
            console.error(`Error creating service at row ${globalIndex}:`, error);
            errors++;
            failedRows.push(globalIndex);
            errorDetails.push({
              row: globalIndex,
              field: 'creation',
              message: `Error al crear servicio: ${error instanceof Error ? error.message : 'Error desconocido'}`,
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

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: errors === 0,
        processed,
        errors,
        message: errors === 0 
          ? `${processed} servicios cargados exitosamente`
          : `${processed} servicios cargados, ${errors} errores`,
        failedRows: failedRows.length > 0 ? failedRows : undefined,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      };

    } catch (error) {
      console.error('Error during batch upload:', error);
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
