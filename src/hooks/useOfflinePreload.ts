/**
 * Hook para pre-cargar datos esenciales para uso offline
 * Se ejecuta en background cuando hay conexión
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { cacheTableData } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';

interface TableConfig {
  name: string;
  label: string;
  query: () => PromiseLike<{ data: any[] | null; error: any }>;
}

interface PreloadStatus {
  isPreloading: boolean;
  lastPreload: Date | null;
  tablesLoaded: string[];
  error: string | null;
  currentTable: string | null;
  progress: number;
  totalTables: number;
  totalRecords: number;
}

const PRELOAD_INTERVAL = 10 * 60 * 1000; // 10 minutos
const PRELOAD_KEY = 'tms-last-preload';

// Configuración de tablas a pre-cargar
const getTableConfigs = (): TableConfig[] => [
  {
    name: 'clients',
    label: 'Clientes',
    query: () => supabase.from('clients').select('*').eq('is_active', true).order('name')
  },
  {
    name: 'operators',
    label: 'Operadores',
    query: () => supabase.from('operators').select('*').eq('is_active', true).order('name')
  },
  {
    name: 'cranes',
    label: 'Grúas',
    query: () => supabase.from('cranes').select('*').eq('is_active', true).order('license_plate')
  },
  {
    name: 'cost_categories',
    label: 'Categorías de costos',
    query: () => supabase.from('cost_categories').select('*').order('name')
  },
  {
    name: 'suppliers',
    label: 'Proveedores',
    query: () => supabase.from('suppliers').select('*').order('name')
  },
  {
    name: 'services',
    label: 'Servicios',
    query: () => supabase.from('services').select('*').order('created_at', { ascending: false }).limit(200)
  },
  {
    name: 'costs',
    label: 'Costos',
    query: () => supabase.from('costs').select('*').order('created_at', { ascending: false }).limit(200)
  },
  {
    name: 'invoices',
    label: 'Facturas',
    query: () => supabase.from('invoices').select('*').in('status', ['draft', 'sent', 'partial']).order('created_at', { ascending: false }).limit(100)
  },
  {
    name: 'inventory_items',
    label: 'Items de inventario',
    query: () => supabase.from('inventory_items').select('*').eq('is_active', true).order('name')
  },
  {
    name: 'inventory_stock',
    label: 'Stock',
    query: () => supabase.from('inventory_stock').select('*')
  },
  {
    name: 'inventory_categories',
    label: 'Categorías inventario',
    query: () => supabase.from('inventory_categories').select('*').eq('is_active', true)
  },
  {
    name: 'income_categories',
    label: 'Categorías ingresos',
    query: () => supabase.from('income_categories').select('*').eq('is_active', true)
  },
  {
    name: 'service_types',
    label: 'Tipos de servicio',
    query: () => supabase.from('service_types').select('*').eq('is_active', true).order('name')
  },
  {
    name: 'service_resources',
    label: 'Recursos de servicios',
    query: () => supabase.from('service_resources').select('*').order('created_at', { ascending: false }).limit(500)
  }
];

export function useOfflinePreload() {
  const { effectiveIsOnline } = useOfflineMode();
  const tableConfigs = getTableConfigs();
  
  const [status, setStatus] = useState<PreloadStatus>({
    isPreloading: false,
    lastPreload: null,
    tablesLoaded: [],
    error: null,
    currentTable: null,
    progress: 0,
    totalTables: tableConfigs.length,
    totalRecords: 0
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

    preloadEssentialData(false);
  }, [effectiveIsOnline]);

  const preloadEssentialData = async (showNotifications: boolean = false) => {
    if (preloadInProgress.current) return;
    preloadInProgress.current = true;
    hasPreloadedThisSession.current = true;

    const tablesLoaded: string[] = [];
    let totalRecords = 0;

    setStatus(prev => ({ 
      ...prev, 
      isPreloading: true, 
      error: null,
      progress: 0,
      currentTable: null,
      tablesLoaded: []
    }));

    try {
      console.log('[OfflinePreload] Starting essential data preload...');

      for (let i = 0; i < tableConfigs.length; i++) {
        const config = tableConfigs[i];
        
        setStatus(prev => ({
          ...prev,
          currentTable: config.label,
          progress: Math.round((i / tableConfigs.length) * 100)
        }));

        const { data, error } = await config.query();
        
        if (error) {
          console.warn(`[OfflinePreload] Error loading ${config.name}:`, error);
          continue;
        }

        if (data) {
          await cacheTableData(config.name, data);
          tablesLoaded.push(config.name);
          totalRecords += data.length;
        }
      }

      // Guardar timestamp de última pre-carga
      localStorage.setItem(PRELOAD_KEY, Date.now().toString());

      setStatus({
        isPreloading: false,
        lastPreload: new Date(),
        tablesLoaded,
        error: null,
        currentTable: null,
        progress: 100,
        totalTables: tableConfigs.length,
        totalRecords
      });

      console.log(`[OfflinePreload] Complete - loaded ${tablesLoaded.length} tables, ${totalRecords} records`);

      if (showNotifications) {
        toast.success('Datos descargados', {
          description: `${tablesLoaded.length} tablas, ${totalRecords.toLocaleString()} registros listos para offline`
        });
      }

    } catch (error: any) {
      console.error('[OfflinePreload] Error:', error);
      setStatus(prev => ({
        ...prev,
        isPreloading: false,
        error: error.message,
        currentTable: null
      }));
      
      if (showNotifications) {
        toast.error('Error al descargar datos', {
          description: error.message
        });
      }
    } finally {
      preloadInProgress.current = false;
    }
  };

  const forcePreload = async () => {
    localStorage.removeItem(PRELOAD_KEY);
    hasPreloadedThisSession.current = false;
    await preloadEssentialData(true);
  };

  return {
    ...status,
    forcePreload
  };
}
