import { useEnhancedServiceDetails } from './useEnhancedServiceDetails';
import { useServiceDetails } from './useServiceDetails';
import { isCustodyService } from '@/utils/serviceValueCalculations';

/**
 * Hook unificado que decide automáticamente si usar datos básicos o mejorados
 * según las necesidades del componente
 */
export const useServiceDetailsGlobal = (serviceId: string | null, enhanced: boolean = false) => {
  const basicDetails = useServiceDetails(serviceId);
  const enhancedDetails = useEnhancedServiceDetails(serviceId);

  // Si se solicitan datos mejorados, usar el hook enhanced
  if (enhanced) {
    return {
      ...enhancedDetails,
      service: enhancedDetails.enhancedService,
      data: enhancedDetails.enhancedService
    };
  }

  // Por defecto, usar datos básicos
  return {
    ...basicDetails,
    service: basicDetails.data,
    enhancedService: null
  };
};

/**
 * Hook específico para formularios que siempre necesita datos completos
 */
export const useServiceDetailsForForm = (serviceId: string | null) => {
  return useServiceDetailsGlobal(serviceId, true);
};

/**
 * Hook específico para visualización que detecta automáticamente si necesita datos mejorados
 */
export const useServiceDetailsForView = (serviceId: string | null) => {
  const basicDetails = useServiceDetails(serviceId);
  
  // Si el servicio básico es de custodia, usar datos mejorados para obtener todos los campos
  const needsEnhanced = basicDetails.data && isCustodyService(basicDetails.data);
  
  return useServiceDetailsGlobal(serviceId, needsEnhanced);
};

/**
 * Hook específico para reportes y análisis que necesita datos completos
 */
export const useServiceDetailsForReports = (serviceId: string | null) => {
  return useServiceDetailsGlobal(serviceId, true);
};