
import { useUser } from '@/contexts/UserContext';
import { useOperatorServices } from './useOperatorServices';
import { Service } from '@/types';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useOperatorServicesTabs = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: allServices, isLoading, error, refetch } = useOperatorServices(user?.id);

  const serviceTabs = useMemo(() => {
    if (!allServices) {
      console.log('🔍 [DEBUG] No hay servicios para procesar');
      return {
        asignados: [],
        activos: [],
        pendientes_entrega: [],
        completados: []
      };
    }

    console.log('🔍 [DEBUG] Procesando servicios:', allServices.map(s => ({
      folio: s.folio,
      status: s.status,
      id: s.id
    })));

    const tabs = {
      asignados: allServices.filter((service: Service) => service.status === 'pending'),
      activos: allServices.filter((service: Service) => service.status === 'in_progress'),
      pendientes_entrega: allServices.filter((service: Service) => service.status === 'inspection_completed'),
      completados: allServices.filter((service: Service) => service.status === 'completed')
    };

    console.log('🔍 [DEBUG] Servicios filtrados:', {
      asignados: tabs.asignados.length,
      activos: tabs.activos.length,
      pendientes_entrega: tabs.pendientes_entrega.length,
      completados: tabs.completados.length,
      pendientes_entrega_details: tabs.pendientes_entrega.map(s => ({
        folio: s.folio,
        status: s.status
      }))
    });

    return tabs;
  }, [allServices]);

  const refreshAllData = async () => {
    console.log('🔄 [TABS] Refreshing all operator data...');
    try {
      // Invalidar todas las queries relacionadas con servicios del operador
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
        queryClient.invalidateQueries({ queryKey: ['operator-services'] }),
        queryClient.invalidateQueries({ queryKey: ['operatorService'] }),
        refetch()
      ]);
      console.log('✅ [TABS] All data refreshed successfully');
    } catch (error) {
      console.error('❌ [TABS] Error refreshing data:', error);
    }
  };

  return {
    serviceTabs,
    isLoading,
    error,
    refetch,
    refreshAllData,
    totalCount: allServices?.length || 0
  };
};
