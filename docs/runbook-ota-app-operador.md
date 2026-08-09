# Runbook — Publicación OTA a la app operador (iOS/Android)

> **ESTADO: NO EJECUTADO.** Este documento describe el procedimiento. A la fecha
> (09-08-2026) `app_bundle_versions` tiene **0 bundles publicados**: el mecanismo
> OTA está integrado y nunca se ha usado. Nada de lo que sigue se corrió.
>
> La publicación hacia los equipos en terreno es decisión de Sergio, y solo
> después de que el fix esté verificado al 100% (ver checklist más abajo).

---

## 1. Qué rige hoy sin tocar los dispositivos

La app operador es un **build empaquetado** de Capacitor: `capacitor.config.ts`
declara `webDir: 'dist'` y **no** define `server.url`. El JS viaja dentro del
`.ipa`. Desplegar la web en Cloudflare Pages **no** cambia nada en un teléfono ya
instalado.

Por eso el criterio de esta tanda fue: todo lo que pueda vivir en el servidor,
vive en el servidor.

| Cambio | Dónde vive | ¿Rige en 1.0.1 (8) y 1.0.1 (6) sin actualizar? |
|---|---|---|
| Bloqueo de eliminación con evidencia de terreno | `assert_service_deletable` + trigger `a_guard_service_delete` | **Sí, ya rige** |
| Auditoría del DELETE de services | trigger `trg_audit_services_delete` | **Sí, ya rige** |
| Folio monotónico | secuencia + `next_service_folio()` | Parcial: la app vieja aún llama al camino viejo del cliente, pero la unicidad de `services.folio` la protege |
| Iniciar un servicio en estado comercial | `advance_operator_service_status` | **Sí, ya rige** |
| Vinculación de telemetría multi-operador | `enforce_principal_operator_service_binding` | **Sí, ya rige** |
| **Ver** un servicio `quoted` en la lista del operador | fetcher JS (`useOperatorServices`) | **No.** Requiere cliente actualizado |

### Por qué la visibilidad NO se puede arreglar desde el servidor

La app instalada envía la consulta ya filtrada:

```ts
.in('status', ['pending', 'in_progress', 'inspection_completed', 'completed'])
```

Ese predicado está compilado dentro del bundle y viaja en el request HTTP. RLS y
los RPC solo pueden **restringir** lo que una consulta devuelve; no pueden
**agregar** filas que el propio cliente excluyó en su `WHERE`. No hay policy,
vista ni función que deshaga ese filtro.

La RLS de `services` nunca filtró por estado (`services_authenticated_SELECT_consolidated`
solo mira `operator_id` y `service_resources`), así que del lado servidor la
visibilidad ya era correcta desde antes.

**Única vía sin publicar nada:** que administración deje el servicio en `pending`
al despacharlo, en vez de `quoted`. Es un cambio de procedimiento, no de código.

> Nota no verificada: `useOperatorService` (la carga de UN servicio por id) no
> filtra por estado, así que un enlace directo a
> `/operator/service/<id>/inspection` podría abrir un servicio `quoted` en la app
> vieja. No se probó y no se recomienda como vía habitual.

---

## 2. Checklist previo a autorizar cualquier publicación

Ninguna publicación se autoriza hasta que **todos** estén marcados por Sergio.

- [ ] **Web en producción verificada.** El deploy de Cloudflare Pages terminó y
      app.gruas5norte.cl carga la versión con el fix.
- [ ] **Portal operador probado con un usuario `operator` real** (no admin, no
      cuenta de prueba con rol elevado).
- [ ] **Estados `quoted` visibles.** Un servicio en `quoted` con operador
      asignado aparece en la lista de ese operador y muestra el botón "Iniciar
      Servicio".
- [ ] **El servicio se inicia.** El botón lleva el servicio a `in_progress` y
      queda registrada la hora de inicio.
- [ ] **Bloqueos de eliminación probados en la UI**: un servicio con inspección
      firmada muestra el mensaje explicativo y NO se elimina; un `quoted` sin
      evidencia sí se elimina.
- [ ] **Folio estrictamente creciente**: crear servicio → anotar folio →
      eliminarlo → crear otro → el folio nuevo es mayor, nunca el mismo.
