
## Plan: Corrección del Cálculo de Ganancia Neta en Servicios con Excedente

### Problema Identificado
En servicios con excedente, la Ganancia Neta se calcula incorrectamente usando el "Monto Cubierto por Cliente" en lugar del "Valor Total del Servicio".

**Ejemplo (Servicio 2645572):**
- Valor Total del Servicio: $1.200.000
- Monto Cubierto Cliente: $476.719
- Excedente: $723.281
- Total Costos: $300.000
- Ganancia Neta Actual (incorrecta): $476.719 - $300.000 = $176.719
- Ganancia Neta Correcta: $1.200.000 - $300.000 = $900.000

### Causa Raíz
El código en `ServiceDetailsModal.tsx` usa la función `getServiceValueForClosure()` para calcular la ganancia neta. Esta función retorna el `clientCoveredAmount` para servicios con excedente, lo cual es correcto para cierres/facturación (lo que paga el cliente), pero incorrecto para ganancia neta (donde el excedente también es utilidad).

### Solución
Crear una nueva función `getServiceValueForProfit()` específica para cálculos de ganancia neta, que siempre use el valor total del servicio.

---

### Cambios a Realizar

#### 1. Agregar nueva función en `serviceValueCalculations.ts`
Nueva función que retorna el valor total del servicio para cálculos de rentabilidad:

```typescript
/**
 * Calculates the value that should be used for profit/net gain calculations.
 * 
 * IMPORTANT: For services with excess (excedente), BOTH the client covered amount
 * AND the excess amount are income for the company. Therefore, profit calculations
 * should use the TOTAL service value, not just the client covered amount.
 * 
 * This is different from getServiceValueForClosure which returns only the billable
 * amount (what the client pays).
 * 
 * @param service - Service object
 * @returns The total service value for profit calculations
 */
export const getServiceValueForProfit = (service: any): number => {
  if (!service) return 0;
  
  // For profit calculations, always use the complete service value
  // Both client covered amount and excess are company income
  return getCompleteServiceValue(service);
};
```

#### 2. Modificar `ServiceDetailsModal.tsx`
Cambiar el cálculo de ganancia neta para usar la nueva función:

**Antes (línea 239-240):**
```typescript
const closureValue = getServiceValueForClosure(serviceData);
const netProfit = closureValue - totalCosts;
```

**Después:**
```typescript
// Para cálculos de ganancia neta, usar el valor TOTAL del servicio
// (tanto el monto cubierto como el excedente son utilidad)
const netProfit = displayServiceValue - totalCosts;
```

#### 3. Corregir el paso de datos al PDF
El PDF recibe `netProfit` desde el modal, por lo que se corregirá automáticamente.

---

### Sección Técnica

#### Archivos a Modificar:

1. **`src/utils/serviceValueCalculations.ts`**
   - Agregar función `getServiceValueForProfit()` con documentación clara
   - Distinguir entre valor para cierre (facturación) vs valor para ganancia

2. **`src/components/services/ServiceDetailsModal.tsx`** (línea ~240)
   - Importar y usar `getServiceValueForProfit` o directamente usar `displayServiceValue`
   - Actualizar comentario para claridad

#### Lógica de Negocio:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICIO CON EXCEDENTE                        │
├─────────────────────────────────────────────────────────────────┤
│  Valor Total del Servicio: $1.200.000                           │
│  ├── Monto Cubierto Cliente: $476.719 ──► Para facturación      │
│  └── Excedente: $723.281 ──────────────► Pagado por tercero     │
│                                                                  │
│  AMBOS son ingresos de la empresa                               │
│                                                                  │
│  Ganancia Neta = Valor Total - Costos                           │
│  Ganancia Neta = $1.200.000 - $300.000 = $900.000               │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado Esperado
- Ganancia Neta se calculará como: Valor Total del Servicio - Total Costos
- Para el servicio 2645572: $1.200.000 - $300.000 = $900.000
- El excedente se considerará correctamente como parte de la utilidad
- El PDF de detalle también mostrará el cálculo correcto
