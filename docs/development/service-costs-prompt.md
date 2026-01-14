# Prompt: Costos Asociados a Servicios

## Descripción General

Sistema de gestión de costos operacionales directamente vinculados a servicios específicos. Los costos se registran dentro del formulario de Nuevo/Editar Servicio en una sección dedicada. Esta funcionalidad permite asociar gastos como combustible, peajes, viáticos, materiales, etc. al servicio correspondiente.

### Características Principales
- Costos inline dentro del formulario de servicio
- Guardado individual por costo (no requiere guardar todo el servicio)
- Carga automática de costos existentes al editar
- Cálculo automático: `amount = quantity × unitPrice`
- Subcategorías dinámicas por categoría
- Exclusión automática de comisiones (se manejan por separado)
- Resumen por categoría en tiempo real

### Diferencia con Comisiones
> **IMPORTANTE**: Las comisiones de operadores se gestionan en `MultipleOperatorsSection`, NO en esta sección. Los costos de categoría "Comisión Operador" se filtran automáticamente.

---

## Interfaz ServiceCostDetail

```typescript
// src/types/serviceDetails.ts

export interface ServiceCostDetail {
  id: string;                    // UUID o 'temp-{timestamp}' para nuevos
  description: string;           // Descripción del costo (requerido)
  amount: number;                // Monto total (requerido, > 0)
  quantity?: number;             // Cantidad (default: 1)
  unitPrice?: number;            // Precio unitario
  notes?: string;                // Notas adicionales
  category_id: string;           // FK a cost_categories (requerido)
  subcategory?: string;          // Subcategoría dinámica
  date?: string;                 // Fecha original (preservar en edición)
  isExisting?: boolean;          // true si ya está guardado en BD
}

// Categorías comunes para costos de servicio
export const SERVICE_COST_CATEGORIES = [
  'Combustible',
  'Peajes',
  'Viáticos',
  'Estacionamiento',
  'Materiales',
  'Transporte',
  'Hospedaje',
  'Otros'
] as const;
```

---

## Componente ServiceCostDetailsSection

### Props

```typescript
interface ServiceCostDetailsSectionProps {
  serviceId?: string;                                    // ID del servicio (undefined para nuevo)
  costDetails: ServiceCostDetail[];                      // Array de costos actuales
  onCostDetailsChange: (costs: ServiceCostDetail[]) => void;  // Callback para actualizar
  disabled?: boolean;                                    // Deshabilitar edición
}
```

### Comportamiento Principal

