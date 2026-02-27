
# Fix: Importador de OC no encuentra servicios facturados

## Problema
El importador de OC excluye servicios con estado `invoiced` del pool de candidatos. El servicio SRV-6398 (con COT-4100 y OC-4200490558) esta en estado "Facturado", por lo que nunca se encuentra durante el matching.

El PDF no contiene patente (solo dice "TRASLADO UNIDAD PLV"), asi que el sistema usa fallbacks (referencia de cotizacion, monto, etc.), pero ninguno funciona porque el servicio ya esta filtrado.

## Solucion

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

Agregar `'invoiced'` al filtro de estados en linea 165-170:

```typescript
clientServices = clientServices.filter(s => 
  s.status === 'quoted' || 
  s.status === 'purchase_order_pending' || 
  s.status === 'completed' || 
  s.status === 'with_purchase_order' ||
  s.status === 'invoiced'
);
```

Esto permite que el importador detecte servicios ya facturados y los muestre como "Ya asignada" (same_oc) o "OC diferente" (already_has_oc), dando visibilidad completa al usuario.

### Mismo fix en `src/hooks/vip/useQuotePDFImport.ts`

Agregar `'invoiced'` y `'with_purchase_order'` al filtro equivalente (linea ~130) para consistencia:

```typescript
clientServices = clientServices.filter(s =>
  s.status === 'completed' ||
  s.status === 'purchase_order_pending' ||
  s.status === 'quoted' ||
  s.status === 'with_purchase_order' ||
  s.status === 'invoiced'
);
```

## Resultado esperado
Al importar el PDF de OC 4200490558, el sistema encontrara el servicio SRV-6398 (que tiene COT-4100) via el fallback de referencia de cotizacion y mostrara estado "Ya asignada" (same_oc).
