# Estandarización del manejo de `clientCoveredAmount` en Servicios

## Problema Identificado y Solucionado

### Inconsistencia en el manejo de valores nulos
Los hooks de servicios manejaban `clientCoveredAmount` de manera inconsistente:

1. **useServiceManager.ts**: Convertía `null` a `0` usando `|| 0`
2. **useServiceTransformer.ts**: Preservaba correctamente `null` usando `?? null`
3. **useServiceQueries.ts**: Preservaba correctamente `null` por asignación directa

### Impacto del Problema
Esta inconsistencia causaba que servicios con exceso (`hasExcess: true`) pero sin monto cubierto por cliente (`clientCoveredAmount: null`) aparecieran con valor `0` en lugar de `null`, afectando la lógica de cálculo en `getServiceValueForClosure`.

## Solución Implementada

### 1. Estandarización de Transformaciones
Todos los hooks ahora preservan valores `null` para `clientCoveredAmount`:

```typescript
// ANTES (incorrecto en useServiceManager)
clientCoveredAmount: data.client_covered_amount || 0,

// DESPUÉS (correcto en todos los hooks)
clientCoveredAmount: data.client_covered_amount ?? null,
```

### 2. Fortalecimiento de `getServiceValueForClosure`
- Agregada validación de entrada robusta
- Documentación clara de la lógica de prioridades de negocio
- Manejo consistente de ambas convenciones de nombres (camelCase/snake_case)
- Preservación correcta de valores `null`

### 3. Documentación de la Lógica de Negocio
La función `getServiceValueForClosure` ahora documenta claramente sus prioridades:

1. **Servicios de custodia**: Usar `custody_total_amount`
2. **Servicios con exceso**: Usar `client_covered_amount` solo si no es `null` y > 0
3. **Servicios regulares**: Usar `service.value`

## Prevención de Regresiones

### Consistencia en Transformaciones
- Todos los hooks usan el operador `??` para preservar `null`
- Documentación clara en cada transformación
- Comentarios explicativos sobre el por qué de preservar `null`

### Validaciones en Tiempo de Desarrollo
- Función `getServiceValueForClosure` valida entrada
- Warnings en consola para casos edge
- Documentación técnica completa

## Archivos Modificados

1. **src/hooks/services/useServiceManager.ts**: Corregida transformación de `clientCoveredAmount`
2. **src/utils/serviceValueCalculations.ts**: Mejorada función de cálculo con validaciones
3. **docs/services/client-covered-amount-standardization.md**: Esta documentación

## Resultado

✅ **Solución Definitiva**: Todos los servicios con exceso ahora muestran correctamente sus valores calculados
✅ **No más regresiones**: Lógica estandarizada y documentada
✅ **Mantenimiento fácil**: Un patrón consistente en todas las transformaciones

## Casos de Prueba

| Caso | `hasExcess` | `clientCoveredAmount` | `custody_total_amount` | `value` | Resultado Esperado |
|------|-------------|---------------------|----------------------|---------|-------------------|
| Servicio regular | `false` | `null` | `null` | `1000` | `1000` |
| Servicio con exceso sin cobertura | `true` | `null` | `null` | `1000` | `1000` |
| Servicio con exceso con cobertura | `true` | `500` | `null` | `1000` | `500` |
| Servicio de custodia | `false` | `null` | `2000` | `1000` | `2000` |

Esta estandarización asegura que la lógica de cálculo de valores para cierres funcione correctamente en todos los casos.