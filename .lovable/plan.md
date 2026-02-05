

# Plan: Corregir Guardado y Sincronización de Proveedor Tercerizado

## Problemas Identificados

1. **Campos outsourced no se guardan al editar**: En `useServiceManager.ts`, la función `updateService` NO incluye los campos `outsourced_provider_id`, `outsourced_cost`, ni `outsourced_notes` en el objeto `transformedData`. Por eso cuando editas el servicio y cambias el proveedor, no se guarda.

2. **Costo no se sincroniza al editar**: Cuando se crea un servicio tercerizado, se genera automáticamente un registro en `costs`. Pero cuando se edita el servicio y se cambia el proveedor, el costo existente no se actualiza.

3. **Proveedor actual**: El servicio SRV-6324 tiene guardado `Aliexpress` como proveedor (por error o prueba anterior).

---

## Solución

### 1. Agregar campos outsourced al updateService

Modificar `src/hooks/services/useServiceManager.ts` para incluir los campos en la actualización completa:

```typescript
// Después de los campos de custody/insuredName, agregar:
...(serviceData.outsourcedProviderId !== undefined && {
  outsourced_provider_id: serviceData.outsourcedProviderId && serviceData.outsourcedProviderId.trim() !== '' 
    ? serviceData.outsourcedProviderId 
    : null
}),
...(serviceData.outsourcedCost !== undefined && {
  outsourced_cost: serviceData.outsourcedCost || 0
}),
...(serviceData.outsourcedNotes !== undefined && {
  outsourced_notes: serviceData.outsourcedNotes || null
}),
```

### 2. Sincronizar costo del proveedor tercerizado al editar

Después de actualizar el servicio, si es un servicio tercerizado, actualizar el costo asociado:

```typescript
// Después de la actualización del servicio, si es outsourced:
if (serviceData.outsourcedProviderId !== undefined) {
  // Buscar el costo existente del servicio tercerizado
  const { data: existingCost } = await supabase
    .from('costs')
    .select('id')
    .eq('service_id', id)
    .ilike('description', 'Servicio tercerizado:%')
    .single();

  if (existingCost) {
    // Actualizar el costo existente
    await supabase
      .from('costs')
      .update({
        amount: serviceData.outsourcedCost || 0,
        supplier_id: serviceData.outsourcedProviderId || null,
        notes: serviceData.outsourcedNotes || null
      })
      .eq('id', existingCost.id);
  }
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/services/useServiceManager.ts` | 1. Agregar campos outsourced al transformedData en updateService (líneas ~685)<br>2. Agregar sincronización del costo outsourced después de actualizar servicio |

---

## Corrección del Dato Existente

Para corregir el servicio SRV-6324 actual, después de implementar los cambios:
1. Editar el servicio desde el formulario
2. Seleccionar el proveedor correcto (que sí hace remolques)
3. Guardar - el costo se actualizará automáticamente

---

## Resultado Esperado

1. Al editar un servicio tercerizado, el proveedor se guarda correctamente
2. El costo asociado se sincroniza con el nuevo proveedor
3. El selector de proveedor muestra el valor actual correctamente

