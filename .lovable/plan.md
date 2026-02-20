
# Agregar selector de categoria de costos en tab Costos

## Que se hara

Agregar un selector desplegable de "Categoria de Costo" en la barra de filtros superior, visible solo cuando el tab activo es "Costos". Seguira el mismo patron visual del selector de clientes (que aparece solo en el tab "Clientes").

Al seleccionar una categoria, tanto las metricas del dashboard como la exportacion de costos se filtraran por esa categoria.

## Cambios tecnicos

### Archivo: `src/components/reports/ReportsPage.tsx`

1. **Nuevo estado**: Agregar `selectedCostCategoryId` con valor inicial `'all'`
2. **Importar datos**: Usar `useCostCategories()` para obtener las categorias disponibles
3. **Selector en la barra**: Agregar un `Select` condicional cuando `activeTab === 'costos'`, justo despues del selector de periodo (mismo patron que el selector de clientes en tab "Clientes"). Usara el icono `DollarSign` o similar.
4. **Conectar a effectiveFilters**: Actualizar `effectiveFilters` para incluir `costCategoryId: activeTab === 'costos' ? selectedCostCategoryId : 'all'` -- esto filtra las metricas globales.
5. **Conectar a effectiveCostFilters**: Actualizar `effectiveCostFilters` para usar `categoryId: selectedCostCategoryId` en vez del valor fijo `'all'` -- esto filtra la exportacion de costos.

### Resultado esperado

- En el tab "Costos" aparece un selector "Todas las categorias" junto al periodo
- Al seleccionar una categoria, las metricas (Total Costos, Costo/Servicio, etc.) y la exportacion se filtran por esa categoria
- Los demas tabs no se ven afectados
