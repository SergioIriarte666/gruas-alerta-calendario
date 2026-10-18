# Respaldos de compras en Cloudflare R2

## Alcance

Los JPEG generados por **Bodega / Costos → Desde foto / manual** se guardan en el bucket privado `g5n-comprobantes-compras`. No se mezclan con inspecciones ni respaldos de base de datos. Los otros flujos de captura rápida conservan su almacenamiento actual; no se vacía ni elimina el bucket `quick-entry-photos` completo.

La ruta lógica continúa siendo `<usuario>/manual-purchases/<solicitud>.jpg`. Se conserva en `receipt_photo_paths` y en las solicitudes idempotentes, de modo que trasladar el archivo no cambia la factura, el costo, sus movimientos ni su pago. En R2 la clave es `purchase-receipts/<ruta lógica>`.

## Seguridad y validación

- `purchase-receipts` autentica el JWT y verifica rol admin/operator antes de recibir archivos o firmar accesos. Solo admin puede migrar archivos de otros usuarios.
- El navegador envía un JPEG de hasta 5 MB al servicio; no recibe credenciales R2. Se lee el cuerpo con límite aunque falte `Content-Length`.
- Cada objeto se escribe condicionalmente (`If-None-Match: *`), se verifica por tamaño/SHA-256 y se relee su contenido. Una solicitud no puede sobrescribir una foto distinta.
- La tabla `purchase_receipt_files` conserva el manifiesto verificado (bucket, clave, tamaño, SHA-256, propietario, solicitud). Solo el backend privilegiado puede escribirla. Las RPC de compras aceptan esa evidencia sin exigir un objeto en Supabase Storage.
- Los enlaces temporales duran 10 minutos. Se verifica propiedad o acceso RLS al costo antes de firmar. No se habilita acceso público en R2.
- Las políticas restrictivas impiden nuevas subidas manuales al prefijo antiguo de Supabase. Una versión antigua del frontend debe actualizarse; no se hace fallback de escritura a Supabase si R2 falla.

## Trasladar originales existentes

Una vez publicado y recargado el frontend, como administrador abrir **Costos → Respaldos en R2 → Trasladar respaldos anteriores a R2**.

Antes del traslado se prueba lectura, escritura, verificación y eliminación con un objeto temporal de diagnóstico (no una factura). Si las credenciales no tienen acceso al bucket nuevo, no comienza la migración. El servicio consulta únicamente el prefijo de compras manuales, en lotes de cinco. Para cada foto:

1. Lee el original de Supabase y lo copia a R2, sin sobrescribir contenido distinto.
2. Verifica tamaño, SHA-256 y contenido releído desde R2.
3. Guarda el manifiesto. Si esto falla, no elimina el original.
4. Vuelve a verificar R2 antes de retirar el original por Storage API y comprueba su ausencia.
5. Marca el traslado finalizado. Si se pierde la respuesta o falla este paso, el siguiente intento comprueba el objeto de R2 y reanuda, incluso si el original ya fue retirado.

Los errores se muestran por archivo. Los pendientes se pueden reintentar; no se declara éxito ni se elimina un original cuando falla la copia, el checksum o el manifiesto. No se cambia ninguna ruta de negocio. Los archivos originales que superen 5 MB permanecen en Supabase para revisión.

## Configuración y publicación

Se reutilizan los secrets de servidor `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`. Agregar `R2_PURCHASES_BUCKET=g5n-comprobantes-compras`. Las credenciales R2 deben tener lectura/escritura/eliminación de objetos en este bucket; no se rotan ni cambian las credenciales de inspecciones o backups para conseguirlo.

Publicación coordinada: desplegar `purchase-receipts`, aplicar la migración `20261019010000_purchase_receipts_r2.sql`, publicar frontend y recargar. Solo entonces ejecutar el traslado desde la interfaz nueva. No retirar originales antes de publicar los lectores compatibles con R2.

```sh
npx supabase functions deploy purchase-receipts --project-ref jqszxljtfuknhuvuheko --use-api
npx supabase db push
```

La verificación JWT permanece activa en `supabase/config.toml`. El bucket tiene `r2.dev` deshabilitado y no necesita dominio público. Antes del traslado debe comprobarse el acceso de las credenciales S3 del backend al bucket nuevo.

## Pruebas

```sh
deno test --no-lock --allow-env supabase/functions/_shared/purchaseReceipts.test.ts supabase/functions/_shared/purchaseReceiptStore.test.ts supabase/functions/_shared/r2.test.ts
node scripts/tests/manual-cost-purchase.mjs
npx vitest run src/services/__tests__/receiptPhotos.test.ts src/services/__tests__/manualPurchase.test.ts src/components/costs/__tests__/PurchaseReceiptMigrationDialog.test.tsx
```

Las pruebas cubren copia fallida, checksum incorrecto, manifiesto fallido, borrado fallido, pérdida de confirmación posterior al borrado y reanudación sin original. No se borra un archivo de negocio como parte de estas pruebas.
