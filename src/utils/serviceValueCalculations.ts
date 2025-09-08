import { Service } from '@/types';
import { getCustodyDisplayInfo } from './custodyCalculations';

/**
 * Checks if a service is an equipment rental service
 */
export const isEquipmentRentalService = (service: any): boolean => {
  // Check both service type name and service_type relation
  const serviceTypeName = service.service_type?.name || service.serviceType?.name || service.serviceTypeName;
  return serviceTypeName === 'Arriendo de Equipos';
};

/**
 * Calculates the value that should be used for closure calculations.
 * 
 * BUSINESS LOGIC PRIORITY:
 * 1. custody_total_amount: For custody services, use only the custody total
 * 2. client_covered_amount: For excess services with client coverage, use the covered amount
 * 3. service.value: For regular services, use the base service value
 * 
 * IMPORTANT: This function handles both camelCase and snake_case field names for compatibility
 * between different data sources (database vs transformed objects).
 * 
 * @param service - Service object (supports both naming conventions)
 * @returns The calculated value for closure purposes
 */
export const getServiceValueForClosure = (service: any): number => {
  // Input validation
  if (!service) {
    console.warn('⚠️ getServiceValueForClosure: service is null or undefined');
    return 0;
  }

  // Priority 1: Custody service total amount (support both camelCase and snake_case)
  const custodyTotal = service.custody_total_amount || service.custodyTotalAmount;
  if (custodyTotal && custodyTotal > 0) {
    return custodyTotal;
  }
  
  // Priority 2: Client covered amount for excess services
  // Check both naming conventions and ensure null values are preserved
  const clientCovered = service.clientCoveredAmount !== undefined 
    ? service.clientCoveredAmount 
    : service.client_covered_amount;
    
  // Only use client covered amount if:
  // - Service has excess flag enabled
  // - Client covered amount is not null and greater than 0
  if (service.hasExcess && clientCovered != null && clientCovered > 0) {
    return clientCovered;
  }
  
  // Priority 3: Regular service value
  const baseValue = service.value || 0;
  return baseValue;
};

/**
 * Checks if a service is a custody service (supports both camelCase and snake_case)
 */
export const isCustodyService = (service: any): boolean => {
  const custodyMode = service.custody_mode || service.custodyMode;
  return custodyMode && custodyMode !== 'none';
};

/**
 * Gets custody information for a service (supports both camelCase and snake_case)
 * @deprecated Use getCustodyDisplayInfo from custodyCalculations.ts instead
 */
export const getCustodyInfo = (service: any) => {
  return getCustodyDisplayInfo(service);
};

/**
 * Calculates the total value for an array of services for closure purposes.
 */
export const calculateClosureTotal = (services: Service[]): number => {
  if (!services || !Array.isArray(services)) {
    return 0;
  }
  
  return services.reduce((sum, service) => {
    if (!service) {
      return sum;
    }
    return sum + getServiceValueForClosure(service);
  }, 0);
};