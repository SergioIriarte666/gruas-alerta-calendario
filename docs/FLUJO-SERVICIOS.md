# Flujo de Trabajo - Creación de Servicios

## Resumen del Sistema

Cuando se crea un servicio en el sistema, se ejecutan automáticamente varios procesos para mantener la integridad y trazabilidad de los datos.

## Flujo para Servicios con Comisiones

### ✅ IMPLEMENTADO Y CORREGIDO

Cuando se crea un servicio que incluye comisiones para operadores:

1. **Mostrar en Tarjetas de Servicio**: El servicio aparece inmediatamente en la lista de servicios
2. **Crear Registro en Costos**: Se crea automáticamente un registro en la tabla `costs` con:
   - `category_id`: "440296d4-09c2-4f3a-b02b-835f861df4c4" (Comisión Operador)
   - `operator_id`: ID del operador
   - `service_id`: ID del servicio
   - `service_folio`: Folio del servicio
   - `subcategory`: "comisiones"
   - `amount`: Monto de la comisión
   - `date`: Fecha del servicio
   - `crane_id`: ID de la grúa asignada
   - `description`: "Comisión operador para servicio - {folio}"
   - `notes`: "Comisión generada automáticamente para operador en servicio {folio}"
3. **Crear Registro en Comisiones**: Los registros aparecen automáticamente en la sección de Comisiones

### ✅ CORRECCIÓN IMPLEMENTADA (23/07/2025):
- **Problema**: Las comisiones no se creaban automáticamente en la tabla `costs`
- **Solución**: Agregada lógica en `createService()` que itera sobre todos los operadores con comisión > 0 y crea registros automáticamente
- **Validación**: Filtros `op.commission > 0` para solo crear comisiones válidas

### ✅ CORRECCIÓN COMISIONES FALTANTES (23/07/2025):
- **Problema**: Servicios existentes con comisiones configuradas pero sin registros en tabla `costs`
- **Solución**: Agregada lógica en `updateService()` que detecta y crea comisiones faltantes automáticamente
- **Funcionamiento**: Al editar cualquier servicio, verifica si hay operadores con comisión sin registro en `costs` y los crea
- **Beneficio**: Servicios como SRV-3671 automáticamente obtendrán sus comisiones al ser editados

### Archivos Involucrados:
- `src/hooks/services/useServiceMutations.ts`: Lógica de creación corregida (líneas 273-301)
- `src/hooks/commissions/useCommissions.ts`: Consulta de comisiones
- Función SQL: `get_commissions_with_details()` en Supabase

## Flujo para Servicios con Costos de Mantenimiento

### ✅ IMPLEMENTADO

Cuando se crea un servicio que incluye costos relacionados con mantenimiento:

1. **Mostrar en Tarjetas de Servicio**: El servicio aparece inmediatamente en la lista de servicios
2. **Crear Registro en Costos**: Se crean registros en la tabla `costs` para todos los costos del servicio
3. **Crear Registro en Mantenciones**: Se crean automáticamente registros en `crane_maintenance` cuando:
   - `subcategory` = "Piezas y Repuestos"
   - `subcategory` = "Mano de obra" 
   - `subcategory` = "Servicios externos"
   - `category_name` contiene "mantenimiento"
4. **Crear Registro en Bodega**: Se crean automáticamente movimientos en `inventory_movements` cuando:
   - `subcategory` = "Piezas y Repuestos"
   - Se especifica `part_name` y `quantity > 0`

### Detalles de Implementación:

#### Registro de Mantenimiento (`crane_maintenance`)
- `maintenance_type`: "corrective" (por defecto para servicios)
- `description`: "Mantenimiento por servicio {folio}: {descripción}"
- `cost`: Monto del costo
- `provider`: Proveedor si está especificado
- `scheduled_date` y `completed_date`: Fecha del servicio
- `status`: "completed"
- `notes`: Referencia al servicio original

#### Movimiento de Inventario (`inventory_movements`)
- Se crea o busca el item en `inventory_items` por nombre
- Se usa la primera ubicación disponible en `inventory_locations`
- `movement_type`: "exit" (consumo)
- `quantity`: Negativo (salida de inventario)
- `reference_type`: "service"
- `reference_id`: ID del servicio
- Se vincula con grúa y operador del servicio

### Archivos Involucrados:
- `src/hooks/services/useServiceMutations.ts`: 
  - `createMaintenanceRecords()`: Función para crear registros de mantenimiento
  - `createInventoryMovements()`: Función para crear movimientos de inventario
- Tablas de base de datos:
  - `crane_maintenance`: Registro de mantenimientos
  - `inventory_items`: Catálogo de partes/items
  - `inventory_movements`: Movimientos de entrada/salida
  - `inventory_locations`: Ubicaciones de almacén

## Configuración Requerida

### Para que funcione completamente el sistema necesita:

1. **Categorías de Costos configuradas**:
   - "Comisión Operador" para comisiones
   - Categorías de mantenimiento para costos relacionados

2. **Ubicaciones de Inventario**:
   - Al menos una ubicación configurada en `inventory_locations`

3. **Campos en Formulario de Servicios**:
   - `costDetails[]` con estructura:
     ```typescript
     {
       description: string,
       amount: number,
       category_id: string,
       subcategory?: string,
       part_name?: string,     // Para piezas
       quantity?: number,      // Para piezas
       unit_price?: number,    // Para piezas
       supplier?: string,      // Para mantenimiento
       notes?: string
     }
     ```

## Beneficios del Sistema

1. **Trazabilidad Completa**: Todos los costos quedan registrados y vinculados al servicio original
2. **Automatización**: Reduce errores manuales y duplicación de datos  
3. **Integración**: Los datos fluyen automáticamente entre módulos (Servicios → Costos → Comisiones → Mantenimiento → Inventario)
4. **Auditoría**: Se mantiene un historial completo de todas las operaciones

## Actualizaciones de la Base de Datos

### Campos agregados a `costs`:
- `service_folio`: Para mejor identificación del servicio
- `crane_id`: Vinculación con la grúa del servicio
- `operator_id`: Vinculación con el operador del servicio

Estas mejoras permiten un mejor seguimiento y reporting de costos por grúa, operador y servicio.