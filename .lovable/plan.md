

## Plan: Incluir todas las facturas en Histórico de Ventas

### Cambio
En `src/components/finance/HistoricalSales.tsx`, línea 128, eliminar el filtro que restringe a solo facturas con nota "Importación historial". Cambiar:

```typescript
let result = invoices.filter((inv) => inv.notes?.startsWith(HISTORICAL_NOTE));
```

Por:

```typescript
let result = [...invoices];
```

Esto hará que todas las facturas (importadas + creadas en la app) aparezcan juntas en la misma vista, manteniendo los filtros, ordenamiento y las tres vistas (tabla, agrupado, pipeline) sin cambios.

### Impacto
- Las estadísticas, filtros y vistas funcionarán con el conjunto completo de facturas
- No se requieren cambios en base de datos ni en otros componentes

