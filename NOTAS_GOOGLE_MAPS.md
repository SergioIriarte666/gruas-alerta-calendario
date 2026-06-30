# Integración Google Maps — TMS Grúas 5 Norte

Este documento describe cómo configurar y mantener la integración con las APIs de Google Maps.
No ejecutar los comandos de GCP directamente desde aquí — solo son referencia para quien configure el proyecto.

---

## Arquitectura

```
Cliente (browser)
    │
    └─► supabase.functions.invoke('maps-proxy', { body: { action, ... } })
            │
            └─► Google APIs (la API key NUNCA llega al cliente)
                    ├─ Places API (New)   — autocomplete + place_details
                    ├─ Routes API         — cálculo de ruta y distancia
                    └─ Geocoding API      — texto → coordenadas
```

El Edge Function `supabase/functions/maps-proxy/index.ts` es el único punto de contacto con Google.

---

## Secret requerido en Supabase

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=AIza...
```

Para producción (proyecto `jqszxljtfuknhuvuheko`):

```bash
supabase secrets set --project-ref jqszxljtfuknhuvuheko GOOGLE_MAPS_API_KEY=AIza...
```

---

## APIs a habilitar en Google Cloud Console

En el proyecto de GCP asociado a la API key, habilitar:

1. **Places API (New)** — autocomplete y place details
2. **Routes API** — cálculo de distancia y tiempo de viaje
3. **Geocoding API** — resolución de dirección → lat/lng (usado en gestión de peajes)
4. **Maps JavaScript API** — solo si en el futuro se agrega render visual de mapa en cliente

---

## Restricciones recomendadas para la API key

### Key usada en el Edge Function (server-side)
- **Application restrictions:** None (o IP de los servidores de Supabase si son conocidas)
- **API restrictions:** Places API (New), Routes API, Geocoding API

### Key opcional para Maps JS en cliente (si se agrega render visual)
- **Application restrictions:** HTTP referrers → `https://app.gruas5norte.cl/*`
- **API restrictions:** Maps JavaScript API únicamente
- Variable de entorno cliente: `VITE_GOOGLE_MAPS_BROWSER_KEY` (no confundir con `GOOGLE_MAPS_API_KEY`)

> ⚠️  `GOOGLE_MAPS_API_KEY` es un secret de Supabase (server-side). No va en `.env` ni en variables `VITE_*`. Si aparece en el bundle de producción es un error de seguridad.

---

## Acciones disponibles en maps-proxy

| action | API Google | Propósito |
|---|---|---|
| `autocomplete` | Places API (New) `/places:autocomplete` | Sugerencias de dirección mientras el usuario escribe |
| `place_details` | Places API (New) `/places/{placeId}` | Coordenadas + addressComponents de un lugar seleccionado |
| `route` | Routes API `v2:computeRoutes` | Distancia (km), duración (h) y geometría de la ruta |
| `geocode` | Geocoding API `/geocode/json` | Resolver texto libre a coordenadas (admin peajes) |

---

## Session Tokens (Places API billing)

El hook `useGoogleMaps` gestiona un `sessionToken` (UUID) por flujo de autocomplete.
El token se pasa en cada llamada a `autocomplete` y en el `place_details` final.
Google agrupa ambas llamadas como una sola sesión de facturación (SKU "Autocomplete Session").
El token se regenera automáticamente después de cada `getPlaceDetails`.

**No llamar `place_details` sin pasar el mismo `sessionToken` que se usó en `autocomplete`** —
hacerlo dobla la factura.

---

## Bias de localización

El autocomplete envía siempre un `locationBias` centrado en Copiapó (−27.37°, −70.33°) con radio 500 km,
cubriendo Atacama, Antofagasta y partes de Coquimbo. Ajustar en `maps-proxy/index.ts` si la operación
se expande a otras regiones.

---

## Archivos creados / modificados en esta integración

| Archivo | Tipo | Descripción |
|---|---|---|
| `supabase/functions/maps-proxy/index.ts` | Nuevo | Edge Function gateway Google Maps |
| `src/hooks/useGoogleMaps.ts` | Nuevo | Hook: autocomplete, getPlaceDetails, computeRoute, geocode |
| `src/components/shared/AddressAutocomplete.tsx` | Nuevo | Componente reutilizable de búsqueda de direcciones |
| `src/lib/routeDirections.ts` | Modificado | Ahora llama `maps-proxy` (Routes API) en vez de `mapbox-proxy` |
| `src/components/trip-calculator/TripCalculatorForm.tsx` | Modificado | Reemplaza LocationInput/useGeocode por AddressAutocomplete |
| `src/components/services/form/EnhancedLocationSection.tsx` | Modificado | Reemplaza LocationCombobox por AddressAutocomplete |
| `src/hooks/useTollManagement.ts` | Modificado | Geocoding de peajes via maps-proxy en vez de mapbox-proxy |

---

## Qué sigue usando Mapbox

El render de mapa estático en la calculadora de viajes (`TripRouteMap.tsx`) sigue usando `mapbox-proxy`
(acción `static_map`) para generar la imagen de la ruta. Migrar este componente a Google Maps Static API
queda pendiente para una segunda iteración, ya que requiere un componente de rendering diferente.

---

## Verificación post-deploy

```bash
# 1. Sin API key en bundle
npm run build && grep -r "AIza" dist/  # no debe imprimir nada

# 2. Rutas de red correctas (Network tab del browser)
# Deben ir a: *.supabase.co/functions/v1/maps-proxy
# NO deben ir a: maps.googleapis.com, places.googleapis.com, routes.googleapis.com

# 3. Test básico desde consola del browser (autenticado)
# supabase.functions.invoke('maps-proxy', { body: { action: 'autocomplete', input: 'av los carrera copiapo' } })
# → debe devolver sugerencias chilenas, Copiapó primero
```
