import { parse } from 'papaparse';
import { DataMapper } from './dataMapper';
import { MappedServiceData } from './dataMapper';

interface CSVRow {
  folio: string;
  requestDate: string;
  serviceDate: string;
  clientRut: string;
  clientName: string;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  origin: string;
  destination: string;
  serviceType: string;
  value: string;
  craneLicensePlate: string;
  operatorRut: string;
  operatorCommission: string;
  observations: string;
}

interface CSVUploadResult {
  success: boolean;
  message: string;
  data?: MappedServiceData[];
  errors?: string[];
  warnings?: string[];
}

export const processCSV = async (file: File, dataMapper: DataMapper): Promise<CSVUploadResult> => {
  return new Promise((resolve, reject) => {
    parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => dataMapper.mapHeaders(header.trim()).trim(),
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

export const createServiceFromCsvRow = async (row: any, dataMapper: DataMapper) => {
  try {
    // Find existing entities
    const foundClient = dataMapper.findClientByRut(row.clientRut) || dataMapper.findClientByName(row.clientName);
    const foundCrane = dataMapper.findCraneByPlate(row.craneLicensePlate);
    const foundOperator = dataMapper.findOperatorByRut(row.operatorRut);
    const foundServiceType = dataMapper.findServiceTypeByName(row.serviceType);

    if (!foundClient) {
      console.warn(`Client not found for RUT: ${row.clientRut} or Name: ${row.clientName}`);
      return { success: false, error: `Cliente no encontrado: ${row.clientRut || row.clientName}` };
    }

    if (!foundCrane) {
      console.warn(`Crane not found for License Plate: ${row.craneLicensePlate}`);
      return { success: false, error: `Grúa no encontrada: ${row.craneLicensePlate}` };
    }

    if (!foundOperator) {
      console.warn(`Operator not found for RUT: ${row.operatorRut}`);
      return { success: false, error: `Operador no encontrado: ${row.operatorRut}` };
    }

    if (!foundServiceType) {
      console.warn(`Service Type not found for Name: ${row.serviceType}`);
      return { success: false, error: `Tipo de servicio no encontrado: ${row.serviceType}` };
    }

    // Manual transformation and validation
    const requestDate = dataMapper.fixDateFormat(row.requestDate);
    const serviceDate = dataMapper.fixDateFormat(row.serviceDate);

    if (!requestDate || !serviceDate) {
      return { success: false, error: 'Formato de fecha inválido. Utilice DD-MM-AAAA.' };
    }

    const value = parseFloat(row.value) || 0;
    const operatorCommission = parseFloat(row.operatorCommission) || 0;

    return {
      success: true,
      data: {
        folio: row.folio,
        requestDate,
        serviceDate,
        clientId: foundClient.id,
        vehicleBrand: row.vehicleBrand || '',
        vehicleModel: row.vehicleModel || '',
        licensePlate: row.licensePlate || '',
        origin: row.origin,
        destination: row.destination,
        // Ensure all required properties are provided
        serviceType: {
          id: foundServiceType.id,
          name: foundServiceType.name,
          description: foundServiceType.description || '',
          basePrice: foundServiceType.basePrice,
          isActive: true,
          vehicleInfoOptional: foundServiceType.vehicleInfoOptional || false,
          purchaseOrderRequired: foundServiceType.purchaseOrderRequired || false,
          originRequired: foundServiceType.originRequired !== false,
          destinationRequired: foundServiceType.destinationRequired !== false,
          craneRequired: foundServiceType.craneRequired !== false,
          operatorRequired: foundServiceType.operatorRequired !== false,
          vehicleBrandRequired: foundServiceType.vehicleBrandRequired !== false,
          vehicleModelRequired: foundServiceType.vehicleModelRequired !== false,
          licensePlateRequired: foundServiceType.licensePlateRequired !== false,
          createdAt: '',
          updatedAt: ''
        },
        value,
        craneId: foundCrane.id,
        operatorId: foundOperator.id,
        operatorCommission,
        observations: row.observations || ''
      }
    };
  } catch (error: any) {
    console.error("Error creating service from CSV row:", error);
    return { success: false, error: `Error al crear el servicio: ${error.message || error}` };
  }
};
