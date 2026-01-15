# Prompt: Costos Detallados del Servicio

## Descripción General

Sistema de registro de costos operacionales **dentro del formulario de +Nuevo Servicio / Editar Servicio**. Permite agregar múltiples costos con **subcategorías dinámicas** que cambian según la categoría seleccionada.

### Características Clave

- **Subcategorías dinámicas**: Al seleccionar una categoría, se cargan automáticamente sus subcategorías desde la base de datos
- **Ejemplo de flujo**:
  - Usuario selecciona **"Gastos de Servicios"** → Aparecen subcategorías: Combustible, Peajes, Viáticos, Estacionamiento, etc.
  - Usuario selecciona **"Mantenimiento"** → Aparecen subcategorías: Piezas y Repuestos, Mano de obra, Lubricantes, etc.
- **Cálculo automático**: `monto = cantidad × precio unitario`
- **Guardado individual**: Cada costo se puede guardar independientemente (para servicios existentes)
- **Exclusión de comisiones**: Las comisiones de operadores se manejan en otra sección

---

## Flujo de Subcategorías Dinámicas

### Estructura de Categorías y Subcategorías (desde BD)

```
Gastos de Servicios
├── Combustible
├── Peajes
├── Viáticos
├── Estacionamiento
├── Materiales
├── Transporte
├── Hospedaje
└── Otros

Mantenimiento
├── Piezas y Repuestos
├── Mano de obra
├── Servicios externos
├── Lubricantes y Fluidos
├── Herramientas
└── Otros

Impuestos
├── Convenios
└── IVA

Leasing Operativo
└── Cuota Leasing

Inventario
└── (Sin subcategorías - usa campos especiales)
```

---

## Interfaces TypeScript

```typescript
// Interfaz principal para cada costo del servicio
interface ServiceCostDetail {
  id: string;                    // UUID o 'temp-{timestamp}' para nuevos
  description: string;           // Descripción del costo (requerido)
  amount: number;                // Monto total calculado (requerido)
  quantity?: number;             // Cantidad (default: 1)
  unitPrice?: number;            // Precio unitario
  notes?: string;                // Notas adicionales
  category_id: string;           // FK a cost_categories (requerido)
  subcategory?: string;          // Nombre de subcategoría (texto)
  date?: string;                 // Fecha del costo (YYYY-MM-DD)
  isExisting?: boolean;          // true si ya está guardado en BD
}

// Props del componente
interface ServiceCostDetailsSectionProps {
  serviceId?: string;            // ID del servicio (undefined para nuevos)
  costDetails: ServiceCostDetail[];
  onCostDetailsChange: (costDetails: ServiceCostDetail[]) => void;
  disabled?: boolean;            // Deshabilitar edición
}
```

---

## Componente Principal: ServiceCostDetailsSection

### Ubicación
```
src/components/services/form/ServiceCostDetailsSection.tsx
```

### Código Completo

