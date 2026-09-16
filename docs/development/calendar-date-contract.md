# Fechas del TMS: contrato y revisión global

## Regla
Una fecha ingresada es un día calendario `YYYY-MM-DD`. Se guarda y se presenta
sin convertirla a UTC ni a la zona horaria del dispositivo. El 11 de septiembre
sigue siendo 11 al crear, listar, editar, filtrar, importar y exportar.

Las horas reales (`created_at`, GPS, auditoría y movimientos con hora) son
instantes. Se muestran en `company_data.report_timezone`. Esa configuración
es la fuente del día comercial; la opción histórica de usar la zona del navegador
ya no reemplaza la configuración del TMS. El reloj del dispositivo aún aporta
el instante a las acciones del cliente: esto no incorpora un servicio de reloj remoto.

## Uso en código
- `calendarDateString`: serializar componentes del selector de fecha.
- `parseDateValue`: adaptar una fecha calendario a controles/date-fns, sin UTC.
- `businessClock.format`: pasar directamente la fecha `YYYY-MM-DD` o el timestamp.
- `differenceInCalendarDates` / `addCalendarDays`: cálculos por días, sin asumir 24 horas.
- `businessClock.today`: día actual del TMS.
- `businessClock.toTimestamp`: solo cuando un selector de día escribe en timestamptz.
- `getBusinessTimestampBounds`: límites completos del día comercial, incluido DST.

No convertir el Date de un calendario con `toISOString`. No pasar ese Date a
un formateador de instantes; serializar sus componentes primero. Para fechas
calendario puras, no usar `new Date('YYYY-MM-DD')`.

## Alcance revisado
Facturas y pagos, servicios/cierres/VIP/portal, proveedores, costos y compras,
inventario y grúas, documentos y vencimientos, calendarios, importaciones
Excel/XML/OCR, reportes PDF/Excel, y plantillas de correo del servidor.
Se corrigieron agrupaciones mensuales, vencimientos, rangos de reportes y
conversiones que restaban un día. La edición de un movimiento sin cambiar su
fecha conserva su hora original.

La migración añade `business_timezone`, `business_date`, `business_today`,
actualiza referencias CURRENT_DATE en funciones, vistas y defaults DATE existentes,
y las conversiones calificadas de created_at/movement_date a date en funciones.
Conserva las definiciones actuales de RPCs y deja de reemplazar la hora ingresada
en el trigger de inventario. No reescribe datos históricos.

## Verificación
- `npm run check:dates`: comprobación estática de conversiones inseguras conocidas.
- `npm run test:dates`: días 2024–2027, años bisiestos, ida/vuelta de formularios,
  factura creada/editada/resumen, cierre de mes, cambios de horario, rangos
  completos de día, seriales Excel y documentos comerciales.
- Ejecutar esas pruebas con TZ=America/Santiago, UTC, Asia/Tokyo y Pacific/Kiritimati.
  El workflow calendar-dates.yml lo repite en CI.
- `npm run build`.
- `supabase/tests/business_calendar_dates.sql`: invariantes PostgreSQL después
  de la migración. También se probó la migración con fixtures en PGlite, en las
  cuatro zonas, verificando RPCs, defaults y preservación del instante del movimiento.

La comprobación estática es una barrera para patrones conocidos, no una prueba
exhaustiva de toda conversión posible. La suite completa tiene fallos previos
ajenos a fechas en los contratos visuales global/operaciones y el test Deno de R2.
El chequeo de tipos del repositorio también tiene errores previos.

## Publicación y datos anteriores
Estos cambios requieren desplegar el frontend, aplicar la migración y publicar
send-operator-notification, send-service-confirmation, send-invoice-email,
send-payment-reminder y whatsapp-daily-alerts. No fueron aplicados a producción
como parte de esta revisión local.

Antes de publicar, probar la migración sobre una copia del esquema completo vigente;
la prueba aislada no sustituye esa validación. Después comprobar crear/listar/editar
un documento fechado 11/09, otro el día 1 y filtros del cierre mensual.
No sumar un día masivamente: los registros que ya se guardaron con una fecha
incorrecta requieren cotejo con su documento original.
