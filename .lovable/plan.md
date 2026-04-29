Voy a corregir la búsqueda de “Anular Compra de Bodega” en dos capas: base de datos y experiencia visual.

Hallazgo principal:
- Los datos sí existen: hay “Optico Izquierdo Mack Vision” y “Optico Derecho Mack Vision”.
- La consulta interna simulada encuentra ambos registros para `optico`.
- Pero la UI no muestra nada, por lo que el problema probable está entre el RPC publicado/contrato de Supabase, permisos/autenticación, caché o manejo silencioso de errores. Además, el buscador actual sigue siendo muy frágil para resultados compuestos.

Plan de acción:

1. Reemplazar la búsqueda RPC por una versión más robusta y compatible
   - Mantener `unaccent` para ignorar tildes.
   - Normalizar también mayúsculas/minúsculas y caracteres extraños.
   - Buscar en:
     - costo: descripción, notas, folio/documento, service_folio;
     - factura proveedor: folio y datos XML si existen;
     - ítems de factura proveedor: descripción y nombre de producto;
     - movimientos de inventario: observaciones, referencia, proveedor;
     - productos de inventario: nombre del ítem.
   - Para varias palabras, exigir que todas aparezcan en el texto consolidado, pero permitir que estén distribuidas entre factura, ítem y movimiento.
   - Devolver `matched_item` y `match_score`, manteniendo un contrato estable para el frontend.
   - Evitar dependencias frágiles como orden no determinístico en `LIMIT 1`; elegir el mejor ítem coincidente cuando exista.

2. Asegurar que “optico” y “óptico” muestren los dos registros esperados
   - Validar específicamente estos casos:
     - `optico`
     - `óptico`
     - `optico izquierdo`
     - `óptico izquierdo`
     - `optico derecho`
     - `mack vision`
     - folios `6475314` y `6475315`
   - La búsqueda `optico` debe mostrar al menos:
     - Folio 6475314: Optico Izquierdo Mack Vision
     - Folio 6475315: Optico Derecho Mack Vision

3. Mejorar el frontend para no fallar en silencio
   - Mostrar un mensaje de error visible si el RPC falla, en vez de mostrar solo “No se encontraron compras”.
   - Añadir una línea de diagnóstico útil en pantalla: por ejemplo “0 resultados para ‘optico’” o “Error consultando compras anulables”.
   - Mantener el estilo del módulo de Costos: violetas, badges, tarjetas y tipografía existente.
   - Si el resultado viene por ítem vinculado y no por descripción del costo, mostrar el badge “Ítem: Optico Izquierdo Mack Vision” / “Ítem: Optico Derecho Mack Vision”.

4. Controlar caché/estado de React Query
   - Ajustar la key y opciones de la consulta para evitar que muestre resultados obsoletos o quede pegada en cero resultados tras una migración.
   - Invalidar correctamente al cambiar búsqueda o anular una compra.

5. Prueba final en preview
   - Probar la herramienta desde la ruta real donde está “Anular Compra”.
   - Verificar que al escribir `optico` aparecen los dos registros.
   - Verificar que con tilde y sin tilde el resultado es el mismo.
   - Verificar que si hay un error de permisos o RPC, la UI lo informa explícitamente.

Notas importantes:
- No voy a cambiar aún la lógica de anulación parcial de ítems en esta corrección; primero dejaré la búsqueda estable y confiable.
- No editaré manualmente `src/integrations/supabase/types.ts`; si el contrato de Supabase cambia, se debe tratar con el flujo correcto de tipos generados.