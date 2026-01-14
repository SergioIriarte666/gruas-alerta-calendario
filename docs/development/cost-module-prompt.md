# Prompt: Módulo de Costos Completo

## Descripción General

Sistema de gestión de costos con formulario multi-paso, filtros avanzados, métricas en tiempo real, y vistas alternativas (tabla/tarjetas). Incluye funcionalidades de duplicación, actualización por lotes, carga desde XML, y sincronización con inventario.

### Características Principales
- Formulario multi-paso con 4 secciones
- Layout de dos columnas (navegación + contenido)
- Panel de resumen en tiempo real
- Filtros rápidos de fecha (Hoy, Semana, Mes, Todos)
- Métricas de resumen con variación mensual
- Selección múltiple para acciones por lotes
- Exportación a Excel
- Carga masiva desde XML (facturas electrónicas)

### Paleta de Colores
- **Header del formulario**: Violet (`bg-violet-600`)
- **Métricas positivas**: Green
- **Métricas negativas**: Red
- **Badges de estado**: Colores semánticos según contexto

---

## Estructura de la Página Principal

```typescript
// src/pages/Costs.tsx

interface CostsPageState {
  // Vista y modal
  viewMode: 'table' | 'cards';
  isFormOpen: boolean;
  isXmlUploadOpen: boolean;
  editingCost: Cost | null;
  viewingCost: Cost | null;
  
  // Filtros
  searchTerm: string;
  filters: CostFilters;
  dateFilter: DateFilterPeriod;
  
  // Selección múltiple
  selectedCostIds: string[];
  isBatchUpdateOpen: boolean;
}

type DateFilterPeriod = 'today' | 'week' | 'month' | 'all';

interface CostFilters {
  categoryId?: string;
  subcategory?: string;
  craneId?: string;
  operatorId?: string;
  serviceId?: string;
  costCenterId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
}
```

### Componentes de la Página

```tsx
<div className="space-y-6">
  {/* Header con métricas */}
  <CostsHeader
    onAddCost={() => setIsFormOpen(true)}
    onUploadXml={() => setIsXmlUploadOpen(true)}
    searchTerm={searchTerm}
    onSearchChange={setSearchTerm}
    onExport={handleExport}
    viewMode={viewMode}
    onViewModeChange={setViewMode}
    filters={filters}
    onFiltersChange={setFilters}
    onDateFilterChange={setDateFilter}
    activeDateFilter={dateFilter}
    totalCosts={costs.length}
    totalAmount={totalAmount}
    averageAmount={averageAmount}
    monthlyVariation={monthlyVariation}
  />

  {/* Vista de tabla o tarjetas */}
  {viewMode === 'table' ? (
    <CostsTableView
      costs={filteredCosts}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onViewDetails={handleViewDetails}
      onDuplicate={handleDuplicate}
      selectedIds={selectedCostIds}
      onSelectionChange={setSelectedCostIds}
      onBatchUpdate={() => setIsBatchUpdateOpen(true)}
    />
  ) : (
    <CostList
      costs={filteredCosts}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onViewDetails={handleViewDetails}
      onDuplicate={handleDuplicate}
    />
  )}

  {/* Modales */}
  <CostFormModal
    open={isFormOpen}
    onOpenChange={setIsFormOpen}
    editingCost={editingCost}
    prefilledData={prefilledData}
  />

  <CostDetailsModal
    cost={viewingCost}
    open={!!viewingCost}
    onOpenChange={() => setViewingCost(null)}
    onEdit={handleEdit}
    onDuplicate={handleDuplicate}
  />

  <CostBatchUpdateModal
    open={isBatchUpdateOpen}
    onOpenChange={setIsBatchUpdateOpen}
    selectedCostIds={selectedCostIds}
    onSuccess={() => setSelectedCostIds([])}
  />

  <XmlUploadDialog
    open={isXmlUploadOpen}
    onOpenChange={setIsXmlUploadOpen}
  />
</div>
```

---

