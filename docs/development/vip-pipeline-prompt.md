# Prompt: Módulo Pipeline VIP - Sistema de Gestión de Servicios por Cliente

**Versión:** 1.0  
**Fecha:** Enero 2025  
**Propósito:** Documentación completa para replicar el módulo de Pipeline VIP en otro proyecto de Lovable.

---

## 1. Descripción General

El módulo **Pipeline VIP** proporciona una vista especializada para gestionar servicios de clientes estratégicos. Organiza los servicios por estados de workflow, permite actualizaciones por lotes, y ofrece métricas en tiempo real del estado del pipeline.

### Características Principales

| Característica | Descripción |
|----------------|-------------|
| **Pipeline agrupado por estados** | Servicios organizados en secciones colapsables según su estado |
| **Métricas en tiempo real** | Dashboard con KPIs del pipeline (total servicios, valor, días promedio) |
| **Actualización por lotes (Batch Update)** | Asignación masiva de cotizaciones y órdenes de compra |
| **Filtros avanzados** | Búsqueda por folio, tipo de servicio, fechas, cotización, OC, N° fiscal |
| **Exportación PDF/Excel** | Generación de reportes por estados seleccionados |
| **Selección múltiple** | Checkboxes por servicio y por grupo para operaciones batch |
| **Ordenamiento dinámico** | Columnas ordenables (fecha, valor, folio, etc.) |
| **Navegación colapsable** | Grupos expandibles/contraíbles con métricas de resumen |

---

## 2. Estados del Pipeline

El pipeline gestiona servicios a través de 8 estados principales:

```typescript
const PIPELINE_STATUSES = [
  {
    id: 'quoted',
    title: 'Cotizados',
    description: 'Servicios con cotización enviada'
  },
  {
    id: 'purchase_order_pending',
    title: 'Esperando O.C.',
    description: 'Aguardando orden de compra del cliente'
  },
  {
    id: 'with_purchase_order',
    title: 'Con Orden de Compra',
    description: 'Servicios con orden de compra recibida'
  },
  {
    id: 'pending',
    title: 'Programados',
    description: 'Servicios confirmados y programados'
  },
  {
    id: 'in_progress',
    title: 'En Progreso',
    description: 'Servicios ejecutándose actualmente'
  },
  {
    id: 'completed',
    title: 'Completados',
    description: 'Servicios finalizados exitosamente'
  },
  {
    id: 'failed',
    title: 'Fallidos',
    description: 'Servicios que no pudieron completarse'
  },
  {
    id: 'invoiced',
    title: 'Facturados',
    description: 'Servicios facturados y cerrados'
  }
];
```

### Diagrama de Flujo de Estados

```
┌──────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  quoted  │───▶│ purchase_order_pending│───▶│ with_purchase_order │
└──────────┘    └──────────────────────┘    └─────────────────────┘
                                                      │
                                                      ▼
                                              ┌──────────┐
                                              │ pending  │
                                              └──────────┘
                                                      │
                                                      ▼
                                            ┌─────────────┐
                                            │ in_progress │
                                            └─────────────┘
                                                   │
                            ┌──────────────────────┼──────────────────────┐
                            ▼                      │                      ▼
                      ┌───────────┐               │               ┌──────────┐
                      │  failed   │               ▼               │ cancelled│
                      └───────────┘         ┌───────────┐         └──────────┘
                                            │ completed │
                                            └───────────┘
                                                   │
                                                   ▼
                                            ┌───────────┐
                                            │ invoiced  │
                                            └───────────┘
```

---

## 3. Interfaces TypeScript

### 3.1 Service (Tipo base)

