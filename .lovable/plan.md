

# Agrupacion por Cliente en Lista de Cierres

## Problema
Con 335 cierres en una lista plana, es muy dificil encontrar registros especificos de un cliente. No hay filtro por cliente ni agrupacion visual.

## Solucion
Agregar dos mejoras complementarias:

### 1. Filtro por Cliente en la barra de busqueda
Agregar un selector de cliente en `ClosuresSearch` (al lado del filtro de estado existente) para filtrar rapidamente por un cliente especifico. Tambien hacer que la busqueda por texto incluya el nombre del cliente.

### 2. Vista agrupada por cliente (toggle)
Agregar un boton de toggle en la tabla para alternar entre vista plana (actual) y vista agrupada por cliente. En la vista agrupada:
- Los cierres se agrupan bajo encabezados colapsables por cliente
- Cada encabezado muestra: nombre del cliente, cantidad de cierres, y total acumulado
- Los grupos son colapsables/expandibles con Collapsible de Radix
- Por defecto los grupos vienen colapsados para una vista rapida

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/closures/ClosuresSearch.tsx` | Agregar selector de cliente y prop `clientFilter` |
| `src/components/closures/ClosuresTable.tsx` | Agregar toggle vista plana/agrupada y renderizado por grupos colapsables |
| `src/pages/Closures.tsx` | Agregar estado `clientFilter`, pasar clients a ClosuresSearch, filtrar por cliente en useMemo, incluir nombre de cliente en busqueda de texto |

## Detalles de implementacion

### ClosuresSearch
- Nueva prop: `clientFilter`, `onClientFilterChange`, `clients: Client[]`
- Nuevo `Select` con lista de clientes ordenados alfabeticamente
- Opcion "Todos los clientes" como default

### ClosuresTable
- Estado local `groupByClient` (boolean, default false)
- Boton toggle con icono (Users/List) al lado del titulo "Lista de Cierres"
- En modo agrupado: agrupar closures por `clientId`, renderizar secciones colapsables con `Collapsible`
- Cada header de grupo: nombre cliente, badge con cantidad de cierres, total formateado
- Al expandir un grupo, se muestra la misma tabla pero solo con los cierres de ese cliente (sin columna cliente redundante)

### Closures.tsx (pagina)
- Nuevo estado `clientFilter`
- En el `useMemo` de filtrado, agregar condicion `clientFilter`
- En la busqueda de texto, incluir `getClientName(closure.clientId)` para buscar por nombre de cliente

## Patron de diseno
Siguiendo el patron del modulo de Costos: colores violet para acciones principales, badges informativos, collapsible sections con bordes sutiles.
