

# Herramientas de Emergencia Adicionales para Administrador

## Herramientas Existentes
- **Liberacion de Servicios** (ServiceLiberationTool) - Libera cierres/facturas y revierte servicios
- **Eliminacion de Factura** (InvoiceEmergencyActions) - Elimina factura individual con dependencias
- **Liberacion de Cierre** (ClosureEmergencyActions) - Libera cierre individual
- **Correccion de Inventario** (InventoryFixPanel) - Limpia costos duplicados
- **Diagnostico de Pagos** (PaymentReconciliation) - Detecta inconsistencias en pagos

## Herramientas Propuestas

### 1. Cambio Forzado de Estado de Servicio
**Problema que resuelve:** Servicios que quedan "atascados" en un estado incorrecto (ej: marcados como "facturado" pero sin factura real asociada, o "cerrado" sin cierre existente).

**Funcionalidad:**
- Buscar servicio por folio (SRV-XXXX)
- Mostrar estado actual y relaciones existentes (cierre, factura, pagos)
- Permitir forzar el cambio de estado a cualquier estado valido
- Limpiar automaticamente campos relacionados (invoice_folio, etc.) segun el estado destino
- Confirmacion de seguridad con texto "FORZAR [FOLIO]"

### 2. Reparacion Masiva de Estados
**Problema que resuelve:** Multiples servicios quedan en estado inconsistente despues de una operacion fallida (ej: los 3 servicios de SRV-6413/6414/6415 que quedaron como "facturado" sin factura).

**Funcionalidad:**
- Escaner automatico que detecta inconsistencias: servicios marcados como "facturado" sin registro en invoice_services, servicios "cerrados" sin registro en closure_services, facturas con remaining_amount negativo o paid_amount mayor al total
- Muestra listado de problemas encontrados con detalle
- Boton para reparar todos los problemas detectados o reparar individualmente
- Log de todas las correcciones realizadas

### 3. Eliminacion Segura de Servicio Completo
**Problema que resuelve:** Servicios creados por error que necesitan eliminarse junto con todas sus dependencias (costos, comisiones, inspecciones, historial).

**Funcionalidad:**
- Buscar servicio por folio
- Mostrar arbol completo de dependencias: costos asociados, comisiones, inspecciones, eventos de calendario, relaciones con cierres/facturas
- Opcion de eliminar todo (usa el RPC `delete_service_cascade` existente) o solo desvincular de cierre/factura
- Confirmacion con texto "ELIMINAR [FOLIO]"

### 4. Reconexion de Pago a Factura
**Problema que resuelve:** Pagos que quedaron "sueltos" o aplicados a la factura incorrecta, pagos duplicados que necesitan limpiarse.

**Funcionalidad:**
- Buscar pago por referencia, monto o cliente
- Ver a que factura esta aplicado actualmente
- Permitir reasignar el pago a otra factura del mismo cliente
- Detectar y eliminar pagos duplicados (mismo monto, misma fecha, mismo cliente)
- Recalcular automaticamente paid_amount y remaining_amount de las facturas afectadas

## Implementacion

### Archivos a crear
1. `src/components/admin/ForceStatusChangeTool.tsx` - Cambio forzado de estado
2. `src/components/admin/BulkStatusRepairTool.tsx` - Reparacion masiva
3. `src/components/admin/ServiceDeletionTool.tsx` - Eliminacion segura de servicios
4. `src/components/admin/PaymentReassignmentTool.tsx` - Reconexion de pagos
5. `src/components/admin/AdminEmergencyPanel.tsx` - Panel contenedor con tabs para todas las herramientas

### Archivos a modificar
6. `src/pages/Settings.tsx` - Reemplazar la tab "Liberacion" por un panel completo de herramientas de emergencia que contenga todas las herramientas en sub-tabs

### Diseno
- Todas las herramientas siguen el patron visual del modulo de Costos
- Panel principal con pestanas para cada herramienta
- Cada herramienta tiene: busqueda, vista previa del impacto, confirmacion de seguridad
- Solo visible para usuarios con rol `admin`
- Colores de advertencia (amarillo para precaucion, rojo para acciones destructivas)

### Flujo General (todas las herramientas)
```text
[Buscar por folio/referencia]
         |
[Mostrar estado actual + dependencias]
         |
[Vista previa del impacto]
         |
[Confirmar con texto de seguridad]
         |
[Ejecutar + mostrar resultado]
```
