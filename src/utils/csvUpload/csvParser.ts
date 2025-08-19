
import { parse } from 'papaparse';
import { CSVRow, CSVUploadResult } from './types';
import { DataMapper, MappedServiceData } from '../dataMapper';

export const processCSV = async (file: File, dataMapper: DataMapper): Promise<CSVUploadResult> => {
  return new Promise((resolve, reject) => {
    parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => dataMapper.mapHeaders([header.trim()])[0] || header.trim(),
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.error('CSV Parsing Errors:', results.errors);
          return resolve({
            success: false,
            message: 'Error al analizar el archivo CSV.',
            errors: results.errors.map(error => error.message)
          });
        }

        const headerValidation = dataMapper.validateHeaders(results.meta.fields || []);
        if (!headerValidation.valid) {
          console.error('CSV Header Errors:', headerValidation);
          const missingHeaders = headerValidation.missing.map(header => `Falta la columna "${header}"`);
          const extraHeaders = headerValidation.extra.map(header => `Columna no reconocida "${header}"`);
          return resolve({
            success: false,
            message: 'Error en las columnas del archivo CSV.',
            errors: [...missingHeaders, ...extraHeaders]
          });
        }

        const mappedServices: MappedServiceData[] = [];
        const allErrors: string[] = [];
        const allWarnings: string[] = [];

        for (const row of results.data) {
          const mappingResult = await dataMapper.mapRowData(row);

          if (mappingResult.success) {
            mappedServices.push(mappingResult.data!);
          } else {
            allErrors.push(...mappingResult.errors);
          }
          allWarnings.push(...mappingResult.warnings);
        }

        if (allErrors.length > 0) {
          console.error('Data Mapping Errors:', allErrors);
          return resolve({
            success: false,
            message: 'Error al procesar los datos del archivo CSV.',
            errors: allErrors,
            warnings: allWarnings
          });
        }

        resolve({
          success: true,
          message: 'Archivo CSV procesado exitosamente.',
          data: mappedServices,
          warnings: allWarnings
        });
      },
      error: (error) => {
        console.error('CSV Processing Error:', error);
        reject(error);
      }
    });
  });
};
