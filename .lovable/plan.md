

# Plan: Integrar API de ruts.info como fuente alternativa/fallback

## Contexto
La API de SRE.cl tiene el token público agotado y el premium pendiente de activación. La API de **ruts.info** ofrece datos similares (razón social, actividades económicas, direcciones) y puede usarse como alternativa.

## Estrategia: Fallback SRE -> ruts.info
Modificar la Edge Function para intentar primero con SRE. Si falla (403, cuota agotada, etc.), intentar automáticamente con ruts.info. Así cuando SRE premium se active, se usa como fuente principal.

## Requisitos previos
- Necesitas una API key de ruts.info (se obtiene haciendo una contribución en buymeacoffee.com/martinmoreno). Se guardará como secret `RUTS_INFO_API_KEY`.

## Cambios

### 1. Agregar secret `RUTS_INFO_API_KEY`
- Solicitar al usuario su API key de ruts.info y guardarla como secret en Supabase.

### 2. Modificar `supabase/functions/sre-lookup/index.ts`
- Agregar función para consultar ruts.info como fallback:
  - `GET https://ruts.info/api/company-info?rut={rut_sin_puntos_ni_guion}`
  - Header: `x-api-key: {RUTS_INFO_API_KEY}`
- Lógica: si SRE falla (error 403, cuota agotada, timeout), llamar a ruts.info
- Mapear la respuesta de ruts.info al mismo formato normalizado que ya usa el frontend:
  - `business_name` -> `razon_social`
  - `activities[].activity_description` -> `actividades_economicas`
  - `addresses[0].street + street_number` -> `direccion`
  - `addresses[0].district` -> `comuna`
- El RUT debe enviarse sin puntos ni guión (ej: "770738512")

### 3. Sin cambios en el frontend
El formato de respuesta normalizado se mantiene idéntico, por lo que `ClientFormStep1.tsx` no necesita modificaciones.

## Detalle técnico: formato RUT
El usuario ingresa "12.345.678-9". Para ruts.info se debe limpiar a "123456789" (sin puntos ni guión).

## Archivos modificados
- `supabase/functions/sre-lookup/index.ts` -- agregar lógica de fallback a ruts.info

