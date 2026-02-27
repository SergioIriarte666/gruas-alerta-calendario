

# Plan: Cambiar color de los items de navegacion a violeta

## Cambio
Actualizar el color de texto de los items internos del sidebar (los links de navegacion, no las etiquetas de grupo) para que usen un tono violeta (`text-violet-600`) en lugar del gris actual (`text-muted-foreground`). Esto creara mejor distincion visual entre las etiquetas de grupo (que permanecen en gris) y los elementos navegables.

## Detalle tecnico

### Archivo: `src/components/layout/Sidebar.tsx`

Modificar el componente `NavItem` (linea ~194-204):

- **Items inactivos**: cambiar de `text-muted-foreground` a `text-violet-600` (violeta como en la imagen SRV-6452)
- **Items activos**: mantener `text-foreground` con `font-semibold` y fondo `bg-muted` (para que el activo se distinga claramente)
- **Hover en inactivos**: cambiar de `hover:text-foreground` a `hover:text-violet-800` para mantener coherencia
- **Iconos**: heredaran el color violeta del texto automaticamente

Esto aplica tanto al `SidebarContent` (desktop) como al `MobileSidebarContent` (movil), ya que ambos usan el mismo componente `NavItem`.

### Resultado visual
- Etiquetas de grupo ("PRINCIPAL", "OPERACIONES", etc.) permanecen en gris claro uppercase
- Items de navegacion ("Dashboard", "Servicios", etc.) se muestran en violeta
- Item activo se distingue con fondo gris y texto oscuro en negrita
- Consistente con el sistema de diseno violeta del proyecto

