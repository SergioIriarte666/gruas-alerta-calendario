

# Plan: Sistema de Calculo de Costos de Transporte

## Resumen
Implementar un sistema completo de maestros (Rutas, Peajes, Combustible) y una calculadora inteligente de costos de transporte, integrado dentro del modulo de costos existente. Se usara Mapbox para calcular distancias/rutas y el precio de combustible se gestionara manualmente (actualizacion semanal).

---

## Fase 1: Base de Datos (6 tablas nuevas)

Se crearan las siguientes tablas mediante migraciones SQL:

1. **`routes`** - Maestro de rutas predefinidas
   - `id`, `name`, `origin`, `destination`, `distance_km`, `estimated_time_hours`
   - `consumption_factor` (1.0 default), `route_type` (highway/urban/mixed), `difficulty_level`
   - `is_active`, `notes`, `created_by`, timestamps

2. **`toll_stations`** - Maestro de peajes
   - `id`, `name`, `location`, `highway`, `km_marker`, `operator_company`
   - `payment_methods` (text[]), `is_active`, timestamps

3. **`toll_rates`** - Tarifas por categoria de vehiculo
   - `id`, `toll_station_id` (FK), `vehicle_category` (grua_liviana, grua_pesada, vehiculo_arrastrado)
   - `rate_amount`, `valid_from`, `valid_until`, `is_active`

4. **`route_tolls`** - Relacion ruta-peajes (N:M)
   - `id`, `route_id` (FK), `toll_station_id` (FK), `sequence_order`, `is_optional`

5. **`fuel_prices`** - Historico de precios de combustible
   - `id`, `fuel_type` (diesel default), `price_per_liter`, `price_date`
   - `region`, `source` (manual), `is_current`, timestamps

6. **`crane_consumption_rates`** - Consumo por tipo de grua
   - `id`, `crane_type` (light, medium, horquilla, taxi), `base_consumption_per_km`
   - `loaded_consumption_factor`, `towing_consumption_factor`, `fuel_type`, `is_active`

Todas las tablas tendran RLS para usuarios autenticados, siguiendo el patron existente.

---

## Fase 2: Secreto de Mapbox

Se configurara `MAPBOX_ACCESS_TOKEN` como secreto de Supabase para uso en la Edge Function.

---

## Fase 3: Edge Function - `mapbox-proxy`

Una edge function que actua como proxy para la API de Mapbox Directions:
- Recibe origen y destino (coordenadas o texto)
- Usa Mapbox Geocoding para convertir texto a coordenadas
- Usa Mapbox Directions para obtener distancia y tiempo estimado
- Retorna `distance_km`, `estimated_time_hours`, y geometria de la ruta
- JWT requerido para acceso

---

## Fase 4: Hooks de React Query

- **`useRoutes()`** - CRUD de rutas con React Query
- **`useTollStations()`** - CRUD de peajes y tarifas
- **`useFuelPrices()`** - Gestion de precios de combustible (actual + historico)
- **`useCraneConsumptionRates()`** - Tasas de consumo por tipo de grua
- **`useTransportCalculation()`** - Logica de calculo principal (combustible + peajes + adicionales)
- **`useMapboxRoute()`** - Llamadas a la edge function para distancias

---

## Fase 5: Componentes de UI

### Pagina nueva: `/transport-costs`
Accesible desde el sidebar dentro de la seccion "Financiero", junto a Costos.

### 5.1 Pestanas principales (Tabs)
Siguiendo el patron de diseno del modulo de costos (badges violeta, cards con gradientes, tipografia consistente):

**Tab 1: Calculadora**
- Selector de ruta (predefinida o manual con autocompletado Mapbox)
- Selector de tipo de grua (con iconos)
- Toggle: 1 vehiculo / 2 vehiculos (grua + arrastrado)
- Panel de resultado con desglose:
  - Combustible (litros, precio/litro, total) - destacado como gasto principal
  - Peajes (detalle por estacion)
  - Otros costos (viaticos, desgaste)
  - **Total estimado** con badge grande
- Boton "Guardar como Costo" que crea un registro en la tabla `costs`

**Tab 2: Rutas**
- Tabla CRUD de rutas con las mismas columnas del maestro
- Modal de creacion/edicion con campo de busqueda Mapbox para autocompletar distancia
- Toggle activo/inactivo

**Tab 3: Peajes**
- Tabla CRUD de estaciones de peaje
- Sub-tabla de tarifas por categoria de vehiculo
- Campos `valid_from` / `valid_until` para actualizaciones semestrales

**Tab 4: Combustible**
- Precio actual destacado con badge verde
- Formulario simple para actualizar precio semanal
- Tabla historica de precios con grafico de tendencia (Recharts)
- Fecha de ultima actualizacion visible

**Tab 5: Consumos**
- Tabla de tasas de consumo por tipo de grua
- Factores configurables (carga, arrastre, ruta)

---

## Fase 6: Integracion con Sistema Existente

- El boton "Guardar como Costo" en la calculadora creara un registro en `costs` con:
  - `category_id` = categoria "Servicios" o "Transporte"
  - `subcategory` = "Combustible" / "Peajes" / "Viaticos"
  - `description` auto-generada (ej: "Transporte Copiapo-Santiago - Grua Pesada")
  - Asociacion a `crane_id`, `operator_id`, `service_id` si se seleccionan

---

## Seccion Tecnica

### Estructura de archivos nuevos:
```text
src/pages/TransportCosts.tsx
src/components/transport/
  TransportCostCalculator.tsx
  TransportCostTabs.tsx
  RoutesManager.tsx
  TollStationsManager.tsx
  FuelPricesManager.tsx
  ConsumptionRatesManager.tsx
  CostBreakdownPanel.tsx
  RouteSelector.tsx
  MapboxRouteInput.tsx
src/hooks/transport/
  useRoutes.ts
  useTollStations.ts
  useFuelPrices.ts
  useCraneConsumptionRates.ts
  useTransportCalculation.ts
  useMapboxRoute.ts
src/types/transport.ts
supabase/functions/mapbox-proxy/index.ts
```

### Formula de calculo:
```text
Litros = Distancia x ConsumoBase x FactorRuta x FactorCarga x FactorArrastre
CostoCombustible = Litros x PrecioActualDiesel
CostoPeajes = SUM(peajes_ruta) x NumVehiculos
CostoTotal = CostoCombustible + CostoPeajes + CostosAdicionales
```

### Orden de implementacion:
1. Migracion SQL (tablas + RLS + datos seed de consumo)
2. Secreto Mapbox
3. Edge function mapbox-proxy
4. Tipos TypeScript
5. Hooks
6. Componentes UI (calculadora primero, luego maestros)
7. Pagina + ruta en App.tsx + sidebar
8. Integracion con costos existentes

