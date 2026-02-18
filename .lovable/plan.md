
# Correccion del Modulo de Reportes

## Problema

El modulo de Reportes queda atrapado en "Generando reportes..." porque el hook `useReports` inicializa `loading = true` y solo ejecuta `calculateMetrics` cuando **todas** las colecciones de datos tienen al menos un elemento (servicios, clientes, gruas, operadores). Si alguna esta vacia (por ejemplo, no hay operadores o gruas registradas), la condicion nunca se cumple y `loading` nunca cambia a `false`.

## Solucion

### Archivo: `src/hooks/useReports.ts`

1. **Cambiar la condicion del `useEffect`** (linea 58-62): En vez de requerir que todas las colecciones tengan datos, ejecutar `calculateMetrics` siempre que los hooks hayan terminado de cargar. Incluso con datos vacios, el modulo debe mostrar metricas en cero.

2. **Agregar un fallback de `loading = false`**: Si los datos terminan de cargarse pero estan vacios, establecer `loading = false` con metricas por defecto (todo en cero) para que la pagina se renderice correctamente.

### Cambio concreto

La condicion actual:
```typescript
if (services.length > 0 && clients.length > 0 && cranes.length > 0 && operators.length > 0 && costs && costCategories) {
  calculateMetrics();
}
```

Se cambiara a:
```typescript
// Siempre calcular metricas una vez que los datos esten disponibles (incluso si estan vacios)
calculateMetrics();
```

Se eliminara la condicion que bloquea la ejecucion. La funcion `calculateMetrics` ya maneja correctamente arrays vacios (retorna 0 en totales, arrays vacios en agrupaciones).

### Archivo: `src/components/reports/ReportsPage.tsx`

3. **Mejorar el estado de carga** (linea 56-62): Agregar un timeout de seguridad o mostrar el contenido con metricas vacias si `metrics` es null tras la carga, en vez de bloquear toda la pagina con "Generando reportes...".

Cambio: si `loading` es false pero `metrics` es null, mostrar el dashboard con metricas en cero en vez de quedarse en blanco.
