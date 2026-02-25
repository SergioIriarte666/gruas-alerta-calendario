

# Plan: Unificar Zona Horaria como Fuente Unica de Verdad

## Problema Detectado

Hay 3 causas raiz que generan diferencias entre el PDF del Dashboard y el PDF por correo:

1. **Dashboard usa hora del navegador**: `startOfToday()` usa el reloj del navegador, no la zona horaria configurada en Configuracion.
2. **Correo usa "America/Santiago" hardcodeado**: La Edge Function fuerza `America/Santiago` sin consultar la configuracion del usuario.
3. **Error silencioso en "Servicios del Dia"**: El Dashboard consulta una columna `service_type` que no existe en la tabla `services`, causando un error 400 que hace que esa seccion se muestre vacia (0 programados, 0 completados, etc.), mientras el correo funciona bien.

## Solucion

### 1. Crear funcion auxiliar de zona horaria en el PDF del Dashboard

Modificar `src/utils/pdf/pendingReportPDF.ts`:

- Antes de calcular `today`, obtener la zona horaria del usuario desde `user_settings` (via Supabase query directa).
- Si el usuario tiene `use_system_timezone = true`, congelar la zona detectada del navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Si tiene zona manual, usar esa.
- Calcular `today` usando esa zona horaria con `date-fns-tz` para que sea identica a la que usa el correo.

### 2. Edge Function: leer zona horaria de `user_settings`

Modificar `supabase/functions/send-daily-pending-report/index.ts`:

- Consultar la tabla `user_settings` para obtener la zona horaria configurada (se toma el primer registro encontrado ya que es una empresa de un solo usuario admin).
- Si `use_system_timezone = true`, guardar la zona detectada en la tabla al momento de generar el reporte (o usar el valor previamente congelado). Como la Edge Function no tiene acceso al navegador, se usara el valor almacenado en `user_settings.timezone` como fallback.
- Reemplazar el hardcode `America/Santiago` por la zona obtenida.

### 3. Corregir error de columna `service_type`

En `src/utils/pdf/pendingReportPDF.ts`, la funcion `fetchTodayServices` (linea 21) consulta `service_type` que no existe. Cambiar a `service_type_id` o eliminar ese campo de la consulta y de la tabla del PDF para que coincida con el correo (que solo muestra Folio, Cliente, Estado).

### 4. Igualar estructura de tablas entre ambos PDFs

Ambos PDFs deben tener exactamente las mismas columnas en cada seccion:
- **Servicios del Dia**: Folio, Cliente, Estado (3 columnas, como el correo).
- **Pendientes de Facturar**: Folio, Cliente, Fecha, Dias, Valor (5 columnas en Dashboard; el correo tiene 4 sin Valor - agregar Valor al correo).

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/pdf/pendingReportPDF.ts` | Usar zona horaria de configuracion; corregir columna `service_type`; igualar estructura de tablas |
| `supabase/functions/send-daily-pending-report/index.ts` | Leer zona horaria de `user_settings` en lugar de hardcodear `America/Santiago`; igualar columna Valor en Pendientes de Facturar |

## Detalle Tecnico

```text
+---------------------------+       +---------------------------+
|  Dashboard PDF            |       |  Email PDF (Edge Fn)      |
|  pendingReportPDF.ts      |       |  send-daily-pending-report|
+---------------------------+       +---------------------------+
         |                                   |
         v                                   v
   Query user_settings              Query user_settings
   (timezone, use_system_tz)        (timezone, use_system_tz)
         |                                   |
         v                                   v
   Si use_system=true:               Si use_system=true:
     Intl...timeZone                   Usa timezone guardado
   Si no:                            Si no:
     user_settings.timezone            user_settings.timezone
         |                                   |
         v                                   v
   toLocaleDateString(tz)            toLocaleDateString(tz)
   (misma fecha "hoy")              (misma fecha "hoy")
```

## Resultado Esperado

Ambos PDFs mostraran exactamente los mismos datos, mismas columnas, mismos conteos y mismas fechas, independientemente de donde se generen (boton Dashboard o correo automatico). La zona horaria configurada en Configuracion > Zona Horaria sera la unica fuente de verdad.

