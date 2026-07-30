import type { ServiceCategory } from '@/utils/serviceCategoryLabels';
import type { TelemetryMode } from '@/utils/telemetryMode';

export interface ServiceTypeRequirements {
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
}

export interface ServiceTypeConfig extends ServiceTypeRequirements {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  isActive: boolean;
  availableInClientPortal: boolean;
  vehicleInfoOptional: boolean;
  isOutsourced: boolean;
  serviceCategory: ServiceCategory;
  telemetryMode: TelemetryMode;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTypeFormData {
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  availableInClientPortal: boolean;
  vehicleInfoOptional: boolean;
  isOutsourced: boolean;
  serviceCategory: ServiceCategory;
  telemetryMode: TelemetryMode;
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
}