```typescript
export type ServiceStatus = 
  | 'new'
  | 'quoted' 
  | 'purchase_order_pending'
  | 'with_purchase_order'
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'invoiced';

export interface Service {
  id: string;
  folio: string;
  requestDate: string;
  serviceDate: string;
  startTime?: string;
  endTime?: string;
  
  // Cliente
  client: {
    id: string;
    name: string;
    rut: string;
  };
  
  // Vehículo
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  
  // Ubicación
  origin: string;
  destination: string;
  
  // Recursos
  crane?: {
    id: string;
    licensePlate: string;
    brand: string;
    model: string;
  };
  operator?: {
    id: string;
    name: string;
  };
  serviceType: {
    id: string;
    name: string;
  };
  
  // Financiero
  value: number;
  quoteNumber?: string;
  purchaseOrder?: string;
  purchaseOrderNumber?: string;
  invoiceFolio?: string;
  invoiceNumeroFiscal?: string;
  
  // Estado
  status: ServiceStatus;
  observations?: string;
}
```

### 3.2 ServiceGroup (Agrupación por estado)

```typescript
interface ServiceGroup {
  status: ServiceStatus;
  title: string;
  services: Service[];
  totalValue: number;
  averageDays: number;
  color: string;
  textColor: string;
  sortingDate: Date | null;
  sortingDateLabel: string;
}
```

### 3.3 BatchUpdateData (Actualización por lotes)

```typescript
export interface BatchUpdateData {
  types: ('quote' | 'purchase_order')[];
  services: {
    id: string;
    quote_number?: string;
    purchase_order_number?: string;
    target_status?: string;
  }[];
  notes?: string;
  auto_update_status?: boolean;
}
```

### 3.4 BatchProgressState (Estado del progreso)

```typescript
export interface BatchProgressState {
  isOpen: boolean;
  current: number;
  total: number;
  operationName: string;
  currentItemName?: string;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}
```

### 3.5 AdvancedFilters (Filtros avanzados)

```typescript
interface AdvancedFilters {
  serviceTypeId?: string;
  licensePlate?: string;
  quoteNumber?: string;
  purchaseOrderNumber?: string;
  numeroFiscal?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

---

## 4. Estructura de Componentes

### 4.1 Árbol de Componentes

```
VipClientPipeline.tsx (Página principal)
├── PipelineMetrics.tsx (Dashboard de métricas)
├── PipelineListView.tsx (Vista de lista con grupos)
│   ├── AdvancedServiceFilters.tsx (Panel de filtros)
│   ├── Collapsible (Grupos por estado)
│   │   ├── Table (Lista de servicios)
│   │   │   └── Checkbox (Selección individual)
│   │   └── Métricas del grupo (valor total, días promedio)
│   └── BatchUpdateModal.tsx (Modal de actualización por lotes)
├── PipelineExportModal.tsx (Modal de exportación)
└── BatchProgressModal.tsx (Modal de progreso retro)
```

### 4.2 Componente Principal: VipClientPipeline.tsx

```typescript
// Estructura básica del componente de página
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PipelineMetrics } from '@/components/vip/PipelineMetrics';
import { PipelineListView } from '@/components/vip/PipelineListView';
import { useBatchProgress, BatchProgressModal } from '@/components/ui/batch-progress-modal';
import { useClientServices } from '@/hooks/useClientServices';
import { useClients } from '@/hooks/useClients';

