

# Plan: Mejora Visual de Modales de Detalle

## Modales identificados para mejorar

Se encontraron **6 modales de detalle** que actualmente usan estilos planos (fondo `bg-muted/50`, sin bordes de color, sin jerarquía visual) y que se beneficiarían del mismo tratamiento aplicado al modal de Servicios:

### 1. InvoiceDetailsModal (580 líneas)
- **Archivo**: `src/components/invoices/InvoiceDetailsModal.tsx`
- **Estado actual**: `DetailSection` plano con solo icono violeta. Separadores grises.
- **Mejora**: Agregar `border-l-4` con colores por sección (blue=Identificación, green=Cliente, amber=Fechas, violet=Financiera, emerald=Pagos, cyan=Servicios). Refactorizar `DetailSection` para aceptar color.

### 2. OperatorDetailsModal (148 líneas)
- **Archivo**: `src/components/operators/OperatorDetailsModal.tsx`
- **Estado actual**: Secciones planas con `bg-muted/50`.
- **Mejora**: Envolver cada bloque en tarjetas con `border-l-4`: blue=Contacto, green=Servicios del Día, amber=Licencias.

### 3. ServiceRateDetailsModal (117 líneas)
- **Archivo**: `src/components/serviceRates/ServiceRateDetailsModal.tsx`
- **Estado actual**: Bloques uniformes `bg-muted/50`.
- **Mejora**: Colores por sección: blue=Cliente, orange=Tipo Servicio, emerald=Ruta, violet=Valor (ya tiene tinte violeta), cyan=Notas.

### 4. ServiceTypeDetailsModal (214 líneas)
- **Archivo**: `src/components/service-types/ServiceTypeDetailsModal.tsx`
- **Estado actual**: Tabs con bloques `bg-muted/50` y bordes genéricos.
- **Mejora**: Colores por tab/sección: blue=General, emerald=Vehículo, amber=Requerimientos. Requirement rows con borde lateral de color.

### 5. EventDetailsModal (186 líneas)
- **Archivo**: `src/components/calendar/EventDetailsModal.tsx`
- **Estado actual**: Grids planos sin contenedores visuales.
- **Mejora**: Envolver grupos en tarjetas con `border-l-4`: blue=Info Básica, green=Participantes, orange=Equipo, cyan=Ubicación, amber=Descripción.

### 6. ProductDetailsModal (131 líneas)
- **Archivo**: `src/components/inventory/ProductDetailsModal.tsx`
- **Estado actual**: Card simple con fondo blanco.
- **Mejora**: Colores por sección: blue=Info General, emerald=Inventario, amber=Coincidencia.

## Patrón aplicado

Mismo patrón ya implementado en `ServiceDetailsModal`:
```text
border-l-4 + border-l-{color}-500
bg-{color}-500/5
icono en bg-{color}-500/10 text-{color}-600
título en text-{color}-700 dark:text-{color}-300
```

## Alcance
- Solo cambios CSS/Tailwind
- Sin modificación de lógica, datos, ni estructura funcional
- 6 archivos a modificar

