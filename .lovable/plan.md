
# Fix: Contador de servicios no se actualiza al crear un servicio

## Problema

El hook `useServicesMetrics` usa `useState`/`useEffect` directo con Supabase (no React Query). Despues de crear un servicio, no hay nada que dispare un refetch de las metricas. El hook expone una funcion `refetch`, pero nadie la llama. Tampoco escucha el evento `global-data-refresh` que se dispara tras mutaciones.

## Solucion

### Archivo: `src/hooks/services/useServicesMetrics.ts`

Agregar un `useEffect` que escuche el evento `global-data-refresh` del `window` y llame a `fetchData` cuando se dispare. Esto conecta el hook con el sistema existente de refresh global que ya se activa al crear/editar/eliminar servicios.

Cambio concreto: despues del `useEffect` existente (linea 130-132), agregar:

```typescript
// Escuchar evento global de refresh para actualizar metricas
useEffect(() => {
  const handleGlobalRefresh = () => {
    console.log('🔄 [ServicesMetrics] Global refresh detectado, actualizando metricas...');
    fetchData();
  };
  
  window.addEventListener('global-data-refresh', handleGlobalRefresh);
  return () => window.removeEventListener('global-data-refresh', handleGlobalRefresh);
}, [dateFilter]);
```

### Resultado

- Al crear, editar o eliminar un servicio, el contador "Total Servicios" y las demas metricas se actualizan automaticamente
- No requiere cambios en otros archivos porque el sistema de `global-data-refresh` ya se dispara desde `refreshAllServiceData` en las mutaciones existentes
