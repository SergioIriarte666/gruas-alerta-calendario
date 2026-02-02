
# Plan: Corregir Truncado Dinámico de Columnas en Informe de Servicios

## Problema

La imagen muestra que las columnas del PDF tienen texto truncado ("Grua Liv...", "Arriendo...", "Custodia...", "Salfa Frei...", "Custodia G...") a pesar de que la configuracion de columnas permite ajustar los anchos.

**Causa raiz**: La funcion `getColumnValue()` en `serviceReportExporter.ts` usa valores de truncado fijos (hardcoded) que ignoran la configuracion de ancho de columnas del usuario:

```typescript
// Valores actuales (fijos):
case 'cliente': return truncate(..., 14);
case 'tipoServicio': return truncate(..., 8);
case 'origen': return truncate(..., 10);
case 'destino': return truncate(..., 10);
```

---

## Solucion

Calcular dinamicamente la cantidad maxima de caracteres basandose en el ancho porcentual de cada columna configurado por el usuario.

### Logica de calculo:

```text
Ancho disponible PDF (landscape A4) = ~269mm
Ancho por 1% = 2.69mm
Tamano fuente = 6pt (aproximadamente 1.5mm por caracter)
Caracteres por 1% ancho ≈ 1.79

Formula: maxChars = Math.floor(columnWidth% * 1.8)
```

---

## Cambios en `src/utils/reports/serviceReportExporter.ts`

### 1. Modificar funcion `getColumnValue` para recibir configuracion

```typescript
// Antes:
const getColumnValue = (service: Service, key: ColumnKey): string => {

// Despues:
const getColumnValue = (
  service: Service, 
  key: ColumnKey, 
  config: ReportColumnsConfig
): string => {
  // Calcular maxChars basado en el ancho configurado
  const columnWidth = config.columns[key].width;
  const maxChars = Math.max(5, Math.floor(columnWidth * 1.8));
```

### 2. Actualizar cada case para usar truncado dinamico

```typescript
case 'cliente':
  return truncate(service.client?.name || 'N/A', maxChars);
case 'asegurado':
  return truncate((service as any).insuredName || '-', maxChars);
case 'tipoServicio':
  return truncate(service.serviceType?.name || 'N/A', maxChars);
case 'origen':
  return truncate(service.origin || 'N/A', maxChars);
case 'destino':
  return truncate(service.destination || 'N/A', maxChars);
// etc.
```

### 3. Actualizar llamadas a getColumnValue

```typescript
// Antes (linea 115):
const body = sortedServices.map(service => 
  visibleColumns.map(key => getColumnValue(service, key))
);

// Despues:
const body = sortedServices.map(service => 
  visibleColumns.map(key => getColumnValue(service, key, config))
);
```

---

## Ejemplo de resultado

Con la configuracion por defecto:

| Columna | Ancho % | Caracteres max |
|---------|---------|----------------|
| Cliente | 11% | 19 chars |
| Tipo Servicio | 7% | 12 chars |
| Origen | 12% | 21 chars |
| Destino | 12% | 21 chars |

Si el usuario aumenta "Tipo Servicio" a 15%, se mostraran hasta 27 caracteres.

---

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/reports/serviceReportExporter.ts` | Actualizar funcion `getColumnValue` para calcular truncado dinamico basado en configuracion de ancho |

---

## Resultado esperado

- El texto de cada columna se ajustara automaticamente al ancho configurado
- Con anchos mayores se mostrara texto mas completo
- La configuracion en "Selector de informes y balance" tendra efecto real en el PDF
- Compatibilidad hacia atras: funciona con valores por defecto si no hay configuracion
