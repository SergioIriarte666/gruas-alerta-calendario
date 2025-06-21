
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
  vehicleInfoOptional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTypeFormData {
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  vehicleInfoOptional: boolean;
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
}
