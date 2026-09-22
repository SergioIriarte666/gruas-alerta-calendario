# Cierres por lotes y registro de facturas emitidas

## Objetivo
Cargar varias facturas PDF ya emitidas en el SII, asociar los servicios existentes en TMS, crear sus cierres y registrar las facturas con el número fiscal original. La unidad de trabajo es cada factura, no una agrupación arbitraria por cliente o período. Esta operación no emite documentos nuevos ante el SII.

La captura contiene 1499.pdf y 4369.pdf a 4377.pdf. Solo se conocen los nombres de archivo: no se han extraído ni comprobado folios, RUT, montos, fechas, referencias ni servicios. La vista previa usa datos ficticios y no escribe en la base de datos.

## Flujo propuesto
1. **Cargar documentos.** Botón «Importar facturas emitidas» en Cierres, con acceso desde Facturas. Selección múltiple o arrastre de PDF. Leer tipo de documento, emisor, receptor/RUT, folio fiscal, emisión, vencimiento cuando esté presente, OC/cotización, detalle, neto, IVA y total. Guardar el PDF como respaldo privado. El nombre del archivo es solo una referencia: confirmar el folio desde el contenido. Campos ausentes o extracción incierta requieren revisión; no inventar fechas ni montos.
2. **Conciliar.** Usar como criterio principal el RUT del receptor/pagador + número de orden de compra (OC). Extraer la OC del contenido y referencias de la factura y compararla con la OC de los servicios del mismo cliente. Normalizar prefijos OC, espacios y separadores conocidos, conservando el valor original y los ceros significativos; no usar coincidencias parciales o aproximadas para asignar automáticamente. Corroborar con cotización, folio de servicio, patente, fecha y detalle. Comparar el monto facturable de los servicios con el neto del documento, no con el total con IVA. Una coincidencia de suma por sí sola no demuestra que sean los servicios correctos. Permitir asignación manual y revisión del PDF junto a los servicios. Mostrar estados «Lista», «Diferencia», «Sin coincidencia», «En disputa» y «Ya registrada».
3. **Revisar el lote.** Una fila por factura; selección individual o de todas las listas; detalle de servicios, diferencias, neto/IVA/total, cierres nuevos y cierres existentes a reutilizar. Un cierre por factura cuando el conjunto sea homogéneo. Separar cubierto/excedente y pagadores según las reglas del sistema; si una factura requiere varios cierres, validar y soportar explícitamente la relación múltiple. Nunca cambiar importes originales ni tarifas para forzar una coincidencia. OC ausente o múltiple requiere tratamiento explícito, sin sobrescribir las referencias de servicios por defecto.
4. **Confirmar y registrar.** Procesar solo las filas seleccionadas y válidas. Crear o reutilizar el cierre compatible, registrar la factura en TMS con `numero_fiscal` original, conservar el folio interno independiente, vincular factura/cierres/servicios/PDF y actualizar los estados correspondientes. No inferir que está pagada por estar emitida. Cuando no exista vencimiento en el PDF, mostrar una propuesta basada en la condición del cliente para revisión.
5. **Resultado y recuperación.** Mostrar por documento: folio fiscal, folio interno, cierres, resultado y error accionable. Guardar el avance para recargar o reintentar sin duplicados. Permitir procesar las listas mientras las observadas permanecen pendientes; exportar el resultado del lote.

