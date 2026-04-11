

# Plan: Usar token público de SRE temporalmente

## Cambio
Modificar la Edge Function `sre-lookup` para usar el token público `"token_publico"` como fallback cuando el `SRE_API_TOKEN` no esté activo, o directamente usar el token público por ahora.

### Enfoque simple
En `supabase/functions/sre-lookup/index.ts`, línea 14:
- Cambiar la lógica del token para usar `"token_publico"` como fallback:
```typescript
const token = Deno.env.get("SRE_API_TOKEN") || "token_publico";
```
- Esto permite que funcione inmediatamente con datos públicos
- Cuando el token premium se active, automáticamente lo usará (ya está guardado como secret)

### También cambiar el método a GET
La API pública de SRE usa GET con query params, no POST. Agregar lógica para detectar si es token público y usar GET:
```
GET https://sre.cl/api/company_info?token=token_publico&rut=XX.XXX.XXX-X
```

Si el token es el premium (de env), seguir usando POST como está documentado para el plan premium.

## Archivos
- `supabase/functions/sre-lookup/index.ts` — agregar fallback a token público + soporte GET