```tsx
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
import { debounce } from 'lodash';
import { supabase } from '@/integrations/supabase/client';

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

interface ServiceCostDetailsSectionProps {
  serviceId?: string;
  costDetails: ServiceCostDetail[];
  onCostDetailsChange: (costDetails: ServiceCostDetail[]) => void;
  disabled?: boolean;
}

export const ServiceCostDetailsSection = ({
  serviceId,
  costDetails,
  onCostDetailsChange,
  disabled = false
}: ServiceCostDetailsSectionProps) => {
  
  const { data: categories = [] } = useCostCategories();
  const { data: existingCosts, isLoading: existingCostsLoading, refetch: refetchCosts } = useServiceCosts(serviceId || null);
  const { mutate: addCost } = useAddCost();
  const { mutate: updateCost } = useUpdateCost();
  const { mutate: deleteCost } = useDeleteCost();

  // ✅ Cache de subcategorías para cargar dinámicamente
  const [subcategoriesCache, setSubcategoriesCache] = useState<Record<string, string[]>>({});
  
  // ✅ Estado para prevenir doble clic
  const [isAddingCost, setIsAddingCost] = useState(false);

  // Filtrar categorías de comisión (se manejan en otra sección)
  const commissionCategoryId = categories.find(cat => 
    cat.name.toLowerCase().includes('comisión') || 
    cat.name.toLowerCase().includes('comision')
  )?.id;

  const nonCommissionCategories = categories.filter(cat => 
    !cat.name.toLowerCase().includes('comisión') && 
    !cat.name.toLowerCase().includes('comision')
  );

  const filteredExistingCosts = existingCosts?.filter(cost => 
    cost.category_id !== commissionCategoryId
  ) || [];

  // ✅ Cargar costos existentes al editar (excluyendo comisiones)
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
        date: cost.date, // ✅ Preservar fecha original
        isExisting: true
      }));
      
      onCostDetailsChange(mappedCosts);
    }
  }, [serviceId, categories.length, filteredExistingCosts.length, costDetails.length, existingCostsLoading]);

  // ✅ Cargar subcategorías dinámicamente cuando cambia la categoría
  useEffect(() => {
    const loadSubcategoriesForCategories = async () => {
      const uniqueCategoryIds = [...new Set(costDetails.map(cost => cost.category_id).filter(Boolean))];
      
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

  // ✅ Obtener subcategorías desde cache
  const getSubcategoriesForCategory = (categoryId: string): string[] => {
    if (!categoryId) return [];
    return subcategoriesCache[categoryId] || [];
  };

  // ✅ Agregar nuevo costo con protección anti-doble-clic
  const addCostDetail = () => {
    if (isAddingCost) return;
    
    setIsAddingCost(true);
    
    const newCostDetail: ServiceCostDetail = {
      id: `temp-${Date.now()}`,
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

  // ✅ Eliminar costo
  const removeCostDetail = async (id: string) => {
    const costToRemove = costDetails.find(cost => cost.id === id);
    
    if (costToRemove?.isExisting && serviceId) {
      // Eliminar de BD si es costo existente
      deleteCost(id, {
        onSuccess: () => {
          onCostDetailsChange(costDetails.filter(cost => cost.id !== id));
          refetchCosts();
          toast.success("Costo eliminado correctamente");
        },
        onError: (error) => {
          console.error('Error deleting cost:', error);
          toast.error("Error al eliminar el costo");
        }
      });
    } else {
      // Solo remover del estado local si es nuevo
      onCostDetailsChange(costDetails.filter(cost => cost.id !== id));
    }
  };

  // ✅ Actualizar campo de costo con cálculo automático
  const updateCostDetail = (id: string, field: keyof ServiceCostDetail, value: any) => {
    onCostDetailsChange(
      costDetails.map(cost => {
        if (cost.id === id) {
          const updated = { ...cost, [field]: value };
          
          // ✅ Auto-calcular amount si cambia quantity o unitPrice
          if (field === 'quantity' || field === 'unitPrice') {
            const quantity = field === 'quantity' ? value : updated.quantity || 1;
            const unitPrice = field === 'unitPrice' ? value : updated.unitPrice || 0;
            updated.amount = quantity * unitPrice;
          }
          
          // ✅ Limpiar subcategoría si cambia la categoría
          if (field === 'category_id') {
            updated.subcategory = '';
          }
          
          return updated;
        }
        return cost;
      })
    );
  };

  // ✅ Guardar costo individual (para servicios existentes)
  const saveCostDetail = async (costDetail: ServiceCostDetail) => {
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

    const costData = {
      service_id: serviceId,
      category_id: costDetail.category_id,
      description: costDetail.description.trim(),
      amount: costDetail.amount,
      date: costDetail.isExisting && costDetail.date ? costDetail.date : getCurrentChileDateString(),
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
          console.error('Error updating cost:', error);
          toast.error("Error al actualizar el costo");
        }
      });
    } else {
      // Agregar nuevo costo
      addCost(costData, {
        onSuccess: (data) => {
          if (data && data[0]) {
            updateCostDetail(costDetail.id, 'id', data[0].id);
            updateCostDetail(costDetail.id, 'isExisting', true);
          }
          refetchCosts();
          toast.success("Costo agregado correctamente");
        },
        onError: (error) => {
          console.error('Error adding cost:', error);
          toast.error("Error al agregar el costo");
        }
      });
    }
  };

  // ✅ Cálculos de resumen
  const getTotalCosts = () => {
    return costDetails.reduce((total, cost) => total + (cost.amount || 0), 0);
  };

  const getCostsByCategory = () => {
    const grouped = costDetails.reduce((acc, cost) => {
      const categoryName = nonCommissionCategories.find(cat => cat.id === cost.category_id)?.name || 'Sin categoría';
      if (!acc[categoryName]) acc[categoryName] = 0;
      acc[categoryName] += cost.amount || 0;
      return acc;
    }, {} as Record<string, number>);
    return grouped;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Costos Detallados del Servicio
        </CardTitle>
        {/* Nota informativa sobre comisiones */}
        <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg text-sm">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-muted-foreground">
            <strong>Nota:</strong> Las comisiones de operadores se manejan en la sección "Operadores del Servicio". 
            Esta sección es para otros costos operacionales como combustible, peajes, materiales, etc.
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {costDetails.map((cost, index) => (
          <div key={cost.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">
                Costo {index + 1} 
                {cost.isExisting && <span className="text-xs text-green-600 ml-2">(Guardado)</span>}
              </h4>
              <div className="flex gap-2">
                {serviceId && !disabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveCostDetail(cost)}
                    disabled={!cost.category_id || !cost.description.trim() || cost.amount <= 0}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {cost.isExisting ? 'Actualizar' : 'Guardar'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeCostDetail(cost.id)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

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

              {/* ✅ Subcategoría dinámica - Solo aparece si hay subcategorías */}
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
                      {getSubcategoriesForCategory(cost.category_id).map((subcategory) => (
                        <SelectItem key={subcategory} value={subcategory}>
                          {subcategory}
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
                  placeholder="Ej: Combustible viaje Santiago"
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
                  placeholder="1"
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
                  placeholder="0"
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
                  placeholder="0"
                  min="0"
                  disabled={disabled}
                  className="font-semibold"
                />
              </div>

              {/* Notas */}
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
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

        {/* Botón para agregar costo */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={addCostDetail}
            disabled={disabled || isAddingCost}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 border-green-300 hover:border-green-400"
          >
            <Plus className="h-4 w-4" />
            Agregar Costo
          </Button>

          {/* Resumen de costos */}
          {costDetails.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-lg">
                  ${getTotalCosts().toLocaleString('es-CL')} CLP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Desglose por categoría */}
        {costDetails.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h5 className="text-sm font-medium mb-2">Desglose por Categoría:</h5>
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
};
```

