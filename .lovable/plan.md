
# Fix: Autocompletado en modal de servicios y scroll en la app

## Problemas

1. **Autocompletado no funciona**: Los Combobox de ubicacion (origen/destino) y asegurado usan `Popover` + `Command` dentro de un `Dialog`. El Dialog de Radix aplica `pointer-events: none` al fondo, lo que bloquea la interaccion con el `PopoverContent` (no se puede escribir ni seleccionar).

2. **Scroll no funciona en varios lugares**: Los `ScrollArea` dentro de Dialogs tambien se ven afectados por el mismo `pointer-events: none`, impidiendo el scroll con mouse/touch.

## Solucion

Aplicar `pointer-events-auto` en los componentes base (mismo patron que se aplico exitosamente en `select.tsx`).

### Archivo 1: `src/components/ui/popover.tsx`

Agregar `pointer-events-auto` al `PopoverContent` para que todos los Popover (incluidos los Combobox) funcionen dentro de Dialogs:

```tsx
className={cn(
  "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none pointer-events-auto ...",
  className
)}
```

### Archivo 2: `src/components/ui/scroll-area.tsx`

Agregar `pointer-events-auto` al `ScrollAreaPrimitive.Viewport` para que el scroll funcione dentro de Dialogs:

```tsx
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] pointer-events-auto">
```

Y tambien al `ScrollBar`:

```tsx
className={cn(
  "flex touch-none select-none transition-colors pointer-events-auto",
  ...
)}
```

### Archivo 3: `src/components/ui/command.tsx`

Agregar `pointer-events-auto` al `CommandInput` para asegurar que el campo de texto reciba interacciones dentro de Dialogs:

```tsx
<div className="flex items-center border-b px-3 pointer-events-auto" cmdk-input-wrapper="">
```

## Resultado

- Los campos de autocompletado (origen, destino, asegurado) funcionan correctamente dentro del modal de servicios
- El scroll funciona en todos los modales y dialogos de la aplicacion (detalles de servicio, historial, filtros, etc.)
- No se requieren cambios en los componentes individuales, la correccion es a nivel de componentes base
