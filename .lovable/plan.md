# Plan: reparación definitiva de fechas en toda la app

## Objetivo
Dejar una sola fuente de verdad para fechas y zona horaria en toda la aplicación: la configuración horaria definida en la app. Eliminar cualquier cálculo, filtro, comparación o renderizado que hoy dependa del navegador, de la zona del usuario o de parseos inseguros de `Date`.

## Qué voy a cambiar

1. **Consolidar una única fuente de verdad**
   - Usar la configuración global de la app (`company_data.report_timezone` / `report_use_system_timezone`) como base para toda lógica de negocio.
   - Mantener `dateFormat` como preferencia visual del usuario, pero dejar de usar `user_settings.timezone` para cálculos o conversiones de negocio.
   - Alinear `timezoneUtils` con `businessClock` para que no existan dos caminos distintos compitiendo.

2. **Endurecer utilidades de fecha**
   - Separar claramente:
     - `date-only` (`YYYY-MM-DD`) para columnas tipo fecha.
     - `timestamp` / `timestamptz` para eventos con hora.
   - Centralizar helpers seguros para:
     - parseo
     - formato
     - comparaciones
     - rangos (hoy/semana/mes)
     - diferencias en días
   - Prohibir en la práctica los patrones inseguros detectados: `new Date('YYYY-MM-DD')`, `toISOString().split('T')[0]`, `toDateString()`, `toLocaleDateString()` para lógica.

3. **Auditar y corregir toda la app por módulos**
   - Reemplazar usos inseguros en listados, filtros, badges, exportaciones, dashboards, portal, VIP, costos, facturas, servicios e inventario.
   - Corregir especialmente los casos donde hoy se usan fechas directas del navegador para:
     - “hoy”
     - vencimientos
     - overdue
     - rango semanal/mensual
     - ordenamiento
     - matching por fecha
   - Homologar componentes que muestran fechas para que formateen siempre con helpers comunes.

4. **Ajustar la pantalla de configuración horaria**
   - Hacer explícito en UI y código que la zona horaria global de la app es la fuente de verdad.
   - Evitar que la preview o el guardado mezclen configuración global con timezone personal.
   - Disparar invalidación de caché de fecha/hora de forma consistente al guardar cambios.

5. **Inicialización y consistencia de runtime**
   - Precargar la zona horaria global al iniciar la app para evitar renders iniciales con timezone equivocada.
   - Asegurar que cambios de configuración refresquen cálculos derivados sin necesidad de recargar manualmente.

6. **Validación final completa**
   - Revisar flujos críticos con foco en regresiones:
     - creación/edición de registros con fecha
     - filtros por fecha
     - vencimientos de facturas
     - importadores PDF/XML/CSV
     - exports
     - vistas portal/VIP
   - Confirmar que un mismo registro se vea igual en toda la app bajo la misma configuración horaria.

## Resultado esperado
- La misma fecha se verá y se calculará igual en toda la app.
- No habrá desfases por navegador, GMT local o zona del usuario.
- “Hoy”, “semana”, “mes”, vencimientos y comparaciones usarán siempre la configuración horaria definida en la app.

## Detalles técnicos
- Base de negocio: `businessClock` + helpers seguros de `date-only`.
- `user_settings.dateFormat` seguirá vivo solo para presentación del formato.
- `user_settings.timezone` dejará de influir en lógica de fechas de negocio.
- Reemplazos típicos:
  - `new Date(dateString)` para `YYYY-MM-DD` → `safeParseDateOnly(...)`
  - comparaciones con `new Date()` → `businessClock.today()` / helpers basados en TZ global
  - formateo manual/local del navegador → helpers unificados de `timezoneUtils`
- No voy a tocar alcance ajeno al problema salvo lo necesario para dejar la arquitectura consistente.

## Archivos que probablemente tocaré
- `src/utils/timezoneUtils.ts`
- `src/utils/businessClock.ts`
- `src/main.tsx` / arranque de la app
- `src/components/settings/TimezoneSettingsTab.tsx`
- páginas y hooks con filtros/comparaciones por fecha (`Costs`, `Invoices`, portal, VIP y módulos relacionados)

## Criterio de cierre
Daré esto por resuelto solo cuando la app quede usando una sola lógica horaria global y los puntos críticos de fechas queden alineados de punta a punta.