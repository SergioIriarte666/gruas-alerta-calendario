# finance-historical

## Resumen
Modulo de **historico financiero** para ventas, compras y resultados, con importacion, edicion, agrupaciones y exportacion.

La implementacion actual no se limita a una vista dual de compras y ventas: incluye tambien una tercera tab de resultados.

## Entrypoints vigentes
- Pagina: [Historical](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Historical.tsx)
- Componentes: [src/components/finance](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/finance)
- Componentes de historico: [src/components/finance/historical](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/finance/historical)

## Ruta
- `/historical`

## Arquitectura actual
La pagina actual organiza 3 tabs:
- ventas
- compras
- resultados

## Hooks y servicios clave
- `useInvoices`
- `usePurchaseInvoices`
- `usePurchaseInvoiceItems`
- `usePurchaseExport`

## Datos y dependencias principales
Fuentes principales del modulo visible:
- `invoices`
- `supplier_invoices`
- `supplier_invoice_items`

## Flujos vigentes
### 1. Ventas historicas
- Soporta importacion, suscripcion realtime, edicion masiva y vistas `table`, `grouped` y `pipeline`.

### 2. Compras historicas
- Soporta importacion, creacion, edicion, edicion masiva, recepcion a inventario y vistas `table`, `grouped` y `pipeline`.

### 3. Resultados historicos
- Existe una tab dedicada de resultados con su propia lectura consolidada.

### 4. Exportacion
- El modulo incorpora exportadores e importadores historicos especificos.

## Consideraciones de mantenimiento
- No documentar el historico como si su base principal fueran `payments` o `costs` si la UI visible hoy trabaja sobre facturas de venta y compra.
- Citar importadores y exportadores reales del historico cuando se profundice la documentacion.