export default function VipClientPipeline() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { services, loading, refetch } = useClientServices(clientId || null);
  const batchProgress = useBatchProgress();
  
  const client = clients?.find(c => c.id === clientId);

  const handleBatchUpdate = async (updates: BatchUpdateData) => {
    const total = updates.services.length;
    batchProgress.start('Actualizando servicios', total);
    
    try {
      for (let i = 0; i < updates.services.length; i++) {
        const serviceUpdate = updates.services[i];
        
        // Actualizar servicio en la base de datos
        await updateServiceInDatabase(serviceUpdate);
        
        batchProgress.update(i + 1, serviceUpdate.id);
      }
      
      batchProgress.complete();
      refetch();
    } catch (error) {
      batchProgress.error(error.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header con información del cliente */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client?.name}</h1>
          <p className="text-muted-foreground">{client?.rut}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>

      {/* Métricas del pipeline */}
      <PipelineMetrics 
        services={services} 
        clientName={client?.name || ''} 
      />

      {/* Vista de lista con pipeline */}
      <PipelineListView
        services={services}
        loading={loading}
        clientId={clientId || ''}
        clientName={client?.name || ''}
        onServiceUpdate={refetch}
        onBatchUpdate={handleBatchUpdate}
      />

      {/* Modal de progreso */}
      <BatchProgressModal 
        state={batchProgress.state} 
        onClose={batchProgress.close} 
      />
    </div>
  );
}
```

---

## 5. Funcionalidad de Actualización por Lotes (Batch Update)

### 5.1 Flujo de Trabajo

```
1. Usuario selecciona servicios (checkboxes)
        ↓
2. Click en "Actualizar por Lotes"
        ↓
3. Se abre BatchUpdateModal
        ↓
4. Usuario configura:
   - Habilitar Cotización (Switch)
   - Habilitar Orden de Compra (Switch)
   - Prefijo (COT-, OC-)
   - Número Base (mismo para todos) O Número Inicial (secuencial)
   - Auto-actualizar estado (Switch)
        ↓
5. Click en "Confirmar"
        ↓
6. Se abre BatchProgressModal
        ↓
7. Progreso en tiempo real
        ↓
8. Sonido de éxito/error
        ↓
9. Cerrar modales y refrescar datos
```

### 5.2 Lógica de Numeración

```typescript
// MODO 1: Número Base (mismo para todos)
// Si baseNumber = "2024001" y prefix = "COT-"
// Resultado: Todos los servicios = "COT-2024001"

// MODO 2: Número Secuencial (incrementa)
// Si startingNumber = "1001" y prefix = "OC-" y hay 3 servicios
// Resultado: 
//   Servicio 1 = "OC-1001"
//   Servicio 2 = "OC-1002"
//   Servicio 3 = "OC-1003"

