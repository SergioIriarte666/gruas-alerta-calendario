

# Ubicaciones Guardadas con Coordenadas Exactas

## Problema
Mapbox no encuentra lugares especificos como "Mina La Coipa - Mantos de Oro". Google Maps si los encuentra y muestra coordenadas exactas (ej: -26.81029, -69.26946).

## Solucion
Crear un sistema donde puedas guardar ubicaciones con nombre personalizado y coordenadas (obtenidas de Google Maps), que aparezcan como sugerencias prioritarias en el calculador.

## Flujo de uso
1. Buscas en Google Maps el lugar (ej: "Mina La Coipa"), copias las coordenadas
2. En el calculador, haces clic en un boton "Gestionar ubicaciones" o en un icono de estrella junto al campo
3. Aparece un dialogo donde ingresas: **nombre** ("Mina La Coipa - Mantos de Oro") y **coordenadas** (latitud: -26.81029, longitud: -69.26946)
4. La ubicacion queda guardada en la base de datos
5. La proxima vez que escribas "mantos" o "coipa" en el campo de origen/destino, aparece como primera sugerencia con sus coordenadas exactas -- sin depender de Mapbox

## Cambios

### 1. Nueva tabla `saved_locations` (migracion SQL)
- `id` (uuid, PK)
- `name` (text) -- nombre personalizado
- `latitude` (numeric)
- `longitude` (numeric)
- `created_by` (uuid) -- usuario que la creo
- `created_at` (timestamptz)
- RLS: todos los usuarios autenticados pueden leer y escribir (las ubicaciones son compartidas)

### 2. Nuevo hook `useSavedLocations.ts`
- Query para listar todas las ubicaciones guardadas
- Mutation para crear nueva ubicacion
- Mutation para eliminar ubicacion
- Funcion de busqueda local por nombre (filtro de texto)

### 3. Modificar `LocationInput` en `TripCalculatorForm.tsx`
- Al escribir en el campo, mostrar dos secciones en el dropdown:
  - **Guardadas** (icono estrella): ubicaciones guardadas filtradas por texto, con coordenadas exactas
  - **Mapbox**: resultados de geocodificacion (igual que ahora)
- Al seleccionar una ubicacion guardada, usar directamente sus coordenadas (lat/lng) sin hacer geocodificacion

### 4. Nuevo componente `SavedLocationsManager.tsx`
- Dialogo/modal para agregar nueva ubicacion:
  - Campo "Nombre" (texto libre)
  - Campo "Latitud" (numerico, ej: -26.81029)
  - Campo "Longitud" (numerico, ej: -69.26946)
- Lista de ubicaciones guardadas con opcion de eliminar
- Boton de acceso desde la pagina del calculador (junto al titulo o en una pestana)

### 5. Integrar en `TripCalculatorPage.tsx`
- Agregar boton o enlace para abrir el gestor de ubicaciones guardadas

## Detalles tecnicos
- Las coordenadas se almacenan como `[longitude, latitude]` internamente (formato Mapbox), pero el usuario las ingresa como latitud/longitud (formato Google Maps) -- se hace la conversion automaticamente
- El dropdown muestra maximo 5 ubicaciones guardadas y 5 resultados de Mapbox
- Sigue el patron visual del modulo de Costos (colores, tipografia, modales)

