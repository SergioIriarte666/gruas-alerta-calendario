# Facturas desde foto o ingreso manual en Costos

En **Costos → Desde foto / manual** se puede registrar una factura que no está en el TMS, aunque no tenga XML disponible.

1. **Comprobante:** adjuntar foto opcional JPG, PNG, WEBP o HEIC (hasta 20 MB). Pulsar **Leer foto y precargar datos** y revisar proveedor, RUT, folio, fechas, códigos, cantidades, precios unitarios netos e IVA. La lectura no guarda un costo ni determina si está pagado. También se puede completar todo a mano.
2. **Clasificación y pago:** elegir categoría, centro de costo opcional, empresa dueña, empresa financiadora y glosa. Asignar una subcategoría a cada producto; no hay una subcategoría global que sobrescriba las distintas clasificaciones. La grúa opcional es solo una referencia financiera. Confirmar **Pendiente** o **Pagada**, fecha real y referencia opcional del pago.
3. **Revisión:** comprobar totales, detalle, clasificación y respaldo antes de **Confirmar registro en Costos**.

Si el comprobante no tiene detalle legible, marcar **Registrar solo los totales: no tengo detalle legible**. Esta acción quita las líneas precargadas. Se registran los datos de cabecera, neto, IVA, total y una subcategoría opcional para el gasto completo; no se inventan productos. Los importes de cabecera deben cuadrar. Esta opción no está disponible en Bodega.

Se crea **un costo consolidado, una factura de proveedor y un registro de pago** en una sola transacción. Los productos se conservan como detalle documental, sin catálogo ni movimientos de inventario, entradas o consumos. Los códigos y precios unitarios se toman del mismo lector corregido que utiliza Bodega. Una factura con varias subcategorías muestra su clasificación en el detalle; su costo no se duplica.

El filtro de subcategoría también encuentra coincidencias dentro del detalle documental. Muestra cada factura una sola vez por su importe completo; no es un informe de montos prorrateados por subcategoría.

## Seguridad y reintentos

- La RPC autoriza administradores y operadores; el servicio de lectura mantiene sus permisos actuales (administradores). Si la lectura no está disponible, el ingreso manual sigue funcionando.
- La foto se normaliza a JPEG y se guarda en el bucket privado de Cloudflare R2 `g5n-comprobantes-compras`, bajo el usuario y el identificador de solicitud. El detalle del costo utiliza enlaces temporales para visualizarla. Los originales anteriores se trasladan desde **Costos → Respaldos en R2**, verificando cada copia antes de retirarlos de Supabase.
- El servidor valida montos, RUT, folio, clasificación y foto, y detecta facturas previas por proveedor/folio en Costos, Proveedores o Bodega. No se vincula silenciosamente a un costo previo.
- La identidad se resuelve por el RUT del emisor, nunca por el nombre del receptor. Si la razón social del comprobante difiere del maestro para el mismo RUT, se debe elegir explícitamente usar el nombre del comprobante o conservar el registrado antes de guardar. La primera opción actualiza el nombre de ese proveedor, también visible en sus registros históricos, sin modificar RUT ni identificador.
- Tras un error, **Reintentar guardado** conserva el mismo identificador y los mismos datos: una respuesta perdida no crea otro costo. Para modificar datos después de un intento, cerrar y revisar primero si la factura ya está registrada.
- Si falla la transacción, se revierten proveedor nuevo, costo, factura, detalle y pago juntos. Una foto ya subida puede permanecer privada para reutilizarse al reintentar.

## Publicación

Aplicar las migraciones pendientes antes de publicar el frontend (`npx supabase db push`). La lectura reutiliza `parse-receipt-image`; el respaldo usa la nueva función `purchase-receipts` y la configuración R2 documentada en `docs/technical/purchase-receipts-r2.md`.

Validación local:

```sh
node scripts/tests/manual-cost-purchase.mjs
node scripts/tests/xml-inventory-line-consumption.mjs
npx vitest run src/services/__tests__/manualCost.test.ts src/components/costs/__tests__/ManualCostPurchaseDialog.test.tsx
npm run build
```