const generateNumbers = (
  services: Service[], 
  config: { prefix: string; baseNumber?: string; startingNumber?: string }
) => {
  return services.map((service, index) => {
    if (config.baseNumber) {
      return `${config.prefix}${config.baseNumber}`;
    } else if (config.startingNumber) {
      const startNum = parseInt(config.startingNumber);
      return `${config.prefix}${startNum + index}`;
    }
    return '';
  });
};
```

### 5.3 Lógica de Estado Automático

```typescript
// OC prevalece sobre cotización para determinar el estado
const determineTargetStatus = (
  enableQuote: boolean, 
  enablePO: boolean
): ServiceStatus | null => {
  if (enablePO) {
    return 'with_purchase_order';  // OC siempre prevalece
  } else if (enableQuote) {
    return 'quoted';
  }
  return null;
};
```

### 5.4 Componente BatchUpdateModal

```typescript
export const BatchUpdateModal: React.FC<BatchUpdateModalProps> = ({
  open,
  onOpenChange,
  selectedServices,
  onBatchUpdate,
  clientName
}) => {
  const [enableQuote, setEnableQuote] = useState(true);
  const [enablePurchaseOrder, setEnablePurchaseOrder] = useState(false);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState(true);
  const [excludedServices, setExcludedServices] = useState<Set<string>>(new Set());
  const [batchData, setBatchData] = useState({
    quote: { baseNumber: '', startingNumber: '', prefix: 'COT-', notes: '' },
    purchase_order: { baseNumber: '', startingNumber: '', prefix: 'OC-', notes: '' }
  });

  // Servicios activos (no excluidos)
  const activeServices = useMemo(() => 
    selectedServices.filter(s => !excludedServices.has(s.id)),
    [selectedServices, excludedServices]
  );

  const handleSubmit = async () => {
    const services = activeServices.map((service, index) => {
      const serviceData: any = { id: service.id };

      if (enableQuote) {
        if (batchData.quote.baseNumber) {
          serviceData.quote_number = `${batchData.quote.prefix}${batchData.quote.baseNumber}`;
        } else if (batchData.quote.startingNumber) {
          const startNum = parseInt(batchData.quote.startingNumber);
          serviceData.quote_number = `${batchData.quote.prefix}${startNum + index}`;
        }
      }

      if (enablePurchaseOrder) {
        if (batchData.purchase_order.baseNumber) {
          serviceData.purchase_order_number = `${batchData.purchase_order.prefix}${batchData.purchase_order.baseNumber}`;
        } else if (batchData.purchase_order.startingNumber) {
          const startNum = parseInt(batchData.purchase_order.startingNumber);
          serviceData.purchase_order_number = `${batchData.purchase_order.prefix}${startNum + index}`;
        }
      }

      if (autoUpdateStatus) {
        serviceData.target_status = enablePurchaseOrder 
          ? 'with_purchase_order' 
          : 'quoted';
      }

      return serviceData;
    });

    await onBatchUpdate({
      types: [...(enableQuote ? ['quote'] : []), ...(enablePurchaseOrder ? ['purchase_order'] : [])],
      services,
      auto_update_status: autoUpdateStatus
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh]">
        {/* Layout de 2 columnas */}
        <div className="flex h-full">
          {/* Panel izquierdo: Lista de servicios con checkboxes */}
          <div className="w-[35%] border-r">
            <ScrollArea>
              {selectedServices.map(service => (
                <div key={service.id} onClick={() => toggleExclusion(service.id)}>
                  <Checkbox checked={!excludedServices.has(service.id)} />
                  <span>{service.folio}</span>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Panel derecho: Configuración */}
          <div className="flex-1">
            {/* Card Cotizaciones */}
            <Card className={enableQuote ? 'border-blue-500' : ''}>
              <Switch checked={enableQuote} onCheckedChange={setEnableQuote} />
              {enableQuote && (
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Prefijo" value={batchData.quote.prefix} />
                  <Input label="Nº Base" value={batchData.quote.baseNumber} />
                  <Input label="Nº Inicial" value={batchData.quote.startingNumber} />
                </div>
              )}
            </Card>

            {/* Card Órdenes de Compra */}
            <Card className={enablePurchaseOrder ? 'border-green-500' : ''}>
              <Switch checked={enablePurchaseOrder} onCheckedChange={setEnablePurchaseOrder} />
              {/* Similar a cotizaciones */}
            </Card>

            {/* Auto-actualizar estado */}
            <Switch 
              checked={autoUpdateStatus} 
              onCheckedChange={setAutoUpdateStatus}
              label="Actualizar estado automáticamente"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit}>
            Confirmar Actualización ({activeServices.length} servicios)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 6. Hooks Personalizados

### 6.1 useClientServices

```typescript
export const useClientServices = (clientId: string | null) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServicesByClient = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          client:clients(*),
          crane:cranes(*),
          operator:operators(*),
          serviceType:service_types(*)
        `)
        .eq('client_id', id)
        .order('service_date', { ascending: false });

      if (error) throw error;
      
      // Transformar datos...
      setServices(formattedServices);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      fetchServicesByClient(clientId);
    }
  }, [clientId, fetchServicesByClient]);

  return { services, loading, refetch: () => fetchServicesByClient(clientId!) };
};
```

### 6.2 useUpdateServicesBatch

```typescript
export interface ServiceBatchUpdateData {
  serviceIds: string[];
  fields: {
    status?: ServiceStatus;
    crane_id?: string | null;
    observations?: string | null;
  };
  appendObservations?: boolean;
  operatorId?: string | null;
  onProgress?: (progress: BatchProgressCallback) => void;
}

