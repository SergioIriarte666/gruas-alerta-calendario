## Problema

Cuando se registran costos a un servicio ya existente (combustible, peajes, viáticos, etc.), quedan como **no pagados** (círculo rojo). Esto contradice la regla de negocio vigente: los gastos operativos de servicios deben marcarse como pagados por defecto, dejando solo las **comisiones** con flujo manual.

Hoy esto solo se cumple en el modal de desglose rápido (`ServiceExpenseModals`), pero falla en los tres puntos donde el usuario normalmente registra costos a un servicio existente.

## Causa raíz

1. **`ServiceCostDetailsSection.saveCostDetail`** (formulario de edición de servicio → sección "Costos Detallados"): construye el `costData` sin `payment_date`, por lo que el costo se inserta con `payment_date = NULL`.
2. **`CostForm`** y **`QuickCostForm`**: el checkbox "Marcar como pagado" siempre arranca en `false`, incluso cuando hay un `service_id` seleccionado.

## Cambios propuestos

### 1. `src/components/services/form/ServiceCostDetailsSection.tsx`
- En `saveCostDetail`, agregar `payment_date: costDate` al objeto `costData` cuando se crea un costo nuevo.
- En la actualización (`isExisting === true`), preservar el `payment_date` existente: si el costo ya tenía pago registrado, no tocarlo; si no, asignar `costDate`. Esto evita "despagar" un costo que el usuario marcó manualmente como pendiente en otro flujo.
- La sección ya excluye categoría comisiones, así que esta regla aplica solo a operativos (alineado con la regla de negocio).

### 2. `src/components/costs/QuickCostForm.tsx` y `src/components/costs/CostForm.tsx`
- Cambiar el valor por defecto del campo `is_paid` a `true` cuando:
  - el formulario se abre con un `service_id` preseleccionado (registro contextual desde un servicio), **y**
  - la categoría seleccionada no es comisiones.
- Mantener `is_paid: false` por defecto en cualquier otro caso (compras a proveedor, gastos administrativos, etc.) para no alterar el flujo de pagos a proveedores.
- El usuario sigue pudiendo desmarcar el checkbox antes de guardar.

### 3. `src/components/costs/ServiceExpenseModals.tsx`
- Sin cambios (ya asigna `payment_date: baseData.date`).

## Fuera de alcance

- No tocar comisiones (mantienen su flujo manual en su módulo).
- No tocar XML/CSV/masivos (esos tienen su propia lógica documentada).
- Sin migraciones de BD ni cambios en edge functions.
- Sin re-asignar pagos a costos históricos ya registrados; el cambio aplica solo a costos creados/editados desde aquí en adelante.

## Verificación

- Editar un servicio existente → agregar Combustible $X → guardar → el costo aparece con icono verde (pagado) y `payment_date` igual a la fecha del servicio.
- Mismo flujo con Comisión Operador → sigue quedando **no pagado** (rojo).
- Crear un costo desde `/costs` sin servicio → checkbox "Marcar como pagado" parte desmarcado (sin cambios).
- Crear un costo desde `/costs` con servicio preseleccionado → checkbox parte marcado, se puede desmarcar.
