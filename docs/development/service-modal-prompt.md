# Prompt: Modal de Nuevo Servicio (EnhancedServiceForm)

## Descripción General

Crear un formulario multi-paso para la gestión de servicios con las siguientes características:

- **Layout**: Dos columnas - navegación/resumen a la izquierda, contenido del formulario a la derecha
- **Header**: Barra superior violeta con título e indicador de progreso
- **Navegación**: 4 pasos clickeables con indicadores visuales de estado
- **Validación**: Dinámica según el tipo de servicio seleccionado
- **Resumen**: Panel lateral con información en tiempo real

---

## Estructura de 4 Pasos

### Paso 1: Información Básica
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Folio | string | Sí | Auto-generado, formato configurable |
| Fecha Solicitud | date | Sí | Fecha de solicitud del servicio |
| Fecha Servicio | date | Sí | Fecha de ejecución |
| Cliente | select | Sí | Selector de clientes registrados |
| Orden de Compra | string | Condicional | Según tipo de servicio |
| Número de Cotización | string | No | Referencia opcional |
| Tipo de Servicio | select | Sí | Define validaciones dinámicas |

### Paso 2: Vehículo y Ubicación
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Marca | string | Condicional | Marca del vehículo |
| Modelo | string | Condicional | Modelo del vehículo |
| Patente | string | Condicional | Placa del vehículo |
| Origen | string | Condicional | Dirección de origen |
| Destino | string | Condicional | Dirección de destino |

### Paso 3: Recursos
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Grúa | select | Condicional | Grúa asignada |
| Operadores | array | Condicional | Lista de operadores con comisiones |
| Costos | array | No | Costos asociados al servicio |

### Paso 4: Financiero
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Valor del Servicio | number | Sí | Monto total del servicio |
| Tiene Exceso | boolean | No | Indica si hay monto excedente |
| Monto Cubierto | number | Condicional | Si tiene exceso |
| Monto Exceso | number | Condicional | Si tiene exceso |
| Estado | select | Sí | pending, in_progress, completed, cancelled |
| Observaciones | textarea | No | Notas adicionales |

---

## Interfaces TypeScript

### Estado del Formulario

```typescript
interface ServiceFormData {
  // Datos básicos
  folio: string;
  requestDate: string;
  serviceDate: string;
  clientId: string;
  purchaseOrder?: string;
  purchaseOrderNumber?: string;
  quoteNumber?: string;
  serviceTypeId: string;
  
  // Vehículo
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  
  // Ubicación
  origin: string;
  destination: string;
  
  // Recursos
  craneId: string;
  operators: ServiceOperator[];
  
  // Financiero
  value: number;
  costDetails: ServiceCostDetail[];
  hasExcess?: boolean;
  clientCoveredAmount?: number;
  excessAmount?: number;
  
  // Estado
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  observations?: string;
}
```

### Operadores del Servicio

```typescript
interface ServiceOperator {
  id: string;
  operatorId: string;
  operator?: Operator;
  commission: number;
  role?: string; // "Principal", "Auxiliar", "Supervisor"
  hours?: number;
}
```

### Costos del Servicio

```typescript
interface ServiceCostDetail {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
  category_id: string;
  subcategory?: string;
  date?: string;
  isExisting?: boolean;
}
```

### Configuración de Tipo de Servicio

```typescript
interface ServiceTypeConfig {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  isActive: boolean;
  vehicleInfoOptional: boolean;
  
  // Campos requeridos dinámicamente
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
}
```

### Paso de Navegación

```typescript
interface FormStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  isCompleted: boolean;
  hasError: boolean;
}
```

---

## Componentes Principales

### 1. FormStepNavigation

Navegación lateral con pasos clickeables.