export const useUpdateServicesBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceBatchUpdateData) => {
      const { serviceIds, fields, onProgress } = data;
      const total = serviceIds.length;

      for (let index = 0; index < serviceIds.length; index++) {
        const serviceId = serviceIds[index];
        
        // Actualizar servicio
        await supabase
          .from('services')
          .update(fields)
          .eq('id', serviceId);

        // Reportar progreso
        onProgress?.({
          current: index + 1,
          total,
          percentage: ((index + 1) / total) * 100,
          currentItemId: serviceId,
        });
      }

      return { success: true, count: serviceIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Servicios actualizados exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
};
```

### 6.3 useBatchProgress

```typescript
export const useBatchProgress = () => {
  const [state, setState] = useState<BatchProgressState>({
    isOpen: false,
    current: 0,
    total: 0,
    operationName: '',
  });

  const start = (operationName: string, total: number) => {
    setState({
      isOpen: true,
      current: 0,
      total,
      operationName,
      isComplete: false,
      hasError: false,
    });
  };

  const update = (current: number, currentItemName?: string) => {
    setState(prev => ({ ...prev, current, currentItemName }));
  };

  const complete = () => {
    playRetroSuccessSound();  // Sonido 8-bit de éxito
    setState(prev => ({ ...prev, current: prev.total, isComplete: true }));
  };

  const error = (message?: string) => {
    playRetroErrorSound();  // Sonido 8-bit de error
    setState(prev => ({ ...prev, hasError: true, errorMessage: message }));
  };

  const close = () => {
    setState(prev => ({ ...prev, isOpen: false }));
  };

  return { state, start, update, complete, error, close };
};
```

### 6.4 useAdvancedFilters

```typescript
export const useAdvancedFilters = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({});

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== undefined && v !== '');
  }, [filters]);

  const applyAdvancedFilters = (
    services: Service[], 
    basicFilters: { searchTerm: string; statusFilter: string }
  ): Service[] => {
    let filtered = services;

    // Filtro básico de búsqueda
    if (basicFilters.searchTerm) {
      const term = basicFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.folio.toLowerCase().includes(term) ||
        s.serviceType.name.toLowerCase().includes(term) ||
        s.quoteNumber?.toLowerCase().includes(term) ||
        s.purchaseOrderNumber?.toLowerCase().includes(term)
      );
    }

    // Filtros avanzados
    if (filters.serviceTypeId) {
      filtered = filtered.filter(s => s.serviceType.id === filters.serviceTypeId);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(s => s.serviceDate >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(s => s.serviceDate <= filters.dateTo!);
    }
    // ... más filtros

    return filtered;
  };

  const clearFilters = () => setFilters({});
  const updateFilters = (newFilters: Partial<AdvancedFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return { isOpen, setIsOpen, filters, hasActiveFilters, applyAdvancedFilters, clearFilters, updateFilters };
};
```

---

## 7. Componentes UI Especiales

### 7.1 BatchProgressModal

Modal de progreso con estética retro gaming.

```typescript
export const BatchProgressModal = ({ state, onClose }: BatchProgressModalProps) => {
  const { isOpen, current, total, operationName, isComplete, hasError } = state;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (isComplete || hasError) && onClose?.()}>
      <DialogContent className="bg-gray-950 border-cyan-500/50">
        {/* Header */}
        <h3 className="text-cyan-400 font-mono">{operationName}</h3>

        {/* Barra de progreso retro */}
        <RetroProgressBar value={percentage} hasError={hasError} />

        {/* Contador */}
        <div className="flex items-center justify-center gap-2">
          {hasError ? <XCircle className="text-red-500" /> 
           : isComplete ? <CheckCircle2 className="text-green-500" />
           : <Loader2 className="text-cyan-400 animate-spin" />}
          <span className="font-mono">
            {current} de {total} elementos
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

### 7.2 RetroProgressBar

Barra de progreso segmentada estilo retro.

