# Sistema de Exportación de Comisiones

## Funcionalidad Implementada

El sistema de exportación de comisiones permite generar reportes en formato PDF y Excel con los datos de comisiones filtrados según los criterios seleccionados por el usuario.

## Archivos Creados

### 1. `src/utils/reports/commissionReportExporter.ts`
Exportador principal que maneja la generación de reportes en ambos formatos:
- **PDF**: Incluye encabezado de empresa, filtros aplicados, resumen ejecutivo y tabla detallada
- **Excel**: Genera múltiples hojas (Resumen, Detalle, Por Operador)

### 2. `src/hooks/commissions/useCommissionExport.ts`
Hook personalizado que:
- Maneja el estado de exportación
- Valida datos antes de exportar
- Procesa filtros y genera nombres de archivo automáticos
- Proporciona feedback al usuario mediante toasts

### 3. `src/components/commissions/CommissionExportButton.tsx`
Componente de UI reutilizable que:
- Dropdown con opciones PDF/Excel
- Estados de carga y validación
- Adaptable a diferentes tamaños y variantes
- Integrable en múltiples ubicaciones

## Integración en la Página

### Ubicaciones del Botón de Exportación
1. **Barra de búsqueda principal**: Exporta todas las comisiones filtradas
2. **Header del tab "Todas las Comisiones"**: Exportación general con filtros
3. **Cada grupo de operador**: Exportación específica por operador

## Características del Reporte

### Reporte PDF
- Encabezado con información de la empresa y logo
- Sección de filtros aplicados
- Resumen ejecutivo con métricas clave:
  - Total de comisiones
  - Cantidad pendientes/pagadas
  - Montos totales y promedios
- Tabla detallada con todas las comisiones

### Reporte Excel
- **Hoja "Resumen"**: Información de empresa, filtros y métricas
- **Hoja "Detalle"**: Datos completos de todas las comisiones
- **Hoja "Por Operador"**: Resumen agrupado por operador (cuando aplique)

## Filtros Respetados
- Estado (pendientes/pagadas)
- Operador específico
- Nombre de cliente
- Rango de fechas
- Rango de montos

## Validaciones
- No permite exportar si no hay datos
- Requiere configuración de empresa válida
- Manejo de errores con mensajes descriptivos
- Estados de carga visual

## Nomenclatura de Archivos
Los archivos se generan con el patrón:
`comisiones-[fecha_inicio]-a-[fecha_fin].[pdf|xlsx]`

## Tipos Agregados

### `AppliedCommissionFilters`
```typescript
interface AppliedCommissionFilters {
  status?: string;
  operatorId?: string;
  operatorName?: string;
  clientName?: string;
  dateFrom?: string;
  dateTo?: string;
  amountFrom?: number;
  amountTo?: number;
}
```

### `ExportCommissionReportArgs`
```typescript
interface ExportCommissionReportArgs {
  format: 'pdf' | 'excel';
  commissions: Commission[];
  settings: Settings;
  appliedFilters: AppliedCommissionFilters;
}
```

## Dependencias Utilizadas
- `jsPDF` y `jspdf-autotable` para generación de PDFs
- `xlsx` para generación de archivos Excel
- `date-fns` para formateo de fechas
- Componentes UI existentes (Button, DropdownMenu, etc.)

## Patrón Seguido
La implementación sigue el mismo patrón arquitectónico que otros exportadores del sistema:
- Separación de responsabilidades
- Reutilización de utilidades comunes
- Consistencia en UI/UX
- Manejo robusto de errores
- Integración con el sistema de configuración existente