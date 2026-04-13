

# Plan: Agregar N° Fiscal al header y botón Imprimir servicios

## Cambios en `src/components/invoices/InvoiceDetailsModal.tsx`

### 1. Header: Mostrar N° Fiscal junto al folio
En el `DialogTitle` (línea 253-259), agregar el `numeroFiscal` al lado del folio de factura. Ejemplo visual:
```text
📄 Factura FACT-4359 | N° 12345        [Enviada]
```
Si no tiene número fiscal, no se muestra nada adicional.

### 2. Botón Imprimir en pestaña Servicios
Agregar un botón `Imprimir` (icono `Printer` de lucide-react) en el header de la sección "Servicios Incluidos" (línea 518-525). Al hacer clic, abre una ventana de impresión con una tabla limpia que incluye:
- Header: Factura (folio + N° fiscal), cliente, fecha
- Tabla de servicios: Folio, Fecha, Vehículo, Patente, Valor, Estado
- Total al final

Se usará `window.open()` + `document.write()` para generar un HTML limpio de impresión, sin dependencias adicionales.

### Importaciones
- Agregar `Printer` desde `lucide-react`
- Agregar `Button` desde `@/components/ui/button`

## Archivo
- `src/components/invoices/InvoiceDetailsModal.tsx`

