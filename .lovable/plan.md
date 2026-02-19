

# Agregar prefijo "OC-" al aplicar Orden de Compra

## Problema

Al aplicar la OC desde el importador PDF, el numero se guarda sin el prefijo "OC-" (ej: `4200490558` en vez de `OC-4200490558`). Esto rompe la uniformidad visual en el pipeline donde los sub-grupos usan el prefijo "OC-".

## Solucion

Modificar la funcion `applyMatches` en `usePurchaseOrderPDFImport.ts` para anteponer el prefijo `OC-` al numero de OC antes de guardarlo, solo si no lo tiene ya.

## Detalle tecnico

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

En la funcion `applyMatches`, al llamar `updateService`, formatear el `ocNumber`:

```typescript
const formattedOC = match.ocNumber.startsWith('OC-') 
  ? match.ocNumber 
  : `OC-${match.ocNumber}`;

await updateService(match.service!.id, {
  purchaseOrder: formattedOC,
  status: 'with_purchase_order' as any,
});
```

Esto asegura que siempre se almacene con el prefijo, sin duplicarlo si ya viene incluido.

