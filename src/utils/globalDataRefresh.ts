import { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createLogger } from "@/lib/logger";
import { operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';


const logger = createLogger("globalDataRefresh");
/**
 * Utilidad para refrescar globalmente todos los datos relacionados con servicios
 * Útil después de cambios importantes en la base de datos
 */
export const refreshAllServiceData = async (queryClient: QueryClient) => {
  try {
    // Invalidar todas las queries relacionadas con servicios
    await Promise.all([
      // Servicios principales
      queryClient.invalidateQueries({ queryKey: ['services'] }),
      queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['crane-services'] }),
      
      // Costos y comisiones
      queryClient.invalidateQueries({ queryKey: ['costs'] }),
      queryClient.invalidateQueries({ queryKey: ['commissions'] }),
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] }),
      
      // Facturas y cierres
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['closures'] }),
      
      // Dashboard y reportes
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
      
      // Invalidar queries específicas de servicios individuales
      queryClient.invalidateQueries({ queryKey: ['service-costs'] }),
      queryClient.invalidateQueries({ queryKey: ['service-details'] }),
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details'] }),
      queryClient.invalidateQueries({ queryKey: ['serviceDetails'] }),
    ]);
    
    // FORCE REFETCH of critical queries immediately
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['services'] }),
      queryClient.refetchQueries({ queryKey: ['costs'] }),
    ]);
    
    // Disparar evento personalizado para componentes que no usan React Query
    window.dispatchEvent(new CustomEvent('global-data-refresh', { 
      detail: { timestamp: Date.now(), status: 'completed' } 
    }));
    
    return { success: true };
  } catch (error) {
    logger.error('❌ GLOBAL REFRESH: Error durante actualización global:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    
    // Disparar evento de error
    window.dispatchEvent(new CustomEvent('global-data-refresh-error', { 
      detail: { timestamp: Date.now(), error: message } 
    }));
    
    throw error;
  }
};

/**
 * Hook para escuchar cambios globales de datos
 */
export const useGlobalDataRefresh = (callback: () => void) => {
  useEffect(() => {
    const handleGlobalRefresh = () => {
      callback();
    };
    
    window.addEventListener('global-data-refresh', handleGlobalRefresh);
    
    return () => {
      window.removeEventListener('global-data-refresh', handleGlobalRefresh);
    };
  }, [callback]);
};
