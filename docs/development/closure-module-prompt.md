# Prompt: Módulo de Cierre de Servicios (Service Closures)

## Descripción General

El **Módulo de Cierre de Servicios** permite agrupar servicios completados en un período de tiempo para su posterior facturación. Es el paso intermedio entre la finalización de servicios y la generación de facturas.

### Características Principales:

1. **Modal de 2 columnas** con panel de navegación/resumen lateral
2. **Formulario de 3 pasos**: Período → Cliente y Servicios → Detalles
3. **Búsqueda global** de servicios (últimos 90 días por defecto)
4. **Trazabilidad de servicios procesados**: Muestra si un servicio ya fue incluido en otro cierre/factura
5. **Auto-detección**: Cliente único, órdenes de compra y rango de fechas
6. **Completado de servicios pendientes** desde el modal
7. **Paleta violeta** consistente con el sistema de diseño

---

## Estructura del Formulario (3 Pasos)

### Paso 1 - Período
- **DateRangePicker** con calendarios para "Fecha Desde" y "Fecha Hasta"
- **Alert informativo** explicando que solo se incluyen servicios completados
- **Navegación libre** entre pasos (sin validación bloqueante)

### Paso 2 - Cliente y Servicios
- **ClientSelector** con opción "Todos los clientes"
  - Muestra departamento bajo el nombre del cliente (si existe y no es "General")
- **EnhancedServicesSelector** con:
  - Barra de búsqueda multi-campo (cotización, OC, patente, folio, cliente)
  - Sección de servicios pendientes (checkbox maestro + completado masivo)
  - Sección de servicios disponibles (checkbox maestro)
  - Panel de servicios ya procesados (cuando no hay resultados locales)
  - Botón "Auto-rellenar fechas" desde servicios seleccionados

### Paso 3 - Detalles
- **Campo Orden de Compra** (auto-detectada de servicios seleccionados)
- **Campo Total** (solo lectura, calculado automáticamente)
- **Select de Estado**: open, closed, invoiced, quoted, purchase_order_pending

---

## Interfaces TypeScript

```typescript
// types/index.ts

export type ClosureStatus = 'open' | 'closed' | 'invoiced' | 'quoted' | 'purchase_order_pending';

export interface ServiceClosure {
  id: string;
  folio: string;                    // Formato: CIE-001, CIE-002, etc.
  serviceIds: string[];             // IDs de servicios incluidos
  dateRange: {
    from: string;                   // YYYY-MM-DD
    to: string;                     // YYYY-MM-DD
  };
  clientId?: string;                // Opcional - puede agrupar múltiples clientes
  total: number;                    // Suma de valores de servicios
  status: ClosureStatus;
  purchaseOrder?: string;           // Orden(es) de compra concatenadas
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
}

// Interface para el formulario interno
interface FormData {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientId: string;
  serviceIds: string[];
  total: number;
  status: ClosureStatus;
  purchaseOrder: string;
}

// Interface para navegación de pasos
export interface ClosureFormStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  hasError: boolean;
}

// Interface para servicios ya procesados (trazabilidad)
export interface ProcessedServiceInfo {
  serviceId: string;
  serviceFolio: string;
  purchaseOrder: string | null;
  purchaseOrderNumber: string | null;
  clientName: string;
  closureId: string;
  closureFolio: string;
  invoiceId: string | null;
  invoiceFolio: string | null;
  invoiceNumeroFiscal: string | null;
  invoiceStatus: string | null;
}
```

---

## Componentes Principales

### 1. ClosureForm.tsx (Componente Principal)

