# OTA bundles para TMS Operador

## Resumen

Las apps nativas de `TMS Operador` ahora pueden descargar bundles web OTA usando `@capgo/capacitor-updater` en modo manual. Los bundles viven en Supabase Storage (`app-bundles`) y el manifiesto de activacion vive en `public.app_bundle_versions`.

Regla de oro: si un cambio requiere plugins nativos nuevos, permisos nuevos o cambios en `Info.plist` / Gradle, no va por OTA. En ese caso corresponde release nativo tradicional y los siguientes bundles deben subir `min_native_version`.

## Flujo de release

1. Confirmar que el cambio es solo JS/CSS/HTML.
2. Publicar bundle:

```bash
npm run release:bundle -- --activate
```

3. Si hace falta fijar una version nativa minima:

```bash
npm run release:bundle -- --activate --min-native-version 1.3.0
```

4. Si quieres dejar el bundle cargado pero no activo todavia:

```bash
npm run release:bundle
```

## Variables necesarias

El script usa estas variables de entorno desde `.env` o `.env.local`:

```bash
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Opcionales:

```bash
BUNDLE_BUILD_COMMAND="npm run build:operator-mobile"
BUNDLE_MIN_NATIVE_VERSION=1.3.0
```

## Que hace el script

- Ejecuta el build de la app movil.
- Genera version automatica `YYYY.MM.DD-N`.
- Zipea `dist/` con archivos en la raiz del zip.
- Calcula `sha256`.
- Sube `bundle-<version>.zip` al bucket `app-bundles`.
- Inserta la fila en `app_bundle_versions`.
- Si recibe `--activate`, llama el RPC `activate_app_bundle_version()` con transaccion del lado SQL.

Tambien deja un registro local en `releases/bundles/<version>.json`.

## Comportamiento en la app

- Solo corre en iOS/Android nativo.
- `notifyAppReady()` se llama al inicio para confirmar que el bundle actual es sano.
- En arranque y `resume`, la app consulta la version activa para `ios`, `android` o `all`.
- Si `min_native_version` es mayor que la version instalada, no descarga nada.
- Si hay bundle nuevo compatible, se descarga y se agenda con `next()` para el siguiente arranque en frio.
- Si el bundle nuevo no vuelve a llamar `notifyAppReady()`, Capgo hace rollback automatico.

## Validacion recomendada

1. `npm run build`
2. `npx cap sync`
3. Instalar APK/IPA de prueba.
4. Publicar un cambio visual con `npm run release:bundle -- --activate`.
5. Abrir la app, esperar el toast, cerrar y volver a abrir.
6. Confirmar que el cambio aparece sin reinstalar el APK.
