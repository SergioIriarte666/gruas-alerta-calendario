

# Plan: Foto de perfil con almacenamiento en DB

## Objetivo
Agregar funcionalidad de foto de perfil que se pueda subir/cambiar desde la pagina de Perfil, se almacene en Supabase Storage, y se muestre en el sidebar (avatar).

## Cambios necesarios

### 1. Crear bucket de almacenamiento "avatars" (migracion SQL)
- Crear bucket publico `avatars` en `storage.buckets`
- Crear politicas RLS para que cada usuario pueda subir/actualizar/eliminar su propia foto (path: `{user_id}/avatar.*`)
- Permitir lectura publica para que el avatar se muestre sin URLs firmadas

### 2. Actualizar UserContext para incluir `avatar_url`
**Archivo:** `src/contexts/UserContext.tsx`
- Agregar `avatar_url` al tipo `UserProfile`
- Incluir `avatar_url` en la query `select` de `fetchUserProfile`
- Propagar `avatar_url` en el cache y en `updateUser`

### 3. Agregar seccion de foto en la pagina de Perfil
**Archivo:** `src/pages/Profile.tsx`
- Agregar una seccion antes de "Informacion Personal" con:
  - Avatar grande circular mostrando la foto actual o iniciales
  - Boton "Cambiar foto" que abre un input de archivo (accept="image/*")
  - Al seleccionar imagen: subirla a `avatars/{userId}/avatar.{ext}` en Supabase Storage
  - Actualizar `profiles.avatar_url` con la URL publica
  - Llamar `forceRefreshProfile` para que el sidebar refleje el cambio inmediatamente

### 4. Mostrar avatar real en el Sidebar
**Archivo:** `src/components/layout/Sidebar.tsx`
- Reemplazar `<AvatarImage src={undefined} />` por `<AvatarImage src={user?.avatar_url} />`
- Aplica tanto en `SidebarContent` como en `MobileSidebarContent`

## Detalle tecnico

### Migracion SQL
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

### UserProfile type update
Agregar `avatar_url?: string | null` al interface y al select query (`avatar_url`).

### Logica de upload en Profile.tsx
- Usar `supabase.storage.from('avatars').upload(path, file, { upsert: true })`
- Obtener URL publica con `getPublicUrl`
- Actualizar `profiles.avatar_url` via `updateUser`

### Sidebar
- Linea 227 y 343: cambiar `src={undefined}` por `src={user?.avatar_url || undefined}`

## Resultado esperado
- El usuario puede subir una foto de perfil desde la pagina /profile
- La foto se almacena en Supabase Storage (bucket `avatars`)
- La URL se guarda en `profiles.avatar_url`
- El sidebar muestra la foto real del usuario en el avatar circular
- Si no hay foto, se muestran las iniciales como fallback (comportamiento actual)

