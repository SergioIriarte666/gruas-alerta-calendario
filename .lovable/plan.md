
# Plan: Agregar Desglose de Cobros en Informe de Servicios

## Problema

El informe PDF muestra solo el valor total ($89,000) pero no indica cómo está compuesto. Para servicios con múltiples prestaciones (ej: Remolque + Custodia), se necesita ver el desglose:

| Actual | Deseado |
|--------|---------|
| Valor: $89,000 | Servicio: $40,000, Custodia: $49,000, Total: $89,000 |

---

## Solucion

Agregar 2 columnas nuevas al sistema de reportes:
1. **valorBase**: Valor del servicio base (Remolque, Arriendo, etc.)
2. **valorCustodia**: Valor de custodia (si aplica)

La columna "valor" existente seguira mostrando el total.

---

## Cambios Requeridos

### 1. Actualizar tipos de columnas

**Archivo:** `src/types/reportColumnConfig.ts`

Agregar las nuevas columnas al tipo `ReportColumnsConfig`:

```typescript
export interface ReportColumnsConfig {
  columns: {
    fecha: ReportColumnConfig;
    folio: ReportColumnConfig;
    cliente: ReportColumnConfig;
    asegurado: ReportColumnConfig;
    cotizacion: ReportColumnConfig;
    oc: ReportColumnConfig;
    factura: ReportColumnConfig;
    tipoServicio: ReportColumnConfig;
    patente: ReportColumnConfig;
    origen: ReportColumnConfig;
    destino: ReportColumnConfig;
    estado: ReportColumnConfig;
    valorBase: ReportColumnConfig;     // NUEVO
    valorCustodia: ReportColumnConfig; // NUEVO
    valor: ReportColumnConfig;
  };
}
```

Actualizar `defaultReportColumnConfig`:

```typescript
export const defaultReportColumnConfig: ReportColumnsConfig = {
  columns: {
    // ... columnas existentes ...
    valorBase: { visible: true, width: 6, label: 'Servicio' },
    valorCustodia: { visible: true, width: 6, label: 'Custodia' },
    valor: { visible: true, width: 6, label: 'Total' }
  }
};
```

Actualizar `columnOrder`:

```typescript
export const columnOrder: ColumnKey[] = [
  'fecha', 'folio', 'cliente', 'asegurado', 'cotizacion', 'oc', 'factura',
  'tipoServicio', 'patente', 'origen', 'destino', 'estado', 
  'valorBase', 'valorCustodia', 'valor'  // NUEVO orden
];
```

---

### 2. Actualizar exportador de reportes

**Archivo:** `src/utils/reports/serviceReportExporter.ts`

Agregar casos para las nuevas columnas en `getColumnValue`:

```typescript
import { getServiceValueBreakdown, getDisplayServiceValue } from '../serviceValueCalculations';

// Dentro de getColumnValue:
case 'valorBase':
  const breakdown = getServiceValueBreakdown(service);
  return breakdown.baseValue > 0 
    ? `$${breakdown.baseValue.toLocaleString('es-CL')}` 
    : '-';

case 'valorCustodia':
  const custodyBreakdown = getServiceValueBreakdown(service);
  return custodyBreakdown.custodyValue > 0 
    ? `$${custodyBreakdown.custodyValue.toLocaleString('es-CL')}` 
    : '-';

case 'valor':
  return `$${getDisplayServiceValue(service).toLocaleString('es-CL')}`;
```

---

### 3. Actualizar Excel export

En la misma función, actualizar el mapeo para Excel:

```typescript
const services_data = sortedServices.map(s => {
  const breakdown = getServiceValueBreakdown(s);
  return {
    // ... campos existentes ...
    'Valor Servicio': breakdown.baseValue,
    'Valor Custodia': breakdown.custodyValue,
    'Valor Total': getDisplayServiceValue(s),
    // ...
  };
});
```

---

## Resultado Esperado

### PDF (con columnas visibles):

| Cliente | Tipo | Origen | Destino | Servicio | Custodia | Total |
|---------|------|--------|---------|----------|----------|-------|
| ICASS SpA | Grua Livianos | Salfa Freire | Custodia G5N | $40,000 | $49,000 | $89,000 |
| ICASS SpA | Grua Livianos | Salfa Freire | Custodia G5N | $40,000 | $49,000 | $89,000 |

### Para servicios sin custodia:

| Cliente | Tipo | Servicio | Custodia | Total |
|---------|------|----------|----------|-------|
| Cliente X | Arriendo | $50,000 | - | $50,000 |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/types/reportColumnConfig.ts` | Agregar tipos `valorBase` y `valorCustodia`, actualizar defaults y orden |
| `src/utils/reports/serviceReportExporter.ts` | Agregar casos para nuevas columnas, importar `getServiceValueBreakdown`, actualizar Excel |

---

## Compatibilidad

- Usuarios existentes verán las nuevas columnas automáticamente con valores por defecto
- Las columnas pueden ocultarse desde Configuración > Selector de informes
- El ancho total se rebalanceará para mantener 100%
