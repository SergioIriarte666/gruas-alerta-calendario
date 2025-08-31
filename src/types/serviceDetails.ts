
import { Service, Operator, ServiceStatus } from './index';
import { Cost } from './costs';

// Tipos para múltiples operadores
export interface ServiceOperator {
  id: string;
  operatorId: string;
  operator?: Operator;
  commission: number;
  role?: string; // Ej: "Principal", "Auxiliar", "Supervisor"
  hours?: number;
}

// Interfaz extendida del servicio (incluye todos los campos de custodia del Service base)
export interface EnhancedService extends Omit<Service, 'operator' | 'operatorCommission'> {
  operators: ServiceOperator[];
  serviceCosts: Cost[]; // Changed from costDetails to serviceCosts to align with costs table
  totalCosts: number;
  totalCommissions: number;
}

// Tipos para el formulario
export interface ServiceFormData {
  // Datos básicos
  folio: string;
  requestDate: string;
  serviceDate: string;
  clientId: string;
  purchaseOrder?: string;
  quoteNumber?: string;
  serviceTypeId: string;
  
  // Vehículo
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  
  // Ubicación
  origin: string;
  destination: string;
  
  // Recursos
  craneId: string;
  operators: ServiceOperator[];
  
  // Financiero
  value: number;
  costDetails: ServiceCostDetail[]; // Kept for form compatibility
  hasExcess?: boolean;
  clientCoveredAmount?: number;
  excessAmount?: number;
  
  // Estado y observaciones
  status: ServiceStatus;
  observations?: string;
  
  // Update context
  updateType?: 'service' | 'costs' | 'operators';
}

// Interface for cost details in the form (maps to costs table)
export interface ServiceCostDetail {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
  category_id: string;
  subcategory?: string;
  isExisting?: boolean; // To track if it's saved in database
}

// Constantes para las categorías de costos comunes en servicios
export const SERVICE_COST_CATEGORIES = [
  'Combustible',
  'Peajes',
  'Viáticos',
  'Estacionamiento',
  'Materiales',
  'Comisiones',
  'Otros'
] as const;

export type ServiceCostCategory = typeof SERVICE_COST_CATEGORIES[number];
