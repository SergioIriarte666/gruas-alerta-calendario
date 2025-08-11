# Eliminación de Servicios - Bidireccionalidad de Datos

## Problema Identificado
**Fecha:** 23 de enero de 2025

Cuando se eliminaba un servicio desde el módulo de Servicios, los registros relacionados en otras tablas NO se eliminaban automáticamente, causando:

- Costos órfanos en la tabla `costs`
- Recursos de servicio órfanos en `service_resources`
- Service costs órfanos en `service_costs`
- Datos huérfanos en inspecciones, eventos de calendario, etc.

El usuario tenía que eliminar manualmente estos registros, lo que es propenso a errores y causa inconsistencias en los datos.

## Solución Implementada

### 1. Función de Eliminación en Cascada
Creada función `delete_service_cascade()` que elimina automáticamente todos los datos relacionados:

```sql
-- Orden de eliminación para evitar violaciones de FK:
1. Inspecciones (inspections)
2. Costos del servicio (costs)
3. Service costs (service_costs)
4. Recursos del servicio (service_resources)
5. Closure services (closure_services)
6. Invoice services (invoice_services)
7. Eventos de calendario (calendar_events)
8. Finalmente el servicio (services)
```

### 2. Trigger Automático
Creado trigger `cascade_delete_service_trigger` que se ejecuta **BEFORE DELETE** en la tabla `services` para limpiar automáticamente todos los datos relacionados.

### 3. Actualización del Código Frontend
Modificado `useServiceMutations.ts` para usar la nueva función:

```typescript
// ANTES: Solo eliminaba el servicio
const { error } = await supabase
  .from('services')
  .delete()
  .eq('id', id);

// DESPUÉS: Elimina servicio + todos los datos relacionados
const { error } = await supabase.rpc('delete_service_cascade', {
  p_service_id: id
});
```

## Seguridad
- La función valida que el usuario tenga rol `admin` o `operator`
- Utiliza `SECURITY DEFINER` para control de acceso
- Incluye logging detallado para auditoría

## Tablas Afectadas por la Eliminación en Cascada
1. `inspections` - Inspecciones del servicio
2. `costs` - Costos asociados al servicio
3. `service_costs` - Costos específicos del servicio
4. `service_resources` - Recursos (operadores, grúas) asignados
5. `closure_services` - Vínculos con cierres de servicios
6. `invoice_services` - Vínculos con facturas
7. `calendar_events` - Eventos de calendario relacionados
8. `services` - El servicio principal

## Beneficios
- ✅ **Integridad de datos**: No más registros huérfanos
- ✅ **Experiencia del usuario**: Eliminación en un solo paso
- ✅ **Automatización**: No requiere intervención manual
- ✅ **Auditoría**: Logging completo de eliminaciones
- ✅ **Seguridad**: Control de permisos integrado

## Testing
Para probar la funcionalidad:
1. Crear un servicio con costos asociados
2. Eliminar el servicio desde el módulo de Servicios
3. Verificar que todos los registros relacionados se eliminaron automáticamente
4. Revisar los logs de la consola para confirmación

## Notas Técnicas
- La eliminación es irreversible
- Se ejecuta en una transacción para garantizar consistencia
- Los errores en eliminaciones secundarias no detienen el proceso principal
- Compatible con servicios existentes y nuevos