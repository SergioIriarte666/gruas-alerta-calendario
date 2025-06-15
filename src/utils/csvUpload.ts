import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Service } from '@/types';
import { UploadedServiceRow } from './csvValidations';

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
  parseCSV(file: File): Promise<UploadedServiceRow[]> {
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
            resolve(results.data as UploadedServiceRow[]);
          }
        },
        error: (error) => {
          reject(new Error(`Error reading file: ${error.message}`));
        }
      });
    });
  }

  // Parse Excel file
  parseExcel(file: File): Promise<UploadedServiceRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
          
          if (json.length < 2) {
            resolve([]);
            return;
          }

          const headerMap: { [key: string]: string } = {
            'Folio': 'folio', 'Fecha Solicitud': 'requestDate', 'Fecha Servicio': 'serviceDate',
            'Cliente RUT': 'clientRut', 'Cliente Nombre': 'clientName', 'Vehículo Marca': 'vehicleBrand',
            'Vehículo Modelo': 'vehicleModel', 'Patente': 'licensePlate', 'Origen': 'origin',
            'Destino': 'destination', 'Tipo Servicio': 'serviceType', 'Valor': 'value',
            'Grúa Patente': 'craneLicensePlate', 'Operador RUT': 'operatorRut',
            'Comisión Operador': 'operatorCommission', 'Observaciones': 'observations'
          };

          const rawHeaders = json[0];
          const headers = rawHeaders.map(h => headerMap[h] || h.toLowerCase().replace(/\s+/g, ''));
          
          const rows = json.slice(1);

          const dataRows = rows.map(rowArray => {
            const rowObject: { [key: string]: any } = {};
            headers.forEach((header, index) => {
              let value = rowArray[index];
              if (['requestDate', 'serviceDate'].includes(header) && value instanceof Date) {
                value = value.toISOString().split('T')[0];
              }
              rowObject[header] = String(value ?? '');
            });
            return rowObject as UploadedServiceRow;
          }).filter(row => row.folio); // Filter out empty rows

          resolve(dataRows);
        } catch (e) {
          reject(new Error('Error al procesar el archivo Excel.'));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  // Convert uploaded row to Service object
  convertToService(
    csvRow: UploadedServiceRow,
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

  // Download Excel template file
  downloadExcelTemplate(): void {
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

    // Add cell formatting hints
    worksheet['B1'].c = [{a:"Días", t:"Formato: YYYY-MM-DD"}];
    worksheet['C1'].c = [{a:"Días", t:"Formato: YYYY-MM-DD"}];
    worksheet['D1'].c = [{a:"Días", t:"Formato: 12.345.678-9"}];
    worksheet['H1'].c = [{a:"Días", t:"Formato: AAAA-12"}];
    worksheet['M1'].c = [{a:"Días", t:"Formato: AAAA-12"}];
    worksheet['N1'].c = [{a:"Días", t:"Formato: 12.345.678-9"}];


    XLSX.writeFile(workbook, 'plantilla_servicios.xlsx');
  }
}
