
# Agregar Fechas y Dias de Custodia en Reportes de Servicios

## Que se hara

Agregar tres nuevas columnas al reporte de servicios: **Inicio Custodia**, **Fin Custodia** y **Dias Custodia**, que se mostraran junto a la columna existente de "Valor Custodia".

## Cambios

### 1. `src/types/reportColumnConfig.ts`

Agregar 3 nuevas columnas al tipo `ReportColumnsConfig`, al `defaultReportColumnConfig` y al `columnOrder`:

- `custodiaInicio` - Fecha de inicio de custodia (visible por defecto, width: 5, label: "Inicio Custodia")
- `custodiaFin` - Fecha de termino de custodia (visible por defecto, width: 5, label: "Fin Custodia")  
- `custodiaDias` - Cantidad de dias en custodia (visible por defecto, width: 4, label: "Dias Custodia")

Se insertaran en el `columnOrder` justo antes de `valorCustodia` para que queden agrupadas logicamente.

### 2. `src/utils/serviceReportGenerator.ts`

Agregar los campos de custodia a la query de Supabase en `fetchServicesForReport`:
- `custody_start_date`
- `custody_end_date`
- `custody_days`

Y mapearlos en el objeto `formattedServices`:
- `custodyStartDate: s.custody_start_date || null`
- `custodyEndDate: s.custody_end_date || null`
- `custodyDays: s.custody_days || 0`

### 3. `src/utils/reports/serviceReportExporter.ts`

Agregar los 3 nuevos cases en la funcion `getColumnValue`:
- `custodiaInicio`: Formatea `service.custodyStartDate` como `dd/MM/yy` o muestra `-`
- `custodiaFin`: Formatea `service.custodyEndDate` como `dd/MM/yy` o muestra `-`
- `custodiaDias`: Muestra `service.custodyDays` o `-` si es 0/null

Agregar las 3 columnas tambien en la hoja Excel (seccion `services_data`):
- `'Inicio Custodia'`: fecha formateada
- `'Fin Custodia'`: fecha formateada
- `'Dias Custodia'`: numero de dias

### Resultado visual en el PDF

```text
... | Inicio Custodia | Fin Custodia | Dias | Custodia | Total |
... | 15/01/26        | 22/01/26     | 8    | $240,000 | $540,000 |
... | -               | -            | -    | -        | $100,000 |
```