---

## Hooks Necesarios

### 1. useCostCategories

```typescript
// src/hooks/useCostCategories.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CostCategory {
  id: string;
  name: string;
  description?: string;
}

export const useCostCategories = () => {
  return useQuery({
    queryKey: ['cost-categories'],
    queryFn: async (): Promise<CostCategory[]> => {
      const { data, error } = await supabase
        .from('cost_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
```

### 2. useCostSubcategories

```typescript
// src/hooks/useCostSubcategories.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CostSubcategory {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  display_order: number;
}

export const useCostSubcategories = (categoryId?: string) => {
  return useQuery({
    queryKey: ['cost-subcategories', categoryId],
    queryFn: async (): Promise<CostSubcategory[]> => {
      if (!categoryId) return [];
      
      const { data, error } = await supabase
        .from('cost_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!categoryId,
  });
};
```

### 3. useServiceCosts

```typescript
// src/hooks/useServiceCosts.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ServiceCost {
  id: string;
  service_id: string;
  category_id: string;
  description: string;
  amount: number;
  date: string;
  notes?: string;
  subcategory?: string;
}

export const useServiceCosts = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service-costs', serviceId],
    queryFn: async (): Promise<ServiceCost[]> => {
      if (!serviceId) return [];

      // ✅ Consulta sin JOINs para evitar duplicados
      const { data, error } = await supabase
        .from('costs')
        .select('id, service_id, category_id, description, amount, date, notes, subcategory')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!serviceId,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
};
```

