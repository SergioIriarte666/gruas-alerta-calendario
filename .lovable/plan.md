
# Plan: Simplificar Pestana de Consumos

## Cambio principal
Cambiar el concepto de **"litros por km"** (consumo) a **"km por litro"** (rendimiento), que es mas intuitivo. Ejemplo: grua liviana rinde **4.5 km/L** en vez de consumir 0.22 L/km. Eliminar los campos de "factor carga" y "factor arrastre" de la UI y del calculo.

## Cambios por archivo

### 1. `ConsumptionRatesManager.tsx`
- Mostrar solo **un campo editable**: "Rendimiento (km/L)" en vez de los 3 campos actuales (consumo base, factor carga, factor arrastre)
- Al guardar, convertir internamente: `base_consumption_per_km = 1 / rendimiento_km_per_liter`
- Quitar las filas de "Factor carga" y "Factor arrastre" del UI

### 2. `useTransportCalculation.ts`
- Simplificar la formula eliminando `loadFactor` y `towingFactor`
- Nueva formula: `Litros = Distancia * base_consumption_per_km * consumptionFactor`
- (donde `base_consumption_per_km` ya viene convertido desde el rendimiento)

### 3. `TransportCostCalculator.tsx` (panel de resultados)
- Quitar las lineas de "Factor carga" y "Factor arrastre" del desglose de combustible
- Mostrar "Rendimiento: X km/L" en lugar de "Consumo base: X L/km"

### 4. `src/types/transport.ts`
- Quitar `loadFactor` y `towingFactor` del tipo `TransportCostEstimate.fuelCost`
- Mantener `loaded_consumption_factor` y `towing_consumption_factor` en `CraneConsumptionRate` (existen en BD, simplemente no se usan)

### 5. Datos actuales en BD (actualizacion)
- Grua liviana: actualmente 0.25 L/km (= 4 km/L). Se actualizara a 0.222 L/km (= **4.5 km/L** segun tu indicacion)
- Resto se mantiene igual, solo se ignoran los factores

## Seccion tecnica

La conversion entre las dos metricas:
- `rendimiento_km_L = 1 / base_consumption_per_km`
- `base_consumption_per_km = 1 / rendimiento_km_L`

La formula simplificada del calculo:
```text
Litros = Distancia x (1 / Rendimiento) x FactorRuta
CostoCombustible = Litros x PrecioDiesel
```
