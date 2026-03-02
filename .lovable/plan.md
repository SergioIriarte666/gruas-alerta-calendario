
# Plan: Modulo de Calculo de Viajes (Integrado con Gestion de Combustible)

## Resumen

Modulo completo que combina la gestion manual de precios de combustible (CRUD con historicos) con la calculadora de viajes, integrando API de Peajes Chile (GetAPI) y Mapbox (ya configurada). El combustible es sub-modulo dentro del calculador de viajes, no un modulo separado.

---

## Arquitectura General

```text
/trip-calculator (pagina principal con tabs)
  |
  +-- Tab "Calculadora"     --> Formulario de calculo + resultados
  +-- Tab "Historial"       --> Estimaciones guardadas
  +-- Tab "Combustible"     --> CRUD precios combustible (semanal)
  +-- Tab "Consumos Gruas"  --> Config consumo por tipo de grua
```

```text
+--------------------+     +-------------------+     +------------------+
|    UI Frontend     |---->| Edge Functions    |---->| APIs Externas    |
|                    |     |                   |     |                  |
| TripCalculatorPage |     | mapbox-proxy      |     | Mapbox Geocoding |
|   (4 tabs)         |     | (ya existe)       |     | Mapbox Directions|
|                    |     |                   |     |                  |
|                    |     | tollroutes-proxy  |     | GetAPI Peajes    |
|                    |     | (nuevo)           |     |                  |
+--------------------+     +-------------------+     +------------------+
         |
         v
+--------------------+
| Supabase Tables    |
| fuel_prices     (existe)  |
| crane_consumption  |
|   _rates        (existe)  |
| trip_estimates  (nueva)   |
+--------------------+
```

---

## Fase 1: Edge Function para API Peajes

**Archivo:** `supabase/functions/tollroutes-proxy/index.ts`

- CORS headers (patron existente de `mapbox-proxy`)
- `verify_jwt = false` en `config.toml`, validacion JWT en codigo
- Acciones soportadas:
  - `route-cost`: origen, destino, categoria vehicular --> costo total + desglose por plaza
  - `locations`: listado de ciudades disponibles
  - `categories`: categorias vehiculares (mapear a tipos de grua)
- Usa secret `GETAPI_CHILE_API_KEY` (ya configurado)
- Manejo de errores: si API no responde, retornar error claro para fallback manual en UI

---

## Fase 2: Migracion - Tabla `trip_estimates`

```text
trip_estimates
  - id (UUID PK)
  - route_name (TEXT)
  - origin (TEXT)
  - destination (TEXT)
  - distance_km (NUMERIC)
  - estimated_time_hours (NUMERIC)
  - crane_type (TEXT)
  - vehicle_config (TEXT: '1_vehicle' | '2_vehicles')
  - fuel_cost (NUMERIC)
  - toll_cost (NUMERIC)
  - additional_costs (NUMERIC)
  - total_estimate (NUMERIC)
  - calculation_details (JSONB - desglose completo)
  - service_id (UUID FK opcional a services)
  - created_by (UUID)
  - created_at (TIMESTAMPTZ)
```

RLS: usuarios autenticados pueden leer/insertar/actualizar sus propias estimaciones.

---

## Fase 3: Hooks de Datos (6 hooks)

### 3.1 `src/hooks/useFuelPrices.ts`
- `useCurrentFuelPrices()`: precios con `is_current = true`
- `useFuelPriceHistory(fuelType?, region?)`: historial con filtros
- `useAddFuelPrice()`: insertar nuevo precio, desactivando automaticamente el anterior del mismo `fuel_type`
- `useUpdateFuelPrice()`: editar registro
- `useDeleteFuelPrice()`: eliminar registro

Logica clave al insertar:
```text
1. UPDATE fuel_prices SET is_current = false WHERE fuel_type = :tipo AND is_current = true
2. INSERT nuevo registro con is_current = true
```

### 3.2 `src/hooks/useConsumptionRates.ts`
- CRUD para tabla `crane_consumption_rates`
- Consultar por tipo de grua y tipo de combustible

### 3.3 `src/hooks/useTollCalculation.ts`
- Llama edge function `tollroutes-proxy`
- Cachea locations y categories en estado local
- Mapea tipo de grua a categoria vehicular de la API

### 3.4 `src/hooks/useTripCalculation.ts`
- Logica principal del calculador
- Recibe: origen, destino, tipo grua, config vehiculos
- Obtiene distancia via `mapbox-proxy` (directions)
- Calcula combustible:
  ```text
  Litros = Distancia x ConsumoBase x FactorCarga
  Costo = Litros x PrecioVigente
  ```
- Obtiene peajes via `tollroutes-proxy`
- Suma costos adicionales (viaticos, desgaste configurable)
- Retorna desglose completo

### 3.5 `src/hooks/useTripEstimates.ts`
- CRUD para tabla `trip_estimates`
- Listado con filtros por fecha

