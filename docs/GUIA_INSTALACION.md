
# Guía de Instalación y Configuración

## 1. Requisitos Previos

- **Node.js**: Versión 18 o superior.
- **npm**: Versión 9 o superior (o un gestor de paquetes equivalente como `yarn` o `pnpm`).
- **Git**: Para clonar el repositorio.
- **Cuenta de Supabase**: Necesitará un proyecto en [Supabase](https://supabase.com) para la base de datos y la autenticación.

## 2. Instalación en Local

1.  **Clonar el repositorio**:
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd <NOMBRE_DEL_PROYECTO>
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

## 3. Configuración de Supabase

1.  **Crear un proyecto en Supabase**:
    - Vaya a su [dashboard de Supabase](https://app.supabase.com) y cree un nuevo proyecto.
    - Guarde la **Project URL** y la **anon key**.

2.  **Aplicar las migraciones de la base de datos**:
    - En el dashboard de Supabase de su proyecto, vaya a `SQL Editor`.
    - Copie y pegue el contenido de los archivos de migración de la carpeta `supabase/migrations` del repositorio en un nuevo query.
    - Ejecute las migraciones en orden cronológico para crear la estructura de la base de datos.

3.  **Configurar el cliente de Supabase en el proyecto**:
    - Abra el archivo `src/integrations/supabase/client.ts`.
    - Reemplace los valores `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los que obtuvo de su proyecto de Supabase.

    ```typescript
    // src/integrations/supabase/client.ts
    import { createClient } from '@supabase/supabase-js';
    import { Database } from './types';

    const supabaseUrl = 'TUS_SUPABASE_URL'; // Reemplazar
    const supabaseAnonKey = 'TU_SUPABASE_ANON_KEY'; // Reemplazar

    export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
    ```

    **Nota**: En un entorno de producción, estos valores deben gestionarse como variables de entorno.

4.  **Configurar Row Level Security (RLS)**:
    - Las políticas RLS ya están definidas en las migraciones.
    - Asegúrese de que estén activas para proteger los datos según los roles de usuario.

## 4. Configuración PWA

El proyecto incluye funcionalidades de Progressive Web App (PWA):

1.  **Service Worker**: Ya está configurado en `public/sw.js`
2.  **Web App Manifest**: Configurado en `public/manifest.json`
3.  **Instalación**: Los usuarios pueden instalar la app como nativa

## 5. Ejecutar el Proyecto

Una vez completada la configuración, puede iniciar el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:8080`.

## 6. Configuración Inicial de Datos

### Crear Usuario Administrador
```sql
-- En el SQL Editor de Supabase
INSERT INTO profiles (id, email, full_name, role) 
VALUES (uuid_generate_v4(), 'admin@empresa.com', 'Administrador', 'admin');
```

### Crear Usuario Operador
```sql
-- Crear perfil de operador
INSERT INTO profiles (id, email, full_name, role) 
VALUES (uuid_generate_v4(), 'operador@empresa.com', 'Juan Pérez', 'operator');

-- Vincular con registro de operador
UPDATE operators 
SET user_id = (SELECT id FROM profiles WHERE email = 'operador@empresa.com')
WHERE name = 'Juan Pérez';
```

## 7. Deployment

Para desplegar la aplicación en producción:

```bash
npm run build
```

El contenido de la carpeta `dist/` puede ser desplegado en cualquier servicio de hosting de sitios estáticos como Vercel, Netlify, AWS S3, etc. 

### Variables de Entorno en Producción
Asegúrese de configurar las siguientes variables de entorno:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 8. Troubleshooting

### Problemas Comunes

1. **Error de conexión a Supabase**: Verificar URLs y keys de API
2. **Políticas RLS**: Asegurar que las políticas estén activas
3. **PWA no funciona**: Verificar que el sitio esté servido sobre HTTPS
4. **Operadores sin acceso**: Verificar vinculación user_id en tabla operators

### Logs de Debugging
El sistema incluye logs extensivos en consola para facilitar el debugging en desarrollo.
