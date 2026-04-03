

# Plan: Hacer editable la descripcion del documento en la tarjeta de importacion XML

## Problema
La descripcion que aparece debajo del folio en cada tarjeta (ej: "SALINAS Y FABRES S.A. Item, Item, Item...") no es editable. El usuario quiere poder modificarla antes de confirmar la importacion.

## Solucion

### Archivo: `src/components/inventory/XMLInventoryUpload.tsx`

1. **Agregar estado para descripciones editadas**: Crear un `useState<Map<string, string>>` que almacene las descripciones personalizadas por folio.

2. **Reemplazar el `<p>` estatico por un `<Textarea>`**: En la linea 1403-1405, cambiar el parrafo de texto por un textarea editable que permita al usuario modificar la descripcion del documento directamente en la tarjeta.

3. **Propagar la descripcion editada**: Asegurar que al momento de la importacion, se use la descripcion editada (si existe) en vez de la original del XML, en las funciones `buildProductDescription` y `buildCostDescription`.

4. **Truncar la descripcion inicial**: Si `doc.description` es muy larga (mas de 100 chars), truncarla como valor inicial y permitir que el usuario la extienda o reescriba.

## Detalle tecnico
- Estado: `const [editedDescriptions, setEditedDescriptions] = useState<Map<string, string>>(new Map())`
- El textarea usara `rows={2}` con `resize-y` y fuente `text-sm`
- Al importar, se consultara `editedDescriptions.get(folio) || doc.description` como descripcion final

## Archivos a modificar
- `src/components/inventory/XMLInventoryUpload.tsx`

## Lo que NO se toca
- Logica de validacion de lineas
- Hooks, servicios, base de datos
- Otros modulos

