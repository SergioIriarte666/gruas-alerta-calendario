

# Plan: Mejorar mapeo de datos premium SRE al formulario de cliente

## Problema
Los logs muestran que SRE.cl premium devuelve valores `false` (boolean) para campos como `comuna`, `ciudad`, `provincia`, `region` cuando no hay datos. Además, cuando SÍ existen, la dirección solo usa `direccion + comuna` ignorando ciudad y región. También, ruts.info falla como fallback (`"Error fetching company info"`).

## Cambios

### 1. `supabase/functions/sre-lookup/index.ts` — Sanitizar booleans y enriquecer dirección
Líneas 131-135: los campos geográficos pueden venir como `false` (boolean). Cambiar el mapeo para filtrar explícitamente booleans:
```typescript
direccion: (typeof data.direccion === 'string' && data.direccion) || "",
comuna: (typeof data.comuna === 'string' && data.comuna) || "",
ciudad: (typeof data.ciudad === 'string' && data.ciudad) || "",
provincia: (typeof data.provincia === 'string' && data.provincia) || "",
region: (typeof data.region === 'string' && data.region) || "",
telefono: (typeof data.telefono === 'string' && data.telefono) || "",
email: (typeof data.email === 'string' && data.email) || "",
```

### 2. `src/components/clients/form/ClientFormStep1.tsx` — Construir dirección completa
Línea 73: incluir ciudad y región en la dirección cuando estén disponibles:
```typescript
const address = [result.direccion, result.comuna, result.ciudad, result.region]
  .filter(Boolean)
  .join(', ');
```

### 3. Redesplegar edge function `sre-lookup`

## Nota
Para el RUT 77118775-7 específicamente, SRE.cl no tiene datos de dirección/teléfono/email. Esto es normal — la API premium lo advierte: "Información puede no estar disponible". Pero con estos cambios, cuando los datos SÍ existan para otros RUTs, se aplicarán correctamente.

## Archivos
- `supabase/functions/sre-lookup/index.ts` — sanitizar booleans
- `src/components/clients/form/ClientFormStep1.tsx` — dirección completa con ciudad/región

