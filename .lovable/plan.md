

# Fix: Comparacion case-insensitive y uso de nombres existentes en BD

## Problema
La API de patentes devuelve nombres en mayusculas (ej: "TOYOTA", "HILUX"). Cuando el sistema verifica si existen en la BD, la comparacion es case-insensitive (correcto), pero:

1. **Cuando la marca existe pero no esta seleccionada actualmente**, el sistema asume que el modelo no existe (linea 375-377) sin verificar en la BD
2. **El dialogo de confirmacion muestra los nombres en mayusculas** de la API en vez de usar los nombres que ya existen en la BD (ej: muestra "TOYOTA" en vez de "Toyota", "HILUX" en vez de "Hilux")

## Solucion

### Archivo: `src/components/services/form/VehicleSection.tsx`

**Cambio 1 - Usar nombres de la BD cuando existen (lineas 391-392)**

Cuando marca o modelo existen en la BD, pre-llenar los inputs con el nombre de la BD (casing correcto), no con el de la API:

```typescript
setEditBrandName(existingBrand ? existingBrand.name : patentData.marca);
setEditModelName(patentData.modelo); // Se mantiene API ya que si llega aqui el modelo no existe
```

**Cambio 2 - Verificar modelos en BD cuando la marca es diferente (lineas 365-379)**

En vez de asumir que el modelo no existe cuando la marca seleccionada es diferente, hacer la verificacion seleccionando primero la marca y verificando modelos despues. Podemos usar un approach simple: hacer fetch de modelos de esa marca via Supabase antes de decidir.

Sin embargo, dado que cargar modelos es asincrono y ya se maneja con `useVehicleModels`, la solucion mas practica es:

- Cuando `selectedBrandId !== existingBrand.id`, cambiar el brand seleccionado primero para que se carguen los modelos, y luego verificar
- Alternativa mas simple: usar `supabase` directamente para una consulta rapida

La solucion mas limpia: hacer una consulta directa a Supabase para verificar si el modelo existe para esa marca:

```typescript
// Check if model exists for this brand (direct DB check)
if (existingBrand) {
  const { data: modelData } = await supabase
    .from('vehicle_models')
    .select('id, name')
    .eq('brand_id', existingBrand.id)
    .ilike('name', patentData.modelo)
    .maybeSingle();
  
  existingModel = !!modelData;
  if (modelData) {
    existingModelName = modelData.name; // nombre con casing correcto
  }
}
```

**Cambio 3 - Usar nombre correcto al aplicar (linea 386 y 437)**

Cuando se aplica directamente (ambos existen), usar el nombre de la BD:

```typescript
await applyExistingSuggestion(existingBrand.id, existingBrand.name, existingModelName || patentData.modelo);
```

Y en `handleConfirmCreate` linea 437, cuando la marca existe usar su nombre de BD:

```typescript
onVehicleBrandChange(brandExistsFlag ? existingBrandName : editBrandName.trim());
```

### Resumen de cambios

| Linea | Cambio |
|---|---|
| 357-395 | Hacer `handleApplySuggestion` async con consulta directa a Supabase para verificar modelos |
| 386 | Usar `existingBrand.name` (BD) en vez de `patentData.marca` (API) |
| 391 | Usar `existingBrand.name` cuando existe |
| 437 | Guardar referencia al nombre de BD de la marca existente |

### Archivo unico a modificar
`src/components/services/form/VehicleSection.tsx`

