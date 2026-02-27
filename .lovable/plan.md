
# Plan: Confirmar creacion de marca/modelo en sugerencia de patente

## Problema actual
Cuando la API devuelve datos de un vehiculo (ej: KIA FRONTIER), el sistema crea automaticamente la marca y modelo en la base de datos sin preguntar al usuario. El usuario quiere poder revisar y editar los nombres antes de crearlos.

## Solucion

### Archivo: `src/components/services/form/VehicleSection.tsx`

**Modificar el dialogo de sugerencia** para que tenga dos estados:

1. **Estado inicial (preview)**: Muestra los datos como ahora. Al hacer clic en "Aplicar Sugerencia":
   - Si marca Y modelo ya existen en la BD → aplicar directamente (sin cambios)
   - Si marca o modelo NO existen → pasar al estado de confirmacion

2. **Estado de confirmacion (crear)**: Muestra un mensaje "La marca/modelo no existe en el sistema" con:
   - Input editable para el nombre de la marca (pre-llenado con el valor de la API)
   - Input editable para el nombre del modelo (pre-llenado con el valor de la API)
   - Botones "Cancelar" y "Crear y Aplicar"

### Cambios tecnicos

- Agregar estado `suggestionStep: 'preview' | 'confirm'` (default: `'preview'`)
- Agregar estados `editBrandName` y `editModelName` para los inputs editables
- Agregar flags `brandExists` y `modelExists` para indicar que necesita creacion
- Modificar `handleApplySuggestion`:
  - Primero verificar si marca existe en `brands`
  - Si existe, verificar si modelo existe en `models` para esa marca
  - Si ambos existen: aplicar directo
  - Si alguno no existe: setear `suggestionStep = 'confirm'` con los valores pre-llenados
- Agregar funcion `handleConfirmCreate` que:
  - Crea marca (si no existe) con el nombre editado
  - Setea `pendingModel` con el nombre editado del modelo
  - Aplica al formulario
- Resetear `suggestionStep` a `'preview'` al cerrar el dialogo

### UI del estado de confirmacion

```text
+---------------------------------------+
| Crear Marca/Modelo                    |
| No encontramos "KIA" / "FRONTIER"     |
| en el sistema.                        |
|                                       |
| Marca:  [KIA_____________]            |
| Modelo: [FRONTIER________]            |
|                                       |
|          [Cancelar] [Crear y Aplicar] |
+---------------------------------------+
```

Solo se muestran editables los campos que no existen. Si la marca existe pero el modelo no, solo el modelo es editable.
