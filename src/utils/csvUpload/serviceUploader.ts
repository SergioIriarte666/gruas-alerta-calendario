
import { parse } from 'papaparse';
import { UploadProgress, UploadResult } from './types';
import { TemplateGenerator } from './templateGenerator';

export class CSVServiceUploader {
  parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error('Error parsing CSV: ' + results.errors.map(e => e.message).join(', ')));
          } else {
            resolve(results.data);
          }
        },
        error: reject
      });
    });
  }

  parseExcel(file: File): Promise<any[]> {
    // Implementation for Excel parsing would go here
    return Promise.reject(new Error('Excel parsing not implemented'));
  }

  convertToService(csvRow: any, clients: any[], cranes: any[], operators: any[]): any {
    // Implementation for converting CSV row to service
    return csvRow;
  }

  async processBatch(
    services: any[], 
    createService: (service: any) => Promise<any>, 
    onProgress: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const batchSize = 10;
    const totalBatches = Math.ceil(services.length / batchSize);
    let processed = 0;
    let errors = 0;
    const errorDetails: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = services.slice(i * batchSize, (i + 1) * batchSize);
      
      onProgress({
        currentBatch: i + 1,
        totalBatches,
        processed,
        total: services.length,
        percentage: (processed / services.length) * 100,
        stage: 'uploading'
      });

      for (const service of batch) {
        try {
          await createService(service);
          processed++;
        } catch (error) {
          errors++;
          errorDetails.push({
            row: processed + errors,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return {
      success: errors === 0,
      processed,
      errors,
      message: errors === 0 ? 'All services uploaded successfully' : `${processed} services uploaded, ${errors} failed`,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined
    };
  }

  downloadTemplate(): void {
    TemplateGenerator.downloadTemplate();
  }

  downloadExcelTemplate(): void {
    TemplateGenerator.downloadExcelTemplate();
  }
}
