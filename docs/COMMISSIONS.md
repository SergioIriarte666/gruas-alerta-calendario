# Sistema de Comisiones

## Modelo de Datos

Las comisiones se almacenan en la tabla `costs` con las siguientes características:

### Identificación de Comisiones
- `category_id`: `440296d4-09c2-4f3a-b02b-835f861df4c4` (Categoría "Comisión Operador")
- `subcategory`: Puede ser `"comisiones"` o `null`
- `operator_id`: ID del operador que recibe la comisión (requerido)

### Generación de Comisiones
**IMPORTANTE**: Las comisiones NO se crean automáticamente.

Las comisiones se generan ÚNICAMENTE cuando:
1. El usuario las configura explícitamente en el formulario de servicios
2. Se especifica un monto de comisión > 0 en la sección "Operadores y Comisiones"
3. El sistema guarda la comisión configurada en la tabla `service_resources`

**NO HAY CREACIÓN AUTOMÁTICA DE COMISIONES** para prevenir duplicaciones y conflictos.

### Estados de Comisión
- **Pendiente**: `subcategory = "comisiones"` o `subcategory = null`
- **Pagada**: `subcategory = "comisiones_pagadas"`

## Funcionalidad del Módulo de Comisiones
El módulo de comisiones SOLO permite:
1. **Ver** comisiones pendientes (que fueron creadas manualmente en servicios)
2. **Seleccionar** comisiones para pago
3. **Marcar como pagadas** las comisiones seleccionadas

**NO PERMITE**:
- Crear nuevas comisiones (se crean solo en formulario de servicios)
- Editar comisiones existentes
- Eliminar comisiones

**IMPORTANTE**: Las comisiones solo aparecen aquí si fueron configuradas manualmente por el usuario en el formulario de servicios con valores > 0.

## Query para Obtener Comisiones Pendientes
```sql
SELECT * FROM costs 
WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
AND operator_id IS NOT NULL
AND (subcategory = 'comisiones' OR subcategory IS NULL)
ORDER BY service_folio ASC
```

**NOTA IMPORTANTE**: Se corrigió el query para excluir comisiones pagadas (`comisiones_pagadas`), 
mostrando solo las comisiones pendientes en el módulo de comisiones.

## Proceso de Pago
Cuando se crea un lote de pago:
1. Se cambia `subcategory` de `"comisiones"` o `null` a `"comisiones_pagadas"`
2. Se actualiza el campo `notes` con información del lote de pago
3. **NO se crean nuevos registros** - solo se actualiza el estado

## Interfaz del Módulo de Comisiones

### Vista Detallada
El módulo incluye información completa para cada comisión:
- **Estado**: Pendiente o Pagada (con badges de colores)
- **Folio del Servicio**: Referencia al servicio asociado
- **Fecha del Servicio**: Cuando se realizó el servicio
- **Cliente**: Nombre del cliente del servicio
- **Operador**: Nombre del operador que recibe la comisión
- **Valor del Servicio**: Monto total del servicio
- **Comisión**: Monto de la comisión
- **Porcentaje**: Porcentaje de comisión calculado automáticamente
- **Fecha de Creación**: Cuando se generó la comisión

### Filtros Disponibles
- **Estado**: Todas, Pendientes, Pagadas
- **Operador**: Selección por operador específico
- **Cliente**: Búsqueda por nombre de cliente
- **Rango de Montos**: Filtro por valor mínimo de comisión
- **Rango de Fechas**: Filtro por período de servicios

### Controles de Selección
- Solo se pueden seleccionar comisiones pendientes para pago
- Las comisiones pagadas aparecen deshabilitadas para selección
- Botón "Seleccionar Pendientes" por operador
- Validaciones para prevenir errores en lotes de pago