```tsx
import { Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  isCompleted: boolean;
  hasError: boolean;
}

interface FormStepNavigationProps {
  steps: FormStep[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
}

export function FormStepNavigation({ steps, currentStep, onStepClick }: FormStepNavigationProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isPast = index < currentIndex;
        const isClickable = isPast || isActive || steps[index - 1]?.isCompleted;

        return (
          <button
            key={step.id}
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all",
              isActive && "bg-violet-100 border-2 border-violet-500",
              isPast && step.isCompleted && "bg-green-50",
              step.hasError && "bg-red-50 border-red-300",
              isClickable && "cursor-pointer hover:bg-muted",
              !isClickable && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Indicador de paso */}
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              isActive && "bg-violet-500 text-white",
              isPast && step.isCompleted && "bg-green-500 text-white",
              step.hasError && "bg-red-500 text-white",
              !isActive && !isPast && !step.hasError && "bg-muted text-muted-foreground"
            )}>
              {step.isCompleted && !step.hasError ? (
                <Check className="w-4 h-4" />
              ) : step.hasError ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <step.icon className="w-4 h-4 text-muted-foreground" />
                <span className={cn(
                  "font-medium text-sm",
                  isActive && "text-violet-700"
                )}>
                  {step.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {step.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

### 2. FormSummaryPanel

Panel de resumen en tiempo real.

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, User, MapPin, Truck, Users, DollarSign, 
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';

interface FormSummaryPanelProps {
  folio: string;
  clientName?: string;
  serviceType?: string;
  value: number;
  totalCommissions: number;
  totalCosts: number;
  operatorCount: number;
  craneName?: string;
  origin?: string;
  destination?: string;
  status: string;
  isEditing?: boolean;
}

export function FormSummaryPanel({
  folio,
  clientName,
  serviceType,
  value,
  totalCommissions,
  totalCosts,
  operatorCount,
  craneName,
  origin,
  destination,
  status,
  isEditing = false
}: FormSummaryPanelProps) {
  const netMargin = value - totalCommissions - totalCosts;
  const marginPercentage = value > 0 ? (netMargin / value) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: string }> = {
      pending: { label: 'Pendiente', variant: 'secondary' },
      in_progress: { label: 'En Progreso', variant: 'default' },
      completed: { label: 'Completado', variant: 'success' },
      cancelled: { label: 'Cancelado', variant: 'destructive' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  return (
    <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-violet-800">
            {isEditing ? 'Editando Servicio' : 'Resumen del Servicio'}
          </CardTitle>
          {getStatusBadge(status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Folio y Cliente */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-600" />
            <div>
              <p className="text-xs text-muted-foreground">Folio</p>
              <p className="font-mono font-medium text-sm">{folio || '---'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-violet-600" />
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium text-sm truncate">{clientName || '---'}</p>
            </div>
          </div>
        </div>

        {/* Tipo de Servicio */}
        {serviceType && (
          <div className="p-2 bg-violet-100 rounded-lg">
            <p className="text-xs text-violet-600 font-medium">{serviceType}</p>
          </div>
        )}

        {/* Ubicación */}
        {(origin || destination) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3 h-3 text-green-600" />
              <span className="truncate">{origin || '---'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3 h-3 text-red-600" />
              <span className="truncate">{destination || '---'}</span>
            </div>
          </div>
        )}

        {/* Recursos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Grúa</p>
              <p className="font-medium text-sm">{craneName || '---'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">Operadores</p>
              <p className="font-medium text-sm">{operatorCount}</p>
            </div>
          </div>
        </div>

        {/* Resumen Financiero */}
        <div className="pt-3 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-medium text-green-600">{formatCurrency(value)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Comisiones</span>
            <span className="text-orange-600">-{formatCurrency(totalCommissions)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Costos</span>
            <span className="text-red-600">-{formatCurrency(totalCosts)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium pt-2 border-t">
            <span>Margen Neto</span>
            <span className={netMargin >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(netMargin)}
            </span>
          </div>
          
          {/* Barra de progreso del margen */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Margen</span>
              <span className={cn(
                "font-medium",
                marginPercentage >= 30 ? "text-green-600" :
                marginPercentage >= 15 ? "text-yellow-600" : "text-red-600"
              )}>
                {marginPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all",
                  marginPercentage >= 30 ? "bg-green-500" :
                  marginPercentage >= 15 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${Math.min(Math.max(marginPercentage, 0), 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. ColoredSectionCard

Tarjeta con borde de color para secciones.

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ColoredSectionCardProps {
  title: string;
  icon?: React.ReactNode;
  color: 'violet' | 'blue' | 'green' | 'orange' | 'red';
  children: React.ReactNode;
  className?: string;
}

const colorStyles = {
  violet: 'border-l-violet-500 bg-violet-50/30',
  blue: 'border-l-blue-500 bg-blue-50/30',
  green: 'border-l-green-500 bg-green-50/30',
  orange: 'border-l-orange-500 bg-orange-50/30',
  red: 'border-l-red-500 bg-red-50/30'
};

export function ColoredSectionCard({ 
  title, 
  icon, 
  color, 
  children, 
  className 
}: ColoredSectionCardProps) {
  return (
    <Card className={cn("border-l-4", colorStyles[color], className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

---

## Hook de Validación Dinámica

```typescript
import { useMemo } from 'react';

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface UseServiceFormValidationProps {
  formData: ServiceFormData;
  selectedServiceType?: ServiceTypeConfig;
}

