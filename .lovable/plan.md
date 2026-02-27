
# Fix: VIP Pipeline no se actualiza con datos de cotizacion y OC

## Problema
El hook `useClientServices` (que alimenta todo el Pipeline VIP) no escucha el evento `global-data-refresh` que se dispara cuando se actualizan servicios. Otros hooks como `useServicesMetrics` y `useCalendar` si lo escuchan. Esto causa que el pipeline muestre datos desactualizados despues de importar cotizaciones u ordenes de compra.

## Solucion

### Archivo: `src/hooks/useClientServices.ts`

Agregar un `useEffect` que escuche el evento `window:global-data-refresh` y llame a `fetchServicesByClient` cuando se dispare, igual que hacen los demas hooks del sistema.

### Cambio especifico

Despues del `useEffect` existente (linea 156-163), agregar:

```typescript
// Escuchar evento global de refresco de datos
useEffect(() => {
  const handleGlobalRefresh = () => {
    if (clientId) {
      fetchServicesByClient(clientId);
    }
  };

  window.addEventListener('global-data-refresh', handleGlobalRefresh);
  return () => window.removeEventListener('global-data-refresh', handleGlobalRefresh);
}, [clientId, fetchServicesByClient]);
```

Esto asegura que cualquier cambio en servicios (importacion de cotizaciones, OC, cambios de estado, etc.) se refleje automaticamente en el Pipeline VIP sin necesidad de recargar la pagina.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/hooks/useClientServices.ts` | Agregar listener para `global-data-refresh` |