- [ ] **Telemetría vinculada**: una sesión de un operador que no es el principal
      pero está en `service_resources` guarda `service_id` no nulo.
- [ ] **Rebuild local aprobado por Sergio.** Sergio corrió el build en su propio
      teléfono y dio el visto bueno explícito.
- [ ] **Ventana elegida.** La publicación no cae sobre un turno con grúas en
      ruta.

---

## 3. Procedimiento OTA (NO EJECUTADO)

### 3.1 Cómo funciona

`src/services/liveUpdate.ts` con `@capgo/capacitor-updater`, `autoUpdate: false`
(la app decide, no el plugin). En cada arranque:

1. Lee `app_bundle_versions` donde `is_active = true` y
   `platform IN (<plataforma>, 'all')`. Si hay fila específica de plataforma,
   gana sobre `'all'`.
2. Compara `min_native_version` contra la versión nativa instalada
   (`compareLooseVersions`). Si el nativo es más viejo, **omite** el bundle.
3. Compara `version` del bundle contra la del bundle actual. Solo baja si es
   mayor.
4. Descarga desde `bundle_url` validando `checksum`.
5. `CapacitorUpdater.next()` + `setMultiDelay({ kind: 'kill' })`: el bundle
   **no** se activa en caliente, entra en el siguiente arranque en frío.

### 3.2 Pasos

```bash
# 1. Build de producción
npm run build

# 2. Empaquetar dist/ como zip del bundle
cd dist && zip -r ../bundle-<version>.zip . && cd ..

# 3. Checksum (el plugin lo valida en la descarga)
shasum -a 256 bundle-<version>.zip

# 4. Subir al bucket app-bundles
supabase storage cp bundle-<version>.zip \
  ss:///app-bundles/bundle-<version>.zip --experimental --linked
```

Luego registrar la fila. **Migraciones y datos siempre por `supabase db push --linked`**,
nunca por el dashboard ni por `apply_migration`:

```sql
-- Publicar: is_active = true es lo que dispara la actualización en los equipos.
INSERT INTO public.app_bundle_versions
  (version, bundle_url, checksum, min_native_version, platform, is_active, notes)
VALUES
  ('1.0.2', '<url pública del zip>', '<sha256>', '1.0.1', 'ios', false,
   'Visibilidad de servicios en estado comercial');
```

Se inserta con `is_active = false` a propósito. La publicación real es un paso
aparte y consciente:

```sql
UPDATE public.app_bundle_versions SET is_active = false WHERE platform = 'ios';
UPDATE public.app_bundle_versions SET is_active = true  WHERE version = '1.0.2';
```

### 3.3 Rollback

```sql
UPDATE public.app_bundle_versions SET is_active = false WHERE version = '1.0.2';
UPDATE public.app_bundle_versions SET is_active = true  WHERE version = '<anterior>';
```

El equipo vuelve al bundle anterior en el siguiente arranque en frío. Si no hay
bundle anterior publicado (el caso de hoy: cero bundles), desactivar la fila deja
a los equipos en el bundle **nativo** del `.ipa`, que es el estado actual — o sea
que el rollback desde la primera publicación siempre tiene a dónde volver.

> El "JS Eval error" que aparece en los logs de Capgo es telemetría del plugin,
> **no** un rollback de OTA. Ver la nota de arquitectura sobre splash y Capgo
> antes de interpretar esos logs.

### 3.4 Qué NO puede arreglar un OTA

Un bundle OTA solo reemplaza el JS/CSS. Cambios en plugins nativos,
`Info.plist`, permisos, o la versión nativa exigen **rebuild y TestFlight**. Los
cambios de esta tanda son todos JS o servidor: un OTA alcanza.

---

## 4. Estado de las versiones en terreno (09-08-2026)

| Versión | Situación |
|---|---|
| 1.0.1 (8) | Activa en la mayoría de los equipos |
| 1.0.1 (6) | Un equipo, sin actualizar desde el 29-07 |
| Bundles OTA | **0 publicados** |

El equipo en 1.0.1 (6) es el que hay que mirar primero al fijar
`min_native_version`: si se pone `1.0.1` lo incluye; si el fix necesitara algo
nativo, ese equipo queda fuera hasta que se actualice por TestFlight.
