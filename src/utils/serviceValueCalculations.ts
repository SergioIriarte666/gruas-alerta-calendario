/** Service value calculation utilities — rebuilt to clear Vite dep cache */
import { Service } from '@/types';
import { getCustodyDisplayInfo } from './custodyCalculations';
import { createLogger } from "@/lib/logger";


const logger = createLogger("serviceValueCalculations");
/**
 * Checks if a service is an equipment rental service
 */
export const isEquipmentRentalService = (service: any): boolean => {
  // Check both service type name and service_type relation
  const serviceTypeName = (service.service_type?.name || service.serviceType?.name || service.serviceTypeName || '').trim();
  return serviceTypeName === 'Arriendo de Equipos';
};

const getNormalizedServiceTypeName = (service: any): string =>
  (service?.service_type?.name || service?.serviceType?.name || service?.serviceTypeName || '').trim();

/**
 * Gets the base service value (excluding custody calculations)
 * @param service - Service object (supports both naming conventions)
 * @returns The base service value
 */
export const getBaseServiceValue = (service: any): number => {
  if (!service) return 0;
  
  // Si el servicio tiene custodia, el valor base es service.value
  // Si no tiene custodia, también es service.value
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
    logger.warn('⚠️ getCompleteServiceValue: service is null or undefined');
    return 0;
  }

  const serviceTypeName = getNormalizedServiceTypeName(service);
  const baseValue = getBaseServiceValue(service);
  const custodyValue = getCustodyTotalAmount(service);

  if (serviceTypeName === 'Custodia de Vehículos' || serviceTypeName === 'Arriendo de Equipos') {
    return Math.round(custodyValue || baseValue);
  }
  
  // If both exist, sum them. Otherwise return whichever exists.
  if (baseValue > 0 && custodyValue > 0) {
    if (baseValue === custodyValue && isCustodyService(service)) {
      return Math.round(baseValue);
    }

    return Math.round(baseValue + custodyValue);
  }
  
  return Math.round(baseValue || custodyValue);
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
    logger.warn('⚠️ getServiceValueForClosure: service is null or undefined');
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
    return Math.round(clientCovered);
  }
  
  // Priority 2: Complete service value (base + custody)
  return getCompleteServiceValue(service);
};

/**
 * Calculates the value that should be used for profit/net gain calculations.
 * 
 * IMPORTANT: For services with excess (excedente), BOTH the client covered amount
 * AND the excess amount are income for the company. Therefore, profit calculations
 * should use the TOTAL service value, not just the client covered amount.
 * 
 * This is different from getServiceValueForClosure which returns only the billable
 * amount (what the client pays).
 * 
 * @param service - Service object
 * @returns The total service value for profit calculations
 */
export const getServiceValueForProfit = (service: any): number => {
  if (!service) return 0;
  
  // For profit calculations, always use the complete service value
  // Both client covered amount and excess are company income
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
 * Calcula el valor a mostrar en el Pipeline VIP de un cliente.
 * Para servicios con excedente, muestra el monto que corresponde
 * a ese cliente específico, no el valor total.
 *
 * @param service - Service object
 * @param viewingClientId - ID del cliente cuyo pipeline se está viendo (opcional)
 */
export const getDisplayServiceValue = (
  service: any,
  viewingClientId?: string
): number => {
  if (!service) return 0;

  const hasExcess = Boolean(service.hasExcess ?? service.has_excess);
  const primaryClientId = service.client?.id ?? service.clientId ?? service.client_id;
  const thirdPartyClientId = service.thirdPartyClientId ?? service.third_party_client_id;
  const clientCoveredAmount = service.clientCoveredAmount ?? service.client_covered_amount;
  const excessAmount = service.excessAmount ?? service.excess_amount;

  if (viewingClientId && hasExcess) {
    if (
      primaryClientId === viewingClientId &&
      clientCoveredAmount != null
    ) {
      return Math.round(Number(clientCoveredAmount));
    }
    if (
      thirdPartyClientId === viewingClientId &&
      excessAmount != null
    ) {
      return Math.round(Number(excessAmount));
    }
  }

  return getCompleteServiceValue(service);
};

/**
 * Calculates the total value for an array of services for closure purposes.
 */
export const calculateClosureTotal = (services: Service[]): number => {
  if (!services || !Array.isArray(services)) {
    return 0;
  }
  
  return Math.round(services.reduce((sum, service) => {
    if (!service) {
      return sum;
    }
    return sum + getServiceValueForClosure(service);
  }, 0));
};

/**
 * Gets a breakdown of service values for display purposes
 * @param service - Service object
 * @returns Object with base, custody, and total values
 */
export const getServiceValueBreakdown = (service: any) => {
  if (!service) {
    return { baseValue: 0, custodyValue: 0, totalValue: 0, hasBothValues: false };
  }

  const serviceTypeName = getNormalizedServiceTypeName(service);
  const rawBaseValue = service.value || 0;
  const rawCustodyValue = getCustodyTotalAmount(service);
  
  // Lógica de display:
  // - Si hay AMBOS valores: baseValue = value, custodyValue = custody (servicio con adicional)
  // - Si solo hay value: baseValue = value, custodyValue = 0 (servicio simple)
  // - Si solo hay custody: baseValue = custody, custodyValue = 0 (arriendo/otros es el servicio principal)
  
  const hasBothValues = rawBaseValue > 0 && rawCustodyValue > 0;
  
  let baseValue: number;
  let custodyValue: number;
  let totalValue: number;
  
  if (serviceTypeName === 'Custodia de Vehículos' || serviceTypeName === 'Arriendo de Equipos') {
    baseValue = 0;
    custodyValue = rawCustodyValue || rawBaseValue;
    totalValue = custodyValue;
  } else if (hasBothValues && rawBaseValue === rawCustodyValue && isCustodyService(service)) {
    baseValue = 0;
    custodyValue = rawCustodyValue;
    totalValue = rawCustodyValue;
  } else if (hasBothValues) {
    baseValue = rawBaseValue;
    custodyValue = rawCustodyValue;
    totalValue = rawBaseValue + rawCustodyValue;
  } else if (rawBaseValue > 0) {
    baseValue = rawBaseValue;
    custodyValue = 0;
    totalValue = rawBaseValue;
  } else {
    baseValue = rawCustodyValue;
    custodyValue = 0;
    totalValue = rawCustodyValue;
  }

  return {
    baseValue,
    custodyValue,
    totalValue,
    hasBothValues: baseValue > 0 && custodyValue > 0
  };
};
