
# Plan: Corregir Valores del Reporte de Servicios

## Problema Identificado

El reporte PDF muestra valores incorrectos porque la consulta de base de datos no incluye el campo `custody_total_amount`. 

**Datos Reales en BD:**
| Folio | value | custody_total_amount | Total Correcto |
|-------|-------|---------------------|----------------|
| SRV-6304 | $40,000 | $49,000 | **$89,000** |
| SRV-6305 | $40,000 | $49,000 | **$89,000** |
| SRV-6321 | $0 | $18,000 | **$18,000** |
| SRV-6332 | $0 | $70,000 | **$70,000** |
| SRV-6356 | $0 | $63,000 | **$63,000** |
| SRV-6357 | $50,000 | $0 | **$50,000** |
| **Total** | | | **$379,000** |

El reporte muestra solo el campo `value` ($130,000) en lugar del total correcto ($379,000).

---

## Causa Raiz

En `src/utils/serviceReportGenerator.ts`, la funcion `fetchServicesForReport` no incluye `custody_total_amount` en su SELECT query.

La funcion `getDisplayServiceValue()` calcula: `value + custody_total_amount`, pero como `custody_total_amount` no existe en los datos obtenidos, retorna solo `value`.

---

## Solucion

### Archivo: `src/utils/serviceReportGenerator.ts`

**Agregar `custody_total_amount` al SELECT de la consulta (linea 35):**

```typescript
// Antes (lineas 23-66):
let query = supabase
  .from('services')
  .select(`
    id,
    folio,
    service_date,
    ...
    value,
    has_excess,
    client_covered_amount,
    // FALTA custody_total_amount
    ...
  `)

// Despues:
let query = supabase
  .from('services')
  .select(`
    id,
    folio,
    service_date,
    ...
    value,
    custody_total_amount,  // AGREGAR
    has_excess,
    client_covered_amount,
    ...
  `)
```

**Agregar mapeo del campo en el objeto formateado (linea 90):**

```typescript
// Antes (lineas 83-106):
const formattedServices: Service[] = (data || []).map((s: any) => ({
  ...s,
  serviceDate: s.service_date,
  ...
  clientCoveredAmount: s.client_covered_amount,
  // FALTA custodyTotalAmount
  ...
}));

// Despues:
const formattedServices: Service[] = (data || []).map((s: any) => ({
  ...s,
  serviceDate: s.service_date,
  ...
  clientCoveredAmount: s.client_covered_amount,
  custodyTotalAmount: s.custody_total_amount || 0,  // AGREGAR
  ...
}));
```

---

## Resultado Esperado

Despues de aplicar el fix:

| Folio | Valor en Reporte |
|-------|-----------------|
| SRV-6304 | $89,000 |
| SRV-6305 | $89,000 |
| SRV-6321 | $18,000 |
| SRV-6332 | $70,000 |
| SRV-6356 | $63,000 |
| SRV-6357 | $50,000 |
| **Total** | **$379,000** |

Los valores coincidiran con lo que muestra la interfaz de la aplicacion.
