# Carga de stock mínimo — por dónde empezar

El aviso de stock bajo en Bodega **sólo puede avisar de un producto que tenga mínimo
definido.** Sin mínimo no hay contra qué comparar, así que el producto queda fuera del
control por más que se agote.

Hoy hay **111 productos activos sin mínimo cargado** (de 124). Cargarlos por orden
alfabético es la peor forma de partir: se gastan las primeras horas en cosas que se
mueven una vez al año. La consulta de abajo los ordena por **cuánto rotaron en los
últimos 12 meses**, para que los primeros 25-30 sean los que de verdad conviene
controlar.

## La consulta

```sql
-- Productos activos SIN mínimo cargado, ordenados por rotación de los últimos 12 meses.
-- Los de arriba son los que más conviene cargar primero.
with movimientos_12m as (
  select item_id, count(*) as movimientos
  from inventory_movements
  where movement_date >= (now() at time zone 'America/Santiago')::date - interval '12 months'
  group by item_id
),
existencia as (
  select s.item_id,
         sum(s.current_quantity) as stock_actual,
         string_agg(distinct l.name, ', ' order by l.name) as ubicaciones
  from inventory_stock s
  join inventory_locations l on l.id = s.location_id
  group by s.item_id
)
select
  i.name                                   as producto,
  coalesce(c.name, 'Sin categoría')        as categoria,
  coalesce(m.movimientos, 0)               as movimientos_12m,
  coalesce(e.stock_actual, 0)              as stock_actual,
  coalesce(e.ubicaciones, 'Sin ubicación') as ubicaciones
from inventory_items i
left join inventory_categories c on c.id = i.category_id
left join movimientos_12m m on m.item_id = i.id
left join existencia e on e.item_id = i.id
where i.is_active
  and coalesce(i.minimum_stock, 0) = 0
order by coalesce(m.movimientos, 0) desc, i.name;
```

## Cómo correrla

1. Entrar a [supabase.com](https://supabase.com) y abrir el proyecto **gruas-alerta-calendario**.
2. En el menú de la izquierda, **SQL Editor** → **New query**.
3. Pegar la consulta completa y apretar **Run** (o Ctrl/Cmd + Enter).
4. El resultado sale en pantalla. Con el botón **Download CSV**, arriba a la derecha de
   la tabla de resultados, se baja para imprimir o repartir.

Es una consulta de lectura: no modifica nada, se puede correr las veces que haga falta.

## Dónde se carga el mínimo en el TMS

**Bodega → pestaña Stock → botón "Editar" del producto → campo "Stock Mínimo" → Guardar.**

El cambio se ve de inmediato: si el producto ya está en o bajo ese número, aparece en el
panel "Productos bajo su mínimo", arriba en la misma página.

## Qué número poner

No hay fórmula, es criterio de bodega. Una referencia razonable: **lo que se consume
mientras llega la reposición.** Si de un filtro se usan 2 al mes y el proveedor demora
dos semanas, un mínimo de 1 o 2 avisa a tiempo; un mínimo de 10 va a estar en rojo
siempre y el aviso deja de significar algo.

Dos cosas que conviene tener presente:

- **El mínimo es del producto, no de la bodega.** El sistema suma la existencia de todas
  las ubicaciones antes de comparar. Un producto con 2 unidades en Bodega Principal y 2
  en el taller tiene 4, no 2.
- **Mínimo 0 significa "no controlar".** Es el valor por defecto y es una decisión
  válida para consumibles que no vale la pena vigilar. Sólo hay que saber que ese
  producto nunca va a aparecer en el aviso.

## Cómo se ve el avance

En Bodega, las dos tarjetas de arriba dicen exactamente dónde está parado el trabajo:

- **Bajo mínimo** — productos controlados que hoy están en problemas. Es la lista que
  hay que resolver comprando.
- **Sin stock** — productos agotados **que todavía no tienen mínimo definido**. Ese
  número es la deuda de carga: cada uno que se le cargue un mínimo sale de esta tarjeta
  y pasa a estar controlado de verdad.

Las dos tarjetas no se pisan: un producto está en una o en la otra, nunca en las dos.

## Una anomalía que va a aparecer

Algún producto sale con **stock negativo** (por ejemplo "Oring", en −1). Eso es una
salida registrada sin la entrada correspondiente, no un problema de mínimos. Conviene
corregirlo con un movimiento de ajuste en **Bodega → Movimientos**, pero no bloquea la
carga de mínimos.
