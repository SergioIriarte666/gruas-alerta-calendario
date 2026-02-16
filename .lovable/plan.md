

# Plan: Optimizacion Global de Rendimiento

## Diagnostico

La app muestra "Cargando..." por mas de 3 segundos en todas las paginas. Las causas raiz identificadas son:

### Causa 1: N+1 en `useClosureData.ts` (CRITICA)
El hook obtiene hasta 500 cierres y luego ejecuta una consulta individual a `closure_services` por CADA cierre. En las network requests se observan decenas de llamadas simultaneas a `closure_services?closure_id=eq.XXXX`. Esto genera hasta 500 requests secuenciales.

### Causa 2: Console.log masivo en `NotificationContext.tsx` (ALTA)
Cada vez que se renderiza el contexto de notificaciones (en cada navegacion), se imprime el array completo de notificaciones en consola (`console.log('useNotifications context:', context)`), lo cual incluye objetos JSON enormes que bloquean el hilo principal.

### Causa 3: Queries secuenciales en `useNotificationsData.ts` (ALTA)
Este hook ejecuta ~10 consultas de forma secuencial (una tras otra) en cada carga de pagina porque esta montado globalmente en `NotificationProvider`. Las consultas podrian ejecutarse en paralelo con `Promise.all`.

### Causa 4: 2,035 console.log en 73 archivos de hooks (MEDIA)
Contamina el hilo principal con serialization de objetos complejos en cada operacion.

---

## Solucion

### Cambio 1: `src/hooks/closures/useClosureData.ts`
Reemplazar el bucle N+1 por una unica consulta batch. En vez de hacer `Promise.all` con 500 queries individuales, obtener TODOS los `closure_services` de una vez con `.in('closure_id', allClosureIds)` y luego agrupar en memoria.

```
// ANTES: 500 queries individuales
const closuresWithServices = await Promise.all(
  basicClosures.map(async (closure) => {
    const { data } = await supabase
      .from('closure_services')
      .select('service_id')
      .eq('closure_id', closure.id);
    ...
  })
);

// DESPUES: 1 sola query
const allClosureIds = basicClosures.map(c => c.id);
const { data: allClosureServices } = await supabase
  .from('closure_services')
  .select('closure_id, service_id')
  .in('closure_id', allClosureIds);

// Agrupar en memoria
const servicesByClosureId = new Map();
(allClosureServices || []).forEach(cs => {
  if (!servicesByClosureId.has(cs.closure_id)) {
    servicesByClosureId.set(cs.closure_id, []);
  }
  servicesByClosureId.get(cs.closure_id).push(cs);
});
```

Tambien eliminar los `console.log` de debug del archivo.

### Cambio 2: `src/contexts/NotificationContext.tsx`
Eliminar los 6 `console.log` de debug que imprimen el contexto completo de notificaciones en cada renderizado. Estos son logs de desarrollo que no deberian estar en produccion.

### Cambio 3: `src/hooks/useNotificationsData.ts`
Paralelizar las ~10 queries usando `Promise.all` en vez de ejecutarlas secuencialmente. Agrupar las consultas independientes:

```
// ANTES: secuencial
const { data: urgentServices } = await supabase...
const { data: weekServices } = await supabase...
const { data: overdueData } = await supabase.rpc(...)
const { data: invoicesDueSoon } = await supabase.rpc(...)
// ... 6 mas

// DESPUES: paralelo
const [
  urgentServicesRes,
  weekServicesRes,
  overdueRes,
  dueSoonRes,
  oldDraftRes,
  expiringCranesRes,
  expiringOperatorsRes,
  closedServiceIdsRes,
  invoicedClosureIdsRes
] = await Promise.all([
  supabase.from('services')...,
  supabase.from('services')...,
  supabase.rpc('get_overdue_invoices_for_alerts'),
  supabase.rpc('get_invoices_due_soon', { days_ahead: 7 }),
  supabase.from('invoices')...,
  supabase.from('cranes')...,
  supabase.from('operators')...,
  supabase.from('closure_services').select('service_id'),
  supabase.from('invoice_closures').select('closure_id')
]);
```

Nota: Las 2 queries finales que dependen de `closedIds` (servicios pendientes de cierre >30 dias y >60 dias) se ejecutaran despues del `Promise.all` ya que dependen del resultado.

### Cambio 4: Limpieza masiva de console.log en hooks
Eliminar los `console.log` de debug de los hooks mas criticos que se ejecutan en cada pagina:

- `src/hooks/closures/useClosureData.ts` - 6 logs
- `src/hooks/useClosuresForInvoices.ts` - 5 logs
- `src/hooks/useDailyReport.ts` - 1 log restante
- `src/hooks/services/useServiceManager.ts` - ~15 logs pesados
- `src/hooks/useOperatorServicesTabs.ts` - 5 logs

---

## Resultado esperado

- De ~500+ requests N+1 a 1 sola query batch para cierres
- De ~10 queries secuenciales a ~9 en paralelo para notificaciones
- Eliminacion de logs que serializan objetos grandes en cada renderizado
- Tiempo de carga estimado: de 3+ segundos a menos de 1 segundo

## Archivos a modificar

1. `src/hooks/closures/useClosureData.ts` - Batch query + limpieza logs
2. `src/contexts/NotificationContext.tsx` - Limpieza logs
3. `src/hooks/useNotificationsData.ts` - Paralelizar queries
4. `src/hooks/useClosuresForInvoices.ts` - Limpieza logs
5. `src/hooks/useDailyReport.ts` - Limpieza log restante
6. `src/hooks/services/useServiceManager.ts` - Limpieza logs pesados
7. `src/hooks/useOperatorServicesTabs.ts` - Limpieza logs

