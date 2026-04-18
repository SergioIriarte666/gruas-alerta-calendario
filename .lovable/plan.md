

# Plan: Fuente única de verdad para fechas — Business Timezone

## Diagnóstico (verificado)
- **334 usos** de `new Date()` / `Date.now()` directos en el código → cada uno toma la hora del navegador (UTC interno).
- **3 fuentes de verdad coexistiendo**, lo cual es el origen del caos:
  1. `new Date()` directo (navegador, sin TZ).
  2. `getCurrentChileDate()` / `getCurrentChileDateString()` → usa `user_settings.timezone` (cada usuario distinto).
  3. `getBusinessTimezone()` → lee `company_data.report_timezone` ✅ (la correcta, pero solo usada en alertas/reportes).
- BD verificada: `company_data.report_timezone = 'America/Santiago'`, `report_use_system_timezone = false`. **Esta es la fuente de verdad designada.**
- Inserts inconsistentes: unos guardan `YYYY-MM-DD` (medianoche UTC → desfase visual de 1 día), otros guardan ISO completo (`new Date().toISOString()` → hora UTC del navegador, no de Chile).
- Resultado: registros aparecen en días equivocados, ordenamientos rotos, "consumo inmediato" cae al fondo de listas, alertas se disparan en momentos incorrectos.

## Solución: Capa única `businessClock`

Crear un módulo **`src/utils/businessClock.ts`** que sea la **única forma autorizada** de obtener "ahora" y "hoy" en toda la app. Lee `company_data.report_timezone` con cache sincrónico precargado al boot.

### API (síncrona, lista para usar en cualquier lado)
```ts
businessClock.now()         // Date — instante actual ajustado a TZ negocio
businessClock.nowISO()      // string ISO — para guardar en BD (created_at, updated_at, movement_date)
businessClock.today()       // string 'YYYY-MM-DD' — para campos date-only
businessClock.todayDate()   // Date — hoy 12:00 en TZ negocio
businessClock.format(d, fmt)// string — formato consistente
businessClock.timezone()    // string — 'America/Santiago'
```

### Bootstrap
- Precarga al iniciar la app (en `App.tsx`, antes de routing) → cache disponible síncrono el resto de la sesión.
- Refresca cada 5 min y al cambiar configuración en `TimezoneSettingsTab`.
- Fallback `America/Santiago` si BD no responde.

## Migración (3 fases sin romper nada)

### Fase 1 — Núcleo (alto impacto, bajo riesgo)
1. **Crear** `src/utils/businessClock.ts` + bootstrap en `App.tsx`.
2. **Reemplazar en `UnifiedPurchaseService.ts`**: todos los `movement_date` y `created_at` → `businessClock.nowISO()`. Esto resuelve el bug actual (consumos con timestamp medianoche UTC).
3. **Reemplazar en hooks de costos/inventario/servicios** (`useCosts`, `useServices`, `useInventoryMovements`, `useCranePartsTechnical`, `useUnifiedParts`, `useSupplierPayments`): cualquier `new Date().toISOString()` para `updated_at`/`created_at`/`movement_date` → `businessClock.nowISO()`.
4. **Reemplazar `format(new Date(), 'yyyy-MM-dd')`** en formularios (Debt, Invoice, Payment, etc.) → `businessClock.today()`.

### Fase 2 — UI y formato
5. **Listados y tablas** (Costos, Inventario, Servicios, Crane Parts): ordenar siempre por `created_at DESC` (timestamp confiable post-Fase 1) en vez de `movement_date` o `date`.
6. **Cambiar fechas mostradas** a usar `formatForDisplay` / `formatForDisplayWithTime` ya existentes (que respetan `user_settings`), pero garantizando que el **dato fuente** ya viene en TZ negocio.
7. **Eliminar `getCurrentChileDate*`** progresivamente (mantener como alias deprecado a `businessClock.*` para no romper).

### Fase 3 — Validación BD (trigger defensivo)
8. **Trigger SQL** en tablas críticas (`costs`, `inventory_movements`, `crane_parts`, `services`, `payments`) que si reciben `created_at = NULL` o `movement_date = '00:00:00'` los rellena con `now() AT TIME ZONE 'America/Santiago'`. Última línea de defensa.

## Archivos afectados (estimado)
- **Nuevo**: `src/utils/businessClock.ts` (~120 líneas)
- **Modificados**: ~25 archivos críticos en Fase 1 (servicios, hooks de mutación, formularios principales)
- **Modificados**: ~40 archivos en Fase 2 (componentes UI con `format(new Date(), …)`)
- **Migración SQL**: 1 (triggers defensivos)

## Lo que NO se toca
- `formatForDisplay`, `formatForDisplayWithTime`, `safeParseDateOnly` — **ya están bien**, siguen siendo la API de presentación.
- `user_settings.timezone` / `date_format` — siguen controlando el **formato visual** por usuario (DD/MM vs MM/DD), pero la **fuente del dato** será siempre TZ negocio.
- Datos históricos en BD: no se modifican (Fase 3 solo aplica a inserts futuros).
- RLS, lógica de negocio, sincronizaciones triangulares.

## Resultado esperado
- ✅ Un solo "reloj" en toda la app: `businessClock`.
- ✅ Consumos de inventario aparecen al inicio de listados (timestamp real).
- ✅ Costos, servicios y movimientos se registran con la fecha+hora de Chile (no UTC del navegador del usuario).
- ✅ Alertas, reportes mensuales y dashboards usan el mismo "hoy" en cualquier dispositivo.
- ✅ Si mañana se cambia `report_timezone` en configuración a otra zona, **toda la app se ajusta automáticamente** sin tocar código.

## Riesgo
- **Bajo-medio**. El cambio es aditivo: `businessClock` reemplaza `new Date()` punto a punto. Cada reemplazo es local y revertible. Fase 1 + 2 se pueden desplegar incrementalmente con verificación visual.

