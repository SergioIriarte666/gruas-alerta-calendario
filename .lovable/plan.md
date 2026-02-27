

# Herramienta de Liberacion de Servicios (Admin)

## Problema
Cuando un cierre o factura necesita ser rehecho, actualmente se requiere ejecutar SQL manualmente para: eliminar relaciones en `invoice_services`, `invoice_closures`, `closure_services`, borrar la factura/cierre, y resetear el estado de los servicios. Esto es lento, propenso a errores y requiere acceso directo a la base de datos.

## Solucion Propuesta
Crear una herramienta visual en la UI, accesible solo para administradores, que permita buscar una factura o cierre por folio y ejecutar la liberacion completa con un solo clic (con confirmacion de seguridad).

## Funcionalidad

### Busqueda
- Campo de busqueda por folio de factura (ej: FACT-4298) o folio de cierre (ej: CIE-339)
- Muestra informacion del registro encontrado: cliente, servicios asociados, montos, estado actual

### Vista Previa del Impacto
Antes de confirmar, se muestra exactamente que va a pasar:
- Cantidad de servicios que seran liberados (con sus folios)
- Relaciones que seran eliminadas (invoice_services, invoice_closures, closure_services)
- Registros que seran eliminados (factura y/o cierre)
- Estado al que volveran los servicios (with_purchase_order o completed segun corresponda)

### Acciones Disponibles
1. **Liberar Factura**: Elimina la factura, sus relaciones, y revierte servicios/cierres
2. **Liberar Cierre**: Elimina el cierre, sus relaciones, y revierte servicios
3. **Liberar Ambos**: Cuando una factura tiene cierres asociados, elimina todo el arbol de dependencias

### Confirmacion de Seguridad
- Dialog de confirmacion con texto descriptivo del impacto
- Requiere escribir "LIBERAR [FOLIO]" para confirmar (patron existente en ClosureEmergencyActions)

## Detalles Tecnicos

### Archivos a crear
1. **`src/components/admin/ServiceLiberationTool.tsx`** - Componente principal con busqueda, vista previa y acciones
2. **`src/hooks/useServiceLiberation.ts`** - Hook con la logica de busqueda y liberacion

### Archivos a modificar
3. **`src/pages/Settings.tsx`** o pagina de administracion existente - Agregar acceso a la herramienta (dentro de una seccion visible solo para admin)

### Logica de liberacion (hook)

**Buscar por folio de factura:**
- Query `invoices` por folio
- Query `invoice_services` para obtener servicios vinculados
- Query `invoice_closures` para obtener cierres vinculados
- Query `closure_services` para servicios en esos cierres

**Buscar por folio de cierre:**
- Query `service_closures` por folio
- Query `closure_services` para servicios vinculados
- Query `invoice_closures` para facturas vinculadas

**Ejecutar liberacion de factura:**
1. DELETE `invoice_services` WHERE invoice_id
2. DELETE `invoice_closures` WHERE invoice_id
3. UPDATE `service_closures` SET status = 'closed' (si tenia cierres vinculados)
4. DELETE `invoices` WHERE id
5. UPDATE `services` SET status = 'with_purchase_order', invoice_folio = NULL

**Ejecutar liberacion de cierre:**
1. DELETE `closure_services` WHERE closure_id
2. DELETE `invoice_closures` WHERE closure_id (si existe)
3. DELETE `service_closures` WHERE id
4. UPDATE `services` SET status = 'with_purchase_order', invoice_folio = NULL

### Seguridad
- Componente verifica `user.role === 'admin'` antes de renderizar
- Se ubica dentro de seccion protegida por AdminOnlyRoute o verificacion de rol existente

### Diseno
- Sigue el patron visual del modulo de Costos (fuentes, colores, badges, modales)
- Card con busqueda en la parte superior
- Resultados en tabla/lista con badges de estado
- Modal de confirmacion estilo AlertDialog (como ClosureEmergencyActions)