## Formulario Multi-Paso (CostForm)

### Estructura de 4 Pasos

```typescript
interface CostFormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType;
  isCompleted: boolean;
  hasError: boolean;
}

const getCostFormSteps = (): CostFormStep[] => [
  {
    id: 'basic',
    title: 'Información Básica',
    description: 'Fecha, categoría y descripción',
    icon: FileText,
  },
  {
    id: 'amount',
    title: 'Monto y Detalles',
    description: 'Valor, subcategoría e inventario',
    icon: DollarSign,
  },
  {
    id: 'associations',
    title: 'Asociaciones',
    description: 'Grúa, operador, servicio',
    icon: Link,
  },
  {
    id: 'notes',
    title: 'Notas',
    description: 'Observaciones adicionales',
    icon: StickyNote,
  },
];
```

### Campos por Paso

#### Paso 1: Información Básica
```typescript
interface Step1Fields {
  date: string;              // DatePickerInput, requerido
  category_id: string;       // Select de cost_categories, requerido
  description: string;       // CostCombobox con autocompletado, requerido
}
```

#### Paso 2: Monto y Detalles
```typescript
interface Step2Fields {
  amount: number;            // Input numérico, requerido
  subcategory: string;       // Select/Combobox dinámico según categoría
  
  // Campos condicionales para "Piezas y Repuestos"
  part_name?: string;        // Nombre de la pieza
  supplier?: string;         // Proveedor (texto libre)
  supplier_phone?: string;   // Teléfono del proveedor
  quantity?: number;         // Cantidad
  unit_price?: number;       // Precio unitario (amount = quantity * unit_price)
  kilometraje?: number;      // Kilometraje de la grúa
  
  // Campos para categoría "Inventario"
  purchase_quantity?: number;
  purchase_unit_cost?: number;
  immediate_consumption?: boolean;
}
```

#### Paso 3: Asociaciones
```typescript
interface Step3Fields {
  crane_id?: string;         // Select de grúas activas
  operator_id?: string;      // Select de operadores activos
  service_id?: string;       // ServiceSelector con búsqueda
  service_folio?: string;    // Auto-completado desde servicio
  cost_center_id?: string;   // Select de centros de costo
  supplier_id?: string;      // SupplierSelector (opcional)
}
```

#### Paso 4: Notas
```typescript
interface Step4Fields {
  notes?: string;            // Textarea para observaciones
}
```

---

## Interfaces TypeScript Completas

### Tipo Cost (con relaciones)

```typescript
import { Database } from "@/integrations/supabase/types";

export type CostCategory = Database['public']['Tables']['cost_categories']['Row'];
export type CostSubcategory = Database['public']['Tables']['cost_subcategories']['Row'];

export type Cost = Database['public']['Tables']['costs']['Row'] & {
  payment_date?: string | null;
  payment_batch_id?: string | null;
  cost_categories: CostCategory;
  cranes: Database['public']['Tables']['cranes']['Row'] | null;
  operators: Database['public']['Tables']['operators']['Row'] | null;
  services: (Database['public']['Tables']['services']['Row'] & {
    clients: Database['public']['Tables']['clients']['Row'];
  }) | null;
  crane_parts: {
    part_name: string;
    supplier: string;
    phone: string | null;
    quantity: number;
    unit_price: number;
    total_value: number | null;
    kilometraje: number | null;
  }[] | null;
  crane_maintenance: {
    id: string;
    description: string;
    maintenance_type: string;
    provider: string | null;
    notes: string | null;
  } | null;
  creator?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};
```

### CostFormData

```typescript
export type CostFormData = Omit<
  Database['public']['Tables']['costs']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by'
> & {
  // Campos adicionales para piezas y repuestos
  part_name?: string | null;
  supplier?: string | null;
  supplier_phone?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  kilometraje?: number | null;
  
  // Campos para sincronización con inventario
  purchase_quantity?: number | null;
  purchase_unit_cost?: number | null;
  immediate_consumption?: boolean;
  
  // FK a proveedores
  supplier_id?: string | null;
};
```

