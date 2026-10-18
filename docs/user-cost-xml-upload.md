# Importar gastos XML desde Costos

El importador principal de Costos tiene tres etapas:

1. **Costo y proveedores**: cargar y analizar el XML, revisar duplicados, seleccionar facturas y proveedores, y elegir la categoría del gasto y la condición de vencimiento por proveedor.
2. **Productos y pago**: seleccionar los productos incluidos, asignar su subcategoría individual, ajustar la glosa, el vencimiento y el estado de pago de cada factura. Si está pagada, indicar su fecha real de pago.
3. **Revisión**: comprobar los importes, la clasificación neta por subcategoría, el pago y si se creará un gasto o se vinculará a uno existente. Solo **Confirmar carga** guarda los datos.

Se conserva un costo consolidado por factura. Si hay varias subcategorías, el costo no se asigna íntegramente a una de ellas: la clasificación queda en sus productos y aparece en el detalle de factura del costo. Los productos sin clasificación quedan explícitamente **Sin subcategoría**; no heredan la del proveedor. Cambiar la categoría del proveedor limpia las asignaciones incompatibles.

La condición de vencimiento no determina si la factura está pagada. Desactivar **Marcar como pagado** guarda el costo pendiente, sin fecha de pago, aunque la condición sea **Sin condición (manual)**. Al vincular un gasto existente se recupera su estado de pago para revisarlo antes de confirmar.

Se mantienen la selección parcial de líneas, las sugerencias de glosa, la detección de duplicados y las opciones de entidad, equipo y financiación LowBoy. No se asigna un equipo automáticamente.

## Alcance de la sincronización con Bodega

La opción existente crea una entrada consolidada por factura nueva; en LowBoy puede consumirla al equipo elegido. No distribuye los productos entre varias grúas ni crea movimientos al vincular un costo existente. Para productos individuales, varios destinos o consumo parcial, utilizar **Importar XML a Bodega**. No importar la misma factura por ambos flujos.

Si se advierte que el costo se creó pero falló su detalle, pago o sincronización, revisar el costo registrado antes de reintentar para evitar duplicados.
