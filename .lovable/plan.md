

# Plan: Corregir validación de descripción y mejorar visualización

## Problema
Dos issues identificados en el código:

1. **La validación de descripción bloquea líneas con producto seleccionado**: En la lógica de validación (línea 399), el chequeo `!effectiveLine.description?.trim()` es lo PRIMERO que se evalúa. Si el usuario borra/edita la descripción para buscar coincidencia y luego selecciona un producto manualmente, la línea queda con error "no tiene descripción" aunque ya tenga producto asociado. El match manual queda invisible porque el error tiene prioridad.

2. **El modal ya es grande (98vw/1400px, 92vh)** pero la tabla interna tiene columnas con `min-w-[280px]` para descripción y `min-w-[220px]` para producto que comprimen las demás. Se puede mejorar el layout.

## Cambios en `src/components/inventory/XMLInventoryUpload.tsx`

### 1. Relajar validación cuando hay match manual
En la lógica de validación (~línea 396-413):
- Mover el chequeo de descripción vacía DESPUÉS del chequeo de `matchedItem`
- Si hay `matchedItem` (manual o automático), permitir descripción vacía con un **warning** en vez de error
- Solo bloquear con error si NO hay descripción Y NO hay producto asociado

Cambio concreto:
```
if (!matchedItem) {
  if (!effectiveLine.description?.trim()) {
    error = 'La línea no tiene descripción.';
  } else {
    error = candidates.length > 0
      ? `${candidates.length} coincidencia(s)...`
      : 'No se encontró coincidencia...';
  }
} else if (!effectiveLine.description?.trim()) {
  warning = 'La línea no tiene descripción, se usará el nombre del producto.';
} else if (subtotal <= 0 && total <= 0) {
  ...
}
```

### 2. Agrandar modal y mejorar tabla
- Cambiar el modal a `w-[min(99vw,1600px)] max-w-[1600px]` para aprovechar más espacio en pantallas grandes
- Aumentar `h-[92vh]` a `h-[95vh]`
- Ajustar anchos mínimos de columnas para distribuir mejor

## Archivo a modificar
- `src/components/inventory/XMLInventoryUpload.tsx`

