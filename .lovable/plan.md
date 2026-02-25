

# Reporte Diario de Pendientes por Email (9:00 AM)

## Objetivo
Enviar automaticamente cada dia a las 9:00 AM (hora de Chile) un email con un PDF adjunto que resuma todos los pendientes criticos del sistema.

## Contenido del Reporte PDF
El PDF incluira las siguientes secciones con tablas detalladas:

1. **Servicios Pendientes de Facturar** - Servicios completados sin factura emitida
2. **Servicios sin Orden de Compra (OC)** - Servicios completados sin OC registrada
3. **Servicios sin Cotizacion** - Servicios sin numero de cotizacion
4. **Facturas Pendientes de Pago** - Facturas vencidas o por vencer, con dias de atraso y montos
5. **Servicios Pendientes de Cierre** - Servicios completados hace mas de 30 dias sin cierre
6. **Documentacion por Vencer** - Permisos, seguros y examenes proximos a expirar

Cada seccion mostrara un contador y una tabla con folio, cliente, fecha, dias pendientes y monto cuando aplique. Al final, un resumen con totales por categoria.

## Arquitectura Tecnica

### 1. Edge Function: `send-daily-pending-report`
Nueva funcion que:
- Consulta directamente a Supabase (con service role) replicando la logica de `usePendingSummary` y `useDailyReport`
- Genera un PDF en memoria usando `jspdf` + `jspdf-autotable` (mismas librerias ya usadas en el proyecto)
- Obtiene el email del destinatario desde `company_data.email` (o un campo nuevo `notification_email`)
- Envia el email via **Resend** con el PDF como attachment en base64
- Usa el branding de la empresa (mismo estilo visual que los otros emails)

### 2. Cron Job con `pg_cron` + `pg_net`
Programar la ejecucion diaria a las 9:00 AM Chile (12:00 UTC en horario normal, 13:00 UTC en horario de verano):
- Usa `cron.schedule()` para invocar la Edge Function via `net.http_post()`
- Se ejecuta de lunes a viernes (dias laborales)

### 3. Configuracion en Settings
Agregar en la seccion de Configuracion del Sistema:
- Toggle para activar/desactivar el reporte diario
- Campo de email(s) destinatario(s) (puede ser mas de uno, separados por coma)
- Selector de hora de envio (por defecto 9:00 AM)
- Estos valores se guardaran en la tabla `company_data` o `system_settings`

## Detalle de Implementacion

### Archivos a crear:
- `supabase/functions/send-daily-pending-report/index.ts` - Edge Function principal

### Archivos a modificar:
- `supabase/config.toml` - Registrar la nueva funcion con `verify_jwt = false`
- `src/components/settings/SystemSettingsTab.tsx` - Agregar seccion de configuracion del reporte diario

### Migracion SQL:
- Agregar campos `daily_report_enabled`, `daily_report_emails`, `daily_report_hour` a `company_data`
- Crear el cron job con `pg_cron` para la ejecucion automatica

### Estructura del PDF:
- Encabezado con logo y nombre de la empresa
- Fecha del reporte
- Secciones con tablas (usando jspdf-autotable)
- Resumen final con contadores por categoria
- Pie de pagina con datos de contacto