### CostFormValues (Schema Zod)

```typescript
import { z } from 'zod';

export const costFormSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  category_id: z.string().min(1, 'La categoría es requerida'),
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.number().positive('El monto debe ser positivo'),
  subcategory: z.string().optional(),
  crane_id: z.string().optional().nullable(),
  operator_id: z.string().optional().nullable(),
  service_id: z.string().optional().nullable(),
  service_folio: z.string().optional().nullable(),
  cost_center_id: z.string().optional().nullable(),
  supplier_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  
  // Campos de piezas
  part_name: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  supplier_phone: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  unit_price: z.number().optional().nullable(),
  kilometraje: z.number().optional().nullable(),
  
  // Campos de inventario
  purchase_quantity: z.number().optional().nullable(),
  purchase_unit_cost: z.number().optional().nullable(),
  immediate_consumption: z.boolean().optional(),
});

export type CostFormValues = z.infer<typeof costFormSchema>;
```

---

## Componentes Clave

### CostFormStepNavigation

```typescript
// src/components/costs/form/CostFormStepNavigation.tsx

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostFormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCompleted: boolean;
  hasError: boolean;
}

interface CostFormStepNavigationProps {
  steps: CostFormStep[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
}

export const CostFormStepNavigation = ({
  steps,
  currentStep,
  onStepClick,
}: CostFormStepNavigationProps) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isPast = index < currentIndex;
        const isClickable = isPast || step.isCompleted || index === currentIndex + 1;

        return (
          <button
            key={step.id}
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              isActive && "bg-violet-100 border-2 border-violet-500",
              isPast && !isActive && "bg-muted/50",
              step.hasError && "border-2 border-destructive",
              isClickable && !isActive && "hover:bg-muted cursor-pointer",
              !isClickable && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Indicador de paso */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                isActive && "bg-violet-600 text-white",
                isPast && step.isCompleted && "bg-green-600 text-white",
                step.hasError && "bg-destructive text-destructive-foreground",
                !isActive && !isPast && !step.hasError && "bg-muted text-muted-foreground"
              )}
            >
              {step.isCompleted && !step.hasError ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium text-sm",
                  isActive && "text-violet-700",
                  step.hasError && "text-destructive"
                )}>
                  {step.title}
                </span>
                <Icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-violet-600" : "text-muted-foreground"
                )} />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {step.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

### CostSummaryPanel

```typescript
// src/components/costs/form/CostSummaryPanel.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Tag, 
  DollarSign, 
  Truck, 
  User, 
  FileText,
  Building2,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CostSummaryPanelProps {
  date?: string;
  categoryName?: string;
  subcategory?: string;
  description?: string;
  amount?: number;
  craneName?: string;
  operatorName?: string;
  serviceFolio?: string;
  costCenterName?: string;
  supplierName?: string;
  notes?: string;
  isEditing?: boolean;
  
  // Campos de piezas
  partName?: string;
  quantity?: number;
  unitPrice?: number;
}

