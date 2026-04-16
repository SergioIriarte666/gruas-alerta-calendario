

# Plan: Campo `commission_exempt` en operadores (solución escalable)

## Problema actual
Las exclusiones de comisiones están hardcodeadas por nombre en el código (`EXCLUDED_OPERATOR_NAMES`). Esto no escala, es frágil (cambios de nombre rompen la lógica) y obliga a modificar código cada vez que se quiere excluir/incluir un operador.

## Solución

### 1. Migración: agregar columna `commission_exempt` a `operators`
```sql
ALTER TABLE operators ADD COLUMN commission_exempt boolean NOT NULL DEFAULT false;
-- Marcar los 3 operadores actuales como exentos
UPDATE operators SET commission_exempt = true 
WHERE name ILIKE '%Jorge Iriarte%' OR name ILIKE '%Sergio Iriarte%' OR name ILIKE '%Jorge Ignacio Iriarte%';
```

### 2. Migración: actualizar trigger `generate_commission_on_service_completion`
Agregar validación `AND NOT o.commission_exempt` en el `FOR` loop que lee `service_resources`. Si el operador está exento, no se crea comisión en `costs` aunque tenga `commission_amount > 0` en `service_resources`.

### 3. UI: agregar toggle en `OperatorForm.tsx`
Un `Switch` con label "Exento de comisiones" que controla el campo `commission_exempt`. Se muestra junto al toggle de "Activo".

### 4. Tipo TypeScript: agregar `commissionExempt` a `Operator`
En `src/types/index.ts`, agregar el campo al interface.

### 5. Refactorizar código que usa hardcoded names
- **`src/utils/commissionSync.ts`**: reemplazar `EXCLUDED_OPERATOR_NAMES` por consulta del campo `commission_exempt` del operador.
- **`src/utils/forceCommissionSync.ts`**: mismo cambio.
- **`src/hooks/useEnhancedServiceDetails.ts`**: filtrar operadores con `commission_exempt` del array de operadores en el modal (no mostrar sección de comisión si commission = 0).

### 6. `ServiceCostsSection.tsx`: lógica basada en datos reales
Cambiar `operatorsData.length > 0` por `operatorsData.some(op => op.commission > 0)` para ocultar la sección de comisiones cuando ningún operador tiene comisión.

## Archivos
- Nueva migración SQL (schema + trigger + datos iniciales)
- `src/types/index.ts` (~1 línea)
- `src/components/operators/OperatorForm.tsx` (~15 líneas para el toggle)
- `src/utils/commissionSync.ts` (eliminar hardcoded, usar campo)
- `src/utils/forceCommissionSync.ts` (eliminar hardcoded, usar campo)
- `src/hooks/useEnhancedServiceDetails.ts` (~3 líneas filtro)
- `src/components/services/ServiceCostsSection.tsx` (~2 líneas condición)

## Resultado
Cualquier operador puede marcarse como "exento de comisiones" desde su ficha, sin tocar código. El trigger, la UI y los cálculos respetan este flag automáticamente.

