import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/contexts/NotificationContext';

import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("useInventoryAlerts");
const INVENTORY_ALERTS_SELECT = `
  id,
  alert_type,
  item_id,
  location_id,
  threshold_value,
  is_active,
  last_triggered,
  created_at,
  updated_at,
  created_by,
  item:inventory_items(
    id, name, sku, minimum_stock, maximum_stock, unit_of_measure,
    category:inventory_categories(id, name)
  ),
  location:inventory_locations(id, name, code)
`;

const INVENTORY_ALERT_CONFIG_SELECT = 'alert_type, item_id, location_id, threshold_value';

const STOCK_FOR_ALERTS_SELECT = `
  item_id,
  location_id,
  current_quantity,
  last_movement_date,
  item:inventory_items(id, name, minimum_stock, maximum_stock, safety_stock),
  location:inventory_locations(id, name, code)
`;

const EXPIRING_MOVEMENTS_SELECT = `
  id,
  item_id,
  location_id,
  expiration_date,
  item:inventory_items(id, name),
  location:inventory_locations(id, name, code)
`;

export interface InventoryAlert {
  id: string;
  alert_type: string;
  item_id: string;
  location_id?: string;
  threshold_value?: number;
  is_active: boolean;
  last_triggered?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  item?: {
    id: string;
    name: string;
    sku?: string;
    minimum_stock?: number;
    maximum_stock?: number;
    unit_of_measure: string;
    category?: {
      id: string;
      name: string;
    };
  };
  location?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface ActiveAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  item_name: string;
  location_name?: string;
  current_value: number;
  threshold_value?: number;
  created_at: string;
  item_id: string;
}

export interface AlertConfiguration {
  alert_type: string;
  item_id?: string;
  location_id?: string;
  threshold_value?: number;
  is_active: boolean;
}

// Hook para obtener todas las alertas configuradas
export const useInventoryAlerts = () => {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select(INVENTORY_ALERTS_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryAlert[];
    },
  });
};

