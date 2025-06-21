
import { Client, Crane, Operator, ServiceType } from '@/types';

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
  observations?: string;
}

export interface MappingResult {
  success: boolean;
  data?: MappedServiceData;
  errors: string[];
  warnings: string[];
}

export interface DataMapperContext {
  clients: Client[];
  cranes: Crane[];
  operators: Operator[];
  serviceTypes: ServiceType[];
}