```typescript
export const RetroProgressBar = ({ value, hasError = false }: RetroProgressBarProps) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const totalSegments = 20;
  const filledSegments = Math.floor((clampedValue / 100) * totalSegments);

  // Gradiente de colores: rojo → naranja → amarillo → verde
  const getGradientColor = () => {
    if (hasError) return 'from-red-700 via-red-600 to-red-500';
    if (clampedValue <= 25) return 'from-red-600 via-red-500 to-red-400';
    if (clampedValue <= 50) return 'from-red-500 via-orange-500 to-orange-400';
    if (clampedValue <= 75) return 'from-orange-500 via-yellow-500 to-yellow-400';
    return 'from-yellow-500 via-lime-500 to-green-500';
  };

  return (
    <div className="relative p-1 bg-gray-950 rounded-sm border-2 border-cyan-500/70">
      <div className="flex gap-0.5 p-0.5">
        {Array.from({ length: totalSegments }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'flex-1 h-6 rounded-sm',
              index < filledSegments
                ? `bg-gradient-to-b ${getGradientColor()}`
                : 'bg-gray-800/50'
            )}
          />
        ))}
      </div>
      {/* Efecto scanline retro */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" />
    </div>
  );
};
```

### 7.3 Sonidos Retro (8-bit)

```typescript
// src/lib/sounds.ts
export const playRetroSuccessSound = () => {
  try {
    const audioContext = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.value = freq;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const startTime = audioContext.currentTime + i * 0.1;
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
    });
  } catch (error) {
    console.error('Audio not supported');
  }
};

export const playRetroErrorSound = () => {
  // Similar pero con notas descendentes: G4, E4, C4
  const notes = [392, 329.63, 261.63];
  // ... implementación similar
};
```

---

## 8. Esquema de Base de Datos

### 8.1 Tabla services (campos relevantes)

```sql
-- Campos principales para el pipeline
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS quote_number TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS purchase_order_number TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS invoice_numero_fiscal TEXT;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_services_client_id ON public.services(client_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_quote_number ON public.services(quote_number);
CREATE INDEX IF NOT EXISTS idx_services_purchase_order_number ON public.services(purchase_order_number);

-- Enum de estados (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_status_enum') THEN
    CREATE TYPE service_status_enum AS ENUM (
      'new',
      'quoted',
      'purchase_order_pending',
      'with_purchase_order',
      'pending',
      'in_progress',
      'completed',
      'failed',
      'cancelled',
      'invoiced'
    );
  END IF;
END$$;
```

### 8.2 Vista de Servicios para Pipeline

```sql
CREATE OR REPLACE VIEW pipeline_services AS
SELECT 
  s.*,
  c.name as client_name,
  c.rut as client_rut,
  cr.license_plate as crane_license_plate,
  o.name as operator_name,
  st.name as service_type_name
FROM services s
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN cranes cr ON s.crane_id = cr.id
LEFT JOIN operators o ON s.operator_id = o.id
LEFT JOIN service_types st ON s.service_type_id = st.id
WHERE s.status NOT IN ('cancelled')
ORDER BY s.service_date DESC;
```

---

## 9. Patrones de Diseño UI

### 9.1 Layout de Dos Columnas en Modal

```tsx
<DialogContent className="max-w-5xl h-[80vh]">
  <div className="flex h-full">
    {/* Panel izquierdo: 35% - Lista de items */}
    <div className="w-[35%] border-r flex flex-col">
      <div className="px-4 py-3 border-b">
        <span>Servicios</span>
        <Badge>{activeCount} de {totalCount}</Badge>
      </div>
      <ScrollArea className="flex-1">
        {/* Lista de items con checkboxes */}
      </ScrollArea>
    </div>

    {/* Panel derecho: 65% - Formulario/Configuración */}
    <div className="flex-1 flex flex-col">
      <ScrollArea className="flex-1 p-4">
        {/* Cards de configuración */}
      </ScrollArea>
    </div>
  </div>
</DialogContent>
```

