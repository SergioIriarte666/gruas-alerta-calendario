

# Plan: Integración SRE.cl para Verificación de RUT en Clientes

## Resumen
Agregar un botón de búsqueda junto al campo RUT en el formulario de clientes que consulte la API de sre.cl y auto-complete los datos del cliente (razón social, dirección, teléfono, email, giro comercial).

## Arquitectura

```text
[ClientFormStep1]
   │ usuario ingresa RUT → click "Buscar"
   │
   ▼
[supabase.functions.invoke("sre-lookup")]
   │
   ▼
[Edge Function: sre-lookup]
   │ POST https://sre.cl/api/company_info
   │ { token: SRE_API_TOKEN, rut: "XX.XXX.XXX-X", version: "2.0" }
   │
   ▼
[Respuesta] → auto-rellena: name, address, phone, email
```

## Pasos de implementación

### 1. Guardar el token como secret
Usar la herramienta `add_secret` para almacenar `SRE_API_TOKEN` en el proyecto. Este token solo estará disponible server-side en Edge Functions.

### 2. Crear Edge Function `sre-lookup`
- **Archivo**: `supabase/functions/sre-lookup/index.ts`
- Recibe `{ rut: string }` del frontend (validado con Zod)
- Lee `SRE_API_TOKEN` de `Deno.env`
- Hace POST a `https://sre.cl/api/company_info` con el token y RUT
- Retorna los campos relevantes: `razon_social`, `direccion`, `comuna`, `telefono`, `email`, `glosa_giro`, `dte_email`
- Incluye CORS headers y manejo de errores

### 3. Modificar `ClientFormStep1.tsx`
- Agregar un botón "Buscar" (icono Search) junto al campo RUT
- Al hacer click, invoca la Edge Function con el RUT ingresado
- Si encuentra resultados:
  - Auto-completa `name` con `razon_social`
  - Muestra un panel de resultados con los datos encontrados (dirección, teléfono, email, giro)
  - Permite al usuario confirmar y aplicar los datos al formulario
- Si no encuentra, muestra un toast informativo
- Estado de loading con spinner durante la consulta

### 4. Modificar `ClientForm.tsx`
- Pasar callback desde el form padre para que Step1 pueda actualizar campos de Step2 (phone, email, address) con los datos obtenidos de SRE

### 5. Datos que se auto-completan
| Campo SRE | Campo formulario | Step |
|-----------|-----------------|------|
| razon_social | name | 1 |
| direccion + comuna | address | 2 |
| telefono | phone | 2 |
| email | email | 2 |

## UI/UX
- Botón de búsqueda con estilo coherente al módulo de costos (violet accent)
- Panel de resultados con `border-l-4 border-l-emerald-500` para indicar datos encontrados
- Toast de error si el RUT no se encuentra o hay error de API
- El usuario siempre puede editar los campos después del auto-completado

## Sin riesgo funcional
- El auto-completado es opcional; el flujo manual sigue funcionando igual
- Los datos solo se aplican cuando el usuario confirma

