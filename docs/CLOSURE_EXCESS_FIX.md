# Fix para Cálculo de Totales en Cierres con Servicios con Exceso

## Problema Identificado

El sistema de cierre de servicios mostraba inconsistencias en el cálculo de totales cuando los servicios tenían excesos:

- Los servicios con exceso tienen un valor original (`service.value`) y un monto que el cliente cubre (`clientCoveredAmount`)
- El sistema calculaba los totales usando `service.value` pero en algunos lugares mostraba `clientCoveredAmount`
- Esto causaba confusión entre el monto mostrado en detalles del servicio y el incluido en el cierre

## Solución Implementada

### 1. Función Utilitaria Centralizada

Se creó `src/utils/serviceValueCalculations.ts` con:

- `getServiceValueForClosure(service: Service)`: Determina el valor correcto a usar para cierres
  - Si `hasExcess = true` y `clientCoveredAmount` existe → usa `clientCoveredAmount`
  - Si no → usa `service.value`
  
- `calculateClosureTotal(services: Service[])`: Calcula el total para un array de servicios usando la lógica anterior

### 2. Actualizaciones en Componentes

**ClosureForm.tsx:**
- Importa `calculateClosureTotal`
- Actualiza `handleServiceSelection` para usar el cálculo correcto

**EnhancedServicesSelector.tsx:**
- Importa `getServiceValueForClosure`
- Actualiza la visualización de valores en servicios pendientes y completados
- Muestra el monto correcto (con exceso si aplica)

**EditClosureForm.tsx:**
- Importa `getServiceValueForClosure`
- Actualiza la visualización en servicios actuales del cierre

**useEditClosure.ts:**
- Importa `calculateClosureTotal`
- Actualiza `updateClosureServices` para usar el cálculo correcto

### 3. Comportamiento Esperado

- **Servicios normales**: Se usa `service.value` como siempre
- **Servicios con exceso**: Se usa `clientCoveredAmount` en todos los cálculos y visualizaciones
- **Consistencia**: El monto mostrado en detalles del servicio coincide con el incluido en el cierre
- **Total correcto**: Los cierres muestran el monto total real que el cliente debe pagar

## Casos de Uso

### Ejemplo 1: Servicio sin exceso
- `service.value = 500000`
- `hasExcess = false`
- **Resultado**: Se usa `500000` en todos los cálculos

### Ejemplo 2: Servicio con exceso
- `service.value = 366749`
- `hasExcess = true`
- `clientCoveredAmount = 600000`
- **Resultado**: Se usa `600000` en todos los cálculos

## Archivos Modificados

1. `src/utils/serviceValueCalculations.ts` (nuevo)
2. `src/components/closures/ClosureForm.tsx`
3. `src/components/closures/EnhancedServicesSelector.tsx`
4. `src/components/closures/EditClosureForm.tsx`
5. `src/hooks/closures/useEditClosure.ts`

## Validación

Para validar que el fix funciona correctamente:

1. Crear un servicio con exceso configurado
2. Verificar que en los detalles del servicio se muestre el `clientCoveredAmount`
3. Incluir el servicio en un cierre
4. Verificar que el total del cierre incluya el `clientCoveredAmount`
5. El monto en la lista de servicios para cierre debe coincidir con el total