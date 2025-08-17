# Sistema de Visualización de Valores de Servicios

## Descripción General

Este documento describe la implementación del sistema global para mostrar valores de servicios que incluye automáticamente la custodia cuando corresponde.

## Funcionalidad Principal

### `getServiceDisplayValue(service)`

Función principal que determina el valor total a mostrar para un servicio:

```typescript
export const getServiceDisplayValue = (service: any): number => {
  return getServiceValueForClosure(service);
};
```

Esta función utiliza internamente `getServiceValueForClosure()` que tiene la siguiente lógica de prioridad:

1. **Custody Total Amount**: Si el servicio tiene custodia, retorna `custody_total_amount`
2. **Client Covered Amount**: Para servicios con exceso, retorna `client_covered_amount`  
3. **Service Value**: Valor base del servicio

## Componentes Actualizados

Los siguientes componentes fueron actualizados para usar `getServiceDisplayValue()` en lugar de `service.value`:

### Componentes de Servicios
- `src/components/services/ServicesTable.tsx`
- `src/components/services/ServicesMobileView.tsx`
- `src/components/services/VehicleHistory.tsx`

### Componentes de Clientes
- `src/components/clients/ClientServiceHistory.tsx`

### Componentes de Dashboard
- `src/components/dashboard/RecentServicesTable.tsx`

### Componentes de Portal
- `src/components/portal/PortalServiceCard.tsx`

### Componentes de Grúas
- `src/components/cranes/CraneServiceHistory.tsx`

### Componentes de Cierres
- `src/components/closures/ServicesSelector.tsx`

## Ejemplo de Uso

```typescript
import { getServiceDisplayValue } from '@/utils/serviceValueCalculations';

// En lugar de usar service.value directamente
const oldWay = formatCurrency(service.value);

// Usar la nueva función
const newWay = formatCurrency(getServiceDisplayValue(service));
```

## Casos de Uso

### Servicio Regular
- **Valor del Servicio**: $100,000
- **Valor Mostrado**: $100,000

### Servicio con Custodia
- **Valor del Servicio**: $137,133
- **Custody Total Amount**: $207,133 (servicio + custodia $70,000)
- **Valor Mostrado**: $207,133

### Servicio con Exceso
- **Valor del Servicio**: $200,000
- **Client Covered Amount**: $150,000
- **Valor Mostrado**: $150,000

## Compatibilidad

La función `getServiceDisplayValue()` es compatible con:
- Servicios con campos en formato camelCase (`custodyTotalAmount`)
- Servicios con campos en formato snake_case (`custody_total_amount`)
- Objetos `Service` del tipo TypeScript
- Objetos de consultas directas de Supabase

## Beneficios

1. **Consistencia Global**: Todos los componentes muestran el mismo valor total
2. **Inclusión Automática de Custodia**: No es necesario recordar agregar custodia manualmente
3. **Mantenimiento Simplificado**: Un solo punto de cambio para la lógica de cálculo
4. **Retrocompatibilidad**: Funciona con servicios existentes sin custodia

## Migración

Para migrar código existente:

1. Importar la función: `import { getServiceDisplayValue } from '@/utils/serviceValueCalculations';`
2. Reemplazar `service.value` con `getServiceDisplayValue(service)`
3. Mantener el uso de `formatCurrency()` para el formato de visualización

## Notas Técnicas

- La función es compatible con servicios que no tienen custodia
- Maneja valores null/undefined de forma segura
- Retorna 0 si no encuentra ningún valor válido
- Es eficiente computacionalmente y no requiere consultas adicionales