# Cierres y registro de facturas emitidas: implementación

Acceso: **Cierres** o **Facturas** → **Cierres desde facturas PDF**. Disponible para administradores.

## Flujo simplificado
1. Subir las facturas PDF.
2. El sistema lee la OC, identifica al receptor y propone automáticamente los servicios disponibles de esa OC cuando el neto coincide.
3. Una tabla muestra factura, OC, servicios y total. El detalle permite consultar PDF, datos y fechas; «Resolver» aparece para las excepciones.
4. **Crear cierres y registrar facturas** confirma una sola vez la propuesta seleccionada. Se mantiene el proceso cierre → factura vinculada, con folio SII original.

No hay formulario obligatorio por factura ni doble confirmación. Los borradores se guardan para recuperación, sin abrir automáticamente un historial de documentos. Si el documento omite vencimiento se propone emisión + 30 días, visible y editable, siguiendo el valor habitual del formulario individual. La descripción se completa con el folio y la OC cuando no existe una descripción editada.

## Despliegue
Aplicar las migraciones del repositorio antes de publicar el frontend:
- `20260922175900_add_partial_invoice_service_status.sql`
- `20260922180000_issued_invoice_batch_import.sql`
- `20260922190000_confirm_issued_invoice_proposal.sql`
- `20260922210000_resolve_invoice_client_from_services.sql`

La migración de confirmación permite confirmar la propuesta y registrar la factura en una sola transacción, conservando la comprobación de cambios desde otras sesiones y todas las validaciones anteriores. Los PDF son privados; reimportar un archivo no duplica registros.

## Reglas
- Coincidencia principal: RUT del receptor/pagador + OC. El mismo RUT puede tener varias fichas o sucursales: se buscan sus servicios y se conserva el cliente del servicio seleccionado, tanto en el cierre como en la factura. No se exige RUT único ni se elige una ficha arbitrariamente. Una factura no combina fichas distintas. La igualdad del monto por sí sola no asigna servicios.
- Comparación del neto/base con servicios; IVA y total se conservan del documento revisado. No se calcula una tasa por defecto al registrar.
- RUT emisor debe coincidir con la empresa configurada en TMS.
- Folios duplicados contra TMS o dentro del lote, servicios repetidos entre facturas, disputas y diferencias bloquean el procesamiento.
- Un cierre previo se reutiliza solo completo, con el mismo pagador, sin facturar y con montos consistentes.
- Se crean cierres separados para cubierto y excedente. El servicio permanece parcialmente facturado si aún falta su otra parte.
- Un cambio de borrador desde otra sesión invalida la confirmación anterior.
- Los errores revierten toda la factura; la idempotencia queda guardada en servidor, incluso si se pierde la respuesta de red.
- PDF original privado con enlaces temporales. La carga puede dejar un archivo sin borrador si falla la red entre ambos pasos; reimportar el mismo archivo recupera ese paso sin sobrescribir el original.
- Registrar una factura emitida no la marca pagada ni emite documentos nuevos ante SII.

## Validación realizada
- `npm run build`: compilación de producción.
- `npx vitest run src/utils/__tests__/issuedInvoiceImport.test.ts src/hooks/__tests__/useIssuedInvoiceImport.test.tsx src/utils/__tests__/closureBilling.test.ts src/utils/__tests__/billingBatchImport.test.ts`: extracción, OC, conciliación, revisión, duplicados, recuperación de errores y reglas existentes.
- `npm run test:invoice-import-sql`: PostgreSQL embebido PGlite, esquema aislado y triggers relevantes reales del repositorio. Prueba migraciones, atomicidad, idempotencia, duplicados, disputas, montos, OC, fechas, emisor, fallo tardío/rollback, cambios concurrentes de propuesta, facturación parcial, múltiples cierres, reutilización, folios y permisos. No reemplaza una validación de despliegue sobre el esquema completo de staging.
- ESLint de los archivos de la funcionalidad.
- Navegador: pantalla real con servicios simulados, escritorio/móvil, selección y confirmación; lectura PDF.js en Chrome del original 4369.pdf proporcionado por el usuario: folio 4369, OC 4701775661, neto 195.000, IVA 37.050, total 232.050, emisión 22/09/2026 y vencimiento 22/10/2026. Sin escritura de cierres o facturas reales durante la prueba.
- La comprobación TypeScript global encuentra errores en archivos ajenos a este cambio; no reportó errores en los archivos nuevos.

El formato Facturacion.cl del PDF real está cubierto por una prueba de regresión con identidades anonimizadas. El original no se incorpora al repositorio. Al volver a subir un PDF pendiente sin selección ni correcciones manuales, se repite la lectura para recuperar intentos de versiones anteriores. No se cambian registros ya procesados o seleccionados. La extracción es conservadora; campos ambiguos quedan para revisión. Los PDF escaneados usan OCR, cuya precisión depende de la calidad del documento y de la disponibilidad del modelo de idioma. Las imágenes `implementacion-*.png` muestran la interfaz real con datos ficticios.
