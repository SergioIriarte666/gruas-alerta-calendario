
# Agregar selector de clientes en Reportes/Servicios y sincronizar exportacion

## Problema

El tab "Servicios" no tiene un selector de clientes como si lo tiene "Clientes". Ademas, al cambiar de tab se resetea la seleccion de cliente, y los filtros efectivos solo pasan el `clientId` seleccionado cuando el tab activo es "clientes".

## Cambios

### Archivo: `src/components/reports/ReportsPage.tsx`

1. **Selector de clientes visible en tab "Servicios"**: Agregar la condicion `activeTab === 'servicios'` junto a `activeTab === 'clientes'` para mostrar el selector de clientes en ambos tabs (linea 619).

2. **No resetear cliente al ir a Servicios**: Modificar la logica de reset en linea 547 para que tampoco se resetee el cliente cuando se cambia al tab "servicios":
   - Antes: `if (tab.id !== 'clientes') setSelectedClientId('all')`
   - Despues: `if (tab.id !== 'clientes' && tab.id !== 'servicios') setSelectedClientId('all')`

3. **Conectar filtros efectivos**: Actualizar `effectiveFilters` (linea 134) para que tambien pase el `selectedClientId` cuando el tab activo es "servicios":
   - Antes: `clientId: activeTab === 'clientes' ? selectedClientId : appliedFilters.clientId`
   - Despues: `clientId: (activeTab === 'clientes' || activeTab === 'servicios') ? selectedClientId : appliedFilters.clientId`

4. **Sincronizar exportacion de servicios**: `effectiveServiceFilters` (linea 145) ya usa `selectedClientId`, por lo que la exportacion de servicios automaticamente respetara el cliente seleccionado sin cambios adicionales.

### Resultado esperado

- En el tab "Servicios" aparece el selector "Todos los clientes" junto al periodo (mismo patron visual que en "Clientes")
- Las metricas (Total Servicios, Completados, Cancelados, Ingresos, Ticket Promedio) se filtran por el cliente seleccionado
- La exportacion PDF/Excel de servicios genera el informe solo con los servicios del cliente seleccionado y el rango de fechas activo
- Al cambiar a otros tabs (excepto Clientes), el cliente se resetea a "Todos"