```typescript
// src/components/services/form/ServiceCostDetailsSection.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Receipt, Calculator, Info } from 'lucide-react';
import { useServiceCosts } from '@/hooks/useServiceCosts';
import { useAddCost, useUpdateCost, useDeleteCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';

export const ServiceCostDetailsSection = ({
  serviceId,
  costDetails,
  onCostDetailsChange,
  disabled = false
}: ServiceCostDetailsSectionProps) => {
  
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, string[]>>({});
  
  const { data: categories = [] } = useCostCategories();
  const { data: existingCosts, isLoading: existingCostsLoading, refetch: refetchCosts } = useServiceCosts(serviceId || null);
  const { mutate: addCost } = useAddCost();
  const { mutate: updateCost } = useUpdateCost();
  const { mutate: deleteCost } = useDeleteCost();

  // ============================================
  // 1. FILTRAR COMISIONES (se manejan aparte)
  // ============================================
  
  const commissionCategoryId = categories.find(cat => 
    cat.name.toLowerCase().includes('comisión') || 
    cat.name.toLowerCase().includes('comision')
  )?.id;

  // Excluir categoría de comisiones del selector
  const nonCommissionCategories = categories.filter(cat => 
    !cat.name.toLowerCase().includes('comisión') && 
    !cat.name.toLowerCase().includes('comision')
  );

  // Filtrar costos existentes (excluir comisiones)
  const filteredExistingCosts = existingCosts?.filter(cost => 
    cost.category_id !== commissionCategoryId
  ) || [];

  // ============================================
  // 2. CARGAR COSTOS EXISTENTES AL EDITAR
  // ============================================
  
  useEffect(() => {
    if (serviceId && 
        categories.length > 0 && 
        filteredExistingCosts.length > 0 && 
        costDetails.length === 0 && 
        !existingCostsLoading) {
      
      const mappedCosts = filteredExistingCosts.map(cost => ({
        id: cost.id,
        description: cost.description,
        amount: Number(cost.amount),
        quantity: 1,
        unitPrice: Number(cost.amount),
        notes: cost.notes || '',
        category_id: cost.category_id,
        subcategory: cost.subcategory || '',
        date: cost.date, // ⚠️ CRÍTICO: Preservar fecha original
        isExisting: true
      }));
      
      onCostDetailsChange(mappedCosts);
    }
  }, [serviceId, categories.length, filteredExistingCosts.length, costDetails.length, existingCostsLoading]);

  // ============================================
  // 3. AGREGAR NUEVO COSTO
  // ============================================
  
  const addCostDetail = () => {
    if (isAddingCost) return; // Prevenir doble clic
    
    setIsAddingCost(true);
    
    const newCostDetail: ServiceCostDetail = {
      id: `temp-${Date.now()}`,  // ID temporal
      description: '',
      amount: 0,
      category_id: '',
      subcategory: '',
      notes: '',
      quantity: 1,
      unitPrice: 0,
      isExisting: false
    };
    
    onCostDetailsChange([...costDetails, newCostDetail]);
    
    setTimeout(() => setIsAddingCost(false), 300);
  };

  // ============================================
  // 4. ELIMINAR COSTO
  // ============================================
  
  const removeCostDetail = async (id: string) => {
    const costToRemove = costDetails.find(cost => cost.id === id);
    
    if (costToRemove?.isExisting && serviceId) {
      // Eliminar de la base de datos
      deleteCost(id, {
        onSuccess: () => {
          onCostDetailsChange(costDetails.filter(cost => cost.id !== id));
          refetchCosts();
          toast.success("Costo eliminado correctamente");
        },
        onError: (error) => {
          toast.error("Error al eliminar el costo");
        }
      });
    } else {
      // Solo eliminar del estado local (no guardado aún)
      onCostDetailsChange(costDetails.filter(cost => cost.id !== id));
    }
  };

  // ============================================
  // 5. ACTUALIZAR CAMPO DE COSTO
  // ============================================
  
  const updateCostDetail = (id: string, field: keyof ServiceCostDetail, value: any) => {
    onCostDetailsChange(
      costDetails.map(cost => {
        if (cost.id === id) {
          const updated = { ...cost, [field]: value };
          
          // Auto-calcular amount si se cambia quantity o unitPrice
          if (field === 'quantity' || field === 'unitPrice') {
            const quantity = field === 'quantity' ? value : updated.quantity || 1;
            const unitPrice = field === 'unitPrice' ? value : updated.unitPrice || 0;
            updated.amount = quantity * unitPrice;
          }
          
          // Limpiar subcategoría si cambia la categoría
          if (field === 'category_id') {
            updated.subcategory = '';
          }
          
          return updated;
        }
        return cost;
      })
    );
  };

  // ============================================
  // 6. GUARDAR COSTO INDIVIDUAL
  // ============================================
  
  const saveCostDetail = async (costDetail: ServiceCostDetail) => {
    // Si no hay serviceId, el costo se guardará cuando se cree el servicio
    if (!serviceId) {
      console.log('No serviceId, cost will be saved on service creation');
      return;
    }

    // Validaciones
    if (!costDetail.category_id) {
      toast.error("Debe seleccionar una categoría");
      return;
    }

    const requiredSubcategories = getSubcategoriesForCategory(costDetail.category_id);
    if (requiredSubcategories.length > 0 && !costDetail.subcategory?.trim()) {
      toast.error("Debe seleccionar una subcategoría");
      return;
    }

    if (!costDetail.description.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }

    if (costDetail.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    // Preparar datos para guardar
    const costData = {
      service_id: serviceId,
      category_id: costDetail.category_id,
      description: costDetail.description.trim(),
      amount: costDetail.amount,
      // ⚠️ CRÍTICO: Preservar fecha original en edición
      date: costDetail.isExisting && costDetail.date 
        ? costDetail.date 
        : getCurrentChileDateString(),
      notes: costDetail.notes || '',
      subcategory: costDetail.subcategory || ''
    };

    if (costDetail.isExisting) {
      // Actualizar costo existente
      updateCost({ id: costDetail.id, ...costData }, {
        onSuccess: () => {
          refetchCosts();
          toast.success("Costo actualizado correctamente");
        },
        onError: (error) => {
          toast.error("Error al actualizar el costo");
        }
      });
    } else {
      // Crear nuevo costo
      addCost(costData, {
        onSuccess: (data) => {
          // Actualizar con el ID real de la BD
          if (data && data[0]) {
            updateCostDetail(costDetail.id, 'id', data[0].id);
            updateCostDetail(costDetail.id, 'isExisting', true);
          }
          refetchCosts();
          toast.success("Costo agregado correctamente");
        },
        onError: (error) => {
          toast.error("Error al agregar el costo");
        }
      });
    }
  };

  // ============================================
  // 7. SUBCATEGORÍAS DINÁMICAS
  // ============================================
  
  useEffect(() => {
    const loadSubcategoriesForCategories = async () => {
      const uniqueCategoryIds = [...new Set(
        costDetails.map(cost => cost.category_id).filter(Boolean)
      )];
      
      for (const categoryId of uniqueCategoryIds) {
        if (!subcategoriesCache[categoryId]) {
          const { data } = await supabase
            .from('cost_subcategories')
            .select('name')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('display_order', { ascending: true });
          
          if (data) {
            setSubcategoriesCache(prev => ({
              ...prev,
              [categoryId]: data.map(sub => sub.name)
            }));
          }
        }
      }
    };

    if (costDetails.length > 0) {
      loadSubcategoriesForCategories();
    }
  }, [costDetails.map(c => c.category_id).join(',')]);

  const getSubcategoriesForCategory = (categoryId: string): string[] => {
    if (!categoryId) return [];
    return subcategoriesCache[categoryId] || [];
  };

  // ============================================
  // 8. CÁLCULOS DE RESUMEN
  // ============================================
  
  const getTotalCosts = () => {
    return costDetails.reduce((total, cost) => total + (cost.amount || 0), 0);
  };

  const getCostsByCategory = () => {
    return costDetails.reduce((acc, cost) => {
      const categoryName = nonCommissionCategories.find(
        cat => cat.id === cost.category_id
      )?.name || 'Sin categoría';
      
      if (!acc[categoryName]) acc[categoryName] = 0;
      acc[categoryName] += cost.amount || 0;
      return acc;
    }, {} as Record<string, number>);
  };

  // ... render del componente
};
```