// Hook para obtener alertas activas con evaluación en tiempo real
export const useActiveAlerts = () => {
  return useQuery({
    queryKey: ['active-alerts'],
    queryFn: async () => {
      const activeAlerts: ActiveAlert[] = [];

      // Get alert configurations
      const { data: alertConfigs, error: configError } = await supabase
        .from('inventory_alerts')
        .select(INVENTORY_ALERT_CONFIG_SELECT)
        .eq('is_active', true);

      if (configError) {
        logger.error('❌ Error fetching alert configs:', configError);
        throw configError;
      }

      // Obtener stock data
      const { data: stockData, error: stockError } = await supabase
        .from('inventory_stock')
        .select(STOCK_FOR_ALERTS_SELECT);

      if (stockError) {
        logger.error('❌ useActiveAlerts: Error fetching stock data:', stockError);
        throw stockError;
      }

      // Evaluar alertas de stock bajo
      stockData?.forEach(stock => {
        const lowStockConfig = alertConfigs?.find(config => 
          config.alert_type === 'low_stock' && 
          (config.item_id === stock.item_id || config.item_id === null) &&
          (config.location_id === stock.location_id || config.location_id === null)
        );
        
        if (lowStockConfig && stock.item) {
          const threshold = lowStockConfig.threshold_value || stock.item.minimum_stock || 0;
          if (stock.current_quantity <= threshold) {
            activeAlerts.push({
              id: `low-stock-${stock.item_id}-${stock.location_id}`,
              type: 'low_stock',
              severity: stock.current_quantity === 0 ? 'critical' : 
                       stock.current_quantity <= (stock.item.safety_stock || 0) ? 'warning' : 'info',
              title: 'Stock Bajo',
              message: `${stock.item.name} tiene stock bajo en ${stock.location?.name || 'ubicación desconocida'}`,
              item_name: stock.item.name,
              location_name: stock.location?.name,
              current_value: stock.current_quantity,
              threshold_value: threshold,
              created_at: businessClock.nowISO(),
              item_id: stock.item_id
            });
          }
        }

        // Evaluar alertas de sobrestock
        const overstockConfig = alertConfigs?.find(config => 
          config.alert_type === 'overstock' && 
          (config.item_id === stock.item_id || config.item_id === null) &&
          (config.location_id === stock.location_id || config.location_id === null)
        );
        
        if (overstockConfig && stock.item) {
          const threshold = overstockConfig.threshold_value || stock.item.maximum_stock || 0;
          if (threshold > 0 && stock.current_quantity > threshold) {
            activeAlerts.push({
              id: `overstock-${stock.item_id}-${stock.location_id}`,
              type: 'overstock',
              severity: 'warning',
              title: 'Sobrestock',
              message: `${stock.item.name} excede el stock máximo en ${stock.location?.name || 'ubicación desconocida'}`,
              item_name: stock.item.name,
              location_name: stock.location?.name,
              current_value: stock.current_quantity,
              threshold_value: threshold,
              created_at: businessClock.nowISO(),
              item_id: stock.item_id
            });
          }
        }

        // Evaluar alertas de sin movimiento
        const noMovementConfig = alertConfigs?.find(config => 
          config.alert_type === 'no_movement' && 
          (config.item_id === stock.item_id || config.item_id === null) &&
          (config.location_id === stock.location_id || config.location_id === null)
        );
        
        if (noMovementConfig && stock.item && stock.last_movement_date) {
          const daysSinceMovement = Math.floor(
            (businessClock.todayDate().getTime() - new Date(stock.last_movement_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const threshold = noMovementConfig.threshold_value || 90;
          
          if (daysSinceMovement > threshold) {
            activeAlerts.push({
              id: `no-movement-${stock.item_id}-${stock.location_id}`,
              type: 'no_movement',
              severity: 'warning',
              title: 'Sin Movimiento',
              message: `${stock.item.name} sin movimiento por ${daysSinceMovement} días en ${stock.location?.name || 'ubicación desconocida'}`,
              item_name: stock.item.name,
              location_name: stock.location?.name,
              current_value: daysSinceMovement,
              threshold_value: threshold,
              created_at: businessClock.nowISO(),
              item_id: stock.item_id
            });
          }
        }
      });

      // Obtener productos próximos a vencer
      const expiringConfigs = alertConfigs?.filter(config => config.alert_type === 'expiring_soon');
      
      if (expiringConfigs && expiringConfigs.length > 0) {
        const { data: expiringData, error: expiringError } = await supabase
          .from('inventory_movements')
          .select(EXPIRING_MOVEMENTS_SELECT)
          .not('expiration_date', 'is', null)
          .gte('expiration_date', getTodayLocal());

        if (expiringError) throw expiringError;

        // Evaluar alertas de vencimiento
        expiringData?.forEach(movement => {
          const expiringConfig = expiringConfigs.find(config => 
            (config.item_id === movement.item_id || config.item_id === null) &&
            (config.location_id === movement.location_id || config.location_id === null)
          );
          
          if (expiringConfig && movement.expiration_date) {
            const daysToExpiry = Math.ceil(
              (new Date(movement.expiration_date).getTime() - businessClock.todayDate().getTime()) / (1000 * 60 * 60 * 24)
            );
            const threshold = expiringConfig.threshold_value || 30;
            
            if (daysToExpiry <= threshold && daysToExpiry >= 0) {
              activeAlerts.push({
                id: `expiring-${movement.id}`,
                type: 'expiring_soon',
                severity: daysToExpiry <= 7 ? 'critical' : daysToExpiry <= 15 ? 'warning' : 'info',
                title: 'Producto Próximo a Vencer',
                message: `${movement.item?.name} vence en ${daysToExpiry} días`,
                item_name: movement.item?.name || 'Producto desconocido',
                location_name: movement.location?.name,
                current_value: daysToExpiry,
                threshold_value: threshold,
                created_at: businessClock.nowISO(),
                item_id: movement.item_id
              });
            }
          }
        });
      }

      return activeAlerts;
    },
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
  });
};

// Hook para crear nueva configuración de alerta
export const useCreateAlert = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async (config: AlertConfiguration) => {
      // Verify session is valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session || !session.user) {
        logger.error('❌ Session error:', sessionError);
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      // Double check with getUser
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        logger.error('❌ Authentication error:', authError);
        throw new Error('Usuario no autenticado. Por favor, inicia sesión para continuar.');
      }

      // Check user permissions
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        logger.error('Profile error:', profileError);
        throw new Error('Error verificando permisos de usuario');
      }

      if (!['admin', 'operator'].includes(profile.role)) {
        throw new Error(`Permisos insuficientes. Se requiere rol de administrador u operador. Tu rol actual es: ${profile.role}`);
      }

      // Prepare the data for insertion
      const insertData = {
        alert_type: config.alert_type,
        item_id: config.item_id || null,
        location_id: config.location_id || null,
        threshold_value: config.threshold_value || null,
        is_active: config.is_active,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('inventory_alerts')
        .insert(insertData)
        .select('id, alert_type, item_id, location_id, threshold_value, is_active')
        .single();

      if (error) {
        logger.error('❌ Database error creating alert:', error);
        logger.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Enhanced auth-specific error detection
        if (error.code === 'PGRST116' || error.message.includes('JWT') || error.message.includes('auth.uid()')) {
          logger.error('🔐 Authentication error - auth.uid() likely NULL on server');
          throw new Error('AUTH_UID_NULL');
        }
        
        if (error.code === '42501' || error.message.includes('row-level security')) {
          logger.error('🚫 RLS policy failed - likely auth issue');
          throw new Error('AUTH_PERMISSION_DENIED');
        }
        
        if (error.message.includes('check constraint')) {
          throw new Error(`Tipo de alerta inválido: ${config.alert_type}. Tipos permitidos: low_stock, expiring_soon, overstock, no_movement`);
        }
        
        throw new Error(`Error en la base de datos: ${error.message}`);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      addNotification({
        title: 'Alerta Creada',
        message: 'La configuración de alerta se creó exitosamente',
        type: 'success'
      });
    },
    onError: (error) => {
      logger.error('Create alert error:', error);
      
      // Handle authentication errors specifically
      if (error.message === 'AUTH_UID_NULL') {
        addNotification({
          title: 'Error de Sesión',
          message: 'Tu sesión no está sincronizada con el servidor. Actualiza la sesión o inicia sesión nuevamente.',
          type: 'error'
        });
        return;
      }
      
      if (error.message === 'AUTH_PERMISSION_DENIED') {
        addNotification({
          title: 'Error de Autenticación',
          message: 'No tienes permisos para realizar esta acción. Verifica tu sesión.',
          type: 'error'
        });
        return;
      }
      
      addNotification({
        title: 'Error al Crear Alerta',
        message: error.message,
        type: 'error'
      });
    },
  });
};

