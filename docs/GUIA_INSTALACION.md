
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

## 4. Ejecutar el Proyecto

Una vez completada la configuración, puede iniciar el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:8080`.

## 5. Deployment

Para desplegar la aplicación en producción, puede generar una build estática:

```bash
npm run build
```

El contenido de la carpeta `dist/` puede ser desplegado en cualquier servicio de hosting de sitios estáticos como Vercel, Netlify, AWS S3, etc. Asegúrese de configurar las variables de entorno de Supabase en su proveedor de hosting.

