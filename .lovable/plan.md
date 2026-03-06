

## Plan: Selección múltiple y acciones masivas en Clientes

### Objetivo
Agregar checkboxes en la tabla de clientes para seleccionar múltiples registros y realizar operaciones masivas, siguiendo el mismo patrón visual y funcional del módulo de Servicios.

### Acciones masivas disponibles
- **Activar/Desactivar** clientes seleccionados
- **Eliminar** clientes seleccionados
- **Cambiar departamento** en lote
- **Limpiar selección**

### Cambios técnicos

**1. `src/components/clients/ClientBatchActionBar.tsx`** (nuevo)
- Barra flotante sticky (misma estructura que `ServiceBatchActionBar`)
- Muestra cantidad seleccionada
- Botones: Activar, Desactivar, Eliminar, Limpiar

**2. `src/components/clients/ClientBatchUpdateModal.tsx`** (nuevo)
- Modal para edición masiva de campos: departamento, estado (activo/inactivo)
- Toggles para habilitar cada campo (patrón de `CostBatchUpdateModal`)

**3. `src/hooks/useUpdateClientsBatch.ts`** (nuevo)
- Hook con `useMutation` para actualizar múltiples clientes en Supabase
- Recibe array de IDs y campos a modificar
- Invalida query cache `['clients']` on success

**4. `src/components/clients/ClientsTable.tsx`** (modificar)
- Agregar estado `selectedClients: Set<string>` recibido como prop
- Checkbox en header (select all / deselect all de la página visible)
- Checkbox por fila
- Pasar selección al componente padre

**5. `src/pages/Clients.tsx`** (modificar)
- Agregar estado `selectedClients` con `useState<Set<string>>`
- Handlers para toggle individual, select all, clear
- Renderizar `ClientBatchActionBar` cuando hay selección
- Renderizar `ClientBatchUpdateModal`
- Integrar con `useUpdateClientsBatch` para acciones masivas

**6. `src/components/clients/ClientsMobileView.tsx`** (modificar)
- Agregar checkboxes en la vista mobile para mantener consistencia