export function useServiceFormValidation({ 
  formData, 
  selectedServiceType 
}: UseServiceFormValidationProps) {
  const validationErrors = useMemo(() => {
    const errors: ValidationError[] = [];

    if (!selectedServiceType) return errors;

    // Validar operadores
    if (selectedServiceType.operatorRequired && formData.operators.length === 0) {
      errors.push({
        field: 'operators',
        message: 'Se requiere al menos un operador',
        severity: 'error'
      });
    }

    // Validar grúa
    if (selectedServiceType.craneRequired && !formData.craneId) {
      errors.push({
        field: 'craneId',
        message: 'Se requiere seleccionar una grúa',
        severity: 'error'
      });
    }

    // Validar origen
    if (selectedServiceType.originRequired && !formData.origin?.trim()) {
      errors.push({
        field: 'origin',
        message: 'Se requiere la dirección de origen',
        severity: 'error'
      });
    }

    // Validar destino
    if (selectedServiceType.destinationRequired && !formData.destination?.trim()) {
      errors.push({
        field: 'destination',
        message: 'Se requiere la dirección de destino',
        severity: 'error'
      });
    }

    // Validar vehículo
    if (selectedServiceType.vehicleBrandRequired && !formData.vehicleBrand?.trim()) {
      errors.push({
        field: 'vehicleBrand',
        message: 'Se requiere la marca del vehículo',
        severity: 'error'
      });
    }

    if (selectedServiceType.vehicleModelRequired && !formData.vehicleModel?.trim()) {
      errors.push({
        field: 'vehicleModel',
        message: 'Se requiere el modelo del vehículo',
        severity: 'error'
      });
    }

    if (selectedServiceType.licensePlateRequired && !formData.licensePlate?.trim()) {
      errors.push({
        field: 'licensePlate',
        message: 'Se requiere la patente del vehículo',
        severity: 'error'
      });
    }

    // Validar orden de compra
    if (selectedServiceType.purchaseOrderRequired && !formData.purchaseOrder?.trim()) {
      errors.push({
        field: 'purchaseOrder',
        message: 'Se requiere la orden de compra',
        severity: 'error'
      });
    }

    return errors;
  }, [formData, selectedServiceType]);

  const hasErrors = validationErrors.some(e => e.severity === 'error');
  const hasWarnings = validationErrors.some(e => e.severity === 'warning');

  const getFieldError = (fieldName: string) => 
    validationErrors.find(e => e.field === fieldName);

  const isFieldInvalid = (fieldName: string) => 
    validationErrors.some(e => e.field === fieldName && e.severity === 'error');

  return {
    validationErrors,
    hasErrors,
    hasWarnings,
    getFieldError,
    isFieldInvalid,
    isFormValid: !hasErrors
  };
}
```

---

## Estructura del Componente Principal

```tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileText, Car, Users, DollarSign, ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface EnhancedServiceFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ServiceFormData) => Promise<void>;
  editingService?: Service | null;
  prefilledData?: Partial<ServiceFormData>;
}

