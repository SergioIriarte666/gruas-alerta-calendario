

# Plan: Reparación del Módulo de Comisiones

## Problemas Identificados

### 1. Comisiones pagadas aparecen como pendientes
**Causa raíz**: La función `get_commissions_with_details()` filtra por `cc.name = 'Comisión Operador' OR c.subcategory IN ('comisiones', 'comisiones_pagadas')`. Sin embargo, la migración `20260104` normalizó todas las subcategorías a `'Comisión Operador'`, así que las comisiones antiguas ya no coinciden con `'comisiones_pagadas'`. El estado `paid/pending` se determina correctamente por `payment_date`, pero el frontend tiene un flujo paralelo (`fetchMainOperatorCommissionsFromServices`) que genera comisiones "fantasma" con `status: 'pending'` leyendo directamente de la tabla `services` — sin consultar si ya existe un registro pagado en `costs`.

### 2. Comisiones que no aparecen
**Causa raíz**: El trigger `generate_commission_on_service_completion` solo busca operadores con `role = 'Principal'` en `service_resources`. Si un servicio tiene 2 operadores (ej: Principal + Auxiliar), solo se genera comisión para el Principal. Además, el índice único `idx_costs_unique_commission` (`service_id, operator_id, category_id`) **es correcto** para evitar duplicados, pero el trigger ignora operadores auxiliares.

### 3. Duplicados fantasma por `fetchMainOperatorCommissionsFromServices`
**Causa raíz**: Esta función lee `services.operator_commission` y genera IDs sintéticos (`service-main-{id}`) que NO existen en `costs`. La lógica de deduplicación intenta filtrarlos si ya hay un par `service_id::operator_id` en costs, pero falla cuando: (a) el `operator_id` en `services` difiere del `operator_id` en `costs` (por cambios de operador), o (b) la comisión en costs fue pagada pero la proyección desde services sigue mostrándose como pendiente.

---

## Solución Propuesta

### Paso 1: Simplificar `useCommissions.ts` — Eliminar fuente de datos redundante
Eliminar completamente `fetchMainOperatorCommissionsFromServices`. La **única fuente de verdad** para comisiones es la tabla `costs`. Los datos de `services.operator_commission` son solo un campo de referencia, no la fuente real.

- Mantener `fetchCommissionsFromCosts` como fallback del RPC
- Eliminar la tercera fuente (`mainRes`) del `fetchCommissions`
- Simplificar la lógica de merge: solo RPC + fallback costs, deduplicados por `id`

### Paso 2: Actualizar `get_commissions_with_details()` (migración SQL)
Ampliar el WHERE para capturar todas las variantes de subcategoría históricas:
```sql
WHERE (
  cc.name = 'Comisión Operador' 
  OR c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  OR c.subcategory IN ('comisiones', 'comisiones_pagadas', 'Comisión Operador')
)
```
Esto garantiza que ninguna comisión quede excluida por inconsistencias en nombres de categoría o subcategoría.

### Paso 3: Actualizar trigger para múltiples operadores (migración SQL)
Modificar `generate_commission_on_service_completion` para iterar sobre **todos** los operadores en `service_resources` que tengan `commission_amount > 0`, no solo el `role = 'Principal'`:
```sql
FOR v_record IN
  SELECT sr.operator_id, o.name, sr.commission_amount
  FROM service_resources sr
  JOIN operators o ON o.id = sr.operator_id
  WHERE sr.service_id = NEW.id
    AND sr.commission_amount > 0
LOOP
  -- Verificar duplicados y crear comisión por cada operador
END LOOP;
```
El índice único existente ya protege contra duplicados por par `(service_id, operator_id, category_id)`.

### Paso 4: Sincronizar comisiones históricas faltantes (migración SQL)
Script de reconciliación one-time que busca servicios completados/facturados con operadores en `service_resources` que tengan `commission_amount > 0` pero sin registro correspondiente en `costs`.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/commissions/useCommissions.ts` | Eliminar `fetchMainOperatorCommissionsFromServices`, simplificar `fetchCommissions` |
| Nueva migración SQL | Actualizar `get_commissions_with_details`, trigger multi-operador, reconciliación |

## Riesgos y Mitigación
- **No se toca la tabla `costs`** directamente (solo se agregan registros faltantes)
- **No se modifica la lógica de pagos** (`payment_date`, `payment_batch_id`)
- **No se altera la cascada costos-pagos-inventario** (triggers existentes intactos)
- El índice único previene cualquier duplicado accidental

