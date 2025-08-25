# Sistema Integral de Cálculo de Costos de Transporte - Prompt de Desarrollo

## Objetivo
Desarrollar un sistema completo de maestros y calculadora inteligente para gestionar rutas, peajes y combustible, priorizando el combustible como el mayor gasto operativo.

## Estructura del Sistema

### 1. Maestro de Rutas (`routes`)
**Tabla de base de datos:**
```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Ej: "Copiapó - Santiago"
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC NOT NULL,
  estimated_time_hours NUMERIC NOT NULL,
  consumption_factor NUMERIC DEFAULT 1.0, -- Factor multiplicador (montaña, ciudad, etc)
  route_type TEXT DEFAULT 'highway', -- highway, urban, mixed
  difficulty_level TEXT DEFAULT 'normal', -- easy, normal, difficult
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

**Funcionalidades CRUD:**
- Crear nuevas rutas con origen, destino, distancia
- Editar factores de consumo según dificultad del terreno
- Asociar peajes que aplican a la ruta
- Activar/desactivar rutas
- Histórico de cambios

### 2. Maestro de Peajes (`toll_stations`)
**Tabla de base de datos:**
```sql
CREATE TABLE toll_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Ej: "Peaje Angostura"
  location TEXT NOT NULL,
  highway TEXT, -- Ruta 5 Norte, etc.
  km_marker NUMERIC,
  operator_company TEXT,
  payment_methods TEXT[], -- efectivo, tag, tarjeta
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE toll_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toll_station_id UUID REFERENCES toll_stations(id),
  vehicle_category TEXT NOT NULL, -- grua_liviana, grua_pesada, vehiculo_arrastrado
  rate_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'CLP',
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE route_tolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id),
  toll_station_id UUID REFERENCES toll_stations(id),
  sequence_order INTEGER, -- Orden en que se pasa el peaje
  is_optional BOOLEAN DEFAULT false
);
```

### 3. Maestro de Combustible (`fuel_prices`)
**Tabla de base de datos:**
```sql
CREATE TABLE fuel_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type TEXT NOT NULL DEFAULT 'diesel', -- diesel, gasolina_93, gasolina_95
  price_per_liter NUMERIC NOT NULL,
  currency TEXT DEFAULT 'CLP',
  price_date DATE DEFAULT CURRENT_DATE,
  region TEXT, -- Nacional, RM, Norte, etc.
  source TEXT, -- Manual, API_CNE, etc.
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE crane_consumption_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_type TEXT NOT NULL, -- liviana, mediana, pesada
  base_consumption_per_km NUMERIC NOT NULL, -- Litros por km sin carga
  loaded_consumption_factor NUMERIC DEFAULT 1.3, -- Factor cuando va cargada
  towing_consumption_factor NUMERIC DEFAULT 1.5, -- Factor cuando arrastra vehículo
  fuel_type TEXT DEFAULT 'diesel',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## 4. Calculadora Inteligente de Costos

### Inputs del Usuario:
1. **Ruta**: Selección de ruta predefinida o manual (origen/destino)
2. **Tipo de Grúa**: Liviana, Mediana, Pesada (afecta consumo)
3. **Configuración de Transporte**:
   - 1 vehículo: Solo grúa
   - 2 vehículos: Grúa + vehículo arrastrado
4. **Parámetros adicionales**: Carga especial, condiciones climáticas

### Cálculos Automáticos:

#### A. Combustible (Mayor Gasto - Prioridad #1)
```typescript
interface FuelCalculation {
  baseLitersPerKm: number; // Según tipo de grúa
  routeDistance: number;
  consumptionFactor: number; // De la ruta (montaña, ciudad)
  loadFactor: number; // Si lleva carga
  towingFactor: number; // Si arrastra vehículo
  currentFuelPrice: number;
  totalLiters: number;
  totalCost: number;
}
```

**Fórmula:**
```
Litros Totales = Distancia × Consumo Base × Factor Ruta × Factor Carga × Factor Arrastre
Costo Total = Litros Totales × Precio Actual Combustible
```

