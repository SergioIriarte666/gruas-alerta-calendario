

# Agregar matching por glosa de la OC

## Problema actual

Cuando un item del PDF no tiene patente, el sistema solo puede hacer match por:
1. Numero de OC ya asignado (raro en items nuevos)
2. Monto exacto (poco confiable si hay varios servicios con el mismo valor o valor $0)

La **glosa/descripcion** del item siempre esta presente en la OC (ej: "Traslado de Vehiculos", "Custodia de Vehiculos") y puede compararse contra el **tipo de servicio** (`serviceType.name`) registrado en el sistema.

## Solucion

Agregar un nuevo paso de fallback que compare la glosa del PDF con el nombre del tipo de servicio, usando coincidencia por subcadena normalizada (sin tildes, minusculas).

### Orden de matching propuesto (cuando no hay patente)

```text
1. Fallback 1: Mismo numero de OC ya asignado
2. Fallback 2: Match por glosa + monto (NUEVO)
3. Fallback 3: Match solo por monto (existente, como ultimo recurso)
```

## Detalle tecnico

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

**Agregar funcion de normalizacion de texto** (sin tildes, minusculas, sin espacios extra):

```typescript
const normalizeText = (t: string) => 
  (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
```

**Nuevo Fallback 2 - Match por glosa del servicio:**

Entre el fallback por OC existente y el fallback por monto, agregar:

```typescript
// Fallback 2: Match by description/glosa against service type name
const glosaNorm = normalizeText(item.detail);
if (glosaNorm) {
  const serviceByGlosa = clientServices.find(s =>
    !usedServiceIds.has(s.id) &&
    !s.purchaseOrder && !s.purchaseOrderNumber &&
    s.serviceType?.name &&
    (normalizeText(s.serviceType.name).includes(glosaNorm) ||
     glosaNorm.includes(normalizeText(s.serviceType.name)))
  );
  if (serviceByGlosa) {
    usedServiceIds.add(serviceByGlosa.id);
    matches.push({
      parsedItem: item,
      service: serviceByGlosa,
      ocNumber: oc.ocNumber,
      fileName: oc.fileName,
      status: 'matched',
    });
    continue;
  }
}
```

La comparacion bidireccional (`includes` en ambas direcciones) permite que:
- "Traslado de Vehiculos" (glosa) matchee con "Traslado Por Tierra" via "traslado"
- "Custodia de Vehiculos" matchee con "Custodia de Vehiculos"

**Refinamiento**: Si ademas el monto coincide, priorizar ese match. Si hay multiples candidatos por glosa, el que tenga monto mas cercano gana.

### Archivo modificado
- `src/hooks/vip/usePurchaseOrderPDFImport.ts`

## Resultado esperado

- Items sin patente pero con glosa "Traslado de Vehiculos" encontraran servicios del tipo "Traslado Por Tierra" automaticamente.
- El matching sera mas preciso y reducira los "Sin match" en OCs sin patente visible.