---

## Estructura del Componente (UI)

```tsx
return (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Receipt className="h-5 w-5" />
        Costos Detallados del Servicio
      </CardTitle>
      
      {/* Aviso sobre comisiones */}
      <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg text-sm">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div className="text-muted-foreground">
          <strong>Nota:</strong> Las comisiones de operadores se manejan en la sección 
          "Operadores del Servicio". Esta sección es para otros costos operacionales 
          como combustible, peajes, materiales, etc.
        </div>
      </div>
    </CardHeader>
    
    <CardContent className="space-y-4">
      {/* Lista de costos */}
      {costDetails.map((cost, index) => (
        <div key={cost.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
          {/* Header del costo */}
          <div className="flex justify-between items-center">
            <h4 className="font-medium">
              Costo {index + 1}
              {cost.isExisting && (
                <span className="text-xs text-green-600 ml-2">(Guardado)</span>
              )}
            </h4>
            <div className="flex gap-2">
              {/* Botón Guardar/Actualizar (solo si hay serviceId) */}
              {serviceId && !disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveCostDetail(cost)}
                  disabled={!cost.category_id || !cost.description.trim() || cost.amount <= 0}
                  className="text-blue-600"
                >
                  {cost.isExisting ? 'Actualizar' : 'Guardar'}
                </Button>
              )}
              
              {/* Botón Eliminar */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeCostDetail(cost.id)}
                disabled={disabled}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Campos del costo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Categoría */}
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select
                value={cost.category_id}
                onValueChange={(value) => updateCostDetail(cost.id, 'category_id', value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {nonCommissionCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategoría (condicional) */}
            {cost.category_id && getSubcategoriesForCategory(cost.category_id).length > 0 && (
              <div className="space-y-2">
                <Label>Subcategoría *</Label>
                <Select
                  value={cost.subcategory || ''}
                  onValueChange={(value) => updateCostDetail(cost.id, 'subcategory', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar subcategoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubcategoriesForCategory(cost.category_id).map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Descripción */}
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Input
                value={cost.description}
                onChange={(e) => updateCostDetail(cost.id, 'description', e.target.value)}
                placeholder="Ej: Combustible, peajes, etc."
                disabled={disabled}
              />
            </div>

            {/* Cantidad */}
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={cost.quantity || 1}
                onChange={(e) => updateCostDetail(cost.id, 'quantity', Number(e.target.value))}
                min="0"
                step="0.01"
                disabled={disabled}
              />
            </div>

            {/* Precio Unitario */}
            <div className="space-y-2">
              <Label>Precio Unitario (CLP)</Label>
              <Input
                type="number"
                value={cost.unitPrice || 0}
                onChange={(e) => updateCostDetail(cost.id, 'unitPrice', Number(e.target.value))}
                min="0"
                disabled={disabled}
              />
            </div>

            {/* Monto Total (calculado automáticamente) */}
            <div className="space-y-2">
              <Label>Monto Total (CLP) *</Label>
              <Input
                type="number"
                value={cost.amount}
                onChange={(e) => updateCostDetail(cost.id, 'amount', Number(e.target.value))}
                min="0"
                disabled={disabled}
                className="font-semibold"
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={cost.notes || ''}
                onChange={(e) => updateCostDetail(cost.id, 'notes', e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Footer: Agregar + Resumen */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={addCostDetail}
          disabled={disabled || isAddingCost}
          className="flex items-center gap-2 bg-green-100 hover:bg-green-200"
        >
          <Plus className="h-4 w-4" />
          {isAddingCost ? 'Agregando...' : 'Agregar Costo'}
        </Button>

        {/* Total de costos */}
        <div className="text-right space-y-1">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <Label className="text-sm text-muted-foreground">Total Costos:</Label>
          </div>
          <div className="text-lg font-semibold text-blue-600">
            ${getTotalCosts().toLocaleString('es-CL')} CLP
          </div>
        </div>
      </div>

      {/* Resumen por categoría */}
      {costDetails.length > 0 && (
        <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
          <h5 className="font-medium mb-2">Resumen por Categoría:</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(getCostsByCategory()).map(([category, amount]) => (
              <div key={category} className="flex justify-between">
                <span className="text-muted-foreground">{category}:</span>
                <span className="font-medium">${amount.toLocaleString('es-CL')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);
```