### 4. useCosts (CRUD)

```typescript
// src/hooks/useCosts.ts (extracto relevante)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAddCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (costData: any) => {
      const { data, error } = await supabase
        .from('costs')
        .insert([costData])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    },
  });
};

export const useUpdateCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...costData }: any) => {
      const { data, error } = await supabase
        .from('costs')
        .update(costData)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    },
  });
};

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
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    },
  });
};
```

---

## Esquema de Base de Datos

### Tablas Requeridas

```sql
-- Categorías de costos
CREATE TABLE public.cost_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insertar categorías base
INSERT INTO cost_categories (name, description) VALUES
  ('Gastos de Servicios', 'Gastos operacionales de servicios'),
  ('Mantenimiento', 'Costos de mantenimiento de equipos'),
  ('Impuestos', 'Impuestos y tasas'),
  ('Leasing Operativo', 'Cuotas de leasing'),
  ('Inventario', 'Compras de inventario'),
  ('Comisión', 'Comisiones de operadores');

-- Subcategorías dinámicas
CREATE TABLE public.cost_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES cost_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas
CREATE INDEX idx_cost_subcategories_category ON cost_subcategories(category_id);
CREATE INDEX idx_cost_subcategories_active ON cost_subcategories(category_id, is_active);

-- Insertar subcategorías para "Gastos de Servicios"
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Combustible', 1 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Peajes', 2 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Viáticos', 3 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Estacionamiento', 4 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Materiales', 5 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Transporte', 6 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Hospedaje', 7 FROM cost_categories WHERE name = 'Gastos de Servicios';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Otros', 99 FROM cost_categories WHERE name = 'Gastos de Servicios';

-- Insertar subcategorías para "Mantenimiento"
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Piezas y Repuestos', 1 FROM cost_categories WHERE name = 'Mantenimiento';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Mano de obra', 2 FROM cost_categories WHERE name = 'Mantenimiento';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Servicios externos', 3 FROM cost_categories WHERE name = 'Mantenimiento';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Lubricantes y Fluidos', 4 FROM cost_categories WHERE name = 'Mantenimiento';
INSERT INTO cost_subcategories (category_id, name, display_order) 
SELECT id, 'Herramientas', 5 FROM cost_categories WHERE name = 'Mantenimiento';

-- Tabla principal de costos
CREATE TABLE public.costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES cost_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  subcategory TEXT,
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  supplier_id UUID REFERENCES suppliers(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Índices para performance
CREATE INDEX idx_costs_service_id ON costs(service_id);
CREATE INDEX idx_costs_category_id ON costs(category_id);
CREATE INDEX idx_costs_date ON costs(date);

-- RLS (Row Level Security)
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all costs" ON costs FOR SELECT USING (true);
CREATE POLICY "Users can insert costs" ON costs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update costs" ON costs FOR UPDATE USING (true);
CREATE POLICY "Users can delete costs" ON costs FOR DELETE USING (true);
```

---

## Integración en EnhancedServiceForm

```tsx
// src/components/services/EnhancedServiceForm.tsx (extracto)

import { ServiceCostDetailsSection } from './form/ServiceCostDetailsSection';

// Dentro del componente:
const [formData, setFormData] = useState({
  // ... otros campos
  costDetails: [] as ServiceCostDetail[],
});

// En el render, después de la sección de operadores:
{selectedServiceType?.name !== 'Venta de Productos' && (
  <ServiceCostDetailsSection
    costDetails={formData.costDetails || []}
    onCostDetailsChange={(costs) => setFormData(prev => ({ 
      ...prev, 
      costDetails: costs 
    }))}
    serviceId={service?.id}
    disabled={false}
  />
)}
```

