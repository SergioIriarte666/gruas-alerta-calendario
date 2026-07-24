import type { ServiceCategory } from '@/utils/serviceCategoryLabels';

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
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
}
