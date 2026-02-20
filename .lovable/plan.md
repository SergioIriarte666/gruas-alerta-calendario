

# Fix: Costos no se filtran por cliente en reportes

## Problema encontrado

Al analizar el PDF generado, los **servicios SI estan filtrados correctamente** (28 servicios de Auxilia, $12.2M). Sin embargo, los **costos muestran el total global** ($18M) en vez de solo los costos asociados al cliente seleccionado. Esto genera un Beneficio Neto negativo falso de -$5.8M.

La causa esta en `src/hooks/useReports.ts` lineas 105-113: el filtro de costos solo considera `dateRange` y `costCategoryId`, pero **ignora completamente el filtro de `clientId`**.

## Solucion

### Archivo: `src/hooks/useReports.ts`

Agregar filtrado por cliente en la seccion de costos. Muchos costos tienen un `service_id` que se relaciona con un servicio que tiene `client_id`. Cuando se filtra por cliente:

1. Los costos que tienen `service_id` se filtran verificando que el servicio asociado pertenezca al cliente seleccionado
2. Los costos **sin** `service_id` (gastos generales como sueldos, leasing) se excluyen cuando hay filtro de cliente activo, ya que no son atribuibles a un cliente especifico

Cambio en la funcion `calculateMetrics`, seccion de filteredCosts:

```typescript
// Antes (lineas 105-113):
const filteredCosts = costs.filter(cost => {
    if (filters?.dateRange.from && filters?.dateRange.to) {
        if (cost.date < filters.dateRange.from || cost.date > filters.dateRange.to) return false;
    }
    if (filters?.costCategoryId && filters.costCategoryId !== 'all' && cost.category_id !== filters.costCategoryId) {
        return false;
    }
    return true;
});

// Despues:
const filteredCosts = costs.filter(cost => {
    if (filters?.dateRange.from && filters?.dateRange.to) {
        if (cost.date < filters.dateRange.from || cost.date > filters.dateRange.to) return false;
    }
    if (filters?.costCategoryId && filters.costCategoryId !== 'all' && cost.category_id !== filters.costCategoryId) {
        return false;
    }
    // Filtrar costos por cliente: solo incluir costos cuyo servicio pertenezca al cliente
    if (filters?.clientId && filters.clientId !== 'all') {
        if (!cost.service_id) return false; // Costos sin servicio no son atribuibles
        const relatedService = filteredServices.find(s => s.id === cost.service_id);
        if (!relatedService) return false;
    }
    return true;
});
```

Esta logica usa `filteredServices` (ya filtrado por cliente y fechas) para verificar que el costo esta vinculado a un servicio del cliente seleccionado. Costos generales sin servicio asociado se excluyen cuando hay filtro de cliente.

### Resultado esperado

Al seleccionar Auxilia del 1 al 20 de febrero:
- Servicios: 28 (sin cambio)
- Ingresos: $12.2M (sin cambio)
- Costos: Solo los vinculados a servicios de Auxilia (ej. comisiones de operador, gastos de servicio)
- Beneficio Neto: Calculado correctamente contra los costos del cliente

### Archivo a modificar:
1. `src/hooks/useReports.ts` - Agregar filtro de clientId en la seccion de costos
