# Corrección de Asignación de Subcategorías en Gastos de Servicios

## Problema Identificado
Los gastos de servicios (combustible, peajes, otros) no se estaban guardando con las subcategorías correctas en la base de datos. La tabla de costos mostraba subcategorías vacías para estos tipos de gastos.

## Causa Raíz
En `ServiceExpenseModals.tsx` línea 159, la lógica de asignación de subcategorías tenía dos problemas:

1. **Hardcodeo inconsistente**: 'otros' se mapeaba como "Viatico" en lugar de "Otros"
2. **Mapeo inconsistente**: No seguía las constantes definidas en `SERVICE_SUBCATEGORIES`

```typescript
// Código problemático
subcategory: subcategory === 'otros' ? 'Viatico' : subcategory.charAt(0).toUpperCase() + subcategory.slice(1),
```

## Solución Implementada

### 1. Función de Mapeo Explícito
Creada función `getSubcategoryName` para mapeo consistente:

```typescript
const getSubcategoryName = (section: string): string => {
  switch (section) {
    case 'combustible': return 'Combustible';
    case 'peajes': return 'Peajes';
    case 'otros': return 'Otros';
    default: return 'Otros';
  }
};
```

### 2. Importación de Constantes
Agregada importación de `SERVICE_SUBCATEGORIES` desde `types/costs.ts`:

```typescript
import { CostFormData, SERVICE_SUBCATEGORIES } from '@/types/costs';
```

### 3. Actualización de Lógica de Asignación
Reemplazada línea 159 con función de mapeo:

```typescript
// Antes
subcategory: subcategory === 'otros' ? 'Viatico' : subcategory.charAt(0).toUpperCase() + subcategory.slice(1),

// Después
subcategory: getSubcategoryName(subcategory),
```

### 4. Consistencia en UI
Actualizada función `getSectionTitle` para mostrar "Otros" en lugar de "Viatico":

```typescript
const getSectionTitle = (section: string) => {
  switch (section) {
    case 'combustible': return 'Combustible';
    case 'peajes': return 'Peajes';
    case 'otros': return 'Otros'; // Antes: 'Viatico'
    default: return section;
  }
};
```

## Resultado Esperado

Después de esta corrección:

- ✅ Los gastos de combustible ($18,611) aparecerán con subcategoría "Combustible"
- ✅ Los gastos de peajes ($3,350) aparecerán con subcategoría "Peajes"
- ✅ Los demás gastos aparecerán con subcategoría "Otros"
- ✅ La tabla de costos mostrará las subcategorías correctamente pobladas
- ✅ Consistencia total con las constantes definidas en `SERVICE_SUBCATEGORIES`

## Archivos Modificados
- `src/components/costs/ServiceExpenseModals.tsx`
  - Agregada función `getSubcategoryName`
  - Actualizada importación de constantes
  - Corregida asignación de subcategorías (línea 169)
  - Actualizada función `getSectionTitle`

## Validación
Para verificar la corrección, crear nuevos gastos de servicios y confirmar que:
1. La columna "Subcategoría" se llena automáticamente
2. Los valores coinciden exactamente con las constantes definidas
3. No hay más registros con subcategorías vacías para gastos de servicios