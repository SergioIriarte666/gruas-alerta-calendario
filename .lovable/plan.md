

# Rediseno del Header y Navegacion del Modulo de Reportes

## Problema actual

La zona superior del modulo Reportes tiene una jerarquia visual debil:
- El titulo "Reportes" y la descripcion no tienen suficiente contraste ni estructura
- La barra de tabs ocupa demasiado espacio visual y no tiene relacion clara con el header
- El subtitulo "Dashboard Ejecutivo" se repite debajo de los tabs, creando redundancia
- No hay metricas de resumen rapido visibles al entrar (como si tiene el modulo de Costos)

## Solucion

Seguir los patrones del modulo de Costos para lograr una interfaz mas limpia y profesional.

### Cambios en `src/components/reports/shared/ReportsHeader.tsx`
- Ajustar tipografia: titulo `text-2xl font-bold` (no 3xl), subtitulo con color `text-gray-600 dark:text-gray-400`
- Mantener botones "Actualizar" y "Exportar" alineados a la derecha
- Agregar un badge informativo con la ultima actualizacion integrado en el subtitulo (similar al badge de periodo activo en Costos)

### Cambios en `src/components/reports/ReportsPage.tsx`
- Reducir el padding del TabsList y usar un estilo mas compacto
- Mover el titulo de cada seccion (ej: "Dashboard Ejecutivo") dentro de cada TabsContent pero con tipografia reducida (`text-lg font-semibold` en vez de `text-2xl font-bold`)
- Agregar las 4 tarjetas KPI (Ingresos, Beneficio, Servicios, Facturas Pendientes) directamente debajo de los tabs y antes del contenido de cada tab, como hace el modulo de Costos con sus metricas resumen

### Cambios en `src/components/reports/dashboard/ReportsDashboard.tsx`
- Eliminar el encabezado duplicado "Dashboard Ejecutivo" + descripcion (ya esta en el tab)
- Reducir el titulo de seccion a una linea simple con tipografia mas liviana
- Mantener las tarjetas KPI, distribucion de servicios, top clientes y utilizacion de gruas

### Cambios en `src/components/reports/shared/ReportMetricCard.tsx`
- Sin cambios adicionales (ya fue ajustado en la iteracion anterior)

## Detalle tecnico

### Archivos a modificar:

1. **`src/components/reports/shared/ReportsHeader.tsx`** -- Ajustar tipografia y badge de actualizacion
2. **`src/components/reports/ReportsPage.tsx`** -- Tabs mas compactos, KPIs visibles arriba
3. **`src/components/reports/dashboard/ReportsDashboard.tsx`** -- Quitar encabezado duplicado, limpiar estructura

