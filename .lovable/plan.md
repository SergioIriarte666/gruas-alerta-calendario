

# Plan: Mejora Estética de Importadores XML (Costos y Proveedores)

Usar el importador XML de Bodega como referencia visual para elevar los importadores de Costos y Proveedores al mismo nivel estético. Solo cambios de CSS/JSX, sin modificar logica.

## Cambios en `src/components/costs/XMLCostUpload.tsx`

### 1. Dialog y Header
- Ampliar modal a `w-[min(99vw,1600px)]` con layout de dos columnas como Bodega
- Header con gradiente (`bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:...`)
- Icono dentro de `rounded-lg bg-primary/10 p-2`
- Subtitulo descriptivo y Badge con nombre del archivo cargado

### 2. Drop Zone
- Borde `rounded-2xl` con efecto radial gradient de fondo
- Icono grande dentro de contenedor `rounded-2xl bg-primary/10 p-4`
- Badges descriptivos debajo ("Detección de duplicados", "Sync con Bodega", "Categorización")

### 3. Stats Cards (4 tarjetas de resumen)
- Reemplazar las cards planas por gradient cards con bordes de color:
  - Proveedores: `border-slate-200/80 bg-gradient-to-br from-white to-slate-50`
  - Documentos: `border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white`
  - Errores: `border-red-200/80 bg-gradient-to-br from-red-50 to-white`
  - Total: `border-blue-200/80 bg-gradient-to-br from-blue-50 to-white`
- Iconos dentro de `rounded-xl bg-{color}-100 p-3`
- Labels en `text-xs font-medium uppercase tracking-wide`

### 4. Sección Proveedores
- Cada proveedor como mini-card con `border-l-4 border-l-violet-400 rounded-lg shadow-sm`
- Nombre prominente con Badge del RUT al lado
- Grid de selectores con mejor espaciado

### 5. Sección Documentos
- Cards individuales con `overflow-hidden border-border/70 shadow-sm` (igual que Bodega)
- Folio con icono `FileText` y badges de estado/monto alineados

### 6. Alertas dark mode
- Agregar clases `dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200` a alertas de duplicados
- Lo mismo para alertas de coincidencia (`dark:bg-blue-950/20`)

### 7. Panel lateral (columna derecha)
- Mover opciones de importacion y boton de accion a un sidebar fijo como en Bodega
- Resumen inline: "X documentos - $X.XXX"

## Cambios en `src/components/suppliers/XMLDocumentUpload.tsx`

Aplicar exactamente los mismos cambios que en Costos:
- Dialog ampliado con header con gradiente
- Drop zone con badges y gradiente radial
- Stats cards con gradientes y bordes de color
- Proveedores como mini-cards con borde lateral
- Documentos como cards con sombra
- Dark mode en alertas
- Panel lateral con opciones y boton de accion

## Archivos a modificar
- `src/components/costs/XMLCostUpload.tsx` (solo clases CSS y estructura JSX)
- `src/components/suppliers/XMLDocumentUpload.tsx` (solo clases CSS y estructura JSX)

## Sin riesgo funcional
Todos los cambios son puramente visuales: clases de Tailwind, estructura de divs, e iconografia. No se modifica estado, logica de procesamiento, ni llamadas a base de datos.

