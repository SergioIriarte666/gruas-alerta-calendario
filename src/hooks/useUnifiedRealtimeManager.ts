import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { operatorServicesKeys } from './operatorServicesQueryKeys';

const logger = createLogger('UnifiedRealtimeManager');

interface ChannelConfig {
  channelId: string;
  table: string;
  event: string;
  filter?: string;
  onUpdate: (payload: any) => void;
}

/**
 * SISTEMA UNIFICADO DE REALTIME
 * 
 * Consolida TODAS las suscripciones de Supabase realtime en un solo lugar:
 * ✅ Una sola instancia por canal
 * ✅ Gestión centralizada de suscripciones
 * ✅ Logging detallado
 * ✅ Cleanup automático
 * ✅ Anti-duplicación de canales
 */
export const useUnifiedRealtimeManager = () => {
  const queryClient = useQueryClient();
  const channelsRef = useRef<Map<string, any>>(new Map());
  const configsRef = useRef<Map<string, ChannelConfig>>(new Map());

  /**
   * INVALIDADOR INTELIGENTE DE QUERIES
   */
  const invalidateQueries = useCallback((tables: string[], context: string) => {
    logger.info(`🔄 [UNIFIED_REALTIME] Invalidando queries para: ${tables.join(', ')}`, { context });
    
    // Invalidaciones específicas por tabla
    if (tables.includes('services')) {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all });
      queryClient.invalidateQueries({ queryKey: ['crane-services'] });
    }
    
    if (tables.includes('costs')) {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    }
    
    if (tables.includes('service_resources')) {
      queryClient.invalidateQueries({ queryKey: ['service-resources'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    }
    
    if (tables.includes('cost_centers')) {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
    }
    
    // Invalidaciones globales (lightweight only)
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
  }, [queryClient]);

  /**
   * REGISTRAR CANAL DE REALTIME
   */
  const registerChannel = useCallback((config: ChannelConfig) => {
    const { channelId, table, event, filter, onUpdate } = config;
    
    // Verificar si ya existe el canal
    if (channelsRef.current.has(channelId)) {
      logger.warn(`⚠️ [UNIFIED_REALTIME] Canal ${channelId} ya existe, omitiendo duplicado`);
      return;
    }
    
    logger.info(`📡 [UNIFIED_REALTIME] Registrando canal: ${channelId}`, { table, event, filter });
    
    try {
      const channel = supabase.channel(channelId);
      
      const channelConfig = {
        event: event as any,
        schema: 'public',
        table,
        ...(filter && { filter })
      };
      
      channel.on('postgres_changes', channelConfig, (payload) => {
        logger.info(`🔄 [UNIFIED_REALTIME] Cambio detectado en ${table}`, { 
          channelId, 
          event: payload.eventType,
          table 
        });
        
        onUpdate(payload);
      });
      
      channel.subscribe((status) => {
        logger.info(`📊 [UNIFIED_REALTIME] Estado canal ${channelId}: ${status}`);
      });
      
      channelsRef.current.set(channelId, channel);
      configsRef.current.set(channelId, config);
      
    } catch (error) {
      logger.error(`❌ [UNIFIED_REALTIME] Error registrando canal ${channelId}:`, error);
    }
  }, []);

  /**
   * DESREGISTRAR CANAL
   */
  const unregisterChannel = useCallback((channelId: string) => {
    const channel = channelsRef.current.get(channelId);
    if (channel) {
      logger.info(`🔌 [UNIFIED_REALTIME] Desconectando canal: ${channelId}`);
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelId);
      configsRef.current.delete(channelId);
    }
  }, []);

  /**
   * DESCONECTAR TODOS LOS CANALES
   */
  const disconnectAll = useCallback(() => {
    logger.info('🔌 [UNIFIED_REALTIME] Desconectando todos los canales...');
    
    channelsRef.current.forEach((channel, channelId) => {
      try {
        supabase.removeChannel(channel);
        logger.info(`✅ [UNIFIED_REALTIME] Canal ${channelId} desconectado`);
      } catch (error) {
        logger.error(`❌ [UNIFIED_REALTIME] Error desconectando canal ${channelId}:`, error);
      }
    });
    
    channelsRef.current.clear();
    configsRef.current.clear();
  }, []);

  /**
   * CONFIGURACIONES PREDEFINIDAS DE CANALES
   */
  const setupCoreChannels = useCallback(() => {
    logger.info('🚀 [UNIFIED_REALTIME] Configurando canales principales...');
    
    // Canal principal de servicios
    registerChannel({
      channelId: 'unified-services-updates',
      table: 'services',
      event: 'UPDATE',
      onUpdate: (payload) => {
        invalidateQueries(['services', 'costs'], 'services_update');
      }
    });
    
    // Canal principal de costos
    registerChannel({
      channelId: 'unified-costs-updates',
      table: 'costs',
      event: '*',
      onUpdate: (payload) => {
        invalidateQueries(['costs', 'services'], 'costs_update');
      }
    });
    
    // Canal de recursos de servicios
    registerChannel({
      channelId: 'unified-service-resources-updates',
      table: 'service_resources',
      event: '*',
      onUpdate: (payload) => {
        invalidateQueries(['service_resources', 'services'], 'service_resources_update');
      }
    });
    
    // Canal de centros de costo
    registerChannel({
      channelId: 'unified-cost-centers-updates',
      table: 'cost_centers',
      event: '*',
      onUpdate: (payload) => {
        invalidateQueries(['cost_centers'], 'cost_centers_update');
      }
    });
    
  }, [registerChannel, invalidateQueries]);

  /**
   * CANAL ESPECÍFICO PARA SERVICIO
   */
  const watchSpecificService = useCallback((serviceId: string) => {
    const channelId = `unified-service-${serviceId}`;
    
    registerChannel({
      channelId,
      table: 'services',
      event: 'UPDATE',
      filter: `id=eq.${serviceId}`,
      onUpdate: (payload) => {
        logger.info(`🎯 [UNIFIED_REALTIME] Servicio específico actualizado: ${serviceId}`);
        invalidateQueries(['services', 'costs'], `specific_service_${serviceId}`);
      }
    });
    
    return () => unregisterChannel(channelId);
  }, [registerChannel, unregisterChannel, invalidateQueries]);

  /**
   * ESTADO DEL SISTEMA
   */
  const getStatus = useCallback(() => {
    return {
      activeChannels: Array.from(channelsRef.current.keys()),
      totalChannels: channelsRef.current.size,
      configs: Array.from(configsRef.current.entries())
    };
  }, []);

  // Inicialización automática
  useEffect(() => {
    setupCoreChannels();
    
    return () => {
      disconnectAll();
    };
  }, [setupCoreChannels, disconnectAll]);

  return {
    registerChannel,
    unregisterChannel,
    watchSpecificService,
    disconnectAll,
    getStatus,
    invalidateQueries
  };
};
