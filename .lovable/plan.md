

# Optimizacion de Metricas del Modulo de Servicios

## Problemas detectados

### 1. Ingresos subreportados -- falta `custody_total_amount` en la consulta (CRITICO)

La consulta actual solo trae `id, value, service_date, status`, pero la funcion `getDisplayServiceValue` necesita el campo `custody_total_amount` para calcular el valor completo del servicio. Hay **57 servicios con custodia** que suman **$4.430.000** de ingresos no contabilizados.

- Pantalla muestra: **$197.686.760**
- Valor real (con custodia): **$203.436.760**
- Diferencia: **$5.750.000** aprox. no reportados

### 2. Servicios cancelados incluidos en las metricas

Hay 2 servicios cancelados por **$2.000.000** que se estan contando como servicios activos y como ingresos. Esto infla artificialmente el conteo (1000 deberian ser 998 aprox.) y los ingresos.

### 3. Balance afectado en cascada

Como el "Total Generado" es incorrecto, el "Balance" ($167.366.401) y el "Margen" (84.7%) tambien son inexactos.

---

## Solucion

### Archivo: `src/hooks/services/useServicesMetrics.ts`

**Cambio 1** -- Agregar `custody_total_amount` al SELECT (linea 76):

```
Antes:  .select('id, value, service_date, status')
Despues: .select('id, value, custody_total_amount, service_date, status')
```

Esto permite que `getDisplayServiceValue` calcule correctamente base + custodia.

**Cambio 2** -- Excluir servicios cancelados del calculo de metricas (linea 134-136):

Filtrar los servicios cancelados antes de calcular totales:

```typescript
const activeServices = services.filter(s => s.status !== 'cancelled');
const totalServices = activeServices.length;
const totalRevenue = activeServices.reduce((sum, service) => sum + getDisplayServiceValue(service), 0);
```

Esto asegura que servicios cancelados no inflen las metricas de ingresos ni el conteo.

### Impacto esperado

| Metrica | Valor actual | Valor corregido |
|---------|-------------|-----------------|
| Total Servicios | ~1000 | ~1002 (sin cancelados) |
| Total Generado | $197.686.760 | ~$201.436.760 |
| Balance | $167.366.401 | ~$171.116.401 |
| Margen | 84.7% | ~85.0% |

## Archivo a modificar

- `src/hooks/services/useServicesMetrics.ts` (2 cambios puntuales)

