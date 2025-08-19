import { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Utilidad para refrescar globalmente todos los datos relacionados con servicios
 * Útil después de cambios importantes en la base de datos
 */
export const refreshAllServiceData = async (queryClient: QueryClient) => {
  console.log('🔄 GLOBAL REFRESH: Iniciando actualización global de datos de servicios...');
  
  try {
    // Invalidar todas las queries relacionadas con servicios
    await Promise.all([
      // Servicios principales
      queryClient.invalidateQueries({ queryKey: ['services'] }),
      queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
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
    console.log('🚀 GLOBAL REFRESH: Force refetching critical queries...');
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['services'] }),
      queryClient.refetchQueries({ queryKey: ['costs'] }),
    ]);
    
    console.log('✅ GLOBAL REFRESH: Actualización global completada exitosamente');
    
    // Disparar evento personalizado para componentes que no usan React Query
    window.dispatchEvent(new CustomEvent('global-data-refresh', { 
      detail: { timestamp: Date.now(), status: 'completed' } 
    }));
    
    return { success: true };
  } catch (error) {
    console.error('❌ GLOBAL REFRESH: Error durante actualización global:', error);
    
    // Disparar evento de error
    window.dispatchEvent(new CustomEvent('global-data-refresh-error', { 
      detail: { timestamp: Date.now(), error: error.message } 
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
      console.log('🎯 Recibido evento de refresh global, ejecutando callback...');
      callback();
    };
    
    window.addEventListener('global-data-refresh', handleGlobalRefresh);
    
    return () => {
      window.removeEventListener('global-data-refresh', handleGlobalRefresh);
    };
  }, [callback]);
};