```typescript
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServicesForClosures } from '@/hooks/useServicesForClosures';
import { ServiceClosure, ClosureStatus } from '@/types';
import DateRangePicker from './DateRangePicker';
import ClientSelector from './ClientSelector';
import EnhancedServicesSelector from './EnhancedServicesSelector';
import { ClosureFormStepNavigation, getClosureFormSteps, ClosureFormStep } from './ClosureFormStepNavigation';
import { ClosureSummaryPanel } from './ClosureSummaryPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';
import { detectPurchaseOrders, getPurchaseOrderSummary } from '@/utils/closureUtils';
import { useClients } from '@/hooks/useClients';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';

interface ClosureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (closure: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

interface FormData {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientId: string;
  serviceIds: string[];
  total: number;
  status: ClosureStatus;
  purchaseOrder: string;
}

const ClosureForm = ({ open, onOpenChange, onSubmit }: ClosureFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    dateFrom: undefined,
    dateTo: undefined,
    clientId: '',
    serviceIds: [],
    total: 0,
    status: 'open',
    purchaseOrder: ''
  });

  const { clients = [] } = useClients();
  const selectedClient = clients.find(c => c.id === formData.clientId);

  const {
    services,
    pendingServices,
    usedServiceIds,
    totalCompleted,
    loading: servicesLoading,
    completeService,
    completeMultipleServices,
    refetch,
    isGlobalSearch,
    processedServices,
    searchingProcessed,
    searchProcessedServices,
    clearProcessedServices
  } = useServicesForClosures({
    dateFrom: formData.dateFrom,
    dateTo: formData.dateTo
  });
  
  const [loading, setLoading] = useState(false);

  // Calcular completitud de pasos
  const steps = useMemo((): ClosureFormStep[] => {
    const baseSteps = getClosureFormSteps();
    
    const step1Complete = !!formData.dateFrom && !!formData.dateTo;
    const step2Complete = formData.serviceIds.length > 0;
    const step3Complete = true; // Detalles son opcionales

    const completionStatus = [step1Complete, step2Complete, step3Complete];
    
    return baseSteps.map((step, index) => ({
      ...step,
      isCompleted: completionStatus[index],
      hasError: false,
    }));
  }, [formData]);

  const handleSubmit = async () => {
    if (!formData.dateFrom || !formData.dateTo) return;
    if (formData.serviceIds.length === 0) return;

    setLoading(true);
    try {
      await onSubmit({
        dateRange: {
          from: formData.dateFrom.toISOString().split('T')[0],
          to: formData.dateTo.toISOString().split('T')[0]
        },
        clientId: formData.clientId || undefined,
        serviceIds: formData.serviceIds,
        total: formData.total,
        status: formData.status,
        purchaseOrder: formData.purchaseOrder || undefined
      });

      // Reset form
      setFormData({
        dateFrom: undefined,
        dateTo: undefined,
        clientId: '',
        serviceIds: [],
        total: 0,
        status: 'open',
        purchaseOrder: ''
      });
      setCurrentStep(1);
      refetch();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating closure:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    setFormData(prev => {
      const newServiceIds = checked 
        ? [...prev.serviceIds, serviceId] 
        : prev.serviceIds.filter(id => id !== serviceId);

      const selectedServices = services.filter(s => newServiceIds.includes(s.id));
      const total = calculateClosureTotal(selectedServices);
      const detectedPO = detectPurchaseOrders(selectedServices);
      
      // Auto-detectar cliente único
      let detectedClientId = prev.clientId;
      if (selectedServices.length > 0) {
        const clientIds = [...new Set(selectedServices.map(s => s.client?.id).filter(Boolean))];
        if (clientIds.length === 1 && clientIds[0]) {
          detectedClientId = clientIds[0];
        }
      } else {
        detectedClientId = '';
      }
      
      return {
        ...prev,
        serviceIds: newServiceIds,
        total,
        purchaseOrder: detectedPO,
        clientId: detectedClientId
      };
    });
  };

  const handleAutoFillDates = (dateFrom: Date, dateTo: Date) => {
    setFormData(prev => ({ ...prev, dateFrom, dateTo }));
    setCurrentStep(1);
  };

  const isFormValid = formData.dateFrom && formData.dateTo && formData.serviceIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header con gradiente violeta */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
            <DialogTitle className="text-2xl font-bold text-foreground">
              Nuevo Cierre de Servicios
            </DialogTitle>
            <p className="text-muted-foreground">
              Agrupa servicios completados para facturación
            </p>
          </DialogHeader>

          {/* Layout de 2 columnas */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
              {/* Sidebar Izquierdo */}
              <div className="lg:col-span-1 border-r bg-muted/30 p-4 overflow-y-auto space-y-4">
                <ClosureFormStepNavigation
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={setCurrentStep}
                />
                
                <div className="hidden lg:block">
                  <ClosureSummaryPanel
                    dateFrom={formData.dateFrom}
                    dateTo={formData.dateTo}
                    clientName={selectedClient?.name || ''}
                    selectedCount={formData.serviceIds.length}
                    total={formData.total}
                    purchaseOrder={formData.purchaseOrder}
                    status={formData.status}
                  />
                </div>
              </div>

              {/* Contenido Principal */}
              <div className="lg:col-span-3 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Renderizar paso actual */}
                  {currentStep === 1 && (
                    <ColoredSectionCard title="Período del Cierre" icon={<AlertCircle className="h-4 w-4" />} color="purple" required>
                      <DateRangePicker 
                        dateFrom={formData.dateFrom} 
                        dateTo={formData.dateTo} 
                        onDateFromChange={(date) => setFormData(prev => ({ ...prev, dateFrom: date, serviceIds: [], total: 0 }))} 
                        onDateToChange={(date) => setFormData(prev => ({ ...prev, dateTo: date, serviceIds: [], total: 0 }))} 
                      />
                    </ColoredSectionCard>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <ColoredSectionCard title="Cliente (Opcional)" icon={<AlertCircle className="h-4 w-4" />} color="blue">
                        <ClientSelector 
                          clientId={formData.clientId} 
                          onClientChange={(clientId) => setFormData(prev => ({ ...prev, clientId, serviceIds: [], total: 0 }))} 
                        />
                      </ColoredSectionCard>

                      <ColoredSectionCard title="Servicios Disponibles" icon={<AlertCircle className="h-4 w-4" />} color="green" required>
                        <EnhancedServicesSelector 
                          services={services} 
                          pendingServices={pendingServices}
                          loading={servicesLoading} 
                          clientId={formData.clientId} 
                          selectedServiceIds={formData.serviceIds} 
                          onServiceToggle={handleServiceSelection}
                          onCompleteService={completeService}
                          onCompleteMultipleServices={completeMultipleServices}
                          totalCompleted={totalCompleted}
                          usedServiceIds={usedServiceIds}
                          isGlobalSearch={isGlobalSearch}
                          onAutoFillDates={handleAutoFillDates}
                          processedServices={processedServices}
                          searchingProcessed={searchingProcessed}
                          onSearchProcessed={searchProcessedServices}
                          onClearProcessed={clearProcessedServices}
                        />
                      </ColoredSectionCard>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <ColoredSectionCard title="Orden de Compra" icon={<AlertCircle className="h-4 w-4" />} color="orange">
                        <div className="space-y-2">
                          <Label className="text-foreground">
                            Orden de Compra 
                            {formData.serviceIds.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-2">(Auto-detectada)</span>
                            )}
                          </Label>
                          <Input 
                            type="text" 
                            placeholder="Ej: OC-2024-001"
                            value={formData.purchaseOrder} 
                            onChange={e => setFormData(prev => ({ ...prev, purchaseOrder: e.target.value }))} 
                          />
                          {formData.serviceIds.length > 0 && formData.purchaseOrder && (
                            <div className="text-xs text-muted-foreground">
                              {getPurchaseOrderSummary(services.filter(s => formData.serviceIds.includes(s.id)))}
                            </div>
                          )}
                        </div>
                      </ColoredSectionCard>

                      <ColoredSectionCard title="Total y Estado" icon={<AlertCircle className="h-4 w-4" />} color="cyan">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-foreground">Total</Label>
                            <Input type="number" value={formData.total} readOnly className="font-mono text-lg" />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground">Estado</Label>
                            <Select 
                              value={formData.status} 
                              onValueChange={(value: ClosureStatus) => setFormData(prev => ({ ...prev, status: value }))}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Abierto</SelectItem>
                                <SelectItem value="closed">Cerrado</SelectItem>
                                <SelectItem value="invoiced">Facturado</SelectItem>
                                <SelectItem value="quoted">Cotizado</SelectItem>
                                <SelectItem value="purchase_order_pending">Esperando OC</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </ColoredSectionCard>
                    </div>
                  )}
                </div>

                {/* Footer con navegación */}
                <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                    disabled={currentStep === 1}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    Paso {currentStep} de 3
                  </span>

                  <div className="flex gap-2">
                    {currentStep < 3 ? (
                      <Button
                        type="button"
                        onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
                        className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !isFormValid}
                        className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Crear Cierre
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureForm;
```

