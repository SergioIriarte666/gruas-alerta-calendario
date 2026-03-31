

# Plan: Corregir Roles de Operadores y Comisiones Perdidas en Servicios Multi-Operador

## Problema Raíz

El hook `useEnhancedServiceDetails.ts` (líneas 138-200) **no lee `service_resources`** para construir la lista de operadores. En su lugar:

1. Toma el operador principal desde `services.operator_id` y le asigna `role: 'Principal'` hardcodeado
2. Busca operadores adicionales en la tabla `costs` (comisiones) y les asigna `role: 'Adicional'` hardcodeado

Esto causa:
- **Roles perdidos**: Los roles reales guardados en `service_resources` (Principal, Auxiliar, Supervisor, Apoyo) se ignoran completamente al editar
- **Comisiones perdidas**: Si un operador secundario no tiene comisión en `costs`, simplemente no aparece al editar, y al guardar se elimina de `service_resources`
- **Datos inconsistentes**: Al re-guardar un servicio, los roles se sobrescriben con "Principal" / "Adicional" genéricos

## Solución

### Paso 1: Modificar `useEnhancedServiceDetails.ts` — Leer desde `service_resources`

Agregar una consulta a `service_resources` como fuente primaria de operadores:

```typescript
// NUEVA consulta - obtener operadores reales desde service_resources
const { data: resourcesData } = await supabase
  .from('service_resources')
  .select('id, operator_id, role, commission_amount, is_primary, operators(id, name, rut, phone, ...)')
  .eq('service_id', serviceId)
  .eq('resource_type', 'operator');
```

Reemplazar la lógica actual (líneas 138-200) que construye operadores desde `services.operator_id` + `costs`:

- Si hay registros en `service_resources` → usarlos como fuente primaria (con roles y comisiones reales)
- Si no hay registros en `service_resources` (servicios legacy) → fallback al método actual (`services.operator_id` + costs)

Esto preserva los roles reales (Auxiliar, Supervisor, etc.) y garantiza que todos los operadores aparezcan al editar.

### Paso 2: No se requieren cambios en el formulario ni en `useServiceManager.ts`

El formulario (`MultipleOperatorsSection.tsx`) ya captura roles correctamente. El `useServiceManager.ts` ya guarda roles en `service_resources` correctamente (líneas 926-966). El problema es únicamente la **lectura** en `useEnhancedServiceDetails.ts`.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useEnhancedServiceDetails.ts` | Agregar consulta a `service_resources`, reemplazar lógica de construcción de operadores (líneas 138-200) |

## Impacto
- **Cero riesgo**: Solo cambia la lectura, no la escritura
- **No afecta costos**: La separación de costos vs comisiones sigue igual
- **No afecta triggers**: El trigger de generación de comisiones no se modifica
- **Backward compatible**: El fallback a `services.operator_id` mantiene compatibilidad con servicios antiguos sin `service_resources`

