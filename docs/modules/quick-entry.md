# quick-entry

## Resumen
Modulo de **quick entry** para capturar pendientes rapidos con foto, OCR y derivacion posterior a servicios, costos, inventario o mantenciones.

La implementacion actual no se limita a registrar pendientes: tambien soporta preview, fotos, OCR y navegacion con `prefilledData` hacia otros modulos.

## Entrypoints vigentes
- Pagina: [QuickEntries](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/QuickEntries.tsx)
- Componentes: [src/components/quick-entry](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/quick-entry)
- FAB: `QuickEntryFAB`

## Ruta
- `/quick-entries`

## Arquitectura actual
La experiencia actual se apoya en:
- `QuickEntryFAB`
- `QuickEntryForm`
- `PendingEntriesView`
- `QuickEntryPreview`
- `QuickPhotoCapture`

## Hooks y servicios clave
- `useQuickEntry`

## Datos y dependencias principales
- `quick_entries`
- bucket de storage `quick-entry-photos`
- edge function `parse-receipt-image`

## Flujos vigentes
### 1. Captura rapida
- Permite registrar entradas de tipo `service`, `cost`, `inventory` o `maintenance`.
- Puede adjuntar fotos y metadata.

### 2. OCR y fotos
- Para costos puede invocar OCR sobre la imagen del comprobante.
- Las fotos se almacenan en `quick-entry-photos`.

### 3. Derivacion a modulos
- `PendingEntriesView` deriva registros a `services`, `costs`, `inventory` o `cranes`.
- Para servicios puede abrir `EnhancedServiceForm` con `prefilledData`.
- Para otros tipos navega al modulo correspondiente con datos prellenados.

### 4. Layout
- El FAB existe tanto en layout interno como en portal, aunque su visibilidad depende de permisos.

## Consideraciones de mantenimiento
- Priorizar el flujo real de derivacion por tipo y `prefilledData`.
- No dar protagonismo a `saved_locations` si no participa del flujo operativo vigente.
