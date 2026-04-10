

# Plan: Mejorar UI del Modal de Servicios (Tab Costos)

## Problema
La pestaña "Costos" del modal de detalles del servicio se ve plana y monótona — todas las tarjetas son blancas con bordes grises, sin diferenciación visual entre categorías.

## Cambios en `src/components/services/ServiceCostsSection.tsx`

### 1. Tarjeta de Total con color de fondo
- Cambiar el fondo del resumen total a un degradado suave rojo/destructive para que destaque como encabezado principal.

### 2. Colores por categoría
- Asignar un color lateral (borde izquierdo grueso `border-l-4`) diferente a cada grupo de categoría usando una paleta predefinida (violet, blue, orange, emerald, rose, amber).
- Los headers de categoría también llevan el color correspondiente como acento.

### 3. Resumen por categoría con chips de color
- Cada categoría en el resumen muestra su monto con el color asignado en vez de todos en rojo.

### 4. Badges de subcategoría con color
- Los badges de subcategoría pasan de `outline` gris a tener el color de su categoría padre (fondo suave + texto oscuro).

### 5. Comisiones con estilo diferenciado
- Las tarjetas de comisión de operador llevan borde izquierdo violeta y un badge violeta para distinguirlas visualmente de los costos regulares.

## Archivo a modificar
- `src/components/services/ServiceCostsSection.tsx`

## Sin riesgo funcional
Solo cambios de estilo CSS/Tailwind. No se modifica lógica de datos ni cálculos.

