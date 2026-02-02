
# Plan: Corregir Cálculo de Valor Base en Desglose

## Problema Identificado

La columna "Servicio" muestra "-" en lugar del valor base ($40,000) porque la función `getServiceValueBreakdown` tiene una lógica incorrecta.

**Datos reales en BD:**

| Folio | value (Base) | custody_total_amount | Total Correcto |
|-------|-------------|---------------------|----------------|
| SRV-6304 | $40,000 | $49,000 | $89,000 |
| SRV-6305 | $40,000 | $49,000 | $89,000 |
| SRV-6321 | $0 | $18,000 | $18,000 |
| SRV-6357 | $50,000 | null | $50,000 |

**Lógica actual incorrecta** (lineas 171-184 de `serviceValueCalculations.ts`):

```typescript
const custodyValue = getCustodyTotalAmount(service);
const totalValue = service.value || 0;  // Asume que value = TOTAL
let baseValue = totalValue;
if (custodyValue > 0) {
  baseValue = totalValue - custodyValue;  // Resta custodia del "total"
}
```

El comentario en el código dice "service.value contiene el valor TOTAL" pero según los datos de BD, `value` es el valor BASE, no el total.

---

## Solución

### 1. Corregir `getServiceValueBreakdown` en `serviceValueCalculations.ts`

La lógica correcta debe ser:
- `baseValue = service.value` (valor base directo)
- `custodyValue = service.custody_total_amount`
- `totalValue = baseValue + custodyValue`

```typescript
export const getServiceValueBreakdown = (service: any) => {
  if (!service) {
    return { baseValue: 0, custodyValue: 0, totalValue: 0, hasBothValues: false };
  }

  // service.value ES el valor base del servicio
  const baseValue = service.value || 0;
  
  // custody_total_amount es el valor adicional de custodia
  const custodyValue = getCustodyTotalAmount(service);
  
  // El total es la suma de ambos
  const totalValue = baseValue + custodyValue;

  return {
    baseValue,
    custodyValue,
    totalValue,
    hasBothValues: baseValue > 0 && custodyValue > 0
  };
};
```

### 2. El label "Valor" ya está configurado como "Total"

La configuración en `reportColumnConfig.ts` ya tiene el label correcto:
```typescript
valor: { visible: true, width: 7, label: 'Total' }
```

Esto ya está bien, el problema es solo el cálculo.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/serviceValueCalculations.ts` | Corregir lógica de `getServiceValueBreakdown` (lineas 166-192) |

---

## Resultado Esperado

### PDF (después de la corrección):

| Estado | Servicio | Custodia | Total |
|--------|----------|----------|-------|
| completed | $40,000 | $49,000 | $89,000 |
| completed | $40,000 | $49,000 | $89,000 |
| completed | - | $18,000 | $18,000 |
| completed | - | $70,000 | $70,000 |
| completed | - | $63,000 | $63,000 |
| completed | $50,000 | - | $50,000 |

Los valores coincidirán exactamente con lo almacenado en la base de datos.
