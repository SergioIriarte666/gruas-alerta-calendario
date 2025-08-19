import { Client, Crane, Operator } from '@/types';

export interface CSVServiceRow {
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
  observations?: string;
}

export interface UploadedServiceRow {
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
  observations?: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validRows: UploadedServiceRow[];
}

// RUT validation for Chilean format
export const validateRut = (rut: string): boolean => {
  if (!rut) return false;
  const rutRegex = /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/;
  return rutRegex.test(rut);
};

// Date validation for YYYY-MM-DD format
export const validateDate = (date: string): boolean => {
  if (!date) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
};

// License plate validation for Chilean format
export const validateLicensePlate = (plate: string): boolean => {
  if (!plate) return false;
  const plateRegex = /^[A-Z]{2,4}-[0-9]{2,4}$/;
  return plateRegex.test(plate.toUpperCase());
};

// Numeric value validation
export const validateNumericValue = (value: string): boolean => {
  if (!value) return false;
  const numValue = parseFloat(value);
  return !isNaN(numValue) && numValue >= 0;
};

// Validate CSV row format
export const validateUploadedRowFormat = (row: UploadedServiceRow, rowIndex: number): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required fields validation
  const requiredFields = [
    'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName',
    'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
    'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
  ];

  requiredFields.forEach(field => {
    if (!row[field as keyof UploadedServiceRow] || String(row[field as keyof UploadedServiceRow]).trim() === '') {
      errors.push({
        row: rowIndex,
        field,
        message: `Campo obligatorio faltante`,
        value: row[field as keyof UploadedServiceRow]
      });
    }
  });

  // Date format validation
  if (row.requestDate && !validateDate(row.requestDate)) {
    errors.push({
      row: rowIndex,
      field: 'requestDate',
      message: 'Formato de fecha inválido. Use YYYY-MM-DD',
      value: row.requestDate
    });
  }

  if (row.serviceDate && !validateDate(row.serviceDate)) {
    errors.push({
      row: rowIndex,
      field: 'serviceDate',
      message: 'Formato de fecha inválido. Use YYYY-MM-DD',
      value: row.serviceDate
    });
  }

  // RUT validation
  if (row.clientRut && !validateRut(row.clientRut)) {
    errors.push({
      row: rowIndex,
      field: 'clientRut',
      message: 'Formato de RUT inválido. Use 12.345.678-9',
      value: row.clientRut
    });
  }

  if (row.operatorRut && !validateRut(row.operatorRut)) {
    errors.push({
      row: rowIndex,
      field: 'operatorRut',
      message: 'Formato de RUT inválido. Use 12.345.678-9',
      value: row.operatorRut
    });
  }

  // License plate validation
  if (row.licensePlate && !validateLicensePlate(row.licensePlate)) {
    errors.push({
      row: rowIndex,
      field: 'licensePlate',
      message: 'Formato de patente inválido. Use AAAA-00',
      value: row.licensePlate
    });
  }

  if (row.craneLicensePlate && !validateLicensePlate(row.craneLicensePlate)) {
    errors.push({
      row: rowIndex,
      field: 'craneLicensePlate',
      message: 'Formato de patente inválido. Use AAAA-00',
      value: row.craneLicensePlate
    });
  }

  // Numeric validation
  if (row.value && !validateNumericValue(row.value)) {
    errors.push({
      row: rowIndex,
      field: 'value',
      message: 'Valor debe ser un número válido',
      value: row.value
    });
  }

  if (row.operatorCommission && !validateNumericValue(row.operatorCommission)) {
    errors.push({
      row: rowIndex,
      field: 'operatorCommission',
      message: 'Comisión debe ser un número válido',
      value: row.operatorCommission
    });
  }

  return errors;
};

// Validate references against existing data
export const validateReferences = (
  rows: UploadedServiceRow[],
  clients: Client[],
  cranes: Crane[],
  operators: Operator[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    // Check if client exists
    const clientExists = clients.some(client => client.rut === row.clientRut);
    if (!clientExists) {
      errors.push({
        row: index,
        field: 'clientRut',
        message: 'Cliente no encontrado en el sistema',
        value: row.clientRut
      });
    }

    // Check if crane exists
    const craneExists = cranes.some(crane => crane.licensePlate === row.craneLicensePlate);
    if (!craneExists) {
      errors.push({
        row: index,
        field: 'craneLicensePlate',
        message: 'Grúa no encontrada en el sistema',
        value: row.craneLicensePlate
      });
    }

    // Check if operator exists
    const operatorExists = operators.some(operator => operator.rut === row.operatorRut);
    if (!operatorExists) {
      errors.push({
        row: index,
        field: 'operatorRut',
        message: 'Operador no encontrado en el sistema',
        value: row.operatorRut
      });
    }
  });

  return errors;
};

// Check for duplicate folios
export const validateUniqueFolios = (rows: UploadedServiceRow[], existingFolios: string[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  const seenFolios = new Set<string>();

  rows.forEach((row, index) => {
    if (seenFolios.has(row.folio)) {
      errors.push({
        row: index,
        field: 'folio',
        message: 'Folio duplicado en el archivo CSV',
        value: row.folio
      });
    } else if (existingFolios.includes(row.folio)) {
      errors.push({
        row: index,
        field: 'folio',
        message: 'Folio ya existe en el sistema',
        value: row.folio
      });
    } else {
      seenFolios.add(row.folio);
    }
  });

  return errors;
};

// Full validation function
export const validateUploadedData = (
  csvData: UploadedServiceRow[],
  clients: Client[],
  cranes: Crane[],
  operators: Operator[],
  existingFolios: string[]
): ValidationResult => {
  const allErrors: ValidationError[] = [];
  const validRows: UploadedServiceRow[] = [];

  // Format validation
  csvData.forEach((row, index) => {
    const formatErrors = validateUploadedRowFormat(row, index);
    allErrors.push(...formatErrors);
  });

  // Reference validation
  const referenceErrors = validateReferences(csvData, clients, cranes, operators);
  allErrors.push(...referenceErrors);

  // Folio uniqueness validation
  const folioErrors = validateUniqueFolios(csvData, existingFolios);
  allErrors.push(...folioErrors);

  // Collect valid rows (rows without errors)
  csvData.forEach((row, index) => {
    const rowHasErrors = allErrors.some(error => error.row === index);
    if (!rowHasErrors) {
      validRows.push(row);
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    validRows
  };
};
