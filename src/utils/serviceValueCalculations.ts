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
 * Priority: custody_total_amount > client_covered_amount > service.value
 */
export const getServiceValueForClosure = (service: any): number => {
  // Debug logging for specific service
  if (service.folio === '3027694-3') {
    console.log('🔍 CLOSURE CALCULATION DEBUG - Service 3027694-3:', {
      folio: service.folio,
      hasExcess: service.hasExcess,
      clientCoveredAmount: service.clientCoveredAmount,
      client_covered_amount: service.client_covered_amount,
      value: service.value,
      custodyTotal: service.custody_total_amount || service.custodyTotalAmount
    });
  }

  // Priority 1: Custody service total amount (support both camelCase and snake_case)
  const custodyTotal = service.custody_total_amount || service.custodyTotalAmount;
  const baseValue = service.value || 0;
  
  // Para cualquier servicio con custodia, usar SOLO el custodyTotal
  if (custodyTotal && custodyTotal > 0) {
    if (service.folio === '3027694-3') {
      console.log('🔍 Using custody total:', custodyTotal);
    }
    return custodyTotal; // Solo el valor de custodia, sin duplicar con baseValue
  }
  
  // Priority 2: Client covered amount for excess services (check both naming conventions)
  const clientCovered = service.clientCoveredAmount ?? service.client_covered_amount;
  if (service.hasExcess && clientCovered != null && clientCovered > 0) {
    if (service.folio === '3027694-3') {
      console.log('🔍 Using client covered amount:', clientCovered);
    }
    return clientCovered;
  }
  
  // Priority 3: Regular service value
  if (service.folio === '3027694-3') {
    console.log('🔍 Using base value:', baseValue);
  }
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