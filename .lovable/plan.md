

# Plan: Cambiar SRE.cl de modo gratuito a premium

## Contexto
La API de SRE.cl ya está activa y tienes un token premium configurado como secret (`SRE_API_TOKEN`). Sin embargo, el código actual tiene un fallback a `"token_publico"` y no envía el parámetro `version: "2.0"` que la documentación de SRE.cl especifica. Además, con el modo premium ya no es necesario enriquecer desde ruts.info porque SRE.cl premium devuelve dirección completa, teléfono, email, logo, etc.

## Cambios en `supabase/functions/sre-lookup/index.ts`

### 1. Eliminar fallback a token_publico
Línea 60 — cambiar:
```typescript
// Antes
const token = Deno.env.get("SRE_API_TOKEN") || "token_publico";

// Después
const token = Deno.env.get("SRE_API_TOKEN");
if (!token) {
  return new Response(
    JSON.stringify({ error: "SRE_API_TOKEN no configurado" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### 2. Agregar `version: "2.0"` al request POST
Línea 82 — incluir versión en el body:
```typescript
body: JSON.stringify({ token, rut, version: "2.0" }),
```

### 3. Mapear campos premium adicionales
Agregar los campos que devuelve el modo premium al resultado (ciudad, provincia, región, logo, tags).

### 4. Simplificar lógica de enriquecimiento
Con premium, SRE.cl ya devuelve dirección, teléfono y email. Mantener el enriquecimiento desde ruts.info solo como fallback en caso de que algún campo específico esté vacío, pero sin depender de ello.

### 5. Redesplegar la edge function

## Archivo
- `supabase/functions/sre-lookup/index.ts`