export const CostSummaryPanel = ({
  date,
  categoryName,
  subcategory,
  description,
  amount,
  craneName,
  operatorName,
  serviceFolio,
  costCenterName,
  supplierName,
  notes,
  isEditing,
  partName,
  quantity,
  unitPrice,
}: CostSummaryPanelProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Resumen del Costo</CardTitle>
          <Badge variant={isEditing ? "secondary" : "default"}>
            {isEditing ? 'Editando' : 'Nuevo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fecha */}
        {date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{formatDate(date)}</span>
          </div>
        )}

        {/* Categoría y Subcategoría */}
        {categoryName && (
          <div className="flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span>
              {categoryName}
              {subcategory && <span className="text-muted-foreground"> / {subcategory}</span>}
            </span>
          </div>
        )}

        {/* Descripción */}
        {description && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="line-clamp-2">{description}</span>
          </div>
        )}

        {/* Monto */}
        {amount !== undefined && amount > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-lg font-semibold text-green-600">
              {formatCurrency(amount)}
            </span>
          </div>
        )}

        {/* Detalles de pieza (si aplica) */}
        {partName && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Pieza/Repuesto
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span>{partName}</span>
            </div>
            {quantity && unitPrice && (
              <p className="text-xs text-muted-foreground">
                {quantity} x {formatCurrency(unitPrice)}
              </p>
            )}
          </div>
        )}

        {/* Asociaciones */}
        {(craneName || operatorName || serviceFolio || costCenterName || supplierName) && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Asociaciones
            </p>
            
            {craneName && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span>{craneName}</span>
              </div>
            )}
            
            {operatorName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{operatorName}</span>
              </div>
            )}
            
            {serviceFolio && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Servicio: {serviceFolio}</span>
              </div>
            )}

            {costCenterName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{costCenterName}</span>
              </div>
            )}

            {supplierName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{supplierName}</span>
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        {notes && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Notas
            </p>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### QuickDateFilters

```typescript
// src/components/costs/QuickDateFilters.tsx

import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateFilterPeriod = 'today' | 'week' | 'month' | 'all';

interface QuickDateFiltersProps {
  activePeriod: DateFilterPeriod;
  onPeriodChange: (period: DateFilterPeriod) => void;
}

export const QuickDateFilters = ({
  activePeriod,
  onPeriodChange,
}: QuickDateFiltersProps) => {
  const filters: { id: DateFilterPeriod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'today', label: 'Hoy', icon: Calendar },
    { id: 'week', label: 'Semana', icon: CalendarDays },
    { id: 'month', label: 'Mes', icon: CalendarRange },
    { id: 'all', label: 'Todos', icon: CalendarRange },
  ];

  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activePeriod === filter.id;

        return (
          <Button
            key={filter.id}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPeriodChange(filter.id)}
            className={cn(
              "gap-2",
              isActive && "bg-primary text-primary-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {filter.label}
          </Button>
        );
      })}
    </div>
  );
};
```

### CostsHeader con Métricas

```typescript
// src/components/costs/CostsHeader.tsx

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Upload, 
  Search, 
  Download,
  LayoutGrid,
  List,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { QuickDateFilters } from './QuickDateFilters';

interface CostsHeaderProps {
  onAddCost: () => void;
  onUploadXml: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
  onDateFilterChange: (period: DateFilterPeriod) => void;
  activeDateFilter: DateFilterPeriod;
  totalCosts: number;
  totalAmount: number;
  averageAmount: number;
  monthlyVariation: number;
}

export const CostsHeader = ({
  onAddCost,
  onUploadXml,
  searchTerm,
  onSearchChange,
  onExport,
  viewMode,
  onViewModeChange,
  onDateFilterChange,
  activeDateFilter,
  totalCosts,
  totalAmount,
  averageAmount,
  monthlyVariation,
}: CostsHeaderProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Título y acciones principales */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Costos</h1>
          <p className="text-muted-foreground">
            Administra y controla todos los costos de la operación
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onUploadXml}>
            <Upload className="w-4 h-4 mr-2" />
            Cargar XML
          </Button>
          <Button onClick={onAddCost}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Costo
          </Button>
        </div>
      </div>

      {/* Filtros rápidos de fecha */}
      <QuickDateFilters
        activePeriod={activeDateFilter}
        onPeriodChange={onDateFilterChange}
      />

      {/* Métricas de resumen */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Costos</p>
            <p className="text-2xl font-bold">{totalCosts}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Monto Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Promedio</p>
            <p className="text-2xl font-bold">{formatCurrency(averageAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Variación Mensual</p>
            <div className="flex items-center gap-2">
              <p className={cn(
                "text-2xl font-bold",
                monthlyVariation >= 0 ? "text-red-600" : "text-green-600"
              )}>
                {monthlyVariation >= 0 ? '+' : ''}{monthlyVariation.toFixed(1)}%
              </p>
              {monthlyVariation >= 0 ? (
                <TrendingUp className="w-5 h-5 text-red-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de búsqueda y controles */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción, categoría, proveedor..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => onViewModeChange('table')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="icon"
            onClick={() => onViewModeChange('cards')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        <Button variant="outline" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>
    </div>
  );
};
```

---

## Hooks Principales

### useCosts (CRUD Completo)

```typescript
// src/hooks/costs/useCosts.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost, CostFormData } from '@/types/costs';
import { toast } from 'sonner';

// Fetch costs con relaciones
export const useCosts = () => {
  return useQuery({
    queryKey: ['costs'],
    queryFn: async (): Promise<Cost[]> => {
      const { data, error } = await supabase
        .from('costs')
        .select(`
          *,
          cost_categories(*),
          cranes(*),
          operators(*),
          services(*, clients(*)),
          crane_parts(*),
          crane_maintenance(*)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Cost[];
    },
  });
};