---

### 2. ClosureFormStepNavigation.tsx

```typescript
import React from 'react';
import { Check, Calendar, ListChecks, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ClosureFormStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  hasError: boolean;
}

interface ClosureFormStepNavigationProps {
  steps: ClosureFormStep[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
}

export const ClosureFormStepNavigation = ({
  steps,
  currentStep,
  onStepClick,
}: ClosureFormStepNavigationProps) => {
  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isPast = step.id < currentStep;
        const isClickable = true; // Navegación libre entre todos los pasos

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
              isActive && "bg-violet-500/10 border border-violet-500/30",
              isPast && !isActive && "bg-muted/50",
              !isActive && !isPast && "hover:bg-muted/30",
              step.hasError && "border-destructive/50 bg-destructive/5"
            )}
          >
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                isActive && "bg-violet-600 text-white",
                step.isCompleted && !isActive && "bg-violet-500 text-white",
                step.hasError && "bg-destructive text-destructive-foreground",
                !isActive && !step.isCompleted && !step.hasError && "bg-muted text-muted-foreground"
              )}
            >
              {step.isCompleted && !step.hasError ? (
                <Check className="h-4 w-4" />
              ) : (
                step.id
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                isActive && "text-violet-700 dark:text-violet-300",
                step.hasError && "text-destructive"
              )}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {step.description}
              </p>
            </div>

            <div className={cn(
              "flex-shrink-0 text-muted-foreground",
              isActive && "text-violet-600 dark:text-violet-400"
            )}>
              {step.icon}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const getClosureFormSteps = (): Omit<ClosureFormStep, 'isCompleted' | 'hasError'>[] => [
  {
    id: 1,
    title: 'Período',
    description: 'Rango de fechas',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: 2,
    title: 'Cliente y Servicios',
    description: 'Seleccionar servicios',
    icon: <ListChecks className="h-4 w-4" />,
  },
  {
    id: 3,
    title: 'Detalles',
    description: 'OC y estado',
    icon: <FileText className="h-4 w-4" />,
  },
];
```