### 9.2 Grupos Colapsables con Métricas

```tsx
<Collapsible open={expanded} onOpenChange={toggle}>
  <CollapsibleTrigger className="w-full">
    <Card className="cursor-pointer hover:border-primary/50">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown /> : <ChevronRight />}
          <Badge>{title}</Badge>
          <span>{services.length} servicios</span>
        </div>
        <div className="flex items-center gap-4">
          <span>${totalValue.toLocaleString()}</span>
          <span>{averageDays} días promedio</span>
        </div>
      </div>
    </Card>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Table>
      {/* Tabla de servicios */}
    </Table>
  </CollapsibleContent>
</Collapsible>
```

### 9.3 Selección Múltiple con Checkbox de Grupo

```tsx
// Checkbox en header de tabla para seleccionar todo el grupo
<TableHead>
  <Checkbox
    checked={allGroupSelected}
    indeterminate={someGroupSelected && !allGroupSelected}
    onCheckedChange={(checked) => handleSelectAll(groupServices, checked)}
  />
</TableHead>

// Checkbox individual por fila
<TableCell>
  <Checkbox
    checked={selectedServices.has(service.id)}
    onCheckedChange={(checked) => handleServiceSelection(service.id, checked)}
  />
</TableCell>
```

---

## 10. Guía de Implementación

### Paso 1: Crear estructura de archivos

```
src/
├── pages/
│   └── VipClientPipeline.tsx
├── components/
│   └── vip/
│       ├── PipelineMetrics.tsx
│       ├── PipelineListView.tsx
│       ├── BatchUpdateModal.tsx
│       └── PipelineExportModal.tsx
├── components/ui/
│   ├── batch-progress-modal.tsx
│   └── retro-progress-bar.tsx
├── hooks/
│   ├── useClientServices.ts
│   ├── useUpdateServicesBatch.ts
│   ├── useAdvancedFilters.ts
│   └── vip/
│       └── usePipelineServiceExport.ts
└── lib/
    └── sounds.ts
```

### Paso 2: Configurar rutas

```tsx
// En tu router principal
<Route path="/vip/client/:clientId" element={<VipClientPipeline />} />
```

### Paso 3: Implementar hooks primero

1. `useClientServices` - Fetch de servicios por cliente
2. `useUpdateServicesBatch` - Mutación para actualizaciones por lotes
3. `useBatchProgress` - Gestión de estado del modal de progreso

### Paso 4: Implementar componentes UI

1. `RetroProgressBar` - Barra de progreso visual
2. `BatchProgressModal` - Modal de progreso
3. `BatchUpdateModal` - Modal de configuración de batch
4. `PipelineListView` - Vista principal de lista

### Paso 5: Integrar en página principal

Combinar todos los componentes en `VipClientPipeline.tsx`.

---

## 11. Notas de Integración

### Dependencias Requeridas

```json
{
  "date-fns": "^4.x",
  "@tanstack/react-query": "^5.x",
  "@radix-ui/react-dialog": "^1.x",
  "@radix-ui/react-checkbox": "^1.x",
  "@radix-ui/react-collapsible": "^1.x",
  "@radix-ui/react-scroll-area": "^1.x",
  "lucide-react": "^0.4x",
  "sonner": "^1.x"
}
```

### Consideraciones de Performance

- Usar `useMemo` para cálculos de agrupación de servicios
- Virtualizar listas grandes con react-virtual si hay >100 servicios por grupo
- Debounce en filtros de búsqueda (300ms recomendado)

### Accesibilidad

- Todos los checkboxes deben tener `aria-label`
- Los modales deben gestionar el foco correctamente
- Los sonidos son opcionales y no deben ser la única retroalimentación

---

## 12. Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | Enero 2025 | Versión inicial con batch update, métricas y exportación |

---

**Fin del documento**
