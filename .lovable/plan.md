## Hallazgo de investigación

Revisé ambos modales XML:

- **Costos** (`src/components/costs/XMLCostUpload.tsx`): NO tiene casilla para marcar como pagado. El estado de pago se deriva automáticamente de la `Condición de Pago` (Contado/`none` → `payment_date = fecha emisión`; Crédito → `payment_date = null`). El usuario no puede marcar manualmente un documento como ya pagado.
- **Proveedores** (`src/components/suppliers/XMLDocumentUpload.tsx`): Tiene los estados internos (`statusOverrides`, `paidDateOverrides`) **pero tampoco tienen UI conectada** — son código muerto. En la práctica todos los documentos se importan como `pending`. La única configuración expuesta es la condición de pago y la fecha de vencimiento.

Conclusión: la casilla **no existe en ninguno de los dos modales**. Hay que crearla en ambos para mantener paridad funcional.

## Plan

Agregar en cada fila de documento (en ambos modales) un control para marcarlo como **Pagado** con su fecha, siguiendo el diseño del Módulo de Costos (mismas fuentes, tamaños, badges, Switch + DatePicker compactos ya usados en el módulo).

### 1. `XMLDocumentUpload.tsx` (proveedores)

- Conectar el `setStatusOverrides` existente a un `Switch` por documento con label "Marcar como pagado".
- Cuando esté activo, mostrar un `DatePickerInput` compacto con la fecha de pago (default = hoy), usando `setPaidDateOverrides`.
- Ocultar el selector de "Vencimiento" cuando esté marcado como pagado (no aplica).
- La lógica de inserción (líneas 770-890) ya está preparada: lee `statusOverrides` y `paidDateOverrides` y crea el `supplier_payment` con `status='paid'`, `paid_date`, `paid_amount`. No requiere cambios en backend.

### 2. `XMLCostUpload.tsx` (costos)

- Añadir estados nuevos `paidOverrides: Record<string, boolean>` y `paidDateOverrides: Record<string, string>`.
- En cada fila de documento (en el panel expandido, junto al selector de condición y descripción), añadir un `Switch` "Marcar como pagado" + `DatePickerInput` de fecha de pago.
- En la lógica de creación del costo (línea ~954), reemplazar:
  ```
  const paymentDate = condition === 'none' ? emissionDate : null;
  ```
  por:
  ```
  const isManuallyPaid = paidOverrides[documentKey];
  const paymentDate = isManuallyPaid
    ? (paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd'))
    : (condition === 'none' ? emissionDate : null);
  ```
- Resetear los nuevos estados en el `reset()` del modal.
- También aplicar un "marcar todos como pagados" por proveedor (botón pequeño en el header del grupo de proveedor), igual que ya existe "Aplicar condición a todos".

### 3. Consistencia visual (cost-module pattern)

- Usar `Switch` de shadcn (ya usado en formularios de costo).
- `Label` con `text-xs text-muted-foreground` y `mb-1.5 block` (igual que el resto del modal).
- `DatePickerInput` compacto `w-full max-w-[180px]`.
- Badge violeta `bg-primary/10 text-primary` cuando el doc esté marcado como pagado, reutilizando el estilo del módulo de costos.

### 4. Sin cambios de DB

No hace falta migración: las columnas `payment_date` (costos) y `status/paid_date/paid_amount` (supplier_payments) ya existen y se usan.

### Archivos a modificar

- `src/components/costs/XMLCostUpload.tsx`
- `src/components/suppliers/XMLDocumentUpload.tsx`
