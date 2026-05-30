## Problema

En el modal de Servicio (`ServiceDetailsModal`), el header coloca el bloque del título (badges + "Detalle Operativo y Financiero") y la fila de 5 botones de acción dentro del mismo `flex justify-between`. Como los botones ocupan casi todo el ancho, el bloque del título se comprime y queda desordenado:

- El badge "Servicio 3224823-2" se parte en dos líneas.
- El título "Detalle Operativo y Financiero" se rompe verticalmente palabra por palabra.
- Los botones se quedan apretados en una sola fila sin respiro.

## Cambios

Archivo: `src/components/services/ServiceDetailsModal.tsx` (solo el bloque `DialogHeader`, líneas ~339-418).

1. **Apilar el header en dos filas** en lugar de `justify-between` horizontal:
   - Fila 1: badges (`Servicio {folio}` + estado) en línea, sin truncar.
   - Fila 2: `DialogTitle` "Detalle Operativo y Financiero" en una sola línea, tamaño consistente con el sistema (mismo patrón que el módulo de Costos: `text-xl font-semibold tracking-tight`).
   - Fila 3: barra de acciones en `flex flex-wrap gap-2`, alineada a la izquierda, separada con un margen superior.

2. **Acciones uniformes**:
   - Mantener los mismos botones y handlers; solo ajustar layout (`flex-wrap`) para que respiren en viewports angostos y no compriman el título.
   - Conservar variantes existentes (outline / secondary) y el icono + label actuales.

3. **Spacing y tipografía** siguiendo el patrón del módulo Costos:
   - `DialogHeader`: `px-6 pt-6 pb-4 border-b border-border/70 gap-3`.
   - Bloque de identidad (badges + título) con `space-y-2`.
   - Acciones separadas con `pt-2` para crear jerarquía visual.

4. **Sin cambios de lógica**: no se tocan handlers, datos, ni el resto del modal (tabs, contenido). Solo reordenamiento visual del header.

### Resultado esperado

```text
[Servicio 3224823-2] [Completado]
Detalle Operativo y Financiero
─────────────────────────────────────────────
[Notificar Operador] [Duplicar] [Descargar PDF] [Cotización] [Orden de Trabajo]
```

Título y badges legibles en una línea cada uno; botones envolviendo con elegancia debajo.
