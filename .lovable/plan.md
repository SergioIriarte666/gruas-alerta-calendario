## Problema

Al registrar un costo en el formulario principal (CostForm / QuickCostForm) y marcarlo como pagado, el sistema usa siempre la **fecha del costo** (`values.date`) como `payment_date`. No existe forma de indicar que el costo se ingresó en abril pero se pagó en mayo.

El único lugar donde sí se permite indicar la fecha real de pago hoy es el importador XML (`XMLCostUpload.tsx`, vía `paidDateOverrides`: "Si ya fue pagado, indica la fecha real del pago.").

## Objetivo

Permitir capturar y editar la **fecha real de pago** al crear/editar un costo cuando se marca como pagado, manteniendo el comportamiento por defecto actual (si no se modifica, se usa la fecha del costo).

## Cambios propuestos

### 1. `src/schemas/costSchema.ts`
Agregar campo opcional:
```ts
payment_date: z.string().optional().nullable(),
```

### 2. `src/components/costs/form/CostAmountSection.tsx`
- Cuando `is_paid === true`, mostrar un input `<Input type="date">` debajo del checkbox: **"Fecha real de pago"**.
- Default = `form.getValues('date')` si no hay valor previo.
- Texto auxiliar: "Si el pago se realizó en una fecha distinta a la de registro, indícala aquí."
- Mantener el diseño actual (mismo Card / tokens semánticos del módulo de costos, sin colores hardcoded).

### 3. `src/components/costs/CostForm.tsx`
- `reset(...)`:
  - Edición: `payment_date: cost.payment_date ?? ''`.
  - Prefilled / nuevo: `payment_date: ''` (se autocompletará al marcar pagado).
- En el submit (`onSubmit`, línea ~463):
  ```ts
  payment_date: is_paid
    ? (values.payment_date || cost?.payment_date || values.date)
    : null,
  ```
- Cuando el usuario tilda `is_paid` y `payment_date` está vacío, prellenarlo con `values.date` (efecto `watch` en CostForm o en CostAmountSection).

### 4. `src/components/costs/QuickCostForm.tsx`
Mismo tratamiento mínimo: agregar campo `payment_date` opcional al schema local, input visible si `is_paid`, y enviar `payment_date` real en lugar de derivarlo siempre de `date`.

### 5. `src/components/services/form/ServiceCostDetailsSection.tsx`
No cambia el flujo (los costos del servicio siguen heredando `serviceDate` como `payment_date`, según la regla `service-expenses-auto-payment`). Solo se respeta `payment_date` existente al editar (ya implementado).

## Fuera de alcance

- Importadores XML/CSV/bulk (ya manejan fecha real).
- Comisiones, supplier payments, debts (flujos propios).
- Migraciones de DB (la columna `payment_date` ya existe).
- Recalcular costos históricos.

## Verificación

1. Crear costo nuevo con fecha 22/04, marcar pagado, indicar 15/05 → en detalle aparece "Fecha de Pago: 15/05", "Fecha: 22/04".
2. Crear costo pagado sin tocar la fecha real → se guarda con `payment_date = date` (comportamiento actual).
3. Editar un costo ya pagado y cambiar solo la fecha real → se actualiza `payment_date` sin perder la fecha original.
4. Desmarcar pagado → `payment_date = null`.
