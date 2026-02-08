
# Plan: Corregir Eliminación de Servicios

## Problema Identificado

La UI muestra avisos de éxito pero el servicio **NO se elimina** de la base de datos.

### Causa Raíz
El código tiene **dos sistemas de eliminación** diferentes:

| Hook | Método | ¿Funciona? |
|------|--------|------------|
| `useServiceDeletion.ts` | `supabase.rpc('delete_service_cascade')` | ✅ Sí - elimina en cascada |
| `useServiceManager.ts` | `supabase.from('services').delete()` | ❌ No - falla por foreign keys |

**El problema**: `useServices.ts` (línea 12) usa `useServiceManager`, no `useServiceDeletion`. Cuando hay registros relacionados en otras tablas, el DELETE simple falla silenciosamente porque las **foreign key constraints** lo bloquean:

```
services ← invoice_services
services ← closure_services  
services ← costs
services ← inspections
services ← service_resources
services ← calendar_events
services ← service_costs
services ← service_update_error_logs
services ← service_change_history
```

---

## Solución

### Modificar `useServiceManager.ts`

Cambiar la mutación de eliminación para usar el RPC `delete_service_cascade` en lugar del DELETE simple:

**Antes (líneas 1241-1257):**
```typescript
const deleteServiceMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);
    // ...
  }
});
```

**Después:**
```typescript
const deleteServiceMutation = useMutation({
  mutationFn: async (id: string) => {
    console.log('🗑️ Eliminando servicio con cascada:', id);
    
    const { error } = await supabase.rpc('delete_service_cascade', {
      p_service_id: id
    });

    if (error) {
      console.error('Error eliminando servicio:', error);
      throw new Error(`Error al eliminar el servicio: ${error.message}`);
    }
    
    console.log('✅ Servicio eliminado exitosamente:', id);
    await queryClient.invalidateQueries({ queryKey: ['services'] });
    await queryClient.invalidateQueries({ queryKey: ['costs'] });
  },
  onSuccess: () => {
    toast.success('Servicio eliminado correctamente');
  },
  onError: (error: Error) => {
    console.error('Error eliminando servicio:', error);
    toast.error(error.message || 'Error al eliminar el servicio');
  }
});
```

### Actualizar función RPC (si es necesario)

La función `delete_service_cascade` ya existe pero le faltan 2 tablas:
- `service_update_error_logs`
- `service_change_history`

Si la eliminación aún falla, se agregará un DELETE para estas tablas en la función RPC.

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/services/useServiceManager.ts` | Cambiar `deleteServiceMutation` para usar RPC `delete_service_cascade` |
| (Opcional) Migración SQL | Agregar DELETE de tablas faltantes si aún falla |

---

## Resultado Esperado

1. Al eliminar un servicio, se eliminan **todos** los registros relacionados
2. El servicio desaparece de la UI y de la base de datos
3. Los toast de éxito/error reflejan correctamente el resultado real
