# Cierres y registro de facturas emitidas: implementación

Acceso: **Cierres** o **Facturas** → **Importar facturas emitidas**. Disponible para administradores; los permisos también se comprueban en servidor.

## Habilitación
Aplicar mediante el proceso habitual de despliegue de Supabase, en este orden:

1. `supabase/migrations/20260922175900_add_partial_invoice_service_status.sql`
2. `supabase/migrations/20260922180000_issued_invoice_batch_import.sql`

Después publicar la compilación del frontend. Las migraciones están preparadas en el repositorio; no se han aplicado a una base remota durante este trabajo. No se han registrado facturas ni cierres reales.

La primera migración asegura que exista el estado de facturación parcial en instalaciones basadas en el esquema inicial. La segunda agrega borradores/resultados persistentes, bucket privado de PDF, políticas para administradores y operaciones de consulta, guardado y registro. Instala también un generador de folios de cierres en servidor para las importaciones, que también avanza cuando la creación individual proporciona un folio explícito. Los folios existentes y los proporcionados explícitamente para recuperación se conservan; pueden existir saltos de numeración si una transacción se revierte.

## Uso
1. Agregar o arrastrar PDF (máximo 20 MB y 30 páginas por archivo). El sistema identifica reimportaciones del mismo archivo por SHA-256.
2. Abrir **Revisar**. Comparar el PDF original con los campos extraídos, completar datos ausentes y descripción. Se soportan factura electrónica 33 y exenta 34; otros tipos requieren otro flujo.
3. **Buscar servicios por RUT y OC**. Se muestran inicialmente los de la OC; se pueden revisar otras OC del mismo cliente y documentar una asignación manual. Se conservan ceros significativos y separadores internos para no confundir órdenes distintas.
4. Elegir servicios y confirmar su revisión. La propuesta automática solo selecciona el conjunto de una OC si la suma cuadra; el usuario siempre revisa. OC compartida entre facturas: distribuir servicios explícitamente.
5. Guardar revisión, seleccionar las filas listas y confirmar **Crear cierres y registrar**. Cada factura se procesa en una transacción, con nueva validación de disponibilidad, montos y duplicados.
6. Revisar resultados y exportar CSV. **Revalidar / reintentar** habilita una nueva revisión tras fallos. Las completadas no se repiten. Al abrir se recuperan todos los borradores pendientes y los últimos 100 documentos registrados. Quitar del lote solo retira la fila de la vista actual, no borra su respaldo.

## Reglas
- Coincidencia principal: RUT del receptor/pagador + OC. La igualdad del monto por sí sola no asigna servicios.
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
- `npm run test:invoice-import-sql`: PostgreSQL embebido PGlite, esquema aislado y triggers relevantes reales del repositorio. Prueba migraciones, atomicidad, idempotencia, duplicados, disputas, montos, OC, fechas, emisor, fallo tardío/rollback, cambios concurrentes de borrador, facturación parcial, múltiples cierres, reutilización, folios y permisos. No reemplaza una validación de despliegue sobre el esquema completo de staging.
- ESLint de los archivos de la funcionalidad.
- Navegador: pantalla real con servicios simulados, escritorio/móvil, selección y confirmación; lectura PDF.js de un PDF sintético con los campos esperados.
- La comprobación TypeScript global encuentra errores en archivos ajenos a este cambio; no reportó errores en los archivos nuevos.

Aún se necesita comprobar el formato concreto de los PDF del usuario: solo se proporcionó una captura de nombres. La extracción es conservadora; campos ambiguos quedan para revisión. Los PDF escaneados usan OCR, cuya precisión depende de la calidad del documento y de la disponibilidad del modelo de idioma. Las imágenes `implementacion-*.png` muestran la interfaz real con datos ficticios.
