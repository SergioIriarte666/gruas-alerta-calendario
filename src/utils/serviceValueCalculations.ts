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
 * Gets the base service value (excluding custody calculations)
 * @param service - Service object (supports both naming conventions)
 * @returns The base service value
 */
export const getBaseServiceValue = (service: any): number => {
  if (!service) return 0;
  return service.value || 0;
};

/**
 * Gets the custody total amount
 * @param service - Service object (supports both naming conventions) 
 * @returns The custody total amount
 */
export const getCustodyTotalAmount = (service: any): number => {
  if (!service) return 0;
  return service.custody_total_amount || service.custodyTotalAmount || 0;
};

/**
 * Calculates the complete service value (base + custody when both exist)
 * This is the TOTAL value of the service including all components.
 * 
 * @param service - Service object (supports both naming conventions)
 * @returns The complete service value (base + custody)
 */
export const getCompleteServiceValue = (service: any): number => {
  if (!service) {
    console.warn('⚠️ getCompleteServiceValue: service is null or undefined');
    return 0;
  }

  const baseValue = getBaseServiceValue(service);
  const custodyValue = getCustodyTotalAmount(service);
  
  // If both exist, sum them. Otherwise return whichever exists.
  if (baseValue > 0 && custodyValue > 0) {
    return baseValue + custodyValue;
  }
  
  return baseValue || custodyValue;
};

/**
 * Calculates the value that should be used for closure calculations.
 * 
 * BUSINESS LOGIC PRIORITY:
 * 1. client_covered_amount: For excess services with client coverage, use the covered amount
 * 2. Complete service value: For regular services, use base + custody total
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
  
  // Priority 1: Client covered amount for excess services
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
  
  // Priority 2: Complete service value (base + custody)
  return getCompleteServiceValue(service);
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
 * Calculates the display value that should be shown in modals and reports.
 * Always returns the complete/total service value (base + custody).
 * 
 * @param service - Service object (supports both naming conventions)
 * @returns The total service value for display purposes
 */
export const getDisplayServiceValue = (service: any): number => {
  return getCompleteServiceValue(service);
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

/**
 * Gets a breakdown of service values for display purposes
 * @param service - Service object
 * @returns Object with base, custody, and total values
 */
export const getServiceValueBreakdown = (service: any) => {
  if (!service) {
    return { baseValue: 0, custodyValue: 0, totalValue: 0 };
  }

  const baseValue = getBaseServiceValue(service);
  const custodyValue = getCustodyTotalAmount(service);
  const totalValue = getCompleteServiceValue(service);

  return {
    baseValue,
    custodyValue,
    totalValue,
    hasBothValues: baseValue > 0 && custodyValue > 0
  };
};