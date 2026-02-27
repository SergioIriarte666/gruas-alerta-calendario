

# Plan: Redisenar el Sidebar al Estilo del Referente

## Objetivo
Transformar el sidebar actual (con grupos coloreados y bordes laterales por categoria) a un diseno limpio y moderno como el de la imagen de referencia: fondo claro, perfil de usuario en la parte superior con avatar, grupos como simples etiquetas uppercase ("MAIN", "SETTINGS"), items con hover/active sutiles, y modo colapsado con solo iconos + tooltips.

## Cambios Visuales Principales

### 1. Header del Sidebar -- Perfil de usuario con avatar
- Reemplazar el header actual (logo + nombre empresa) por una seccion de perfil de usuario:
  - Avatar circular (iniciales o foto si existe)
  - Rol del usuario en texto pequeno uppercase (ej. "ADMINISTRADOR")
  - Nombre del usuario
  - Botones de colapsar/expandir (`<` / `>`) integrados junto al avatar
- En modo colapsado: solo el avatar centrado con los botones de navegacion

### 2. Grupos simplificados
- Eliminar los bordes laterales coloreados por grupo y fondos tintados
- Reemplazar por etiquetas simples en uppercase gris claro (ej. "PRINCIPAL", "OPERACIONES", "CONFIGURACION")
- En modo colapsado: una linea separadora sutil en vez de etiqueta
- Los grupos se expanden/colapsan con chevron (como "Income" en la imagen)

### 3. Items de navegacion
- Fondo limpio, sin bordes laterales de color
- Hover: fondo gris sutil (`bg-muted/50`)
- Activo: fondo gris mas marcado (`bg-muted`) con texto en negrita
- Sub-items indentados (como Earnings, Refunds en la imagen)
- En modo colapsado: solo icono centrado, con tooltip negro al hacer hover

### 4. Seccion inferior
- Mover "Cerrar Sesion" al fondo con separador
- Nombre de empresa pequeno en el footer

## Archivos a Modificar

### `src/components/layout/Sidebar.tsx`
- Reescribir `SidebarContent` y `MobileSidebarContent` con la nueva estructura visual
- Header: perfil de usuario con avatar, rol, nombre, botones collapse
- Nav: grupos como labels uppercase, items limpios sin bordes de color
- Footer: logout + nombre empresa
- Modo colapsado: iconos centrados con tooltips (usando Tooltip de Radix)

### `src/index.css`
- Simplificar o eliminar las clases `sidebar-group-*`, `sidebar-item-*`, `sidebar-indicator-*` (ya no se necesitan bordes coloreados por grupo)
- Agregar clases nuevas minimas si es necesario para el estilo limpio

### `src/components/layout/Layout.tsx`
- Sin cambios estructurales, solo ajuste menor si cambia el ancho del sidebar

## Estilo Visual (basado en la imagen)
- Fondo: `bg-white` (tema claro) / compatible con dark
- Texto grupos: `text-muted-foreground text-xs font-semibold uppercase tracking-wider`
- Items: `text-foreground text-sm`, hover `bg-muted/50`, active `bg-muted font-medium`
- Avatar: circulo con iniciales o imagen, borde sutil
- Separadores: lineas `border-b border-border` entre secciones
- Tooltips colapsados: fondo oscuro con texto blanco (como en la imagen)

## Funcionalidad Preservada
- Permisos de modulo (`useUserModulePermissions`) -- sin cambios
- Filtrado por rol (`adminOnly`) -- sin cambios
- Responsive mobile/desktop -- sin cambios
- Colapsar/expandir -- sin cambios en logica, solo visual
- Grupos expandibles -- misma logica con `expandedGroups`