// Hook para actualizar configuración de alerta
export const useUpdateAlert = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Partial<AlertConfiguration> }) => {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .update(config)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      addNotification({
        title: 'Alerta Actualizada',
        message: 'La configuración de alerta se actualizó exitosamente',
        type: 'success'
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Error',
        message: `Error al actualizar la alerta: ${error.message}`,
        type: 'error'
      });
    },
  });
};

// Hook para eliminar configuración de alerta
export const useDeleteAlert = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      addNotification({
        title: 'Alerta Eliminada',
        message: 'La configuración de alerta se eliminó exitosamente',
        type: 'success'
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Error',
        message: `Error al eliminar la alerta: ${error.message}`,
        type: 'error'
      });
    },
  });
};

// Hook para toggle estado activo/inactivo
export const useToggleAlert = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('inventory_alerts')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      addNotification({
        title: 'Alerta Actualizada',
        message: `La alerta fue ${isActive ? 'activada' : 'desactivada'} exitosamente`,
        type: 'success'
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Error',
        message: `Error al cambiar el estado de la alerta: ${error.message}`,
        type: 'error'
      });
    },
  });
};

// Hook para estadísticas de alertas
export const useAlertStats = () => {
  return useQuery({
    queryKey: ['alert-stats'],
    queryFn: async () => {
      const { data: alertsData } = await supabase
        .from('inventory_alerts')
        .select('alert_type, is_active');

      // Get active alerts count from current query
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select(`
          *,
          item:inventory_items(minimum_stock, safety_stock)
        `);
      
      const criticalAlerts = stockData?.filter(stock => 
        stock.item && stock.current_quantity === 0
      ).length || 0;
      
      const warningAlerts = stockData?.filter(stock => 
        stock.item && stock.current_quantity > 0 && stock.current_quantity <= (stock.item.safety_stock || 0)
      ).length || 0;

      const totalAlerts = alertsData?.length || 0;
      const activeConfigurations = alertsData?.filter(a => a.is_active).length || 0;

      return {
        totalAlerts,
        activeConfigurations,
        criticalAlerts,
        warningAlerts,
        totalActiveAlerts: criticalAlerts + warningAlerts
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });
};
