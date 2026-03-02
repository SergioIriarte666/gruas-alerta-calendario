
Objetivo: asegurar que la ruta se vea completa siempre, sin seguir “agrandando” el bloque en la página principal, y habilitar una vista ampliada en modal para recorridos largos.

1) Diagnóstico confirmado
- El componente actual (`TripRouteMap.tsx`) muestra una imagen estática con `object-contain`, pero el encuadre depende de `auto` en Mapbox Static API.
- Para rutas muy largas (norte-sur), el encuadre horizontal puede dejar extremos visualmente fuera o demasiado pegados, aunque aumentemos alto/padding.
- Subir solo el tamaño del mapa (420px, 500px, etc.) no resuelve de forma confiable el encuadre de rutas extremas.

2) Enfoque de solución (estable y sin “estirar” el layout)
- Mantener una previa compacta en la tarjeta (alto fijo razonable, sin seguir creciendo).
- Agregar botón “Ver mapa completo” que abra un modal grande (estilo módulo de costos).
- En backend, dejar de depender de `auto` para la vista completa y construir un `bbox` calculado (min/max lng/lat de la geometría + margen configurable).  
  Esto fuerza que la ruta completa entre en el encuadre.

3) Cambios planeados en backend (`supabase/functions/mapbox-proxy/index.ts`)
- Extender acción `static_map` para aceptar parámetros opcionales:
  - `mode`: `"preview"` | `"full"`
  - `width`, `height`, `padding`
- Calcular bounding box real de la ruta:
  - `minLng`, `minLat`, `maxLng`, `maxLat`
  - aplicar margen porcentual (por ejemplo 8–12%) para que no queden extremos al borde.
- Generar URL Mapbox:
  - `preview`: puede seguir con `auto` (rápido/ligero) o bbox con margen menor.
  - `full`: usar `bbox` explícito + dimensiones grandes (ej. 1280x900@2x), garantizando ruta completa.
- Mantener lógica actual de simplificación/polyline y control de longitud URL.

4) Cambios planeados en frontend (`src/components/trip-calculator/TripRouteMap.tsx`)
- Mantener tarjeta compacta en página principal (sin aumentar más alto).
- Añadir botón secundario “Ver completo” junto a “Google Maps”.
- Incorporar `Dialog` (patrón existente en proyecto):
  - `DialogContent` con `w-[95vw] max-w-6xl max-h-[90vh]`.
  - Encabezado con título/ruta/distancia.
  - Imagen “full map” con `w-full h-auto object-contain`, dentro de contenedor con `max-h-[75vh]`.
- Flujo de carga:
  - al cargar resultado, pedir URL de `preview`.
  - al abrir modal, pedir URL de `full` (lazy load para no penalizar rendimiento inicial).
- Fallback UX:
  - si falla “full”, mantener preview y mostrar acceso directo a Google Maps.

5) Ajuste en integración de formulario (`TripCalculatorForm.tsx`)
- No requiere cambios de lógica de cálculo.
- Solo asegurar que el `TripRouteMap` tenga lo necesario para abrir modal y pedir mapa full.

6) Criterios de aceptación
- En la tarjeta principal, el mapa no sigue creciendo de tamaño.
- Al abrir modal, la ruta completa se visualiza de inicio a fin (incluyendo A/B) en recorridos largos.
- No hay pantalla en blanco ni errores de importación.
- Se mantiene estética visual del módulo de costos (tipografías, tonos, bordes, dialog).

7) Validación funcional (E2E)
- Probar al menos 3 rutas: corta, media, larga (como la de tu captura).
- Confirmar:
  - preview carga normal,
  - modal abre correctamente,
  - vista full incluye toda la ruta y marcadores,
  - botón Google Maps funciona.
- Verificar responsive en desktop y móvil (sin recortes del modal).

Se implementará así para que la visualización completa dependa de un encuadre matemático (bbox) en vez de “seguir agrandando” el contenedor.
