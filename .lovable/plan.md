

## Diagnóstico

Dos problemas en el modal `EditHistoricalInvoiceModal`:

1. **Layout roto**: El `grid grid-cols-4` con labels en columna 1 y inputs en columnas 2-4 se rompe en pantallas pequeñas — los campos se superponen como muestra la captura.

2. **Falta campo "Origen"**: No hay forma de editar si una factura es "Importada" (prefijo `HIST-`) o "Sistema" (sin prefijo). El origen se determina por el prefijo del folio (`folio.startsWith('HIST-')`), por lo que cambiar el origen requiere modificar el folio.

## Solución

### 1. Corregir layout del modal — `EditHistoricalInvoiceModal.tsx`

- Cambiar de `grid grid-cols-4` a un layout vertical con `space-y-4` donde cada campo tiene su `Label` arriba y el input debajo (full width).
- Aumentar el ancho máximo del modal a `sm:max-w-[600px]`.
- Esto elimina la superposición y mejora la legibilidad.

### 2. Agregar campo "Origen" — `EditHistoricalInvoiceModal.tsx`

- Nuevo estado `origin` con valores `'importada'` | `'sistema'`.
- Se inicializa leyendo si `invoice.folio.startsWith('HIST-')`.
- Un `Select` permite cambiar entre "Importada" y "Sistema".
- Al guardar, si el origen cambia:
  - De Importada → Sistema: quitar prefijo `HIST-F-`, `HIST-NC-`, `HIST-ND-` del folio (ej: `HIST-F-4115` → `4115`).
  - De Sistema → Importada: agregar prefijo `HIST-F-` al folio.
- Incluir `folio` en el objeto `updates` pasado a `onSave`.
- El audit log registrará el cambio de origen.

### 3. Actualizar `onSave` en `HistoricalSales.tsx`

- La función `handleUpdateInvoice` ya pasa `updates` genérico a `updateInvoice`, que acepta `Partial<Invoice>` incluyendo `folio`. No requiere cambios en el hook.

### Archivos a modificar
- `src/components/finance/historical/EditHistoricalInvoiceModal.tsx` — layout + campo origen

