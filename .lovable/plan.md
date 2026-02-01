
# Plan: Unificacion Visual del Portal del Operador

## Resumen del Problema
El portal del operador utiliza un tema oscuro (slate/dark) mientras que el resto de la aplicacion usa un tema claro con fondo blanco y acentos violeta. Esto crea una inconsistencia visual significativa.

## Diferencias Identificadas

| Componente | Problema | Solucion |
|------------|----------|----------|
| OperatorLayout | Fondo con gradiente oscuro | Fondo blanco solido como Layout.tsx |
| VehicleEquipmentChecklist | `text-white`, `bg-slate-800/50` | Variables de tema (`text-foreground`, `bg-card`) |
| InspectionFormSections | Cards con `bg-slate-800`, inputs `bg-slate-900` | `bg-card`, `bg-background` |
| PhotographicSet | Tabs y cards en tema oscuro | Variables de tema estandar |
| SignaturePad | `text-zinc-950` hardcoded | `text-foreground` |
| AssignedServiceCard | Algunos colores inconsistentes | Unificar con variables de tema |

## Cambios Propuestos

### 1. OperatorLayout.tsx
- Cambiar el contenedor principal de gradiente oscuro a fondo blanco
- Actualizar header para coincidir con el estilo del Header principal
- Mantener el icono violeta como acento (bg-violet-600)

### 2. VehicleEquipmentChecklist.tsx
- Reemplazar `text-white` por `text-foreground`
- Reemplazar `bg-slate-800/50` por `bg-card`
- Reemplazar `border-slate-600` por `border-border`
- Mantener los indicadores verde/rojo para el estado del checklist

### 3. InspectionFormSections.tsx
- Cambiar Cards de `bg-slate-800 border-slate-700` a `bg-card border-border`
- Cambiar inputs de `bg-slate-900 border-slate-600` a `bg-background border-input`
- Reemplazar `text-white` por `text-foreground`
- Mantener `focus:border-tms-green` para consistencia

### 4. PhotographicSet.tsx
- Card: `bg-slate-800 border-slate-700` a `bg-card border-border`
- TabsList: `bg-slate-700` a `bg-muted`
- Texto: `text-white` y `text-slate-300` a `text-foreground` y `text-muted-foreground`
- Bordes: `border-slate-600` a `border-border`
- Mantener indicadores de estado (verde para fotos completadas)

### 5. SignaturePad.tsx
- Cambiar `text-zinc-950` a `text-muted-foreground`
- Mantener canvas con fondo blanco para firmas legibles

### 6. AssignedServiceCard.tsx
- Unificar `text-gray-400` a `text-muted-foreground`
- Mantener badges de estado con sus colores semanticos

## Archivos a Modificar

1. `src/components/layout/OperatorLayout.tsx`
2. `src/components/operator/VehicleEquipmentChecklist.tsx`
3. `src/components/operator/InspectionFormSections.tsx`
4. `src/components/operator/PhotographicSet.tsx`
5. `src/components/operator/SignaturePad.tsx`
6. `src/components/operator/AssignedServiceCard.tsx`

## Patron de Reemplazo

| Clase Oscura | Clase Clara (Tema) |
|--------------|-------------------|
| `bg-slate-800` | `bg-card` |
| `bg-slate-900` | `bg-background` |
| `bg-slate-700` | `bg-muted` |
| `border-slate-600` | `border-border` |
| `border-slate-700` | `border-border` |
| `text-white` | `text-foreground` |
| `text-slate-300` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `text-zinc-950` | `text-foreground` o `text-muted-foreground` |

## Consideraciones

- Los colores semanticos (verde para exito, rojo para error, naranja para advertencia) se mantienen intactos
- El acento violeta (`text-violet-600`, `bg-violet-600`) se usa para elementos primarios siguiendo el estandar de la app
- Los botones mantienen sus variantes actuales (primary, outline, destructive)
- El indicador verde en tabs de fotos completadas se mantiene para UX

## Resultado Esperado

El portal del operador tendra:
- Fondo blanco limpio como el resto de la app
- Cards con fondo blanco y bordes grises sutiles
- Texto negro/gris oscuro legible
- Inputs con fondo blanco y bordes grises
- Acentos violeta para elementos interactivos
- Consistencia visual total con modulos como Costos, Servicios, etc.
