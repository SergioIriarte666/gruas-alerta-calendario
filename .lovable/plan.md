

## Rediseno de Precios de Combustible: Tabla Semanal

### Objetivo
Redisenar la pestana "Combustible" del calculador de viajes para mostrar los precios historicos en una **tabla pivoteada por semanas** (filas = tipo de combustible, columnas = semanas), similar al formato de bencinaenlinea.cl. Se mantiene el ingreso manual de precios.

### Diseno de la Tabla

```text
Tipo Combustible | Sem 24-Feb | Sem 17-Feb | Sem 10-Feb | Sem 03-Feb | ...
-----------------|------------|------------|------------|------------|----
Diesel           |   $990     |   $986     |     -      |     -      | ...
Gasolina 93      |     -      |     -      |     -      |     -      | ...
Gasolina 95      |     -      |     -      |     -      |     -      | ...
```

- Las columnas seran las ultimas N semanas (configurable, por defecto 8-10 semanas)
- Se resalta la columna mas reciente (precio vigente)
- Cada celda muestra el precio en $/L
- Se incluye indicador de variacion (flecha arriba/abajo) respecto a la semana anterior

### Cambios

**1. Redisenar `FuelPricesManager.tsx`**

- Mantener el header con boton "Nuevo Precio" y las 3 cards de precios vigentes actuales
- Reemplazar la tabla historica plana por una tabla pivoteada:
  - Filas: Diesel, Gasolina 93, Gasolina 95
  - Columnas: semanas ordenadas de mas reciente a mas antigua
  - Celdas: precio formateado en CLP + indicador de variacion
- Eliminar el filtro por tipo (ya no es necesario, todos se muestran en la misma tabla)
- Mantener acciones de editar/eliminar accesibles via click en celda o menu contextual

**2. Logica de agrupacion semanal**

- Agrupar los registros de `fuel_prices` por `price_date` redondeado a la semana (lunes de cada semana)
- Pivotar: para cada semana, buscar el precio de cada tipo de combustible
- Calcular variacion porcentual respecto a la semana anterior

**3. Mantener sin cambios**

- `FuelPriceForm.tsx` (modal de ingreso/edicion)
- `useFuelPrices.ts` (hooks de datos)
- Logica de calculo de viajes que consume precios vigentes

### Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `src/components/trip-calculator/FuelPricesManager.tsx` | Rediseno completo de la seccion historica a tabla semanal pivoteada |

No se requieren cambios en base de datos ni en hooks existentes.
