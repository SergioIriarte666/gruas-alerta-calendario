# Enriquecer tarjeta de servicio en "Registro por Lotes" (Pipeline VIP)

## Contexto

En el modal `BatchUpdateModal` (Pipeline VIP → "Actualización por Lotes"), cada servicio listado en el panel izquierdo muestra muy poca información:

- Folio (ej. `SRV-6617`)
- Estado (`Completado`)
- Tipo de servicio + fecha (`Grua Livianos · 25/04/26`)
- Badges de COT/OC si existen

Se solicita agregar **debajo del folio** los datos del vehículo (marca, modelo, patente) y otros datos relevantes para identificar el servicio sin tener que abrirlo.

## Cambios

Editar **un único archivo**: `src/components/vip/BatchUpdateModal.tsx` (bloque de la tarjeta de servicio, líneas ~381–426).

### Nueva estructura de la tarjeta

```text
[✓] SRV-6617                            [Completado]
    [COT: 4184]  [OC: 123]              ← (si existen, ya estaba)
    🚗 Toyota Hilux · ABCD12             ← NUEVO
    📍 Santiago → Valparaíso             ← NUEVO (truncado si es largo)
    👤 Juan Pérez · GRUA-01              ← NUEVO (operador · grúa)
    Grúa Livianos · 25/04/26             ← (ya existía, queda al final)
```

### Detalle por línea agregada

1. **Vehículo**: ícono `Car` (lucide) + `{vehicleBrand} {vehicleModel} · {licensePlate}`. Si falta marca/modelo, mostrar solo patente. Si no hay patente tampoco, omitir la línea.
2. **Ruta**: ícono `MapPin` + `{origin} → {destination}` con `truncate` y `title` para tooltip. Omitir si ambos están vacíos.
3. **Operador / Grúa**: ícono `User` + `{operator?.name ?? 'Sin operador'} · {crane?.licensePlate ?? 'Sin grúa'}`. Omitir si ambos están vacíos.

Todos los textos: `text-xs text-muted-foreground`, íconos `w-3 h-3` para mantener densidad. Layout vertical con `space-y-0.5` o `mt-1`.

## Estilo

- Reutilizar tokens del sistema (`text-muted-foreground`, `text-foreground`) para respetar el modo oscuro y el patrón del módulo de Costos (memoria de diseño activa).
- Sin colores hardcodeados.
- Íconos de `lucide-react` (ya importados parcialmente en el archivo; agregar los faltantes: `Car`, `MapPin`, `User`).

## Verificación

- Confirmar visualmente en el modal que servicios con/sin patente, con/sin operador y con/sin ruta se renderizan sin huecos.
- Confirmar que el `truncate` evita que rutas largas rompan el layout del panel izquierdo.
- Sin cambios de comportamiento (selección/exclusión sigue funcionando al hacer click en la tarjeta).
