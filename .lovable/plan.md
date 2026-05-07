## Objetivo

Mostrar de forma transparente la información de **Arriendo de Equipos** en el PDF "Informe de Servicios" que se envía al cliente, incluyendo tipo de equipo, tarifa diaria, días y total — datos hoy visibles solo en el detalle del servicio.

## Situación actual

El PDF (`src/utils/reports/serviceReportExporter.ts`) reusa las columnas de **Custodia** (Inicio / Fin / Días / Valor) para los servicios de Arriendo de Equipos. Esto funciona para fechas y días, pero:

- No se distingue visualmente un Arriendo de una Custodia (mismas etiquetas).
- No aparece el **Tipo de Equipo** (ej. "Starlink Mini") ni la **Tarifa Diaria**, datos clave para que el cliente valide la facturación.
- En la fila del screenshot, la columna "Custodia" sale "-" porque el servicio no tiene custodia tradicional.

## Cambios propuestos

### 1. Sección dedicada "Detalle de Arriendos" en el PDF

Debajo de la tabla principal, agregar una sección **solo si hay servicios de tipo "Arriendo de Equipos"** en el período, con tabla:

| Fecha | Folio | Tipo de Equipo | Fecha Inicio | Fecha Fin | Días | Tarifa Diaria | Total Arriendo |

- Detección: `isEquipmentRentalService(service)` (helper ya existente).
- Datos: se leen de los campos custody (`custody_vehicle_type`, `custody_start_date`, `custody_end_date`, `custody_days`, tarifa diaria calculada con `convertToDaily`, `custody_total_amount`).
- Estilo: header violeta (siguiendo el design system del módulo de Costos / memoria de accesibilidad), mismo `fontSize` y `cellPadding` que la tabla principal.

### 2. Etiquetas dinámicas en columnas Custodia (opcional, menor)

Renombrar internamente la fila cuando es Arriendo: en las columnas Inicio/Fin/Días Custodia mostrar el dato igual (ya lo hace), pero el bloque nuevo aclara la naturaleza. **Sin** cambiar headers globales para no romper otros casos.

### 3. Excel: hoja adicional "Arriendos de Equipos"

En el export Excel, añadir una hoja nueva con las mismas columnas de la sección PDF, solo con los servicios de arriendo. La hoja "Detalle de Servicios" se mantiene intacta.

## Archivos a modificar

- `src/utils/reports/serviceReportExporter.ts` — agregar bloque `autoTable` para arriendos en PDF, hoja nueva en Excel.
- (Opcional) `src/utils/custodyCalculations.ts` — reutilizar `getCustodyDisplayInfo` y `convertToDaily` para extraer tarifa diaria; no se modifica.

## Fuera de alcance

- No se cambia la lógica de cálculo de valores ni la estructura de columnas configurables del informe principal.
- No se tocan otros exporters (costos, comisiones, etc.).
- No se modifica la base de datos.

¿Apruebas para implementar?