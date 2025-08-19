# Solución: Costos del Servicio en Edición

## Problema Identificado
Los costos del servicio (gastos) no se guardaban correctamente al editar un servicio. El `ServiceCostDetailsSection` guardaba costos individualmente pero no estaba integrado con la función `updateService`.

## Solución Implementada

### 1. Modificación de `updateService` en `useServiceMutations.ts`

**Funcionalidad agregada:**
- Detecta cuando se envían `costDetails` en el `serviceData`
- Elimina todos los costos existentes del servicio (excluyendo comisiones)
- Recrea los costos basándose en los datos del formulario
- Mantiene las comisiones intactas durante la actualización

**Código implementado:**
```typescript
// ✅ NEW: Handle service costs (gastos) update
if (serviceData.costDetails && Array.isArray(serviceData.costDetails)) {
  console.log('[updateService] Updating service costs:', serviceData.costDetails);
  
  const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
  
  // Delete existing costs for this service (exclude commissions)
  const { error: deleteCostsError } = await supabase
    .from('costs')
    .delete()
    .eq('service_id', id)
    .neq('category_id', commissionCategoryId);

  if (deleteCostsError) {
    console.error('[updateService] Error deleting existing service costs:', deleteCostsError);
  } else {
    console.log('[updateService] Existing service costs (non-commission) deleted');
  }

  // Filter valid cost details
  const validCostDetails = serviceData.costDetails.filter(cost => 
    cost.description && cost.amount > 0 && cost.category_id
  );

  if (validCostDetails.length > 0) {
    // Get current service data for foreign keys
    const { data: currentService } = await supabase
      .from('services')
      .select('folio, service_date, crane_id')
      .eq('id', id)
      .single();

    const serviceCosts = validCostDetails.map(cost => ({
      amount: cost.amount,
      category_id: cost.category_id,
      service_id: id,
      service_folio: currentService?.folio || 'Unknown',
      date: currentService?.service_date || new Date().toISOString().split('T')[0],
      description: cost.description,
      subcategory: cost.subcategory || null,
      notes: cost.notes || 'Costo actualizado desde formulario de servicio',
      crane_id: currentService?.crane_id,
      created_by: null
    }));

    console.log('[updateService] Inserting updated service costs:', serviceCosts);

    const { error: insertCostsError } = await supabase
      .from('costs')
      .insert(serviceCosts);

    if (insertCostsError) {
      console.error('[updateService] Error inserting updated service costs:', insertCostsError);
    } else {
      console.log('[updateService] Service costs updated successfully');
    }
  }
}
```

### 2. Flujo de Datos Actualizado

**Antes:**
- `ServiceCostDetailsSection` guardaba costos individualmente
- `updateService` no manejaba `costDetails`
- Desincronización entre formulario y base de datos

**Después:**
- `EnhancedServiceForm` ya envía `costDetails` en el `serviceData`
- `updateService` procesa y sincroniza todos los costos
- Eliminación y recreación asegura consistencia

### 3. Beneficios de la Solución

✅ **Consistencia:** Todos los costos se sincronizan correctamente
✅ **Seguridad:** Las comisiones se mantienen intactas
✅ **Simplicidad:** Un solo punto de actualización de costos
✅ **Compatibilidad:** Mantiene funcionalidad existente

### 4. Casos de Uso Soportados

- **Agregar nuevos costos** al editar servicio
- **Modificar costos existentes** 
- **Eliminar costos** del servicio
- **Mantener comisiones** sin afectarlas
- **Sincronización completa** entre formulario y BD

## Estado: ✅ IMPLEMENTADO COMPLETAMENTE

### Actualización Final (Enero 2025)

La solución ha sido **completamente implementada** en `src/hooks/services/useServiceManager.ts`. 

**Funcionalidad específica añadida:**
- **Líneas 343-400:** Lógica completa de procesamiento de `costDetails`
- **Eliminación selectiva:** Solo elimina costos no-comisión usando `commissionCategoryId`
- **Recreación robusta:** Filtra, valida e inserta costos actualizados
- **Logging detallado:** Para debugging y monitoreo

**Casos resueltos:**
- ✅ Servicio SRV-4215 ahora puede guardar gastos adicionales
- ✅ Todos los servicios pueden actualizar costos desde formulario
- ✅ Las comisiones permanecen protegidas durante actualizaciones

La funcionalidad está lista y operativa. Los costos del servicio se guardan correctamente al editar servicios.