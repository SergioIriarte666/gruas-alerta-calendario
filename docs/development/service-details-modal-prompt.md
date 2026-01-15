# Prompt: Modal de Detalles del Servicio

## Descripción General

Modal de visualización completa de un servicio que muestra toda la información relacionada, incluyendo datos del cliente, vehículo, detalles del servicio, custodia/arriendo, recursos asignados, finanzas, costos y el historial de servicios.

**Características principales**:
- **4 Tabs** de navegación (Información General, Detalles del Servicio, Costos y Gastos, Historial Vehículo)
- **Header fijo** con folio, badge de estado y acciones (Duplicar, Descargar PDF)
- **Datos enriquecidos** con información del cliente, vehículo, recursos, operadores y finanzas
- **Generación de PDF** completo con todos los detalles del servicio
- **Historial dinámico** (por patente o por cliente según el tipo de servicio)
- **Footer** con auditoría (creado por, actualizado)
- **Sincronización silenciosa** de comisiones de operadores

---

## Layout del Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Header] Detalles del Servicio - SRV-00156  [Badge Estado] [Duplicar] [PDF] │
├──────────────────────────────────────────────────────────────────────────┤
│  [Tab 1: Info General] [Tab 2: Detalles] [Tab 3: Costos] [Tab 4: Historial] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Sección Cliente ─────────────────────────────────────────────────┐  │
│  │  👤 Nombre / Razón Social: Empresa XYZ S.A.                       │  │
│  │  🏢 Departamento: Logística                                       │  │
│  │  🪪 RUT: 76.123.456-7                                             │  │
│  │  📞 Teléfono: +56 9 1234 5678                                     │  │
│  │  ✉️ Email: contacto@empresa.cl                                    │  │
│  │  📍 Dirección: Av. Principal 123, Santiago                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ Sección Vehículo ────────────────────────────────────────────────┐  │
│  │  🔧 Marca y Modelo: Toyota Hilux 2022                             │  │
│  │  🪪 Patente: ABCD-12                                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  (ScrollArea con contenido dinámico según tab seleccionado)              │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  [Footer] Creado: 15/01/2026 10:30 por Juan Pérez | Actualizado: ...     │
└──────────────────────────────────────────────────────────────────────────┘
```

- `Dialog` de shadcn/ui con `max-w-4xl` y altura `h-[90vh]`
- Header fijo con título, badge de estado y botones de acción
- `ScrollArea` con contenido de pestañas
- Footer con timestamps de creación y actualización

---

## Sistema de Pestañas (4 Tabs)

### Tab 1 - Información General

**Sección Cliente**:
- Nombre / Razón Social
- Departamento
- Asegurado (condicional si `insuredName` existe)
- RUT
- Teléfono
- Email
- Dirección (ancho completo)

**Sección Vehículo** (condicional según `shouldShowVehicleInfo`):
- Marca y Modelo
- Patente

### Tab 2 - Detalles del Servicio

**Información del Servicio**:
- Tipo de Servicio
- Orden de Compra (condicional)
- Número de Cotización (condicional)
- Folio Factura (condicional)
- Número Fiscal (condicional)
- Fecha de Solicitud
- Fecha y Hora de Servicio
- Hora de Inicio (condicional)
- Hora de Término (condicional)
- Duración del Servicio (calculada)
- Kilometraje Grúa (condicional)
- Origen (ancho completo)
- Destino (ancho completo)

**Información de Custodia/Arriendo** (condicional según `isCustodyService`):
- Tipo de Vehículo/Equipo
- Días de Custodia/Arriendo
- Tarifa (diaria/semanal/mensual)
- Descuento (condicional)
- Total Custodia/Arriendo
- Fecha Inicio (condicional)
- Fecha Fin (condicional)
- Notas (condicional, ancho completo)

**Recursos Asignados**:
- Grúa (marca, modelo, patente)
- Operador(es) (nombre, RUT, rol si hay múltiples)

**Finanzas**:
- Valor Base del Servicio (si tiene tanto base como custodia)
- Valor de Custodia (si aplica)
- Valor Total del Servicio
- Monto Cubierto Cliente (si tiene excedente)
- Excedente (si aplica)
- Total Costos
- Ganancia Neta (verde si positiva, rojo si negativa)

**Observaciones** (condicional si existen)

### Tab 3 - Costos y Gastos

Componente `ServiceCostsSection`:
- Card resumen con total de costos y cantidad
- Resumen por categoría (grid)
- Sección de comisiones de operadores
- Lista de costos agrupados por categoría con:
  - Descripción
  - Badge de subcategoría
  - Fecha
  - Grúa asociada (si aplica)
  - Operador asociado (si aplica)
  - Folio del servicio
  - Notas (si existen)
  - Monto destacado en rojo

### Tab 4 - Historial Vehículo

Componente `VehicleHistory`:
- Detecta automáticamente si mostrar historial por patente o por cliente
- Título dinámico según tipo
- Badge con cantidad de servicios
- Tabla con columnas:
  - Folio (con badge "Actual" para servicio actual)
  - Fecha
  - Cliente/Patente (según tipo de historial)
  - Tipo Servicio
  - Ruta (origen → destino)
  - Valor
  - Estado (badge colorizado)

---

## Interfaces TypeScript

```typescript
interface ServiceDetailsModalProps {
  service: Service;
  isOpen: boolean;
  onClose: () => void;
  onDuplicate?: (service: Service) => void;
}

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  isFullWidth?: boolean;
}

