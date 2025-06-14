import * as Papa from 'papaparse';
import { Service } from '@/types';
import { CSVServiceRow, validateCSVData, ValidationResult } from './csvValidations';

export interface UploadProgress {
  total: number;
  processed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
}

export interface UploadResult {
  success: boolean;
  processed: number;
  errors: number;
  message: string;
  failedRows?: number[];
}

export class CSVServiceUploader {
  private batchSize = 50;

  // Parse CSV file
  parseCSV(file: File): Promise<CSVServiceRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Map Spanish headers to English field names
          const headerMap: { [key: string]: string } = {
            'Folio': 'folio',
            'Fecha Solicitud': 'requestDate',
            'Fecha Servicio': 'serviceDate',
            'Cliente RUT': 'clientRut',
            'Cliente Nombre': 'clientName',
            'Vehículo Marca': 'vehicleBrand',
            'Vehículo Modelo': 'vehicleModel',
            'Patente': 'licensePlate',
            'Origen': 'origin',
            'Destino': 'destination',
            'Tipo Servicio': 'serviceType',
            'Valor': 'value',
            'Grúa Patente': 'craneLicensePlate',
            'Operador RUT': 'operatorRut',
            'Comisión Operador': 'operatorCommission',
            'Observaciones': 'observations'
          };
          
          return headerMap[header] || header.toLowerCase().replace(/\s+/g, '');
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`Error parsing CSV: ${results.errors[0].message}`));
          } else {
            resolve(results.data as CSVServiceRow[]);
          }
        },
        error: (error) => {
          reject(new Error(`Error reading file: ${error.message}`));
        }
      });
    });
  }

  // Convert CSV row to Service object
  convertToService(
    csvRow: CSVServiceRow,
    clients: any[],
    cranes: any[],
    operators: any[]
  ): Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'> {
    const client = clients.find(c => c.rut === csvRow.clientRut);
    const crane = cranes.find(c => c.licensePlate === csvRow.craneLicensePlate);
    const operator = operators.find(o => o.rut === csvRow.operatorRut);

    return {
      requestDate: csvRow.requestDate,
      serviceDate: csvRow.serviceDate,
      client,
      vehicleBrand: csvRow.vehicleBrand,
      vehicleModel: csvRow.vehicleModel,
      licensePlate: csvRow.licensePlate.toUpperCase(),
      origin: csvRow.origin,
      destination: csvRow.destination,
      serviceType: {
        id: '1',
        name: csvRow.serviceType,
        description: csvRow.serviceType,
        isActive: true,
        createdAt: '',
        updatedAt: ''
      },
      value: parseFloat(csvRow.value),
      crane,
      operator,
      operatorCommission: parseFloat(csvRow.operatorCommission),
      status: 'pending',
      observations: csvRow.observations || ''
    };
  }

  // Process services in batches
  async processBatch(
    services: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>[],
    createService: (service: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => Promise<Service>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const total = services.length;
    const totalBatches = Math.ceil(total / this.batchSize);
    let processed = 0;
    let errors = 0;
    const failedRows: number[] = [];

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = services.slice(i * this.batchSize, (i + 1) * this.batchSize);
        const currentBatch = i + 1;

        // Process each service in the batch
        for (let j = 0; j < batch.length; j++) {
          try {
            await createService(batch[j]);
            processed++;
          } catch (error) {
            console.error('Error creating service:', error);
            errors++;
            failedRows.push(i * this.batchSize + j);
          }

          // Update progress
          if (onProgress) {
            onProgress({
              total,
              processed: processed + errors,
              percentage: Math.round(((processed + errors) / total) * 100),
              currentBatch,
              totalBatches
            });
          }
        }

        // Small delay between batches to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: errors === 0,
        processed,
        errors,
        message: errors === 0 
          ? `${processed} servicios cargados exitosamente`
          : `${processed} servicios cargados, ${errors} errores`,
        failedRows: failedRows.length > 0 ? failedRows : undefined
      };

    } catch (error) {
      return {
        success: false,
        processed,
        errors: total - processed,
        message: `Error durante la carga: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        failedRows
      };
    }
  }

  // Generate CSV template
  generateTemplate(): string {
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

    return [headers.join(','), sampleData.join(',')].join('\n');
  }

  // Download template file
  downloadTemplate(): void {
    const csvContent = this.generateTemplate();
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
}
