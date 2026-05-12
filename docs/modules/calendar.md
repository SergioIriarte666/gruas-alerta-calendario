# calendar

## Resumen
Modulo de **calendario** para visualizar y gestionar eventos manuales junto con eventos sinteticos provenientes de servicios y mantenciones.

La vista actual no trabaja solo con `calendar_events`: consolida `calendar_events`, `services` y `crane_maintenance` en una misma experiencia.

## Entrypoints vigentes
- Pagina: [Calendar](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Calendar.tsx)
- Componentes: [src/components/calendar](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/calendar)
- Hook orquestador: `useCalendar`

## Ruta
- `/calendar`

## Arquitectura actual
La pagina se apoya en:
- `CalendarHeader`
- vistas por dia, semana y mes
- `EventsSidebar`
- `EventModal`
- `ConvertEventToServiceModal`
- hook `useCalendar` que compone navegacion y eventos

## Hooks y servicios clave
- `useCalendar`
- `useCalendarEvents`
- `useCalendarNavigation`

## Datos y dependencias principales
- `calendar_events`
- `services`
- `crane_maintenance`

## Flujos vigentes
### 1. Eventos mixtos
- El calendario mezcla eventos manuales con eventos sinteticos `svc-*` y `mnt-*`.
- Los eventos de servicios y mantenciones no deben documentarse como registros editables de `calendar_events`.

### 2. CRUD manual
- Solo los eventos manuales pueden editarse o eliminarse.
- Los eventos sincronizados quedan bloqueados por su origen.

### 3. Conversion a servicio
- Existe flujo para convertir evento a servicio desde vistas y sidebar.
- El modal usa prefill y abre un flujo operativo relacionado con servicios.

### 4. Refresh global
- El modulo escucha refresh global para recargar datos compartidos.

## Consideraciones de mantenimiento
- Usar `useCalendar` como fuente de verdad del modulo.
- No documentar `EventDetailsModal` como parte de la pagina actual de calendario.
- Distinguir siempre entre evento manual y evento sincronizado desde otros dominios.