---

## Reglas de Negocio

1. **Exclusión de Comisiones**: Las categorías que contengan "Comisión" o "comision" se filtran automáticamente. Las comisiones de operadores se manejan en `MultipleOperatorsSection`.

2. **Validaciones Requeridas**:
   - Categoría: Obligatoria
   - Subcategoría: Obligatoria si la categoría tiene subcategorías definidas
   - Descripción: Obligatoria (no vacía)
   - Monto: Debe ser mayor a 0

3. **IDs Temporales**: Los costos nuevos usan IDs con prefijo `temp-{timestamp}`. Al guardar, se reemplazan por UUIDs de la BD.

4. **Preservación de Fechas**: Al editar costos existentes, se mantiene la fecha original. Solo los costos nuevos usan la fecha actual.

5. **Guardado Individual vs. Masivo**:
   - **Servicio existente** (`serviceId` presente): Cada costo tiene botón "Guardar" individual
   - **Servicio nuevo** (`serviceId` undefined): Los costos se guardan al crear el servicio

---

## UI/UX Detallado

### Estructura Visual

```
┌─────────────────────────────────────────────────────────────┐
│ 📄 Costos Detallados del Servicio                          │
├─────────────────────────────────────────────────────────────┤
│ ℹ️ Nota: Las comisiones de operadores se manejan en la     │
│    sección "Operadores del Servicio"...                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Costo 1 (Guardado)                    [Actualizar] [🗑] │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ [Categoría ▼]  [Subcategoría ▼]  [Descripción_______]  │ │
│ │ [Cantidad___]  [P. Unitario___]  [Monto Total______]   │ │
│ │ [Notas________________________________________________] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Costo 2                               [Guardar] [🗑]    │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [+ Agregar Costo]                    🧮 Total: $150.000 CLP │
├─────────────────────────────────────────────────────────────┤
│ Desglose por Categoría:                                     │
│ Gastos de Servicios: $100.000  │  Mantenimiento: $50.000   │
└─────────────────────────────────────────────────────────────┘
```

### Comportamiento del Select de Subcategoría

1. **Estado inicial**: Campo de subcategoría NO aparece
2. **Usuario selecciona categoría**: 
   - Se consulta `cost_subcategories` para esa categoría
   - Si hay subcategorías activas → Aparece el Select
   - Si no hay subcategorías → El campo NO aparece
3. **Usuario cambia categoría**: Se limpia la subcategoría seleccionada

---

## Dependencias

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "lucide-react": "^0.400.0",
    "sonner": "^1.0.0",
    "date-fns": "^4.0.0",
    "lodash": "^4.17.0"
  }
}
```

---

## Estructura de Archivos Recomendada

```
src/
├── components/
│   └── services/
│       └── form/
│           └── ServiceCostDetailsSection.tsx
├── hooks/
│   ├── useCostCategories.ts
│   ├── useCostSubcategories.ts
│   ├── useServiceCosts.ts
│   └── useCosts.ts
├── types/
│   └── costs.ts
└── utils/
    └── timezoneUtils.ts
```

---

## Notas de Implementación

1. **Prevención de doble-clic**: El botón "Agregar Costo" usa estado `isAddingCost` con timeout de 300ms.

2. **Cache de subcategorías**: Se usa `subcategoriesCache` para evitar consultas repetidas a la BD.

3. **Refetch forzado**: `useServiceCosts` usa `staleTime: 0` y `gcTime: 0` para datos siempre frescos.

4. **Sin JOINs**: La consulta de costos existentes NO usa JOINs para evitar duplicados por relaciones one-to-many.

5. **Formato de moneda**: Usar `toLocaleString('es-CL')` para formato chileno con puntos como separador de miles.
