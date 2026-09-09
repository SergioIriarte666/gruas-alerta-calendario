
export interface DataMapperContext {
  clients: any[];
  cranes: any[];
  operators: any[];
  serviceTypes: any[];
}

export interface MappedServiceData {
  folio: string;
  requestDate: string;
  serviceDate: string;
  clientId: string;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  origin: string;
  destination: string;
  serviceTypeId: string;
  value: number;
  craneId: string;
  operatorId: string;
  operatorCommission: number;
  observations: string;
  costDetails?: MappedServiceCostDetail[];
}

export interface MappedServiceCostDetail {
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  notes: string;
  subcategory: 'Combustible' | 'Viáticos' | 'Peajes';
  operator_id?: string;
  location_text?: string;
}

export interface MappingResult {
  success: boolean;
  data?: MappedServiceData;
  errors: string[];
  warnings?: string[];
}