// Agregar costo
export const useAddCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (costData: CostFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('costs')
        .insert({
          ...costData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('Costo creado exitosamente');
    },
    onError: (error: Error) => {
      toast.error('Error al crear costo', { description: error.message });
    },
  });
};

// Actualizar costo
export const useUpdateCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...costData }: CostFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('costs')
        .update(costData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('Costo actualizado exitosamente');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar costo', { description: error.message });
    },
  });
};

// Eliminar costo
export const useDeleteCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('Costo eliminado exitosamente');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar costo', { description: error.message });
    },
  });
};
```

### useCostCategories y useCostSubcategories

```typescript
// src/hooks/costs/useCostCategories.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCostCategories = () => {
  return useQuery({
    queryKey: ['cost-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};

export const useCostSubcategories = (categoryId?: string) => {
  return useQuery({
    queryKey: ['cost-subcategories', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('cost_subcategories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });
};
```

### useUpdateCostsBatch (Actualización por Lotes)

```typescript
// src/hooks/costs/useUpdateCostsBatch.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchUpdateFields {
  category_id?: string;
  subcategory?: string;
  date?: string;
  payment_date?: string;
  cost_center_id?: string;
  supplier_id?: string;
  notes?: string;
}

interface BatchUpdateParams {
  costIds: string[];
  fields: BatchUpdateFields;
  notesMode: 'replace' | 'append';
}

export const useUpdateCostsBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ costIds, fields, notesMode }: BatchUpdateParams) => {
      const updatePromises = costIds.map(async (id) => {
        let updateData = { ...fields };

        // Manejar modo de notas
        if (fields.notes && notesMode === 'append') {
          const { data: existing } = await supabase
            .from('costs')
            .select('notes')
            .eq('id', id)
            .single();

          updateData.notes = existing?.notes 
            ? `${existing.notes}\n${fields.notes}`
            : fields.notes;
        }

        const { error } = await supabase
          .from('costs')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
        return id;
      });

      return Promise.all(updatePromises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success(`${data.length} costos actualizados exitosamente`);
    },
    onError: (error: Error) => {
      toast.error('Error en actualización por lotes', { description: error.message });
    },
  });
};
```

### useDateFilters (Métricas por Período)

```typescript
// src/hooks/useDateFilters.ts

import { useMemo } from 'react';
import { Cost } from '@/types/costs';
import { 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  isWithinInterval 
} from 'date-fns';

export const useDateFilters = (costs: Cost[]) => {
  return useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    // Costos de hoy
    const todayCosts = costs.filter(cost => {
      const costDate = new Date(cost.date);
      return isWithinInterval(costDate, { start: todayStart, end: todayEnd });
    });

    // Costos del mes actual
    const currentMonthCosts = costs.filter(cost => {
      const costDate = new Date(cost.date);
      return isWithinInterval(costDate, { start: monthStart, end: monthEnd });
    });

    // Costos del mes anterior
    const previousMonthCosts = costs.filter(cost => {
      const costDate = new Date(cost.date);
      return isWithinInterval(costDate, { start: prevMonthStart, end: prevMonthEnd });
    });

    // Calcular totales
    const todayTotal = todayCosts.reduce((sum, c) => sum + c.amount, 0);
    const currentMonthTotal = currentMonthCosts.reduce((sum, c) => sum + c.amount, 0);
    const previousMonthTotal = previousMonthCosts.reduce((sum, c) => sum + c.amount, 0);

    // Variación porcentual
    const monthlyVariation = previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : 0;

    return {
      today: {
        count: todayCosts.length,
        total: todayTotal,
      },
      currentMonth: {
        count: currentMonthCosts.length,
        total: currentMonthTotal,
      },
      previousMonth: {
        count: previousMonthCosts.length,
        total: previousMonthTotal,
      },
      monthlyVariation,
    };
  }, [costs]);
};
```

---

## Funcionalidades Especiales

### Duplicación de Costos

```typescript
// src/utils/costs/prepareCostForDuplication.ts

