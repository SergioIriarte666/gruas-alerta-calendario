

## Problema

Desde el módulo de **Histórico de Ventas**, se pueden editar **todas** las facturas — incluyendo las del sistema (sin prefijo `HIST-`). Estas facturas están vinculadas a cierres, servicios, costos e ingresos. Modificar su estado, folio u origen desde este módulo puede romper esas relaciones y generar inconsistencias contables.

## Enfoque propuesto

Implementar una **protección por origen** en 3 puntos del flujo:

### 1. Modal de edición individual (`EditHistoricalInvoiceModal.tsx`)
- Al abrir una factura cuyo folio **no** empieza con `HIST-`, mostrar un banner de advertencia: *"Esta factura fue generada por el sistema y está vinculada a cierres/servicios. Solo se permiten cambios en notas y metadatos."*
- **Deshabilitar** los campos sensibles: Estado, Origen (ya que cambiar de "Sistema" a "Importada" alteraría el folio y rompería vínculos).
- Permitir editar solo: Notas, Info. Envío, Método de Pago (campos informativos sin impacto relacional).

### 2. Modal de edición masiva (`BatchEditHistoricalInvoicesModal.tsx`)
- Si la selección incluye facturas del sistema, mostrar un aviso: *"X facturas del sistema serán excluidas de los cambios de Estado y Origen."*
- Al aplicar: saltar los campos Estado y Origen para facturas sin prefijo `HIST-`, aplicando solo Notas, Envío y Pago.
- Alternativa más estricta: excluir completamente las facturas del sistema del batch edit.

### 3. Tabla (`HistoricalSalesTable.tsx`)
- En la columna de acciones, el botón "Editar" de facturas del sistema podría mostrar un icono de candado o tooltip indicando edición limitada.

### Archivos a modificar
- `src/components/finance/historical/EditHistoricalInvoiceModal.tsx` — banner + deshabilitar campos sensibles para facturas sistema
- `src/components/finance/historical/BatchEditHistoricalInvoicesModal.tsx` — filtrar/excluir facturas sistema de cambios destructivos
- `src/components/finance/historical/HistoricalSalesTable.tsx` — indicador visual de protección

### Lo que NO se toca
- El flujo de edición en `/invoices` (módulo principal) sigue sin restricciones ya que ese es el lugar correcto para editar facturas del sistema.
- No se bloquea la visualización — solo la modificación de campos vinculantes.