interface DetailSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

interface ServiceCostsSectionProps {
  serviceId: string;
  enhancedService?: EnhancedService | null;
}

interface VehicleHistoryProps {
  licensePlate: string;
  currentServiceId?: string;
  clientId?: string;
  clientName?: string;
}

interface VehicleHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  status: ServiceStatus;
  serviceType: { name: string };
  client: { name: string };
  value: number;
  origin: string;
  destination: string;
}

interface ClientHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  status: ServiceStatus;
  serviceType: { name: string };
  licensePlate: string;
  value: number;
  origin: string;
  destination: string;
}

interface EnhancedService {
  id: string;
  folio: string;
  requestDate: string;
  serviceDate: string;
  client: Client | null;
  purchaseOrder: string | null;
  purchaseOrderNumber: string;
  quoteNumber: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  licensePlate: string | null;
  startTime?: string;
  endTime?: string;
  craneMileage?: number;
  origin: string | null;
  destination: string | null;
  serviceType: ServiceType;
  value: number;
  crane: Crane | null;
  status: ServiceStatus;
  observations: string | null;
  hasExcess: boolean | null;
  clientCoveredAmount: number | null;
  excessAmount: number | null;
  invoiceFolio: string | null;
  invoiceNumeroFiscal: string | null;
  // Campos de custodia
  custodyMode: 'manual' | 'calendar' | 'none' | undefined;
  custodyDays: number | null;
  custodyDailyRate: number | null;
  custodyRateType: string | null;
  custodyStartDate: string | null;
  custodyEndDate: string | null;
  custodyVehicleType: string | null;
  custodyDiscountPercentage: number | null;
  custodyTotalAmount: number | null;
  custodyNotes: string | null;
  // Auditoría
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
  // Datos mejorados
  operators: ServiceOperator[];
  serviceCosts: Cost[];
  totalCosts: number;
  totalCommissions: number;
}

interface ServiceOperator {
  id: string;
  operatorId: string;
  operator: Operator;
  commission: number;
  role: string;
  hours?: number;
}
```

---

## Componentes Reutilizables

### DetailItem

```typescript
const DetailItem = ({ icon: Icon, label, value, valueClass = '', isFullWidth = false }: DetailItemProps) => (
  <div className={`flex items-start space-x-3 ${isFullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <Icon className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
    <div className="flex-grow">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium ${valueClass}`}>{value || 'N/A'}</p>
    </div>
  </div>
);
```

### DetailSection

```typescript
const DetailSection = ({ title, icon: Icon, children }: DetailSectionProps) => (
  <div>
    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
      <Icon className="w-5 h-5 mr-2 text-tms-green"/>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  </div>
);
```

### Cálculo de Duración

```typescript
const calculateDuration = (startTime: string, endTime: string): string => {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  const durationMinutes = endTotalMinutes - startTotalMinutes;
  
  if (durationMinutes < 0) {
    return 'Hora de término anterior a inicio';
  }
  
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  if (hours === 0) {
    return `${minutes} minutos`;
  } else if (minutes === 0) {
    return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else {
    return `${hours}h ${minutes}min`;
  }
};
```

---

## Componente Principal: ServiceDetailsModal

```typescript
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, User, Truck, MapPin, DollarSign, FileText, Clock,
  Phone, Mail, Building, IdCard, UserCheck, Wrench, Shield,
  Download, Timer, Gauge, Copy
} from 'lucide-react';