### 3.6 `src/hooks/useRoutes.ts`
- CRUD para tabla `routes` (ya existe en BD)

---

## Fase 4: Componentes UI

Directorio: `src/components/trip-calculator/`

Diseno visual identico al modulo de Costos: cards con `bg-white dark:bg-gray-800`, badges de color, botones `bg-tms-green`, tipografia y espaciado consistente, modales Dialog con formularios multi-step o simples segun complejidad.

### 4.1 `TripCalculatorPage.tsx` (pagina con Tabs)
- 4 tabs: Calculadora | Historial | Combustible | Consumos
- Header estilo CostsHeader con titulo "Calculo de Viajes"

### 4.2 `TripCalculatorForm.tsx` (Tab Calculadora)
- Input origen/destino con autocompletado via Mapbox geocoding
- Select tipo de grua (desde `crane_consumption_rates`)
- Toggle: 1 vehiculo / 2 vehiculos
- Boton "Calcular" verde tms-green
- Al calcular muestra `TripCostBreakdown`

### 4.3 `TripCostBreakdown.tsx` (Resultados)
- Card Combustible: litros, precio/litro, total, porcentaje del costo total, barra de progreso
- Card Peajes: desglose por plaza de peaje
- Card Costos Adicionales: viaticos, desgaste
- Card Total Estimado destacado con borde verde
- Boton "Guardar Estimacion"

### 4.4 `TripEstimateHistory.tsx` (Tab Historial)
- Tabla con estimaciones previas: fecha, ruta, tipo grua, total
- Accion ver detalle (modal)

### 4.5 `FuelPricesManager.tsx` (Tab Combustible)
- Cards destacadas con precio vigente por tipo (Diesel, Gasolina 93, Gasolina 95)
  - Precio grande, fecha de vigencia, badge "Vigente" verde
- Boton "Registrar Nuevo Precio"
- Tabla historica: Fecha, Tipo, Precio/L, Region, Fuente, Estado
  - Badge verde para vigente, gris para historico
  - Acciones: editar, eliminar
- Filtros por tipo de combustible y rango de fechas

### 4.6 `FuelPriceForm.tsx` (Modal)
- Dialog modal (patron identico a CostForm)
- Campos:
  - Tipo combustible (Select: Diesel, Gasolina 93, Gasolina 95)
  - Precio por litro (Input numerico, formato CLP)
  - Fecha del precio (DatePicker, default jueves mas cercano)
  - Region (Select: Nacional, RM, Norte, Sur, Centro)
  - Fuente (Input texto libre: "ENAP", "Estacion X", etc.)
- Validacion con react-hook-form + zod
- Modo creacion y edicion

### 4.7 `ConsumptionRatesManager.tsx` (Tab Consumos)
- Tabla editable con tasas de consumo por tipo de grua
- Columnas: Tipo Grua, Consumo Base (L/km), Factor Cargada, Factor Arrastre, Combustible
- CRUD inline o modal

---

## Fase 5: Integracion al Sistema

### `src/App.tsx`
- Agregar lazy import y ruta `/trip-calculator`

### `src/constants/modules.ts`
- Agregar modulo:
  ```text
  key: 'trip-calculator'
  label: 'Calculo de Viajes'
  icon: MapPin (lucide)
  route: '/trip-calculator'
  ```

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/tollroutes-proxy/index.ts` | Crear |
| `supabase/config.toml` | Modificar (agregar funcion) |
| Migracion `trip_estimates` | Crear tabla |
| `src/hooks/useFuelPrices.ts` | Crear |
| `src/hooks/useConsumptionRates.ts` | Crear |
| `src/hooks/useTollCalculation.ts` | Crear |
| `src/hooks/useTripCalculation.ts` | Crear |
| `src/hooks/useTripEstimates.ts` | Crear |
| `src/hooks/useRoutes.ts` | Crear |
| `src/components/trip-calculator/TripCalculatorPage.tsx` | Crear |
| `src/components/trip-calculator/TripCalculatorForm.tsx` | Crear |
| `src/components/trip-calculator/TripCostBreakdown.tsx` | Crear |
| `src/components/trip-calculator/TripEstimateHistory.tsx` | Crear |
| `src/components/trip-calculator/FuelPricesManager.tsx` | Crear |
| `src/components/trip-calculator/FuelPriceForm.tsx` | Crear |
| `src/components/trip-calculator/ConsumptionRatesManager.tsx` | Crear |
| `src/pages/TripCalculator.tsx` | Crear |
| `src/App.tsx` | Modificar (ruta) |
| `src/constants/modules.ts` | Modificar (modulo) |

---

## Riesgos y Mitigaciones

- **API Peajes no responde**: UI permite ingreso manual de monto de peajes como fallback
- **Mapbox falla**: Fallback de ingreso manual de distancia en km
- **Sin precios de combustible registrados**: Advertencia visible pidiendo registrar precio antes de calcular
- **Tablas maestras vacias**: Calculadora funciona con valores manuales, mostrando alerta al usuario
