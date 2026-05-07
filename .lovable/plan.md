## Objetivo
Que al abrir `www.gruas5norte.com` (nueva pestaña/ventana o reapertura del navegador) el usuario siempre vea la pantalla de login, en lugar de entrar con una sesión recordada.

## Causa actual
En `src/integrations/supabase/client.ts` el cliente Supabase está configurado así:

```ts
auth: {
  storage: localStorage,
  persistSession: true,
  autoRefreshToken: true,
}
```

`localStorage` guarda la sesión indefinidamente entre cierres del navegador, por eso siempre entra logueado.

## Cambio propuesto
Cambiar el almacenamiento de la sesión a `sessionStorage`:

```ts
auth: {
  storage: sessionStorage,
  persistSession: true,
  autoRefreshToken: true,
}
```

Comportamiento resultante:
- Al cerrar la pestaña/ventana o el navegador, la sesión se pierde y se exige login al volver.
- Dentro de la misma pestaña, recargar (F5) o navegar entre rutas mantiene la sesión (evita re-login molesto en uso normal).

## Pasos
1. Editar `src/integrations/supabase/client.ts` para usar `sessionStorage`.
2. Limpieza extra: en `src/utils/authCleanup.ts` ya se barren claves `sb-*` y `supabase.auth.*` de ambos storages, así que no requiere cambios.
3. Verificar en preview/producción: abrir el sitio en una pestaña nueva tras cerrar el navegador → debe redirigir a `/auth`.

## Alternativa (si prefieres aún más estricto)
Usar `persistSession: false`. Esto obliga login incluso al recargar la misma pestaña. No lo recomiendo porque rompe la experiencia normal de trabajo (cada F5 te saca), pero está disponible si lo deseas.

## Notas
- No se tocan políticas RLS, edge functions, ni el flujo de `AuthContext`. Solo el almacenamiento del token.
- Usuarios actualmente logueados con token en `localStorage` seguirán viéndolo hasta que cierren sesión una vez (o hasta que su token expire); para forzar el efecto inmediato puedo añadir una migración de limpieza al iniciar la app (borrar claves `sb-*` de `localStorage` al cargar).
