# Servicios futuros: causa raíz y dónde mostrarlos

## Diagnóstico

### 1. Reporte de Pendientes (causa principal)
`src/hooks/usePendingSummary.ts` filtra **solo** servicios con `status = 'completed'` en sus dos queries de servicios (líneas 71 y 80). Los servicios futuros tienen status `pending`, `quoted`, `purchase_order_pending`, `with_purchase_order` o `in_progress` → **nunca entran en ninguna categoría**. Además, la interfaz `PendingSummaryData` no tiene una sección para "Próximos servicios".

### 2. Calendario (bug menor de mapeo de status)
`src/hooks/useCalendarEvents.ts` **sí descarga** los servicios futuros (sin filtro de status ni fecha, líneas 38‑42) y `getEventsForDate` compara correctamente. Los futuros deberían verse al navegar al mes correspondiente.

Problemas detectados:
- `serviceStatusMap` (líneas 61‑67) incluye `en_route` (no existe en el enum de BD) y **omite** status válidos: `quoted`, `purchase_order_pending`, `with_purchase_order`, `invoiced`, `inspection_completed`, `failed`. Caen al fallback `'scheduled'` y se pintan todos verdes ("completados" visualmente confuso), lo que hace que el usuario perciba que "no aparecen como futuros".
- El header del Calendario no avisa cuántos servicios programados existen en el mes actual / próximo, así que si están en otro mes pasan desapercibidos.

### 3. Dashboard
`useDashboardData.ts` calcula `metrics.futureServices` pero el número no se expone como tarjeta/link navegable; no hay forma de ver el listado.

---

## Cambios propuestos (solo UI + lectura de datos, sin tocar lógica de negocio)

### A. `src/hooks/usePendingSummary.ts`
1. Añadir 5ª query: servicios con `service_date >= today` y `status IN ('pending','quoted','purchase_order_pending','with_purchase_order','in_progress')`, ordenados por fecha ascendente, limit 100.
2. Extender `PendingSummaryData` con:
   ```ts
   upcomingServices: UpcomingService[]  // {id, folio, serviceDate, clientName, daysUntil, status}
   ```
3. Sumar `upcomingServices.length` al cálculo de `totalCritical` solo si `daysUntil <= 3` (urgencia operativa). El resto cuenta como informativo.

### B. `src/components/dashboard/PendingSummaryModal.tsx`
Añadir un `PendingCategoryCard` nuevo "Próximos servicios" con icono `CalendarClock` (violeta, según design tokens), mostrando folio, cliente, fecha y badge "en X días". Patrón visual idéntico al del módulo Costos.

### C. `src/hooks/useCalendarEvents.ts`
Reemplazar `serviceStatusMap` por uno alineado al enum real:
```ts
const serviceStatusMap = {
  pending: 'scheduled',
  quoted: 'scheduled',
  purchase_order_pending: 'scheduled',
  with_purchase_order: 'scheduled',
  in_progress: 'scheduled',
  inspection_completed: 'scheduled',
  invoiced: 'completed',
  completed: 'completed',
  cancelled: 'cancelled',
  failed: 'cancelled',
};
```
(Elimina `en_route`.)

### D. `src/pages/Calendar.tsx` (header)
Mostrar un contador discreto: "📅 X servicios programados este mes · Y próximos". Permite ver de un vistazo que sí hay futuros aunque la vista actual esté vacía.

### E. Dashboard — tarjeta navegable
Convertir el KPI `futureServices` existente en un link/MetricCard que abra el `PendingSummaryModal` con la sección "Próximos servicios" expandida (o navegue a `/services?filter=upcoming`). Sin lógica nueva, solo onClick.

---

## Otros lugares donde también deberían visibilizarse (recomendado)

| Ubicación | Acción |
|---|---|
| **Sidebar/Notificaciones** | Badge con count de servicios programados para "mañana" |
| **WhatsApp daily-alerts** (ya existe edge function) | Incluir lista de servicios programados para el día siguiente en el resumen diario que envía a admins/operadores |
| **Operator App / OperatorDashboard** | Sección "Mis próximos servicios" filtrando por `operator_id = auth.uid()` y `service_date >= today` |

Estos tres puntos son opcionales — confirma cuáles quieres incluir en esta iteración o si los dejamos para una fase posterior.

---

## Archivos a modificar

- `src/hooks/usePendingSummary.ts` (query + tipo + total)
- `src/components/dashboard/PendingSummaryModal.tsx` (nueva categoría)
- `src/hooks/useCalendarEvents.ts` (status map)
- `src/pages/Calendar.tsx` o `src/components/calendar/CalendarHeader.tsx` (contador)
- `src/pages/Dashboard.tsx` (link en KPI `futureServices`)

Sin migraciones de BD. Sin cambios en edge functions (a menos que apruebes el punto de WhatsApp).