---

## Hook useServiceCosts

```typescript
// src/hooks/useServiceCosts.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost } from '@/types/costs';

const fetchServiceCosts = async (serviceId: string): Promise<Cost[]> => {
  // Consulta simple sin JOINs para evitar duplicados
  const { data: costsData, error } = await supabase
    .from('costs')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  if (!costsData || costsData.length === 0) {
    return [];
  }

  // Obtener datos relacionados por separado para evitar duplicados
  const categoryIds = [...new Set(costsData.map(c => c.category_id).filter(Boolean))];
  const { data: categories } = await supabase
    .from('cost_categories')
    .select('id, name')
    .in('id', categoryIds);

  const craneIds = [...new Set(costsData.map(c => c.crane_id).filter(Boolean))];
  const { data: cranes } = await supabase
    .from('cranes')
    .select('id, license_plate, brand, model')
    .in('id', craneIds);

  const operatorIds = [...new Set(costsData.map(c => c.operator_id).filter(Boolean))];
  const { data: operators } = await supabase
    .from('operators')
    .select('id, name, rut')
    .in('id', operatorIds);

  // Enriquecer costos con datos relacionados
  const enrichedCosts = costsData.map(cost => ({
    ...cost,
    cost_categories: categories?.find(cat => cat.id === cost.category_id) || null,
    cranes: cranes?.find(crane => crane.id === cost.crane_id) || null,
    operators: operators?.find(op => op.id === cost.operator_id) || null
  }));

  return enrichedCosts as Cost[];
};

export const useServiceCosts = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service-costs', serviceId],
    queryFn: () => fetchServiceCosts(serviceId!),
    enabled: !!serviceId,
    refetchOnWindowFocus: true,
    staleTime: 0, // Siempre refetch para datos actualizados
    gcTime: 0,    // No mantener en caché
    refetchOnMount: 'always',
  });
};
```

---

## Integración en EnhancedServiceForm

```typescript
// src/components/services/EnhancedServiceForm.tsx

import { ServiceCostDetailsSection } from './form/ServiceCostDetailsSection';

// Dentro del formulario (Paso 3: Recursos o Paso 4: Financiero)
<ServiceCostDetailsSection
  serviceId={editingService?.id}  // undefined para nuevo servicio
  costDetails={formData.costDetails || []}
  onCostDetailsChange={(costs) => setFormData(prev => ({ 
    ...prev, 
    costDetails: costs 
  }))}
  disabled={isSubmitting}
/>
```

---

## Flujo de Datos