export const ServiceDetailsModal = ({ service, isOpen, onClose, onDuplicate }: ServiceDetailsModalProps) => {
  if (!service) return null;
  
  const queryClient = useQueryClient();
  
  // Hook para obtener datos completos del servicio
  const { enhancedService, isLoading } = useServiceDetailsForView(service.id);
  
  // Hook para generar PDF
  const { generatePDF, isGenerating } = useServiceDetailsPDF();
  
  // Combinar datos preservando SIEMPRE el creatorName
  const serviceData = enhancedService ? {
    ...enhancedService,
    client: {
      ...enhancedService.client,
      department: enhancedService.client.department || service.client.department
    },
    createdBy: enhancedService.createdBy || service.createdBy,
    creatorName: enhancedService.creatorName || service.creatorName || 'Usuario Desconocido'
  } : service;
  
  // Obtener datos calculados
  const serviceCosts = enhancedService?.serviceCosts || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;
  const totalCosts = totalServiceCosts + totalCommissions;
  
  // Valores del servicio
  const displayServiceValue = getDisplayServiceValue(serviceData);
  const serviceBreakdown = getServiceValueBreakdown(serviceData);
  const closureValue = getServiceValueForClosure(serviceData);
  const netProfit = closureValue - totalCosts;
  
  // Detectar custodia
  const isCustody = isCustodyService(serviceData);
  const custodyInfo = isCustody ? getCustodyInfo(serviceData) : null;
  const isEquipmentRental = isEquipmentRentalService(serviceData);
  
  // SINCRONIZACIÓN SILENCIOSA DE COMISIONES
  useEffect(() => {
    const verifyAndSyncCommissions = async () => {
      if (!isOpen || !serviceData.id) return;
      if ((serviceData.operatorCommission || 0) <= 0) return;

      const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
      
      const { data: existingCommissions } = await supabase
        .from('costs')
        .select('id, amount')
        .eq('service_id', serviceData.id)
        .eq('category_id', commissionCategoryId);

      if (!existingCommissions || existingCommissions.length === 0) {
        // Sincronización silenciosa
        await supabase.rpc('force_commission_sync_for_service', { 
          p_service_id: serviceData.id 
        });
        
        // Invalidar queries
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData.id] });
        queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData.id] });
        queryClient.invalidateQueries({ queryKey: ['costs'] });
        queryClient.invalidateQueries({ queryKey: ['commissions'] });
      }
    };

    if (isOpen && serviceData.id) {
      queryClient.invalidateQueries({ queryKey: ['service-costs', serviceData.id] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', serviceData.id] });
      setTimeout(verifyAndSyncCommissions, 100);
    }
  }, [isOpen, serviceData.id, serviceData.operatorCommission, queryClient]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span>Detalles del Servicio - {serviceData.folio}</span>
              {getServiceStatusBadge(serviceData.status)}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onDuplicate && (
                <Button variant="secondary" size="sm" onClick={() => onDuplicate(service)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isGenerating}>
                <Download className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="details">Detalles del Servicio</TabsTrigger>
              <TabsTrigger value="costs">Costos y Gastos</TabsTrigger>
              <TabsTrigger value="history">Historial Vehículo</TabsTrigger>
            </TabsList>
            
            {/* TAB CONTENT... */}
          </Tabs>

          <div className="flex justify-between text-sm text-muted-foreground pt-4 mt-6 mb-6 border-t border-border">
            <span>
              Creado: {formatForDisplayWithTime(serviceData.createdAt)}
              {serviceData.creatorName && ` por ${serviceData.creatorName}`}
            </span>
            <span>Actualizado: {formatForDisplayWithTime(serviceData.updatedAt)}</span>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Componente: ServiceCostsSection

```typescript
import React from 'react';
import { useServiceCosts } from '@/hooks/useServiceCosts';
import { EnhancedService } from '@/types/serviceDetails';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, AlertTriangle, Calculator, TrendingDown } from 'lucide-react';

export const ServiceCostsSection = ({ serviceId, enhancedService }: ServiceCostsSectionProps) => {
  const { data: costs, isLoading, error } = useServiceCosts(serviceId);
  
  // Usar datos del enhanced service si están disponibles
  const allCosts = enhancedService?.serviceCosts || costs || [];
  const operatorsData = enhancedService?.operators || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const totalCosts = allCosts.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;
  const grandTotal = totalCosts + totalCommissions;

  // Agrupar costos por categoría
  const costsByCategory = allCosts.reduce((acc, cost) => {
    const categoryName = cost.cost_categories?.name || 'Sin categoría';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(cost);
    return acc;
  }, {} as Record<string, typeof allCosts>);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">Error al cargar los costos del servicio</span>
      </div>
    );
  }

  if (!allCosts.length && !operatorsData.length) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay costos ni comisiones registrados para este servicio</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card resumen total */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-destructive" />
            <span className="font-medium text-foreground">Total de Costos</span>
          </div>
          <span className="text-lg font-bold text-destructive">
            {formatCurrency(grandTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
          <span>{allCosts.length + operatorsData.length} costos registrados</span>
          <span>{Object.keys(costsByCategory).length + (operatorsData.length > 0 ? 1 : 0)} categorías</span>
        </div>
      </div>

      {/* Resumen por categorías */}
      {(Object.keys(costsByCategory).length > 1 || operatorsData.length > 0) && (
        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingDown className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground text-sm">Resumen por Categoría</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {operatorsData.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate">Comisión Operador:</span>
                <span className="text-destructive font-medium">{formatCurrency(totalCommissions)}</span>
              </div>
            )}
            {Object.entries(costsByCategory).map(([category, categoryCosts]) => {
              const categoryTotal = categoryCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
              return (
                <div key={category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate">{category}:</span>
                  <span className="text-destructive font-medium">{formatCurrency(categoryTotal)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sección de comisiones de operadores */}
      {operatorsData.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-foreground text-sm border-b border-border pb-1">
            Comisión Operador ({operatorsData.length} costo{operatorsData.length !== 1 ? 's' : ''})
          </h4>
          
          {operatorsData.map((operatorData) => (
            <div key={operatorData.id} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="font-medium text-foreground">
                      Comisión operador - Servicio {enhancedService?.folio}
                    </h5>
                    <Badge variant="outline" className="text-xs">comisiones</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p><span className="font-medium">Operador:</span> {operatorData.operator?.name || 'N/A'}</p>
                    <p><span className="font-medium">Folio:</span> {enhancedService?.folio}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-destructive">
                    {formatCurrency(operatorData.commission || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de costos agrupados por categoría */}
      {Object.entries(costsByCategory).map(([category, categoryCosts]) => (
        <div key={category} className="space-y-2">
          <h4 className="font-medium text-foreground text-sm border-b border-border pb-1">
            {category} ({categoryCosts.length} costo{categoryCosts.length !== 1 ? 's' : ''})
          </h4>
          
          {categoryCosts.map((cost) => (
            <div key={cost.id} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="font-medium text-foreground">{cost.description}</h5>
                    {cost.subcategory && (
                      <Badge variant="outline" className="text-xs">{cost.subcategory}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p><span className="font-medium">Fecha:</span> {formatForDisplay(cost.date)}</p>
                    {cost.cranes && (
                      <p><span className="font-medium">Grúa:</span> {cost.cranes.brand} {cost.cranes.model}</p>
                    )}
                    {cost.operators && (
                      <p><span className="font-medium">Operador:</span> {cost.operators.name}</p>
                    )}
                    {cost.service_folio && (
                      <p><span className="font-medium">Folio:</span> {cost.service_folio}</p>
                    )}
                  </div>
                  {cost.notes && (
                    <p className="text-sm text-muted-foreground mt-2 italic">{cost.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-destructive">
                    {formatCurrency(Number(cost.amount))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
```

---

## Componente: VehicleHistory

```typescript
import React from 'react';
import { useVehicleHistory } from '@/hooks/useVehicleHistory';
import { useClientHistory } from '@/hooks/useClientHistory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, History, Car, User } from 'lucide-react';

export const VehicleHistory = ({ licensePlate, currentServiceId, clientId, clientName }: VehicleHistoryProps) => {
  // Detectar si es un servicio sin vehículo específico
  const isVehicleSpecific = licensePlate && licensePlate !== 'N/A' && licensePlate !== '';
  
  const vehicleQuery = useVehicleHistory(isVehicleSpecific ? licensePlate : '');
  const clientQuery = useClientHistory(!isVehicleSpecific && clientId ? clientId : '');
  
  // Usar datos apropiados según tipo de servicio
  const history = isVehicleSpecific ? vehicleQuery.history : clientQuery.history;
  const isLoading = isVehicleSpecific ? vehicleQuery.isLoading : clientQuery.isLoading;
  const error = isVehicleSpecific ? vehicleQuery.error : clientQuery.error;

  const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500 text-white' },
      in_progress: { label: 'En Progreso', className: 'bg-blue-500 text-white' },
      inspection_completed: { label: 'Inspección Completada', className: 'bg-orange-500 text-white' },
      completed: { label: 'Completado', className: 'bg-green-500 text-white' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' },
      invoiced: { label: 'Facturado', className: 'bg-purple-500 text-white' },
      quoted: { label: 'Cotizado', className: 'bg-cyan-500 text-white' },
      purchase_order_pending: { label: 'Esperando O.C.', className: 'bg-amber-500 text-white' }
    };
    const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <div className="flex items-center space-x-2 mb-4">
          {isVehicleSpecific ? <Car className="w-5 h-5 text-tms-green" /> : <User className="w-5 h-5 text-tms-green" />}
          <h3 className="text-lg font-semibold text-foreground">
            {isVehicleSpecific 
              ? `Historial de Servicios - Patente ${licensePlate}`
              : `Historial del Cliente${clientName ? ` - ${clientName}` : ''}`}
          </h3>
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-destructive/10 rounded-lg mt-4">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Error al cargar el historial</h3>
        <p className="text-destructive">No se pudo obtener el historial de servicios.</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex items-center space-x-2 mb-4">
          {isVehicleSpecific ? <Car className="w-5 h-5 text-tms-green" /> : <User className="w-5 h-5 text-tms-green" />}
          <h3 className="text-lg font-semibold text-foreground">
            {isVehicleSpecific 
              ? `Historial de Servicios - Patente ${licensePlate}`
              : `Historial del Cliente${clientName ? ` - ${clientName}` : ''}`}
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 rounded-lg">
          <History className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Sin historial previo</h3>
          <p className="text-muted-foreground">
            {isVehicleSpecific 
              ? `No se encontraron servicios previos para la patente ${licensePlate}.`
              : `No se encontraron servicios previos para este cliente.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {isVehicleSpecific ? <Car className="w-5 h-5 text-tms-green" /> : <User className="w-5 h-5 text-tms-green" />}
          <h3 className="text-lg font-semibold text-foreground">
            {isVehicleSpecific 
              ? `Historial de Servicios - Patente ${licensePlate}`
              : `Historial del Cliente${clientName ? ` - ${clientName}` : ''}`}
          </h3>
        </div>
        <Badge variant="outline" className="text-tms-green border-tms-green">
          {history.length} servicio{history.length !== 1 ? 's' : ''} encontrado{history.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-foreground">Folio</TableHead>
            <TableHead className="text-foreground">Fecha</TableHead>
            {isVehicleSpecific && <TableHead className="text-foreground">Cliente</TableHead>}
            {!isVehicleSpecific && <TableHead className="text-foreground">Patente</TableHead>}
            <TableHead className="text-foreground">Tipo Servicio</TableHead>
            <TableHead className="text-foreground">Ruta</TableHead>
            <TableHead className="text-foreground">Valor</TableHead>
            <TableHead className="text-foreground">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((service) => (
            <TableRow 
              key={service.id} 
              className={`border-border ${service.id === currentServiceId ? 'bg-tms-green/10' : ''}`}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Badge variant="tms">{service.folio}</Badge>
                  {service.id === currentServiceId && (
                    <Badge variant="outline" className="text-xs border-tms-green text-tms-green">
                      Actual
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatForDisplay(service.serviceDate)}</TableCell>
              {isVehicleSpecific && <TableCell>{'client' in service ? service.client.name : 'N/A'}</TableCell>}
              {!isVehicleSpecific && <TableCell>{'licensePlate' in service ? service.licensePlate : 'N/A'}</TableCell>}
              <TableCell>{service.serviceType.name}</TableCell>
              <TableCell className="max-w-xs">
                <div className="truncate">{service.origin} → {service.destination}</div>
              </TableCell>
              <TableCell className="font-semibold">{formatCurrency(service.value)}</TableCell>
              <TableCell>{getStatusBadge(service.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

---

## Hooks Principales

### useEnhancedServiceDetails

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchEnhancedServiceDetails = async (serviceId: string): Promise<EnhancedService | null> => {
  if (!serviceId) return null;

  // 1. Obtener datos básicos del servicio con relaciones
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .select(`
      *, quote_number,
      client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department),
      cranes(id, license_plate, brand, model, type),
      operators(id, name, rut, phone, license_number, operator_type),
      service_types!inner(id, name, description, base_price, vehicle_info_optional),
      creator:profiles!services_created_by_fkey(id, full_name, email)
    `)
    .eq('id', serviceId)
    .single();

  if (serviceError || !serviceData) return null;

  // 2. Obtener todos los costos del servicio
  const { data: costsData } = await supabase
    .from('costs')
    .select(`
      *,
      cost_categories(id, name),
      cranes(id, license_plate, brand, model),
      operators(id, name, rut)
    `)
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false });

  // 3. Separar costos de comisiones vs otros costos
  const commissionCosts = costsData?.filter(cost => 
    cost.subcategory === 'Comisiones' || 
    cost.description?.toLowerCase().includes('comisión')
  ) || [];
  
  const serviceCosts = costsData?.filter(cost => 
    cost.subcategory !== 'Comisiones' && 
    !cost.description?.toLowerCase().includes('comisión')
  ) || [];

  // 4. Construir array de operadores evitando duplicaciones
  const operators: ServiceOperator[] = [];
  const processedOperatorIds = new Set<string>();
  
  // Agregar operador principal
  if (serviceData.operators && serviceData.operator_id) {
    operators.push({
      id: 'main-operator',
      operatorId: serviceData.operator_id,
      operator: serviceData.operators,
      commission: serviceData.operator_commission || 0,
      role: 'Principal',
      hours: 8
    });
    processedOperatorIds.add(serviceData.operator_id);
  }

  // Agregar operadores adicionales desde costos de comisiones
  commissionCosts.forEach((cost) => {
    if (cost.operator_id && cost.operators && !processedOperatorIds.has(cost.operator_id)) {
      operators.push({
        id: `additional-${cost.id}`,
        operatorId: cost.operator_id,
        operator: cost.operators,
        commission: cost.amount || 0,
        role: 'Adicional'
      });
      processedOperatorIds.add(cost.operator_id);
    }
  });

  // 5. Calcular totales
  const totalCommissions = operators.reduce((sum, op) => sum + (op.commission || 0), 0);
  const totalCosts = serviceCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);

  // 6. Retornar servicio mejorado
  return {
    ...serviceData,
    creatorName: serviceData.creator?.full_name || serviceData.creator?.email,
    operators,
    serviceCosts,
    totalCosts,
    totalCommissions
  };
};

export const useEnhancedServiceDetails = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['enhanced-service-details', serviceId],
    queryFn: () => fetchEnhancedServiceDetails(serviceId!),
    enabled: !!serviceId,
    staleTime: 30000,
    gcTime: 300000
  });
};
```

### useServiceDetailsGlobal

```typescript
import { useEnhancedServiceDetails } from './useEnhancedServiceDetails';
import { useServiceDetails } from './useServiceDetails';

/**
 * Hook unificado que decide automáticamente si usar datos básicos o mejorados
 */
export const useServiceDetailsGlobal = (serviceId: string | null, enhanced: boolean = false) => {
  const basicDetails = useServiceDetails(serviceId);
  const enhancedDetails = useEnhancedServiceDetails(serviceId);

  if (enhanced) {
    return {
      ...enhancedDetails,
      service: enhancedDetails.enhancedService,
      data: enhancedDetails.enhancedService
    };
  }

  return {
    ...basicDetails,
    service: basicDetails.data,
    enhancedService: null
  };
};

/**
 * Hook específico para visualización que siempre necesita datos completos
 */
export const useServiceDetailsForView = (serviceId: string | null) => {
  return useServiceDetailsGlobal(serviceId, true);
};
```

### useServiceDetailsPDF

```typescript
import { useState } from 'react';
import { generateServiceDetailsPDF } from '@/utils/pdf/serviceDetailsPdfGenerator';
import { toast } from 'sonner';

export const useServiceDetailsPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const generatePDF = async (
    serviceData: any, 
    totalCosts: number, 
    totalCommissions: number, 
    netProfit: number
  ) => {
    setIsGenerating(true);
    
    try {
      const blob = await generateServiceDetailsPDF({
        service: serviceData,
        totalCosts,
        totalCommissions,
        netProfit
      });
      
      // Descargar automáticamente
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Servicio-${serviceData.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('PDF generado exitosamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return { generatePDF, isGenerating };
};
```

---

## Utilidades de Cálculo de Valores

### serviceValueCalculations.ts

```typescript
/**
 * Checks if a service is an equipment rental service
 */
export const isEquipmentRentalService = (service: any): boolean => {
  const serviceTypeName = service.service_type?.name || service.serviceType?.name;
  return serviceTypeName === 'Arriendo de Equipos';
};

/**
 * Gets the base service value (excluding custody calculations)
 */
export const getBaseServiceValue = (service: any): number => {
  if (!service) return 0;
  return service.value || 0;
};

/**
 * Gets the custody total amount
 */
export const getCustodyTotalAmount = (service: any): number => {
  if (!service) return 0;
  return service.custody_total_amount || service.custodyTotalAmount || 0;
};

/**
 * Calculates the complete service value (base + custody when both exist)
 */
export const getCompleteServiceValue = (service: any): number => {
  if (!service) return 0;
  const baseValue = getBaseServiceValue(service);
  const custodyValue = getCustodyTotalAmount(service);
  
  if (baseValue > 0 && custodyValue > 0) {
    return baseValue + custodyValue;
  }
  return baseValue || custodyValue;
};

/**
 * Calculates the value for closure calculations.
 * PRIORITY: client_covered_amount for excess services, otherwise complete value
 */
export const getServiceValueForClosure = (service: any): number => {
  if (!service) return 0;
  
  const clientCovered = service.clientCoveredAmount ?? service.client_covered_amount;
  
  if (service.hasExcess && clientCovered != null && clientCovered > 0) {
    return clientCovered;
  }
  
  return getCompleteServiceValue(service);
};

/**
 * Checks if a service is a custody service
 */
export const isCustodyService = (service: any): boolean => {
  const custodyMode = service.custody_mode || service.custodyMode;
  return custodyMode && custodyMode !== 'none';
};

/**
 * Calculates the display value for modals and reports
 */
export const getDisplayServiceValue = (service: any): number => {
  return getCompleteServiceValue(service);
};

/**
 * Gets a breakdown of service values for display purposes
 */
export const getServiceValueBreakdown = (service: any) => {
  if (!service) {
    return { baseValue: 0, custodyValue: 0, totalValue: 0, hasBothValues: false };
  }

  const custodyValue = getCustodyTotalAmount(service);
  const totalValue = service.value || 0;
  
  let baseValue = totalValue;
  if (custodyValue > 0) {
    baseValue = totalValue - custodyValue;
  }

  return {
    baseValue,
    custodyValue,
    totalValue,
    hasBothValues: baseValue > 0 && custodyValue > 0
  };
};
```

---

## Sistema de Estados y Badges

```typescript
const STATUS_CONFIG = {
  pending: { label: 'Pendiente', className: 'bg-yellow-500 text-white' },
  in_progress: { label: 'En Progreso', className: 'bg-blue-500 text-white' },
  inspection_completed: { label: 'Inspección Completada', className: 'bg-orange-500 text-white' },
  completed: { label: 'Completado', className: 'bg-green-500 text-white' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' },
  invoiced: { label: 'Facturado', className: 'bg-purple-500 text-white' },
  quoted: { label: 'Cotizado', className: 'bg-cyan-500 text-white' },
  purchase_order_pending: { label: 'Esperando O.C.', className: 'bg-amber-500 text-white' }
};

export const getServiceStatusBadge = (status: ServiceStatus) => {
  const config = STATUS_CONFIG[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };
  return <Badge className={config.className}>{config.label}</Badge>;
};
```

---

## Generación de PDF

```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ServiceDetailsPDFData {
  service: any;
  totalCosts: number;
  totalCommissions: number;
  netProfit: number;
}

const TMS_GREEN = [0, 150, 136] as [number, number, number];
const LIGHT_GRAY = [245, 245, 245] as [number, number, number];

export const generateServiceDetailsPDF = async (data: ServiceDetailsPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const { service } = data;
  
  let yPosition = 20;
  
  // Secciones del PDF:
  // 1. Header corporativo con logo
  // 2. Título del documento
  // 3. Sección Cliente
  // 4. Sección Vehículo (si aplica)
  // 5. Información del Servicio
  // 6. Custodia/Arriendo (si aplica)
  // 7. Recursos Asignados
  // 8. Finanzas (con ganancia neta destacada en verde)
  // 9. Observaciones (si existen)
  // 10. Footer con timestamps y número de página
  
  return doc.output('blob');
};
```

---

## Esquema de Base de Datos

```sql
-- Tabla de servicios (campos relevantes para el modal)
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  request_date DATE NOT NULL,
  service_date TIMESTAMPTZ NOT NULL,
  start_time TIME,
  end_time TIME,
  crane_mileage INTEGER,
  client_id UUID REFERENCES clients(id),
  purchase_order TEXT,
  purchase_order_number TEXT,
  quote_number TEXT,
  vehicle_brand TEXT,
  vehicle_model TEXT,
  license_plate TEXT,
  origin TEXT,
  destination TEXT,
  service_type_id UUID REFERENCES service_types(id) NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  operator_commission NUMERIC DEFAULT 0,
  status service_status NOT NULL DEFAULT 'pending',
  observations TEXT,
  -- Excedentes
  has_excess BOOLEAN DEFAULT FALSE,
  client_covered_amount NUMERIC,
  excess_amount NUMERIC,
  -- Facturación
  invoice_folio TEXT,
  invoice_numero_fiscal TEXT,
  -- Custodia
  custody_mode TEXT,
  custody_days INTEGER,
  custody_daily_rate NUMERIC,
  custody_rate_type TEXT,
  custody_start_date DATE,
  custody_end_date DATE,
  custody_vehicle_type TEXT,
  custody_discount_percentage NUMERIC,
  custody_total_amount NUMERIC,
  custody_notes TEXT,
  -- Asegurado
  insured_name TEXT,
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de costos asociados
CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id),
  category_id UUID REFERENCES cost_categories(id) NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE,
  notes TEXT,
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  service_folio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_services_license_plate ON services(license_plate);
CREATE INDEX idx_services_client_id ON services(client_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_costs_service_id ON costs(service_id);
CREATE INDEX idx_costs_category_id ON costs(category_id);
```

---

## Dependencias

```json
{
  "@tanstack/react-query": "^5.56.2",
  "@supabase/supabase-js": "^2.50.0",
  "@radix-ui/react-dialog": "^1.1.2",
  "@radix-ui/react-tabs": "^1.1.0",
  "@radix-ui/react-scroll-area": "^1.1.0",
  "jspdf": "^3.0.1",
  "jspdf-autotable": "^5.0.2",
  "date-fns": "^4.1.0",
  "lucide-react": "^0.462.0",
  "sonner": "^1.5.0"
}
```

---

## Estructura de Archivos Recomendada

```
src/
├── components/
│   └── services/
│       ├── ServiceDetailsModal.tsx
│       ├── ServiceCostsSection.tsx
│       └── VehicleHistory.tsx
├── hooks/
│   ├── useServiceDetailsGlobal.ts
│   ├── useEnhancedServiceDetails.ts
│   ├── useServiceDetails.ts
│   ├── useServiceDetailsPDF.ts
│   ├── useServiceCosts.ts
│   ├── useVehicleHistory.ts
│   └── useClientHistory.ts
├── utils/
│   ├── serviceValueCalculations.ts
│   ├── statusHelpers.ts
│   ├── timezoneUtils.ts
│   ├── currencyUtils.ts
│   └── pdf/
│       └── serviceDetailsPdfGenerator.ts
├── types/
│   ├── index.ts
│   └── serviceDetails.ts
└── pages/
    └── Services.tsx
```

---

## Notas de Implementación

1. **Datos Enriquecidos**: Siempre usar `useEnhancedServiceDetails` para el modal de visualización para obtener operadores múltiples, costos completos y comisiones calculadas.

2. **Preservación del Creador**: Combinar datos de enhanced y básicos para preservar siempre `creatorName`, ya que puede venir de diferentes fuentes.

3. **Invalidación de Cache**: Al abrir el modal, invalidar queries de costos, detalles del servicio y comisiones.

4. **Historial Dinámico**: Detectar automáticamente si usar historial por patente (cuando existe) o por cliente (cuando no hay patente).

5. **Sincronización de Comisiones**: Al abrir el modal, verificar silenciosamente si las comisiones están sincronizadas y corregir si es necesario.

6. **Formato Moneda Chileno**: `new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount)`

7. **Timezone**: Usar utilidades `formatForDisplay` y `formatForDisplayWithTime` para manejar correctamente las fechas en zona horaria de Chile.

---

## Ejemplo de Uso

```tsx
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';

const [selectedService, setSelectedService] = useState<Service | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);

const handleViewDetails = (service: Service) => {
  setSelectedService(service);
  setIsModalOpen(true);
};

const handleDuplicateService = (service: Service) => {
  // Lógica para duplicar servicio
  console.log('Duplicando servicio:', service.folio);
};

return (
  <>
    {/* Tabla o lista de servicios */}
    <Button onClick={() => handleViewDetails(service)}>Ver Detalles</Button>

    {/* Modal de detalles */}
    {selectedService && (
      <ServiceDetailsModal
        service={selectedService}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDuplicate={handleDuplicateService}
      />
    )}
  </>
);
```

---

## Versión

**v1.0** - Enero 2026

---

*Este prompt está diseñado para replicar completamente el modal de detalles del servicio en un proyecto React + Supabase + shadcn/ui.*
