

# Plan: Pestaña "Histórico" + Fix scroll del modal

## Problemas identificados

1. **Pestaña "Historial"** actualmente muestra `PaymentHistory` (historial de pagos). El usuario quiere una pestaña nueva **"Histórico"** separada para las facturas importadas del sistema externo, sin mezclarlas con las facturas del sistema actual.

2. **Modal de importación no scrollea**: El `DialogContent` tiene `overflow-hidden` y el `ScrollArea` está dentro, pero los botones de acción están dentro del `ScrollArea` en lugar de estar fijos abajo, y el layout flex puede estar causando que no se expanda correctamente.

## Cambios

### 1. Crear componente `InvoiceHistoricalTab.tsx`
- Nueva pestaña que muestra solo facturas históricas (filtradas por `notes = 'Importación historial 2025'`).
- Tabla read-only con: Folio, N° Fiscal, Cliente, Fecha, Total, Estado.
- Botón "Importar Historial" integrado en el header de esta pestaña.
- Buscador y stats simples (total facturado, cantidad).
- Sigue el patrón visual del Cost Module (badges, fonts, etc).

### 2. Modificar `Invoices.tsx`
- Agregar nueva pestaña "Histórico" al `TabsList` (renombrar la actual "Historial" que es de pagos para evitar confusión, o mantener ambas con nombres claros).
- Mover el botón "Importar Historial" del header principal a la pestaña Histórico.
- Grid de tabs pasa de 6 a 7 columnas.

### 3. Fix scroll del modal `InvoiceHistoryImport.tsx`
- Separar los botones de acción fuera del `ScrollArea` para que queden fijos abajo.
- Asegurar que el contenido del preview sea scrolleable con `overflow-y-auto` dentro del flex container.

