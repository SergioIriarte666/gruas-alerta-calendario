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
  transformForCache?: (data: any[]) => any[];
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

// Transformadores para normalizar datos a formato app (camelCase)
const transformClientForCache = (client: any) => ({
  id: client.id,
  name: client.name,
  rut: client.rut,
  phone: client.phone || '',
  email: client.email || '',
  address: client.address || '',
  department: client.department || '',
  contactName: client.contact_name || '',
  isActive: client.is_active ?? false,
  createdAt: client.created_at,
  updatedAt: client.updated_at,
  createdBy: client.created_by
});

const transformOperatorForCache = (operator: any) => ({
  id: operator.id,
  name: operator.name,
  rut: operator.rut,
  phone: operator.phone || '',
  operatorType: operator.operator_type || 'crane_operator',
  department: operator.department || '',
  position: operator.position || '',
  licenseNumber: operator.license_number || '',
  examExpiry: operator.exam_expiry || '',
  isActive: operator.is_active ?? false,
  createdAt: operator.created_at,
  updatedAt: operator.updated_at,
  createdBy: operator.created_by
});

const transformCraneForCache = (crane: any) => ({
  id: crane.id,
  licensePlate: crane.license_plate,
  brand: crane.brand,
  model: crane.model,
  type: crane.type,
  circulationPermitExpiry: crane.circulation_permit_expiry,
  insuranceExpiry: crane.insurance_expiry,
  technicalReviewExpiry: crane.technical_review_expiry,
  isActive: crane.is_active ?? false,
  createdAt: crane.created_at,
  updatedAt: crane.updated_at,
  createdBy: crane.created_by
});

const transformServiceTypeForCache = (st: any) => ({
  id: st.id,
  name: st.name,
  description: st.description,
  basePrice: st.base_price,
  isActive: st.is_active,
  vehicleInfoOptional: st.vehicle_info_optional || false,
  purchaseOrderRequired: st.purchase_order_required || false,
  originRequired: st.origin_required !== false,
  destinationRequired: st.destination_required !== false,
  craneRequired: st.crane_required !== false,
  operatorRequired: st.operator_required !== false,
  vehicleBrandRequired: st.vehicle_brand_required !== false,
  vehicleModelRequired: st.vehicle_model_required !== false,
  licensePlateRequired: st.license_plate_required !== false,
  createdAt: st.created_at,
  updatedAt: st.updated_at
});

const transformVehicleBrandForCache = (brand: any) => ({
  id: brand.id,
  name: brand.name,
  isActive: brand.is_active ?? true,
  createdAt: brand.created_at
});

const transformVehicleModelForCache = (model: any) => ({
  id: model.id,
  name: model.name,
  brandId: model.brand_id,
  isActive: model.is_active ?? true,
  createdAt: model.created_at
});

// Configuración de tablas a pre-cargar
const getTableConfigs = (): TableConfig[] => [
  {
    name: 'clients',
    label: 'Clientes',
    query: () => supabase.from('clients').select('*').eq('is_active', true).order('name'),
    transformForCache: (data) => data.map(transformClientForCache)
  },
  {
    name: 'operators',
    label: 'Operadores',
    query: () => supabase.from('operators').select('*').eq('is_active', true).order('name'),
    transformForCache: (data) => data.map(transformOperatorForCache)
  },
  {
    name: 'cranes',
    label: 'Grúas',
    query: () => supabase.from('cranes').select('*').eq('is_active', true).order('license_plate'),
    transformForCache: (data) => data.map(transformCraneForCache)
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
    query: () => supabase.from('service_types').select('*').eq('is_active', true).order('name'),
    transformForCache: (data) => data.map(transformServiceTypeForCache)
  },
  {
    name: 'service_resources',
    label: 'Recursos de servicios',
    query: () => supabase.from('service_resources').select('*').order('created_at', { ascending: false }).limit(500)
  },
  {
    name: 'vehicle_brands',
    label: 'Marcas de vehículos',
    query: () => supabase.from('vehicle_brands').select('*').eq('is_active', true).order('name'),
    transformForCache: (data) => data.map(transformVehicleBrandForCache)
  },
  {
    name: 'vehicle_models',
    label: 'Modelos de vehículos',
    query: () => supabase.from('vehicle_models').select('*').eq('is_active', true).order('name'),
    transformForCache: (data) => data.map(transformVehicleModelForCache)
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
          // Aplicar transformación si está definida
          const dataToCache = config.transformForCache ? config.transformForCache(data) : data;
          await cacheTableData(config.name, dataToCache);
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
