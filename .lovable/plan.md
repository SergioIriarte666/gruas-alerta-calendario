

# Fix: Normalización de RUT en el importador de historial

## Problema

El importador de historial usa una normalización de RUT incompleta. Solo quita puntos (`77.225.200-5` → `77225200-5`), pero el sistema `entityFinders` quita puntos, espacios Y guiones (`77225200-5` → `772252005`). Si en la BD el RUT está guardado con formato diferente (ej: `77225200-5` vs `77.225.200-5`), la comparación falla.

## Solución

Alinear la función `normalizeRut` en `invoiceHistoryParser.ts` con el patrón existente en `entityFinders.ts`:

```typescript
// Antes (solo quita puntos)
const normalizeRut = (rut: string): string => {
  return rut.replace(/\./g, '').trim().toUpperCase();
};

// Después (quita puntos, espacios y guiones — igual que entityFinders)
const normalizeRut = (rut: string): string => {
  return rut.replace(/[.\s-]/g, '').trim().toUpperCase();
};
```

## Archivo a modificar

- `src/utils/invoiceHistoryParser.ts` — línea 66: cambiar regex de `\\.` a `[.\\s-]`

Cambio de 1 línea. Esto hará que clientes como "ARRENDADORA DE VEHÍCULOS S.A." (RUT 77.225.200-5) se reconozcan correctamente contra el registro en la BD.