---

### 3. ClosureSummaryPanel.tsx

```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, User, ListChecks, DollarSign, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClosureStatus } from '@/types';

interface ClosureSummaryPanelProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientName: string;
  selectedCount: number;
  total: number;
  purchaseOrder: string;
  status: ClosureStatus;
}

const STATUS_LABELS: Record<ClosureStatus, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' },
  closed: { label: 'Cerrado', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  invoiced: { label: 'Facturado', className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' },
  quoted: { label: 'Cotizado', className: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  purchase_order_pending: { label: 'Esperando OC', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30' },
};

export const ClosureSummaryPanel = ({
  dateFrom,
  dateTo,
  clientName,
  selectedCount,
  total,
  purchaseOrder,
  status,
}: ClosureSummaryPanelProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const statusConfig = STATUS_LABELS[status];

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-500" />
            Resumen del Cierre
          </span>
          <Badge className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Período */}
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <span className="text-xs text-muted-foreground block">Período:</span>
            <span className="text-sm font-medium">
              {formatDate(dateFrom)} - {formatDate(dateTo)}
            </span>
          </div>
        </div>

        {/* Cliente */}
        {clientName && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cliente:</span>
            <span className="text-sm font-medium truncate">{clientName}</span>
          </div>
        )}

        {/* Servicios */}
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Servicios:</span>
          <Badge variant={selectedCount > 0 ? "default" : "secondary"} className={cn(
            selectedCount > 0 && "bg-violet-600 text-white"
          )}>
            {selectedCount} seleccionados
          </Badge>
        </div>

        {/* Orden de Compra */}
        {purchaseOrder && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">OC:</span>
            <span className="text-sm font-mono">{purchaseOrder}</span>
          </div>
        )}

        <Separator className="my-3" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total:</span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            total > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          )}>
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

### 4. DateRangePicker.tsx

```typescript
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
}