import { Cost, CostFormData } from '@/types/costs';
import { getCurrentChileDateString } from '@/lib/dateUtils';

export const prepareCostForDuplication = (cost: Cost): CostFormData => {
  return {
    date: getCurrentChileDateString(), // Fecha de hoy
    description: `[Duplicado] ${cost.description}`,
    amount: cost.amount,
    category_id: cost.category_id,
    subcategory: cost.subcategory,
    crane_id: cost.crane_id,
    operator_id: cost.operator_id,
    service_id: cost.service_id,
    service_folio: cost.service_folio,
    cost_center_id: cost.cost_center_id,
    supplier_id: cost.supplier_id,
    notes: cost.notes,
    
    // Limpiar campos de inventario
    purchase_quantity: null,
    purchase_unit_cost: null,
    immediate_consumption: false,
    inventory_movement_id: null,
    maintenance_id: null,
  };
};
```

### Batch Update Modal

```typescript
// src/components/costs/CostBatchUpdateModal.tsx

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUpdateCostsBatch } from '@/hooks/costs/useUpdateCostsBatch';

interface CostBatchUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCostIds: string[];
  onSuccess: () => void;
}

export const CostBatchUpdateModal = ({
  open,
  onOpenChange,
  selectedCostIds,
  onSuccess,
}: CostBatchUpdateModalProps) => {
  const { mutate: updateBatch, isPending } = useUpdateCostsBatch();

  // Estados para campos habilitados
  const [enableCategory, setEnableCategory] = useState(false);
  const [enableSubcategory, setEnableSubcategory] = useState(false);
  const [enableDate, setEnableDate] = useState(false);
  const [enableCostCenter, setEnableCostCenter] = useState(false);
  const [enableSupplier, setEnableSupplier] = useState(false);
  const [enableNotes, setEnableNotes] = useState(false);

  // Valores de campos
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [notesMode, setNotesMode] = useState<'replace' | 'append'>('replace');

  const handleSubmit = () => {
    const fields: Record<string, any> = {};

    if (enableCategory && categoryId) fields.category_id = categoryId;
    if (enableSubcategory && subcategory) fields.subcategory = subcategory;
    if (enableDate && date) fields.date = date;
    if (enableCostCenter) fields.cost_center_id = costCenterId || null;
    if (enableSupplier) fields.supplier_id = supplierId || null;
    if (enableNotes && notes) fields.notes = notes;

    updateBatch(
      {
        costIds: selectedCostIds,
        fields,
        notesMode,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Actualizar {selectedCostIds.length} costos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Toggle para cada campo */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Categoría</Label>
              <Switch
                checked={enableCategory}
                onCheckedChange={setEnableCategory}
              />
            </div>
            {enableCategory && (
              <CategorySelect value={categoryId} onChange={setCategoryId} />
            )}

            {/* ... más campos con toggles ... */}

            <div className="flex items-center justify-between">
              <Label>Notas</Label>
              <Switch
                checked={enableNotes}
                onCheckedChange={setEnableNotes}
              />
            </div>
            {enableNotes && (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escribir nota..."
                />
                <RadioGroup value={notesMode} onValueChange={(v) => setNotesMode(v as 'replace' | 'append')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="replace" id="replace" />
                    <Label htmlFor="replace">Reemplazar notas existentes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="append" id="append" />
                    <Label htmlFor="append">Añadir a notas existentes</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Esquema de Base de Datos

```sql
-- Categorías de costos
CREATE TABLE public.cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Datos iniciales de categorías
INSERT INTO public.cost_categories (name, description) VALUES
  ('Operación', 'Costos operativos generales'),
  ('Mantenimiento', 'Mantenimiento de grúas y equipos'),
  ('Inventario', 'Consumo de inventario'),
  ('Administrativo', 'Gastos administrativos'),
  ('Comisión Operador', 'Comisiones a operadores');

-- Subcategorías dinámicas
CREATE TABLE public.cost_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES cost_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(category_id, name)
);

-- Datos iniciales de subcategorías
INSERT INTO public.cost_subcategories (category_id, name, display_order) 
SELECT id, 'Combustible', 1 FROM cost_categories WHERE name = 'Operación'
UNION ALL
SELECT id, 'Peajes', 2 FROM cost_categories WHERE name = 'Operación'
UNION ALL
SELECT id, 'Viáticos', 3 FROM cost_categories WHERE name = 'Operación'
UNION ALL
SELECT id, 'Piezas y Repuestos', 1 FROM cost_categories WHERE name = 'Mantenimiento'
UNION ALL
SELECT id, 'Mano de obra', 2 FROM cost_categories WHERE name = 'Mantenimiento';

-- Tabla principal de costos
CREATE TABLE public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  category_id UUID NOT NULL REFERENCES cost_categories(id),
  subcategory TEXT,
  
  -- Asociaciones opcionales
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  service_id UUID REFERENCES services(id),
  service_folio TEXT,
  cost_center_id UUID REFERENCES cost_centers(id),
  supplier_id UUID REFERENCES suppliers(id),
  
  -- Campos adicionales
  notes TEXT,
  payment_date DATE,
  payment_batch_id UUID,
  
  -- Campos para inventario
  purchase_quantity NUMERIC,
  purchase_unit_cost NUMERIC,
  immediate_consumption BOOLEAN DEFAULT false,
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  maintenance_id UUID REFERENCES crane_maintenance(id),
  
  -- Auditoría
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Centros de costo
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES cost_centers(id),
  budget_amount NUMERIC,
  budget_period TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX idx_costs_date ON costs(date);
CREATE INDEX idx_costs_category_id ON costs(category_id);
CREATE INDEX idx_costs_crane_id ON costs(crane_id);
CREATE INDEX idx_costs_service_id ON costs(service_id);
CREATE INDEX idx_costs_created_at ON costs(created_at);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_costs_updated_at
  BEFORE UPDATE ON costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all costs"
  ON costs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert costs"
  ON costs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their costs"
  ON costs FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their costs"
  ON costs FOR DELETE
  USING (auth.uid() = created_by);
```

---

## Dependencias Requeridas

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "typescript": "^5.0.0",
    
    "@tanstack/react-query": "^5.56.2",
    "@supabase/supabase-js": "^2.50.0",
    
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    
    "tailwindcss": "^3.4.0",
    "tailwind-merge": "^2.5.2",
    "tailwindcss-animate": "^1.0.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-dropdown-menu": "^2.1.1",
    "@radix-ui/react-popover": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    
    "lucide-react": "^0.462.0",
    "date-fns": "^4.1.0",
    "sonner": "^1.5.0",
    "xlsx": "^0.18.5"
  }
}
```

---

## Patrones y Buenas Prácticas

### Patrón Anti-Submit Accidental

```typescript
// ❌ Evitar: form con onSubmit
<form onSubmit={handleSubmit}>
  <button type="submit">Guardar</button>
</form>

// ✅ Correcto: div con onClick explícito
<div className="form-container">
  {/* ... campos ... */}
  <Button type="button" onClick={handleSubmit}>
    Guardar
  </Button>
</div>
```

### Validación por Pasos

```typescript
const calculateStepCompletion = (values: CostFormValues) => ({
  basic: !!(values.date && values.category_id && values.description),
  amount: !!(values.amount && values.amount > 0),
  associations: true, // Opcional
  notes: true, // Opcional
});

const handleSubmit = () => {
  const completion = calculateStepCompletion(formValues);
  
  if (!completion.basic) {
    setCurrentStep('basic');
    toast.error('Complete la información básica');
    return;
  }
  
  if (!completion.amount) {
    setCurrentStep('amount');
    toast.error('El monto es requerido');
    return;
  }
  
  // Proceder con guardado
  saveCost(formValues);
};
```

### Cache Invalidation

```typescript
// En mutations, invalidar queries relacionadas
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['costs'] });
  queryClient.invalidateQueries({ queryKey: ['cost-metrics'] });
  
  // Si afecta inventario
  if (hasInventoryFields) {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }
  
  // Si afecta servicios
  if (serviceId) {
    queryClient.invalidateQueries({ queryKey: ['services', serviceId] });
  }
};
```

---

## Notas de Implementación

### 1. Auto-fill al Seleccionar Servicio
Cuando se selecciona un servicio, auto-completar:
- `crane_id` desde `service.crane_id`
- `operator_id` desde primer operador del servicio
- `service_folio` desde `service.folio`

### 2. Cálculo Automático de Piezas
Para subcategoría "Piezas y Repuestos":
```typescript
amount = quantity * unit_price
```

### 3. Subcategorías Dinámicas
Las subcategorías cambian según la categoría seleccionada.
Usar `useCostSubcategories(categoryId)` para obtenerlas.

### 4. Preservar Fechas Originales
Al editar costos existentes, mantener la fecha original.
Solo actualizar a fecha actual en costos nuevos o duplicados.

### 5. Proveedor Opcional
El campo `supplier_id` no es requerido.
Hay costos (sueldos, comisiones) que no tienen proveedor.

### 6. Exportación a Excel
Usar librería `xlsx` para generar archivos con múltiples hojas:
- Detalle de costos
- Resumen por categoría
- Tendencia mensual
- Resumen ejecutivo

---

## Estructura de Archivos Recomendada

```
src/
├── components/
│   └── costs/
│       ├── CostsHeader.tsx
│       ├── CostList.tsx
│       ├── CostCard.tsx
│       ├── CostsTableView.tsx
│       ├── CostDetailsModal.tsx
│       ├── CostBatchActionBar.tsx
│       ├── CostBatchUpdateModal.tsx
│       ├── QuickDateFilters.tsx
│       ├── CostFiltersComponent.tsx
│       ├── XmlUploadDialog.tsx
│       └── form/
│           ├── CostForm.tsx
│           ├── CostFormStepNavigation.tsx
│           ├── CostSummaryPanel.tsx
│           ├── steps/
│           │   ├── BasicInfoStep.tsx
│           │   ├── AmountDetailsStep.tsx
│           │   ├── AssociationsStep.tsx
│           │   └── NotesStep.tsx
│           └── fields/
│               ├── CategorySelect.tsx
│               ├── SubcategoryCombobox.tsx
│               ├── CostCombobox.tsx
│               └── PartsFields.tsx
├── hooks/
│   └── costs/
│       ├── useCosts.ts
│       ├── useCostCategories.ts
│       ├── useCostSubcategories.ts
│       ├── useUpdateCostsBatch.ts
│       ├── useDeleteCost.ts
│       └── useFrequentCostData.ts
├── pages/
│   └── Costs.tsx
├── types/
│   └── costs.ts
└── utils/
    └── costs/
        ├── prepareCostForDuplication.ts
        ├── costFilters.ts
        └── costExporter.ts
```
