# Compras sin XML: desde foto o ingreso manual

En **Bodega → Ingresar compra**, elegir **Desde foto / manual**. El origen **Desde XML** conserva el flujo anterior. Cambiar de origen reinicia los datos aún no guardados.

1. Opcionalmente seleccionar una foto JPG, PNG, WEBP o HEIC de hasta 20 MB. La aplicación prepara una copia JPEG legible. **Leer foto y precargar datos** utiliza el servicio de extracción existente; no crea facturas, costos ni movimientos. La lectura requiere la configuración y permisos del servicio `parse-receipt-image` (actualmente administradores). Si no está disponible, se puede completar la compra manualmente conservando la foto.
2. Revisar proveedor y RUT, folio, emisión, vencimiento y cada producto. Los precios son **unitarios netos**; indicar IVA 19% o exento por producto. Los precios identificados como brutos se convierten a netos solo cuando su suma coincide con el total del comprobante: aun así deben revisarse. Datos ilegibles o ausentes quedan pendientes de completar. Volver a leer reemplaza los datos escritos.
3. Escribir neto, IVA y total del comprobante. El sistema compara los importes con los productos; solo permite preparar la compra cuando cuadran, con tolerancia de un peso por redondeo. No completar importes desconocidos con cifras inventadas.
4. Pulsar **Usar estos datos y clasificar compra**. Elegir categoría, centro de costo, bodega y estado de pago. La lectura no marca automáticamente la compra pagada. Si lo está, indicar fecha real y referencia opcional.
5. En **Productos**, asociar cada línea al catálogo o crear el producto, elegir su subcategoría y destino: bodega, consumo inmediato o consumo parcial hacia una grúa. Se admiten distintas grúas. Para eliminar o modificar cantidades/precios de una compra manual, volver a los datos de la factura: no se permite descartar líneas dejando intacto el total.
6. Revisar y confirmar. La factura, su único costo/pago, las líneas, movimientos y asociación del respaldo se guardan en una transacción. La foto queda vinculada al costo y se abre desde su detalle mediante enlaces temporales privados. No se genera un XML fiscal.

La foto se prepara localmente y se envía al servicio de lectura solo al solicitarlo. Se almacena en el bucket privado `quick-entry-photos` al confirmar. Si falla la subida, no se registra la compra. Si hay un error de red durante el registro, reintentar sin cambiar los datos utiliza el mismo identificador y no duplica la compra. Una factura del mismo proveedor y folio ya registrada por otro flujo se rechaza.

## Instalación y validación

Aplicar la migración `20261018233000_manual_inventory_purchases.sql`. Reutiliza la transacción de inventario existente, agrega `register_manual_inventory_purchase` y una bitácora privada de idempotencia. No requiere una nueva Edge Function ni otra clave de IA. Mantener disponible `parse-receipt-image`; el ingreso manual funciona independientemente de la IA.

Pruebas SQL: `node scripts/tests/xml-inventory-line-consumption.mjs`. Incluyen el comprobante Dicar 54491 (cuatro herramientas, neto 127.606, IVA 24.245, total 151.851), pago pendiente/pagado, respaldo, múltiples grúas, duplicados, reintentos, validación de importes y reversión de escrituras si falla el último paso. Estos datos de prueba no registran la compra real.
