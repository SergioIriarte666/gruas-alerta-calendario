# suppliers

## Resumen
Modulo de **proveedores** para gestion de catalogo, pagos, calendario de vencimientos e importacion XML con trazabilidad hacia costos e inventario.

La fuente operativa principal del catalogo hoy es `inventory_suppliers`, no una tabla `suppliers` separada como base principal del frontend.

## Entrypoints vigentes
- Pagina: [Suppliers](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Suppliers.tsx)
- Componentes: [src/components/suppliers](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/suppliers)

## Ruta
- `/suppliers`

## Arquitectura actual de la pagina
La vista principal opera por tabs:

- `PaymentList`
- `SupplierList`
- `SupplierPaymentCalendar`

Flujos auxiliares montados desde la pagina:

- `SupplierForm`
- `RegisterPaymentModal`
- `XMLDocumentUpload`

Notas relevantes:
- `XMLDocumentUpload` es hoy el entrypoint XML principal del modulo.
- `XMLSupplierUpload` puede existir en el repositorio, pero no esta conectado como flujo principal de `/suppliers`.

## Hooks y servicios clave
- `useSuppliers`
- `useSupplierPayments`
- `useSupplierInvoices`
- `useSupplierStats`
- `useSupplierPaymentStats`

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `inventory_suppliers`
- `supplier_payments`
- `supplier_invoices`
- `supplier_invoice_items`
- relaciones con `costs`, `inventory_movements`, `crane_parts`

## Flujos vigentes

### 1. Catalogo de proveedores
- Alta y edicion desde `SupplierForm`.
- El catalogo operativo del frontend se basa en `inventory_suppliers`.
- Puede almacenar defaults utiles para importaciones recurrentes.

### 2. Gestion de pagos
Conviven dos superficies reales:

- alta rapida desde `RegisterPaymentModal`
- gestion completa desde `PaymentList`

`PaymentList` cubre:

- filtros y estados
- edicion o revision de pagos
- marcado de pagado
- exportacion y seguimiento

### 3. Calendario de vencimientos
- `SupplierPaymentCalendar` resume compromisos por fecha.
- Complementa, no reemplaza, el listado detallado de pagos.

### 4. Importacion XML
- `XMLDocumentUpload` importa documentos tributarios del proveedor.
- Puede detectar duplicados y coincidencias.
- Puede proponer glosas y defaults por proveedor.
- Puede enlazar o derivar informacion hacia costos e inventario.

### 5. Trazabilidad pago -> costo -> inventario
Este es uno de los flujos mas importantes del modulo:

- un pago o documento de proveedor puede crear o actualizar `costs`
- puede crear movimientos en `inventory_movements`
- puede incluso participar en consumo inmediato a grua

## Consideraciones de mantenimiento
- Si se cambia la documentacion del modelo de datos, reflejar que `inventory_suppliers` es la fuente de verdad operativa actual.
- Si un cambio toca XML, validar impacto cruzado en costos, inventario y sugerencias por proveedor.
- Diferenciar siempre entre flujos visibles en `/suppliers` y componentes legacy o secundarios del repositorio.
