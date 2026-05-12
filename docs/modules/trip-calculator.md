# trip-calculator

## Resumen
Modulo de **trip calculator** para estimar rutas, peajes, combustible y costo operativo por viaje.

La implementacion actual combina calculadora, historial, precios de combustible, tasas de consumo y ubicaciones guardadas.

## Entrypoints vigentes
- Pagina: [TripCalculator](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/TripCalculator.tsx)
- Componentes: [src/components/trip-calculator](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/trip-calculator)

## Ruta
- `/trip-calculator`

## Arquitectura actual
La pagina principal organiza 4 tabs:
- calculadora
- historial
- combustible
- consumos

Ademas integra `SavedLocationsManager`.

## Hooks y servicios clave
- `useTripCalculation`
- `useTollCalculation`
- `useTripEstimates`
- `useFuelPrices`
- `useConsumptionRates`
- `useSavedLocations`
- `useCranes`
- `useTollLocations`

## Datos y dependencias principales
- edge functions `mapbox-proxy` y `tollroutes-proxy`
- `fuel_prices`
- `crane_consumption_rates`
- `saved_locations`
- `trip_estimates`

## Flujos vigentes
### 1. Calculo de viaje
- Usa geocodificacion, ruta y consulta de peajes.
- Si falla parte del flujo externo, puede requerir o usar fallback manual.

### 2. Desglose de costo
- La calculadora muestra breakdown completo del viaje.
- Considera peajes, distancia, combustible y parametros operativos.

### 3. Historial y guardado
- La estimacion puede serializarse y guardarse en historial.

### 4. Configuracion operativa
- El modulo administra precios de combustible, tasas de consumo y ubicaciones guardadas.

## Consideraciones de mantenimiento
- No documentar tablas antiguas de rutas o peajes como base principal si el calculo vigente usa edge functions externas.
