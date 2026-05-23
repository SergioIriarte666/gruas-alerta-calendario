# Configuracion de Turnstile

## Variables opcionales

- Frontend Vite: `VITE_TURNSTILE_SITE_KEY`
- Edge Function `send-password-reset`: `TURNSTILE_SECRET_KEY`

## Comportamiento actual

- Si no configuras estas variables, el flujo de recuperacion funciona solo con `rate limiting`.
- Si configuras ambas variables, el captcha se activa automaticamente en frontend y backend.

## Claves oficiales de prueba

- Site key siempre exitosa: `1x00000000000000000000AA`
- Secret key siempre exitosa: `1x0000000000000000000000000000000AA`

## Requisitos de produccion

- Crear un widget real en Cloudflare Turnstile para el dominio productivo.
- Definir `VITE_TURNSTILE_SITE_KEY` en el frontend desplegado.
- Definir `TURNSTILE_SECRET_KEY` en los secretos de Supabase para `send-password-reset`.
- Mantener `site key` y `secret key` reales fuera del repositorio.

## Secuencia recomendada

```bash
cp .env.example .env
```

- Definir `VITE_TURNSTILE_SITE_KEY` en `.env` o en el proveedor de hosting del frontend.

```bash
supabase secrets set TURNSTILE_SECRET_KEY="tu_secret_key_real"
supabase functions deploy send-password-reset
```

- Si el frontend se despliega por separado, regenerar el build con `VITE_TURNSTILE_SITE_KEY` ya configurado.
- Probar el flujo completo en `/auth` con el formulario de recuperación antes de publicarlo.

## Notas de seguridad

- La validacion client-side por si sola no es suficiente; cuando Turnstile esta activo, la Edge Function valida el token via `siteverify`.
- Mientras Turnstile no este configurado, la proteccion activa es el `rate limiting` por `IP + email` y la respuesta generica anti-enumeracion.
