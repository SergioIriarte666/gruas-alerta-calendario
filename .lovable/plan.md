

# Fix: Excel con columnas en ingles y logo como texto

## Problemas

1. La hoja "Servicios por Mes" usa columnas crudas: `month`, `services`, `revenue` en vez de "Mes", "Servicios", "Ingresos"
2. La hoja "Servicios por Estado" usa: `status`, `count`, `percentage` en vez de "Estado", "Cantidad", "Porcentaje (%)"
3. En la hoja Resumen, se muestra la URL completa del logo como texto plano (no tiene sentido en Excel)

## Solucion

### Archivo: `src/utils/reports/operationalReportExporter.ts`

**Cambio 1 - Servicios por Mes (lineas 120-123)**: Mapear campos a espanol

```typescript
// Antes:
const services_month_ws = XLSX.utils.json_to_sheet(metrics.servicesByMonth);

// Despues:
const services_month_ws = XLSX.utils.json_to_sheet(metrics.servicesByMonth.map(s => ({
  'Mes': formatDate(new Date(s.month + '-02T00:00:00'), "MMM yyyy", { locale: es }),
  'Servicios': s.services,
  'Ingresos': s.revenue
})));
```

**Cambio 2 - Servicios por Estado (lineas 148-150)**: Mapear campos y traducir estados

```typescript
// Antes:
const services_status_ws = XLSX.utils.json_to_sheet(metrics.servicesByStatus);

// Despues:
const statusLabels: Record<string, string> = {
  completed: 'Completado', pending: 'Pendiente', cancelled: 'Cancelado',
  in_progress: 'En Progreso', assigned: 'Asignado'
};
const services_status_ws = XLSX.utils.json_to_sheet(metrics.servicesByStatus.map(s => ({
  'Estado': statusLabels[s.status] || s.status,
  'Cantidad': s.count,
  'Porcentaje (%)': Number(s.percentage.toFixed(1))
})));
```

**Cambio 3 - Quitar logo URL del Resumen (linea 99)**: Eliminar la linea `company.logo ? [Logo: ...] : []` de `resumen_ws_data` ya que una URL no aporta valor en un archivo Excel.