#### B. Peajes
```typescript
interface TollCalculation {
  routeTolls: TollStation[];
  craneTolls: number; // Peajes para la grúa
  vehicleTolls: number; // Peajes para vehículo arrastrado (si aplica)
  totalTolls: number;
}
```

#### C. Otros Costos
```typescript
interface AdditionalCosts {
  operatorPerDiem: number; // Viáticos operador
  lodging?: number; // Hospedaje si es necesario
  meals?: number; // Alimentación
  vehicleWear: number; // Desgaste vehículo
  insurance?: number; // Seguros adicionales
}
```

### Output de la Calculadora:
```typescript
interface TransportCostEstimate {
  route: RouteInfo;
  fuelCost: FuelCalculation; // El más importante
  tollCosts: TollCalculation;
  additionalCosts: AdditionalCosts;
  totalEstimate: number;
  breakdown: CostBreakdown[];
  calculationDate: Date;
  validityPeriod: string; // "Válido por 7 días"
}
```

## Componentes a Desarrollar

### 1. Gestión de Maestros
- `RoutesManager.tsx`: CRUD completo de rutas
- `TollStationsManager.tsx`: CRUD de peajes y tarifas
- `FuelPricesManager.tsx`: Gestión de precios combustible
- `ConsumptionRatesManager.tsx`: Configuración consumos por tipo grúa

### 2. Calculadora
- `TransportCostCalculator.tsx`: Interface principal
- `RouteSelector.tsx`: Selección de ruta
- `CostBreakdown.tsx`: Desglose detallado
- `CostEstimateReport.tsx`: Reporte para cliente

### 3. Hooks Especializados
- `useRoutes()`: Operaciones CRUD rutas
- `useTollStations()`: Gestión peajes
- `useFuelPrices()`: Precios combustible actuales
- `useTransportCalculation()`: Lógica de cálculo principal

## Ejemplo Práctico: Copiapó → Santiago
```
Ruta: Copiapó - Santiago (827 km)
Grúa: Pesada
Configuración: 2 vehículos (grúa + vehículo arrastrado)

CÁLCULO DE COMBUSTIBLE:
- Consumo base grúa pesada: 0.45 L/km
- Factor montaña (Ruta 5 Norte): 1.2
- Factor arrastre vehículo: 1.5
- Litros totales: 827 × 0.45 × 1.2 × 1.5 = 673 litros
- Precio diesel: $780/litro
- Costo combustible: $525,800

PEAJES (para 2 vehículos):
- Angostura: $12,400
- Chacabuco: $8,600
- Lampa: $7,200
- Total peajes: $28,200

OTROS COSTOS:
- Viáticos operador: $45,000
- Desgaste vehículo: $46,800
- Total otros: $91,800

TOTAL ESTIMADO: $645,800
(Combustible = 81.4% del costo total)
```

## Beneficios del Sistema

1. **Automatización**: Cálculos instantáneos y precisos
2. **Trazabilidad**: Histórico de precios y factores
3. **Flexibilidad**: Ajuste de factores según condiciones
4. **Integración**: Con sistema existente de costos
5. **Mantenimiento Centralizado**: Un lugar para actualizar precios
6. **Reportería**: Estimaciones profesionales para clientes

## Integración con Sistema Actual

- Extender tabla `costs` para referenciar rutas calculadas
- Crear vínculos con `services` para costos estimados vs reales
- Integrar con `cranes` para obtener tipos y consumos
- Conectar con `operators` para cálculo de viáticos

## Notas de Implementación

1. **Priorizar combustible**: Es el 70-80% del costo total
2. **Actualización de precios**: Sistema para actualizar precios semanalmente
3. **Validación**: Comparar estimaciones vs costos reales
4. **Alertas**: Notificar cambios significativos en precios
5. **Respaldo**: Mantener histórico para análisis de tendencias

---

**Documentar cada modificación/actualización en este mismo sistema según instrucciones del usuario.**