const DateRangePicker = ({ dateFrom, dateTo, onDateFromChange, onDateToChange }: DateRangePickerProps) => {
  const handleDateFromSelect = (date: Date | undefined) => {
    if (date) {
      // Crear fecha local normalizando a mediodía para evitar problemas de timezone
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      onDateFromChange(localDate);
    } else {
      onDateFromChange(undefined);
    }
  };

  const handleDateToSelect = (date: Date | undefined) => {
    if (date) {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      onDateToChange(localDate);
    } else {
      onDateToChange(undefined);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-foreground">Fecha Desde</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Seleccionar fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={handleDateFromSelect}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">Fecha Hasta</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Seleccionar fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={handleDateToSelect}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default DateRangePicker;
```

---

### 5. ClientSelector.tsx

```typescript
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';

interface ClientSelectorProps {
  clientId: string;
  onClientChange: (clientId: string) => void;
}

const ClientSelector = ({ clientId, onClientChange }: ClientSelectorProps) => {
  const { clients } = useClients();

  const handleValueChange = (value: string) => {
    // Convertir "all" de vuelta a string vacío
    onClientChange(value === "all" ? "" : value);
  };

  return (
    <div className="space-y-2">
      <Label className="text-foreground">Cliente (Opcional)</Label>
      <Select value={clientId || "all"} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Todos los clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            Todos los clientes
          </SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              <div className="flex flex-col py-0.5">
                <span className="font-medium">{client.name}</span>
                {/* Mostrar departamento si existe y no es "General" */}
                {client.department && client.department !== 'General' && (
                  <span className="text-xs text-violet-600 dark:text-violet-400">
                    {client.department}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClientSelector;
```

---

## Hooks Principales

### useServicesForClosures.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useServiceTransformer } from './services/useServiceTransformer';

interface UseServicesForClosuresOptions {
  dateFrom?: Date;
  dateTo?: Date;
}

interface ServicesForClosuresData {
  availableServices: Service[];
  pendingServices: Service[];
  usedServiceIds: Set<string>;
  totalCompleted: number;
}

export interface ProcessedServiceInfo {
  serviceId: string;
  serviceFolio: string;
  purchaseOrder: string | null;
  purchaseOrderNumber: string | null;
  clientName: string;
  closureId: string;
  closureFolio: string;
  invoiceId: string | null;
  invoiceFolio: string | null;
  invoiceNumeroFiscal: string | null;
  invoiceStatus: string | null;
}

export const useServicesForClosures = (options: UseServicesForClosuresOptions = {}) => {
  const [data, setData] = useState<ServicesForClosuresData>({
    availableServices: [],
    pendingServices: [],
    usedServiceIds: new Set(),
    totalCompleted: 0
  });
  const [loading, setLoading] = useState(false);
  const [processedServices, setProcessedServices] = useState<ProcessedServiceInfo[]>([]);
  const [searchingProcessed, setSearchingProcessed] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();
  const { dateFrom, dateTo } = options;
  
  // Flag para búsqueda global (sin filtro de fechas)
  const isGlobalSearch = !dateFrom && !dateTo;

  const fetchServicesData = async () => {
    try {
      setLoading(true);
      
      // Si no hay fechas, usar últimos 90 días por defecto
      let effectiveDateFrom = dateFrom;
      if (isGlobalSearch) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        effectiveDateFrom = ninetyDaysAgo;
      }
      
      // Query para servicios facturables (completados, con OC, fallidos)
      let billableQuery = supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!left(id, name, description, is_active)
        `)
        .in('status', ['completed', 'with_purchase_order', 'failed'])
        .order('folio', { ascending: true });

      // Query para servicios pendientes
      let pendingQuery = supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!left(id, name, description, is_active)
        `)
        .eq('status', 'pending')
        .order('folio', { ascending: true });

      // Agregar filtro de fechas
      if (effectiveDateFrom) {
        billableQuery = billableQuery.gte('service_date', effectiveDateFrom.toISOString().split('T')[0]);
        pendingQuery = pendingQuery.gte('service_date', effectiveDateFrom.toISOString().split('T')[0]);
      }
      if (dateTo) {
        billableQuery = billableQuery.lte('service_date', dateTo.toISOString().split('T')[0]);
        pendingQuery = pendingQuery.lte('service_date', dateTo.toISOString().split('T')[0]);
      }

      const [billableResult, pendingResult] = await Promise.all([
        billableQuery,
        pendingQuery
      ]);

      if (billableResult.error) throw billableResult.error;
      if (pendingResult.error) throw pendingResult.error;

      const billableServices = billableResult.data || [];
      const pendingServices = pendingResult.data || [];

      // Obtener IDs de servicios ya incluidos en cierres
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select('service_id');

      const usedServiceIds = new Set(closureServices?.map(cs => cs.service_id) || []);

      // Filtrar servicios ya en cierres
      const availableBillableServices = billableServices.filter(
        service => !usedServiceIds.has(service.id)
      );

      // Transformar datos
      const transformedBillable = transformRawServiceData(availableBillableServices);
      const transformedPending = transformRawServiceData(pendingServices);

      setData({
        availableServices: transformedBillable,
        pendingServices: transformedPending,
        usedServiceIds,
        totalCompleted: billableServices.length
      });
    } catch (error: any) {
      console.error('Error fetching services data:', error);
      toast.error("Error", { description: "No se pudieron cargar los servicios." });
      setData({
        availableServices: [],
        pendingServices: [],
        usedServiceIds: new Set(),
        totalCompleted: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const completeService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .eq('id', serviceId);

      if (error) throw error;

      await fetchServicesData();
      toast.success("Servicio completado");
    } catch (error: any) {
      console.error('Error completing service:', error);
      toast.error("Error", { description: "No se pudo completar el servicio." });
    }
  };

  const completeMultipleServices = async (serviceIds: string[]) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .in('id', serviceIds);

      if (error) throw error;

      await fetchServicesData();
      toast.success(`${serviceIds.length} servicio(s) completados`);
    } catch (error: any) {
      console.error('Error completing services:', error);
      toast.error("Error", { description: "No se pudieron completar los servicios." });
    }
  };

  useEffect(() => {
    fetchServicesData();
  }, [dateFrom, dateTo]);

  // Búsqueda de servicios ya procesados (en cierres/facturas)
  const searchProcessedServices = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setProcessedServices([]);
      return;
    }

    try {
      setSearchingProcessed(true);
      const searchPattern = `%${searchTerm.trim()}%`;

      // Query con relaciones FK explícitas para evitar errores PGRST201
      const { data: processedData, error } = await supabase
        .from('services')
        .select(`
          id,
          folio,
          purchase_order,
          purchase_order_number,
          license_plate,
          client:clients!services_client_id_fkey(id, name),
          closure_services!inner(
            closure:service_closures!inner(
              id,
              folio,
              invoice_closures!fk_invoice_closures_closure_id(
                invoice:invoices!fk_invoice_closures_invoice_id(
                  id,
                  folio,
                  numero_fiscal,
                  status
                )
              )
            )
          )
        `)
        .or(`purchase_order.ilike.${searchPattern},purchase_order_number.ilike.${searchPattern},folio.ilike.${searchPattern},license_plate.ilike.${searchPattern}`)
        .limit(10);

      if (error) {
        console.error('Error searching processed services:', error);
        setProcessedServices([]);
        return;
      }

      // Transformar a ProcessedServiceInfo
      const transformed: ProcessedServiceInfo[] = (processedData || []).map((service: any) => {
        const closureService = service.closure_services?.[0];
        const closure = closureService?.closure;
        const invoiceClosure = closure?.invoice_closures?.[0];
        const invoice = invoiceClosure?.invoice;

        return {
          serviceId: service.id,
          serviceFolio: service.folio,
          purchaseOrder: service.purchase_order,
          purchaseOrderNumber: service.purchase_order_number,
          clientName: service.client?.name || 'Cliente desconocido',
          closureId: closure?.id || '',
          closureFolio: closure?.folio || '',
          invoiceId: invoice?.id || null,
          invoiceFolio: invoice?.folio || null,
          invoiceNumeroFiscal: invoice?.numero_fiscal || null,
          invoiceStatus: invoice?.status || null
        };
      });

      setProcessedServices(transformed);
    } catch (error) {
      console.error('Error in searchProcessedServices:', error);
      setProcessedServices([]);
    } finally {
      setSearchingProcessed(false);
    }
  }, []);

  const clearProcessedServices = useCallback(() => {
    setProcessedServices([]);
  }, []);

  return {
    services: data.availableServices,
    pendingServices: data.pendingServices,
    usedServiceIds: data.usedServiceIds,
    totalCompleted: data.totalCompleted,
    loading,
    completeService,
    completeMultipleServices,
    refetch: fetchServicesData,
    isGlobalSearch,
    processedServices,
    searchingProcessed,
    searchProcessedServices,
    clearProcessedServices
  };
};
```

---

### useClosureOperations.ts

```typescript
import { supabase } from '@/integrations/supabase/client';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

export const useClosureOperations = () => {

  const createClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Obtener usuario actual para created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generar folio secuencial (CIE-001, CIE-002, etc.)
      const { data: lastClosure } = await supabase
        .from('service_closures')
        .select('folio')
        .like('folio', 'CIE-%')
        .order('folio', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let nextNumber = 1;
      if (lastClosure?.folio) {
        const match = lastClosure.folio.match(/CIE-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const folio = `CIE-${String(nextNumber).padStart(3, '0')}`;

      // Insertar cierre
      const { data, error } = await supabase
        .from('service_closures')
        .insert({
          folio,
          date_from: closureData.dateRange.from,
          date_to: closureData.dateRange.to,
          client_id: closureData.clientId || null,
          total: closureData.total,
          status: closureData.status,
          purchase_order: closureData.purchaseOrder || null,
          created_by: user?.id || null
        })
        .select()
        .single();

      if (error) throw error;

      // Crear relaciones cierre-servicio
      if (closureData.serviceIds.length > 0) {
        const closureServices = closureData.serviceIds.map(serviceId => ({
          closure_id: data.id,
          service_id: serviceId
        }));

        const { error: relationError } = await supabase
          .from('closure_services')
          .insert(closureServices);

        if (relationError) throw relationError;
      }

      const newClosure: ServiceClosure = formatClosureData(data);
      newClosure.serviceIds = closureData.serviceIds;
      
      toast.success("Cierre creado", {
        description: `Cierre ${folio} creado exitosamente.`,
      });

      return newClosure;
    } catch (error: any) {
      console.error('Error creating closure:', error);
      toast.error("Error", { description: "No se pudo crear el cierre." });
      throw error;
    }
  };

  const updateClosure = async (id: string, closureData: Partial<ServiceClosure>) => {
    try {
      const updateData: any = {};
      
      if (closureData.dateRange) {
        updateData.date_from = closureData.dateRange.from;
        updateData.date_to = closureData.dateRange.to;
      }
      if (closureData.clientId !== undefined) {
        updateData.client_id = closureData.clientId;
      }
      if (closureData.total !== undefined) {
        updateData.total = closureData.total;
      }
      if (closureData.status !== undefined) {
        updateData.status = closureData.status;
      }
      if (closureData.purchaseOrder !== undefined) {
        updateData.purchase_order = closureData.purchaseOrder;
      }

      const { error } = await supabase
        .from('service_closures')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success("Cierre actualizado");
      return { ...closureData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error updating closure:', error);
      toast.error("Error", { description: "No se pudo actualizar el cierre." });
      throw error;
    }
  };

  const deleteClosure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_closures')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Cierre eliminado");
    } catch (error: any) {
      console.error('Error deleting closure:', error);
      toast.error("Error", { description: "No se pudo eliminar el cierre." });
      throw error;
    }
  };

  const closeClosure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_closures')
        .update({ status: 'closed' })
        .eq('id', id);

      if (error) throw error;

      toast.success("Cierre procesado");
      return { status: 'closed' as const, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error closing closure:', error);
      toast.error("Error", { description: "No se pudo procesar el cierre." });
      throw error;
    }
  };

  return {
    createClosure,
    updateClosure,
    deleteClosure,
    closeClosure
  };
};
```

---

## Utilidades

### closureUtils.ts

```typescript
import { ServiceClosure } from '@/types';

export const formatClosureData = (data: any): ServiceClosure => {
  return {
    id: data.id,
    folio: data.folio || 'N/A',
    serviceIds: data.closure_services?.map((cs: any) => cs.service_id) || [],
    dateRange: {
      from: data.date_from,
      to: data.date_to
    },
    clientId: data.client_id || undefined,
    total: Number(data.total) || 0,
    status: data.status as ServiceClosure['status'] || 'open',
    purchaseOrder: data.purchase_order || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by || undefined,
    creatorName: data.creator?.full_name || data.creator?.email || undefined
  };
};

export const generateClosureFolio = (count: number): string => {
  return `CIE-${String(count + 1).padStart(3, '0')}`;
};

export const detectPurchaseOrders = (services: any[]): string => {
  if (!services || services.length === 0) return '';
  
  // Extraer todas las órdenes de compra únicas
  const purchaseOrders = services
    .map(service => service.purchaseOrder || service.purchaseOrderNumber)
    .filter(Boolean)
    .filter((po, index, arr) => arr.indexOf(po) === index);
  
  if (purchaseOrders.length === 0) return '';
  if (purchaseOrders.length === 1) return purchaseOrders[0];
  
  // Múltiples OC - concatenar
  return purchaseOrders.join(', ');
};

export const getPurchaseOrderSummary = (services: any[]): string => {
  if (!services || services.length === 0) return '';
  
  const withPO = services.filter(s => s.purchaseOrder || s.purchaseOrderNumber);
  const withoutPO = services.filter(s => !s.purchaseOrder && !s.purchaseOrderNumber);
  
  const parts = [];
  if (withPO.length > 0) {
    parts.push(`${withPO.length} servicio(s) con OC`);
  }
  if (withoutPO.length > 0) {
    parts.push(`${withoutPO.length} servicio(s) sin OC`);
  }
  
  return parts.join(' • ');
};
```

---

### serviceValueCalculations.ts

```typescript
import { Service } from '@/types';

/**
 * Calcula el valor que se debe usar para cálculos de cierre.
 * 
 * PRIORIDAD DE LÓGICA DE NEGOCIO:
 * 1. client_covered_amount: Para servicios con exceso, usar el monto cubierto por cliente
 * 2. Valor completo del servicio: base + custodia total
 */
export const getServiceValueForClosure = (service: any): number => {
  if (!service) return 0;
  
  // Prioridad 1: Monto cubierto por cliente para servicios con exceso
  const clientCovered = service.clientCoveredAmount !== undefined 
    ? service.clientCoveredAmount 
    : service.client_covered_amount;
    
  if (service.hasExcess && clientCovered != null && clientCovered > 0) {
    return clientCovered;
  }
  
  // Prioridad 2: Valor completo (base + custodia)
  return getCompleteServiceValue(service);
};

/**
 * Calcula el valor completo del servicio (base + custodia)
 */
export const getCompleteServiceValue = (service: any): number => {
  if (!service) return 0;

  const baseValue = service.value || 0;
  const custodyValue = service.custody_total_amount || service.custodyTotalAmount || 0;
  
  if (baseValue > 0 && custodyValue > 0) {
    return baseValue + custodyValue;
  }
  
  return baseValue || custodyValue;
};

/**
 * Calcula el total para un array de servicios (para cierres)
 */
export const calculateClosureTotal = (services: Service[]): number => {
  if (!services || !Array.isArray(services)) return 0;
  
  return services.reduce((sum, service) => {
    if (!service) return sum;
    return sum + getServiceValueForClosure(service);
  }, 0);
};
```

---

## Esquema de Base de Datos

```sql
-- =====================
-- TABLA: service_closures
-- =====================
CREATE TABLE public.service_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  purchase_order TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_service_closures_status ON public.service_closures(status);
CREATE INDEX idx_service_closures_client ON public.service_closures(client_id);
CREATE INDEX idx_service_closures_folio ON public.service_closures(folio);

-- RLS
ALTER TABLE public.service_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view closures"
  ON public.service_closures FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert closures"
  ON public.service_closures FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update closures"
  ON public.service_closures FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete closures"
  ON public.service_closures FOR DELETE
  USING (auth.role() = 'authenticated');


-- =====================
-- TABLA: closure_services (many-to-many)
-- =====================
CREATE TABLE public.closure_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL REFERENCES public.service_closures(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(closure_id, service_id)
);

-- Índices
CREATE INDEX idx_closure_services_closure ON public.closure_services(closure_id);
CREATE INDEX idx_closure_services_service ON public.closure_services(service_id);

-- RLS
ALTER TABLE public.closure_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view closure_services"
  ON public.closure_services FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert closure_services"
  ON public.closure_services FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete closure_services"
  ON public.closure_services FOR DELETE
  USING (auth.role() = 'authenticated');


-- =====================
-- TABLA: invoice_closures (relación factura-cierre)
-- =====================
CREATE TABLE public.invoice_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  closure_id UUID NOT NULL REFERENCES public.service_closures(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, closure_id)
);

-- Crear FK aliases explícitos para queries complejas
ALTER TABLE public.invoice_closures 
  ADD CONSTRAINT fk_invoice_closures_invoice_id 
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE public.invoice_closures 
  ADD CONSTRAINT fk_invoice_closures_closure_id 
  FOREIGN KEY (closure_id) REFERENCES public.service_closures(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX idx_invoice_closures_invoice ON public.invoice_closures(invoice_id);
CREATE INDEX idx_invoice_closures_closure ON public.invoice_closures(closure_id);

-- RLS
ALTER TABLE public.invoice_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice_closures"
  ON public.invoice_closures FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert invoice_closures"
  ON public.invoice_closures FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete invoice_closures"
  ON public.invoice_closures FOR DELETE
  USING (auth.role() = 'authenticated');
```

---

## Dependencias

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "@supabase/supabase-js": "^2.x",
    "date-fns": "^3.x",
    "lucide-react": "^0.x",
    "sonner": "^1.x",
    "react": "^18.x",
    "react-dom": "^18.x"
  }
}
```

---

## Estructura de Archivos Recomendada

```
src/
├── components/
│   └── closures/
│       ├── ClosureForm.tsx
│       ├── ClosureFormStepNavigation.tsx
│       ├── ClosureSummaryPanel.tsx
│       ├── DateRangePicker.tsx
│       ├── ClientSelector.tsx
│       └── EnhancedServicesSelector.tsx
├── hooks/
│   ├── closures/
│   │   ├── useClosureData.ts
│   │   └── useClosureOperations.ts
│   ├── useServicesForClosures.ts
│   └── useClients.ts
├── utils/
│   ├── closureUtils.ts
│   └── serviceValueCalculations.ts
└── types/
    └── index.ts
```

---

## Patrones y Buenas Prácticas

### 1. Patrón Anti-Submit Accidental
```typescript
// Usar <div> wrapper en lugar de <form>
// Botón con type="button" y onClick explícito
<Button type="button" onClick={handleSubmit}>
  Crear Cierre
</Button>
```

### 2. Generación de Folio Secuencial
```typescript
const { data: lastClosure } = await supabase
  .from('service_closures')
  .select('folio')
  .like('folio', 'CIE-%')
  .order('folio', { ascending: false })
  .limit(1)
  .maybeSingle();

let nextNumber = 1;
if (lastClosure?.folio) {
  const match = lastClosure.folio.match(/CIE-(\d+)/);
  if (match) {
    nextNumber = parseInt(match[1]) + 1;
  }
}

const folio = `CIE-${String(nextNumber).padStart(3, '0')}`;
```

### 3. useCallback para Evitar Bucles de Renderizado
```typescript
const searchProcessedServices = useCallback(async (searchTerm) => {
  // lógica de búsqueda
}, []);

const clearProcessedServices = useCallback(() => {
  setProcessedServices([]);
}, []);
```

### 4. Relaciones FK Explícitas en Queries
```typescript
// Usar nombres de FK explícitos para evitar errores PGRST201
.select(`
  closure_services!inner(
    closure:service_closures!inner(
      id,
      folio,
      invoice_closures!fk_invoice_closures_closure_id(
        invoice:invoices!fk_invoice_closures_invoice_id(...)
      )
    )
  )
`)
```

---

## Notas de Implementación

1. **Debounce en búsqueda**: 500ms antes de buscar servicios procesados
2. **Checkbox maestro**: Usar ref con `indeterminate` para estado parcial
3. **Fechas locales**: Normalizar a mediodía (12:00) para evitar problemas de timezone
4. **Formato moneda chileno**: `toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })`
5. **Búsqueda global**: Últimos 90 días por defecto cuando no hay filtro de fechas
6. **Auto-detección**: Cliente único y órdenes de compra se detectan automáticamente

---

## Versión

**v4.0** - Enero 2025

---

*Este prompt está diseñado para ser copy-paste ready en cualquier proyecto React + Supabase + shadcn/ui.*
