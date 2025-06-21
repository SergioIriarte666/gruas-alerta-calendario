
export interface CSVRow {
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

export interface CSVUploadResult {
  success: boolean;
  message: string;
  data?: any[];
  errors?: string[];
  warnings?: string[];
}

export interface UploadProgress {
  currentBatch: number;
  totalBatches: number;
  processed: number;
  total: number;
  percentage: number;
  stage: string;
}

export interface UploadResult {
  success: boolean;
  processed: number;
  errors: number;
  message: string;
  errorDetails?: Array<{ row: number; message: string }>;
}
