

# Plan: Auto-formatear RUT con puntos y guion mientras se escribe

## Problema
El campo de RUT acepta texto libre sin formateo automático. El usuario quiere que al escribir "767698410" se convierta automáticamente a "76.769.841-0".

## Cambios

### 1. Crear utilidad `src/utils/rutFormatter.ts`
Función `formatRut(value: string): string` que:
- Limpia todo excepto dígitos y K/k
- Separa el dígito verificador (último carácter)
- Agrega puntos cada 3 dígitos de derecha a izquierda en el cuerpo
- Agrega guion antes del verificador
- Ejemplo: `767698410` → `76.769.841-0`

### 2. Modificar `src/components/clients/form/ClientFormStep1.tsx`
En el `onChange` del input de RUT (línea 108), aplicar el formateo automático:
```typescript
onChange={(e) => onChange('rut', formatRut(e.target.value))}
```

### 3. Asegurar que `sre-lookup` limpia el RUT formateado
La edge function ya tiene `cleanRut()` que elimina puntos. Verificar que también maneje el formato con puntos correctamente (ya lo hace con `replace(/\./g, "")`).

## Archivo
- `src/utils/rutFormatter.ts` (nuevo)
- `src/components/clients/form/ClientFormStep1.tsx` (1 línea)