export function EnhancedServiceForm({
  isOpen,
  onOpenChange,
  onSubmit,
  editingService,
  prefilledData
}: EnhancedServiceFormProps) {
  const [currentStep, setCurrentStep] = useState('basic');
  const [formData, setFormData] = useState<ServiceFormData>(getDefaultFormData());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Definir pasos
  const steps: FormStep[] = [
    { id: 'basic', title: 'Información Básica', description: 'Folio, fechas y cliente', icon: FileText, isCompleted: false, hasError: false },
    { id: 'vehicle', title: 'Vehículo y Ubicación', description: 'Datos del vehículo', icon: Car, isCompleted: false, hasError: false },
    { id: 'resources', title: 'Recursos', description: 'Grúa y operadores', icon: Users, isCompleted: false, hasError: false },
    { id: 'financial', title: 'Financiero', description: 'Valor y costos', icon: DollarSign, isCompleted: false, hasError: false }
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        {/* Header con progreso */}
        <div className="bg-violet-600 text-white p-4 rounded-t-lg">
          <DialogTitle className="text-xl font-semibold mb-2">
            {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
          </DialogTitle>
          <Progress value={progress} className="h-2 bg-violet-400" />
          <p className="text-sm text-violet-200 mt-1">
            Paso {currentIndex + 1} de {steps.length}
          </p>
        </div>

        {/* Contenido principal - Dos columnas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Columna izquierda - Navegación y Resumen */}
          <div className="w-72 border-r bg-muted/30 p-4 space-y-4 overflow-y-auto">
            <FormStepNavigation
              steps={steps}
              currentStep={currentStep}
              onStepClick={setCurrentStep}
            />
            
            <FormSummaryPanel
              folio={formData.folio}
              clientName={/* obtener nombre del cliente */}
              serviceType={/* obtener tipo de servicio */}
              value={formData.value}
              totalCommissions={/* calcular total */}
              totalCosts={/* calcular total */}
              operatorCount={formData.operators.length}
              craneName={/* obtener nombre de grúa */}
              origin={formData.origin}
              destination={formData.destination}
              status={formData.status}
              isEditing={!!editingService}
            />
          </div>

          {/* Columna derecha - Formulario */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Renderizar paso actual */}
            {currentStep === 'basic' && (
              <BasicInfoStep formData={formData} onChange={setFormData} />
            )}
            {currentStep === 'vehicle' && (
              <VehicleLocationStep formData={formData} onChange={setFormData} />
            )}
            {currentStep === 'resources' && (
              <ResourcesStep formData={formData} onChange={setFormData} />
            )}
            {currentStep === 'financial' && (
              <FinancialStep formData={formData} onChange={setFormData} />
            )}
          </div>
        </div>

        {/* Footer con botones de navegación */}
        <div className="border-t p-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {currentIndex === steps.length - 1 ? (
              <Button 
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Guardando...' : 'Guardar Servicio'}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Esquema de Base de Datos (SQL)

```sql
-- Tipos de servicio con configuración de validación
CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  vehicle_info_optional BOOLEAN DEFAULT false,
  purchase_order_required BOOLEAN DEFAULT false,
  origin_required BOOLEAN DEFAULT true,
  destination_required BOOLEAN DEFAULT true,
  crane_required BOOLEAN DEFAULT true,
  operator_required BOOLEAN DEFAULT true,
  vehicle_brand_required BOOLEAN DEFAULT false,
  vehicle_model_required BOOLEAN DEFAULT false,
  license_plate_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Servicios principales
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  request_date DATE NOT NULL,
  service_date DATE NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  service_type_id UUID REFERENCES service_types(id) NOT NULL,
  purchase_order TEXT,
  purchase_order_number TEXT,
  quote_number TEXT,
  vehicle_brand TEXT,
  vehicle_model TEXT,
  license_plate TEXT,
  origin TEXT,
  destination TEXT,
  crane_id UUID REFERENCES cranes(id),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  has_excess BOOLEAN DEFAULT false,
  client_covered_amount NUMERIC(12,2),
  excess_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending',
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Operadores asignados a servicios
CREATE TABLE service_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID REFERENCES operators(id) NOT NULL,
  commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  role TEXT,
  hours NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Costos asociados a servicios
CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  category_id UUID REFERENCES cost_categories(id) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  subcategory TEXT,
  notes TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar según necesidades)
CREATE POLICY "Usuarios autenticados pueden ver servicios"
  ON services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden crear servicios"
  ON services FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar servicios"
  ON services FOR UPDATE TO authenticated USING (true);
```

---

## Dependencias Requeridas

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-select": "^2.x",
    "@radix-ui/react-checkbox": "^1.x",
    "@radix-ui/react-progress": "^1.x",
    "lucide-react": "^0.400+",
    "tailwindcss": "^3.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "@hookform/resolvers": "^3.x",
    "@supabase/supabase-js": "^2.x",
    "date-fns": "^3.x",
    "sonner": "^1.x"
  }
}
```

---

## Patrón Anti-Submit Accidental

Para evitar que el formulario se envíe accidentalmente al presionar Enter:

```tsx
// ❌ NO usar
<form onSubmit={handleSubmit}>
  <Button type="submit">Guardar</Button>
</form>

// ✅ SÍ usar
<div>
  <Button type="button" onClick={handleSubmit}>Guardar</Button>
</div>
```

---

## Notas de Implementación

1. **Folio Auto-generado**: Implementar hook `useEnhancedFolioGeneration` que genere folios únicos con formato configurable (ej: `SRV-2024-0001`).

2. **Validación Dinámica**: La validación cambia según el tipo de servicio seleccionado. Usar el hook `useServiceFormValidation`.

3. **Pre-llenado para Duplicar**: Cuando se duplica un servicio, usar `prefilledData` para inicializar el formulario con los datos del servicio original (excepto folio y fechas).

4. **Sincronización de Comisiones**: Al cambiar el valor del servicio, recalcular automáticamente las comisiones de los operadores si están basadas en porcentaje.

5. **Manejo de Costos**: Los costos pueden ser agregados en el paso 3 y se guardan en la tabla `costs` con referencia al servicio.

6. **Estados del Servicio**:
   - `pending`: Recién creado, pendiente de ejecución
   - `in_progress`: En proceso de ejecución
   - `completed`: Finalizado exitosamente
   - `cancelled`: Cancelado

7. **Permisos y RLS**: Configurar políticas de seguridad según el rol del usuario (admin, operador, etc.).