### 1. Crear Nuevo Servicio
```
1. Usuario abre "Nuevo Servicio"
2. ServiceCostDetailsSection se monta con costDetails=[] y serviceId=undefined
3. Usuario agrega costos → se agregan al estado local (id: "temp-xxx")
4. Al guardar servicio:
   a. Se crea el servicio → obtiene serviceId
   b. Se iteran los costDetails y se guardan con service_id
   c. Se actualizan los IDs temporales por los reales
```

### 2. Editar Servicio Existente
```
1. Usuario abre "Editar Servicio"
2. ServiceCostDetailsSection se monta con serviceId=xxx
3. useServiceCosts(serviceId) carga costos existentes
4. useEffect mapea costos a costDetails con isExisting=true
5. Usuario puede:
   - Editar y "Actualizar" → updateCost()
   - Eliminar → deleteCost()
   - Agregar nuevos → addCost()
```

### 3. Preservación de Fechas
```typescript
// ⚠️ REGLA CRÍTICA
date: costDetail.isExisting && costDetail.date 
  ? costDetail.date           // Preservar fecha original
  : getCurrentChileDateString() // Solo para nuevos costos
```

---

## Reglas de Negocio

### 1. Exclusión de Comisiones
Los costos de categoría "Comisión Operador" se excluyen automáticamente de esta sección. Se gestionan en `MultipleOperatorsSection` junto con la asignación de operadores.

```typescript
const commissionCategoryId = categories.find(cat => 
  cat.name.toLowerCase().includes('comisión') || 
  cat.name.toLowerCase().includes('comision')
)?.id;

const nonCommissionCategories = categories.filter(cat => 
  !cat.name.toLowerCase().includes('comisión')
);
```

### 2. Validaciones Requeridas
- **Categoría**: Obligatorio
- **Subcategoría**: Obligatorio si la categoría tiene subcategorías
- **Descripción**: Obligatorio, no puede estar vacío
- **Monto**: Obligatorio, debe ser > 0

### 3. Cálculo Automático de Monto
```typescript
if (field === 'quantity' || field === 'unitPrice') {
  updated.amount = (updated.quantity || 1) * (updated.unitPrice || 0);
}
```

### 4. Estados de Guardado
- **Nuevo (temp-xxx)**: No guardado en BD, botón muestra "Guardar"
- **Existente (UUID)**: Guardado en BD, botón muestra "Actualizar", badge "(Guardado)"

---

## Esquema de Base de Datos

```sql
-- Tabla costs con relación a servicios
CREATE TABLE public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  category_id UUID NOT NULL REFERENCES cost_categories(id),
  subcategory TEXT,
  notes TEXT,
  
  -- Asociación al servicio
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  service_folio TEXT,
  
  -- Otras asociaciones opcionales
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  
  -- Auditoría
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda rápida por servicio
CREATE INDEX idx_costs_service_id ON costs(service_id);

-- RLS: Eliminar costos cuando se elimina el servicio
-- (Ya configurado con ON DELETE CASCADE)
```

---

## Dependencias

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "@supabase/supabase-js": "^2.x",
    "lucide-react": "^0.4x",
    "sonner": "^1.x",
    "date-fns": "^4.x",
    "lodash": "^4.x" // Para debounce
  }
}
```

---

## Notas de Implementación

### 1. Prevención de Doble Clic
```typescript
const [isAddingCost, setIsAddingCost] = useState(false);

const addCostDetail = () => {
  if (isAddingCost) return;
  setIsAddingCost(true);
  // ... agregar costo
  setTimeout(() => setIsAddingCost(false), 300);
};
```

### 2. Cache de Subcategorías
Las subcategorías se cargan dinámicamente y se cachean para evitar múltiples llamadas a la BD.

### 3. Refetch Forzado
El hook usa `staleTime: 0` y `gcTime: 0` para asegurar datos actualizados siempre.

### 4. Modo Disabled
Cuando el servicio está en estado "Cerrado" o "Facturado", la sección se deshabilita completamente.

---

## Estructura de Archivos

```
src/
├── components/
│   └── services/
│       └── form/
│           └── ServiceCostDetailsSection.tsx
├── hooks/
│   ├── useServiceCosts.ts
│   ├── useCosts.ts (useAddCost, useUpdateCost, useDeleteCost)
│   └── useCostCategories.ts
├── types/
│   └── serviceDetails.ts (ServiceCostDetail)
└── utils/
    └── timezoneUtils.ts (getCurrentChileDateString)
```
