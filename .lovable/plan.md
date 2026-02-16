

# Plan: Optimizar carga del Informe Diario (N+1 queries)

## Problema

El hook `useDailyReport.ts` tiene dos bucles `for` que ejecutan una consulta individual a `invoice_services` por cada servicio completado para verificar si ya fue facturado. Si hay 50 servicios completados, son 100 consultas secuenciales adicionales a la base de datos, causando tiempos de carga de varios segundos.

## Solucion

Reemplazar las consultas individuales por una sola consulta batch que obtiene todos los `service_id` de `invoice_services` de una vez, y luego filtra en memoria.

## Detalle Tecnico

### Archivo: `src/hooks/useDailyReport.ts`

**Cambio 1 - Lineas 149-166 (primer bucle N+1):**

Antes (una query por servicio):
```typescript
for (const service of allServices) {
  if (service.status === 'completed') {
    const { data: existsInInvoice } = await supabase
      .from('invoice_services')
      .select('service_id')
      .eq('service_id', service.id)
      .maybeSingle();
    // ...
  }
}
```

Despues (una sola query batch):
```typescript
const completedServiceIds = allServices
  .filter(s => s.status === 'completed')
  .map(s => s.id);

const { data: invoicedServices } = completedServiceIds.length > 0
  ? await supabase
      .from('invoice_services')
      .select('service_id')
      .in('service_id', completedServiceIds)
  : { data: [] };

const invoicedServiceIds = new Set(
  (invoicedServices || []).map(is => is.service_id)
);

// Filtrar en memoria
for (const service of allServices) {
  if (service.status === 'completed' && !invoicedServiceIds.has(service.id)) {
    if (service.purchase_order_number) {
      pendingInvoicingWithPO.push(service);
    } else {
      pendingInvoicingWithoutPO.push(service);
    }
  }
}
```

**Cambio 2 - Lineas 255-303 (segundo bucle N+1):**

Mismo patron: obtener todos los `service_id` facturados en una sola consulta y filtrar en memoria en vez de consultar uno por uno.

**Cambio 3 - Eliminar logs de debug:**

Remover los `console.log` extensos de debug de supplier payments (lineas 215-251) que agregan ruido innecesario.

### Resultado esperado

- De ~100+ consultas secuenciales a ~9 consultas paralelas (las 7 originales del `Promise.all` + 2 batch de `invoice_services`)
- Tiempo de carga reducido drasticamente (de varios segundos a menos de 1 segundo)
- Sin cambios en la funcionalidad ni en la UI

### Archivo adicional: build error

Corregir el error de build en `supabase/functions/send-inspection-email/index.ts` que importa `npm:resend@2.0.0` sin tenerlo en las dependencias de Deno. Se ajustara el import para usar el patron correcto de importacion en edge functions.

