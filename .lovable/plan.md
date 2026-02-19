

# Filtrar servicios facturados y evitar duplicados en el importador de OC

## Problema

El importador de OC desde PDF presenta dos fallos:

1. **Servicios facturados como candidatos**: Servicios con estado `invoiced` no deben ser elegibles para asignar una OC nueva, ya que estan cerrados contablemente.
2. **Mismo servicio duplicado**: Cuando el PDF tiene multiples items sin patente, el fallback por monto puede asignar el mismo servicio a varios items porque no se marca como "ya usado".

## Solucion

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

**Cambio 1 - Excluir servicios facturados del pool de candidatos**

Despues de obtener `clientServices`, filtrar los que tengan `status === 'invoiced'`:

```text
// Excluir servicios facturados del matching
clientServices = clientServices.filter(s => s.status !== 'invoiced');
```

**Cambio 2 - Deduplicar: evitar asignar el mismo servicio a multiples items**

Usar un `Set<string>` para rastrear los IDs de servicios ya asignados. Antes de hacer match, verificar que el servicio no este en el set. Al confirmar un match, agregarlo.

```text
const usedServiceIds = new Set<string>();

// En cada punto donde se hace match exitoso:
if (serviceByAmount && !usedServiceIds.has(serviceByAmount.id)) {
  usedServiceIds.add(serviceByAmount.id);
  matches.push({ ... });
}
```

Esto aplica a todos los caminos de matching: por patente, por OC existente y por monto.

## Resultado esperado

- Los servicios facturados ya no apareceran como candidatos.
- Cada servicio solo podra asignarse a un item del PDF, evitando filas duplicadas.

