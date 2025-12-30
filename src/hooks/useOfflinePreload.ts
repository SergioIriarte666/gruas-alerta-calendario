/**
 * Hook para pre-cargar datos esenciales para uso offline
 * Se ejecuta en background cuando hay conexión
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { cacheTableData } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';

interface PreloadStatus {
  isPreloading: boolean;
  lastPreload: Date | null;
  tablesLoaded: string[];
  error: string | null;
}

const PRELOAD_INTERVAL = 10 * 60 * 1000; // 10 minutos
const PRELOAD_KEY = 'tms-last-preload';

export function useOfflinePreload() {
  const { effectiveIsOnline } = useOfflineMode();
  const [status, setStatus] = useState<PreloadStatus>({
    isPreloading: false,
    lastPreload: null,
    tablesLoaded: [],
    error: null
  });
  const preloadInProgress = useRef(false);
  const hasPreloadedThisSession = useRef(false);

  useEffect(() => {
    // Solo pre-cargar cuando está online
    if (!effectiveIsOnline) return;
    
    // Evitar múltiples pre-cargas en la misma sesión inicial
    if (hasPreloadedThisSession.current) return;

    // Verificar si ya se pre-cargó recientemente
    const lastPreload = localStorage.getItem(PRELOAD_KEY);
    if (lastPreload) {
      const timeSinceLastPreload = Date.now() - parseInt(lastPreload, 10);
      if (timeSinceLastPreload < PRELOAD_INTERVAL) {
        console.log('[OfflinePreload] Skipping - recently preloaded');
        return;
      }
    }

    preloadEssentialData();
  }, [effectiveIsOnline]);

  const preloadEssentialData = async () => {
    if (preloadInProgress.current) return;
    preloadInProgress.current = true;
    hasPreloadedThisSession.current = true;

    setStatus(prev => ({ ...prev, isPreloading: true, error: null }));
    
    const tablesLoaded: string[] = [];

    try {
      console.log('[OfflinePreload] Starting essential data preload...');

      // Clientes activos
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (clients) {
        await cacheTableData('clients', clients);
        tablesLoaded.push('clients');
      }

      // Operadores activos
      const { data: operators } = await supabase
        .from('operators')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (operators) {
        await cacheTableData('operators', operators);
        tablesLoaded.push('operators');
      }

      // Grúas activas
      const { data: cranes } = await supabase
        .from('cranes')
        .select('*')
        .eq('is_active', true)
        .order('license_plate');
      
      if (cranes) {
        await cacheTableData('cranes', cranes);
        tablesLoaded.push('cranes');
      }

      // Categorías de costos
      const { data: costCategories } = await supabase
        .from('cost_categories')
        .select('*')
        .order('name');
      
      if (costCategories) {
        await cacheTableData('cost_categories', costCategories);
        tablesLoaded.push('cost_categories');
      }

      // Proveedores
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (suppliers) {
        await cacheTableData('suppliers', suppliers);
        tablesLoaded.push('suppliers');
      }

      // Servicios recientes (últimos 100)
      const { data: services } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (services) {
        await cacheTableData('services', services);
        tablesLoaded.push('services');
      }

      // Costos recientes (últimos 100)
      const { data: costs } = await supabase
        .from('costs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (costs) {
        await cacheTableData('costs', costs);
        tablesLoaded.push('costs');
      }

      // Facturas pendientes
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .in('status', ['draft', 'sent', 'partial'])
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (invoices) {
        await cacheTableData('invoices', invoices);
        tablesLoaded.push('invoices');
      }

      // Guardar timestamp de última pre-carga
      localStorage.setItem(PRELOAD_KEY, Date.now().toString());

      setStatus({
        isPreloading: false,
        lastPreload: new Date(),
        tablesLoaded,
        error: null
      });

      console.log(`[OfflinePreload] Complete - loaded ${tablesLoaded.length} tables`);

    } catch (error: any) {
      console.error('[OfflinePreload] Error:', error);
      setStatus(prev => ({
        ...prev,
        isPreloading: false,
        error: error.message
      }));
    } finally {
      preloadInProgress.current = false;
    }
  };

  const forcePreload = async () => {
    localStorage.removeItem(PRELOAD_KEY);
    hasPreloadedThisSession.current = false;
    await preloadEssentialData();
    toast.success('Datos pre-cargados', {
      description: `${status.tablesLoaded.length} tablas listas para uso offline`
    });
  };

  return {
    ...status,
    forcePreload
  };
}