## Base existente que se puede aprovechar
- `src/components/vip/BillingBatchImporter.tsx`, `src/hooks/vip/useBillingBatchImport.ts` y `src/utils/billingBatchImport.ts`: flujo Excel/CSV de OC → cierres → facturas, con conciliación y seguimiento de ejecución. Actualmente orientado al contexto de un cliente VIP. Extraer lógica compartida para este flujo por PDF y varios clientes, manteniendo compatible el actual.
- `src/utils/loadPdfJsCompat.ts` y `src/utils/localVipPdfParser.ts`: infraestructura local de lectura PDF/OCR. El parser examinado trata cotizaciones y órdenes de compra; no asumir que ya interpreta facturas SII. Agregar un parser específico con revisión asistida y pruebas sobre PDF reales representativos.
- `src/hooks/closures/useClosureOperations.ts`: reglas de montos, custodia, disputas y relaciones por tipo. La creación actual genera folio leyendo el último cierre y escribe en varias operaciones; antes del lote se debe asegurar asignación concurrente de folios y transacción en servidor.
- `src/hooks/invoices/useInvoiceOperations.ts`: registro del número fiscal, vínculo y actualización de estados. Revisar la atomicidad y el soporte de múltiples cierres antes de reutilizarlo para un proceso masivo.
- `src/utils/closureBilling.ts`: disponibilidad por servicio/tipo y asignación a pagador. Reutilizar estas reglas, sin considerar todo servicio «facturado» totalmente disponible ni totalmente bloqueado.

## Coincidencia por orden de compra
- Mostrar por separado **OC del PDF**, **OC en TMS** y el resultado de la comparación, con las referencias originales disponibles.
- Una OC coincidente identifica candidatos del mismo cliente; no autoriza por sí sola a seleccionar todos sus servicios. Si la OC abarca varias facturas o grupos, conciliar cada factura con sus servicios específicos, sin reutilizar el mismo servicio/tipo.
- OC ausente, ilegible, distinta o varias OC posibles: marcar «Revisar OC» y permitir revisar el PDF y asignar servicios manualmente con confirmación explícita. Nunca inventar una OC ni sobrescribirla en TMS para producir una coincidencia.
- Solo considerar una fila lista cuando cliente/pagador, referencias, servicios disponibles y montos estén conciliados; ninguna igualdad de OC o de total por sí sola basta.
- Probar OC repetida entre clientes, OC compartida por varias facturas, ceros iniciales, diferencias de formato, varias OC en una factura y OC ausente o discordante.

## Etapas de implementación
1. **Lectura y modelo de lote.** Revisar PDF representativos, definir campos y validaciones, parser de facturas, filas normalizadas y almacenamiento de borradores/archivos con permisos. Contemplar documento sin texto: OCR con revisión; documento no compatible: observación explícita.
2. **Conciliación y pantalla.** Buscador de servicios completo y paginado, sugerencias explicables, selección manual, validaciones, detalle PDF y resumen. No usar solo una vista previa limitada de servicios para decidir que no hay coincidencias.
3. **Persistencia segura.** Operación transaccional por factura con autorización en servidor, reserva segura de folios, verificación de disponibilidad al guardar e idempotencia persistente por documento. Revisar el índice actual de `numero_fiscal` y el alcance de la identidad documental (emisor, tipo, folio) antes de modificar restricciones. Evitar estados parciales: cierre huérfano, factura sin vínculo o servicio incorrectamente facturado. Adjuntos con estado explícito y recuperación si falla su carga.
4. **Integración y pruebas.** Progreso, resultados y reintentos; actualizar las vistas de Cierres, Facturas y Servicios. Pruebas de extracción, identificación ambigua, diferencia de montos, duplicado dentro del lote y contra TMS, cierres previos, disputa, cubierta/excedente/custodia, varias OC, fechas ausentes, permisos, concurrencia y recuperación tras fallo o recarga. Validación funcional con archivos reales antes de activar escrituras.

## Criterios de aceptación
- Cada documento registrado conserva los datos revisados del PDF y queda trazable hasta sus servicios.
- El lote no registra automáticamente filas con información incompleta, discrepancias o asociaciones ambiguas.
- Repetir el lote, recargar la pantalla o reintentar un fallo no duplica facturas ni cierres.
- Los servicios con disputas o porciones ya comprometidas no pueden incluirse en un cierre nuevo.
- Una factura emitida no se marca pagada sin evidencia de pago.
- Ninguna acción del flujo envía una emisión nueva al SII.

## Vista previa
Abrir `vista-previa.html`. Permite filtrar, seleccionar las facturas listas, revisar observaciones, confirmar y simular resultados. Los folios mostrados provienen solo de los nombres de la captura y deben verificarse contra el contenido de cada PDF. No es una implementación conectada a TMS ni un lector de PDF.
