

# Propuestas de Mejora UI - Gestion de Clientes

## Diagnostico actual

La pagina de Clientes tiene una estructura basica: titulo + barra de busqueda + tabla plana. Comparado con el modulo de Costos (dashboard de metricas, filtros avanzados, toggle de vistas tabla/cards, gradientes violeta) y el VIP Pipeline (metricas con iconos coloridos, tabs con contenido rico), la pagina de Clientes se siente incompleta.

## Propuesta 1: Dashboard de metricas en la cabecera

Agregar una grilla de 4 tarjetas de metricas al inicio, similar al `CostsDashboard`, con:

- **Total Clientes Activos** - con gradiente violeta (card primaria) e icono `Users`
- **Empresas Unicas** - conteo por RUT unico, icono `Building2`
- **Servicios Activos** - total de servicios en pipeline de todos los clientes, icono `TrendingUp`
- **Facturacion Pendiente** - monto pendiente de pago agregado, icono `DollarSign`

Cada tarjeta con el mismo patron visual del CostsDashboard: icono en circulo coloreado, valor grande, subtitulo descriptivo.

## Propuesta 2: Acceso rapido al Pipeline VIP desde la tabla

Dado que Pipeline VIP es la funcionalidad mas usada, elevar su acceso:

- Hacer que el **nombre del cliente sea clickeable** y lleve directo al Pipeline VIP (el flujo mas comun)
- El nombre mostraria un cursor pointer y un hover con subrayado sutil
- Mover el boton "Ver detalles" (ojo) al area de acciones donde queda actualmente
- Esto elimina un clic extra para el flujo principal

## Propuesta 3: Filtros rapidos por estado y departamento

Reemplazar el filtro actual (solo busqueda de texto) por una barra de filtros mas completa:

- **Filtro por estado**: badges/chips clickeables "Todos", "Activos", "Inactivos" con contadores
- **Filtro por departamento**: dropdown o chips con los departamentos mas frecuentes
- Mantener la barra de busqueda integrada en la misma fila
- Estilo: chips con borde y fondo sutil al estilo de los `UnifiedCostFilters`

## Propuesta 4: Columna de "Servicios en Pipeline" en la tabla

Agregar una columna visual que muestre cuantos servicios tiene cada cliente activos en el pipeline:

- Mini badge con numero de servicios activos (ej. "5 activos")
- Color indicativo: verde si tiene servicios recientes, gris si no tiene actividad
- Al hacer clic lleva al Pipeline VIP de ese cliente

## Propuesta 5: Simplificar columnas de acciones

Las acciones actualmente muestran 5 botones por fila (Pipeline, Ver, Editar, Activar/Desactivar, Eliminar), lo cual es excesivo. Propuesta:

- **Pipeline VIP** se mueve al nombre clickeable (Propuesta 2)
- **Ver detalles** y **Editar** se mantienen como iconos
- **Activar/Desactivar** y **Eliminar** se agrupan en un menu desplegable "..." (DropdownMenu)
- Esto deja 3 elementos en la columna de acciones: ojo, lapiz, menu

---

## Detalle Tecnico

### Archivos a crear
- `src/components/clients/ClientsDashboard.tsx` - Grilla de metricas (patron de CostsDashboard)

### Archivos a modificar
- `src/pages/Clients.tsx` - Integrar dashboard, filtros de estado/departamento
- `src/components/clients/ClientsFilters.tsx` - Agregar chips de estado y departamento junto a la busqueda
- `src/components/clients/ClientsTable.tsx` - Nombre clickeable hacia Pipeline VIP, columna de servicios, acciones agrupadas
- `src/components/clients/ClientsMobileView.tsx` - Nombre clickeable, acciones simplificadas

### Patron de datos para metricas
Reutilizar los datos existentes del hook `useClients()` para contar activos/inactivos y RUTs unicos. Para servicios activos y facturacion pendiente, agregar una consulta ligera con `.select('id, status')` desde `services` agrupada por `client_id`, y otra a `invoices` para pendientes. Estas consultas se encapsularian en un nuevo hook `useClientsDashboardMetrics`.

### Patron visual
- Gradiente violeta en la card primaria (como `CostsDashboard`)
- Iconos en circulos con fondo coloreado `bg-violet-600/10`, `bg-blue-100`, etc.
- Tipografia: `text-2xl font-bold` para valores, `text-sm text-muted-foreground` para etiquetas
- Chips de filtro con `border rounded-full px-3 py-1` y estado activo con `bg-primary text-primary-foreground`

