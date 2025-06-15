
# Arquitectura del Software

## 1. Vista General

La aplicación sigue una arquitectura de **Single Page Application (SPA)** basada en componentes, con un backend como servicio (BaaS) proporcionado por Supabase.

```
+----------------+      +-------------------------+      +-----------------+
|   Navegador    | <=>  |     Frontend (React)    | <=>  | Supabase (BaaS) |
| (Usuario)      |      |                         |      |                 |
+----------------+      |  - Componentes (UI)     |      |  - Base de Datos|
                        |  - Hooks (Lógica)       |      |  - Auth         |
                        |  - Enrutamiento         |      |  - Storage      |
                        +-------------------------+      +-----------------+
```

## 2. Arquitectura del Frontend

El frontend está diseñado para ser modular, escalable y mantenible.

### 2.1. Capa de Presentación (UI)
- **Componentes**: La UI se construye a partir de componentes React funcionales. Se utiliza la biblioteca **shadcn/ui**, que proporciona componentes accesibles y personalizables construidos sobre Tailwind CSS.
- **Estructura de Componentes**:
  - `pages/`: Componentes de alto nivel que definen la estructura de una página completa.
  - `components/`: Componentes reutilizables, organizados por dominio de negocio (ej. `components/services/ServiceForm.tsx`).
  - `components/ui/`: Componentes genéricos de UI proporcionados por shadcn/ui.
  - `components/layout/`: Componentes de maquetación principal como `Sidebar` y `Header`.

### 2.2. Capa de Lógica de Negocio y Estado
- **Hooks Personalizados**: La lógica de negocio y la gestión de estado se encapsulan en hooks personalizados. Este es el patrón principal de la aplicación. Por cada recurso (ej. `services`), existe un hook (`useServices.ts`) que expone:
  - El estado de los datos (`services`, `loading`, `error`).
  - Funciones para realizar operaciones CRUD (`createService`, `updateService`, `deleteService`).
- **Gestión de Estado del Servidor**: **React Query (`@tanstack/react-query`)** es fundamental. Se utiliza para:
  - Realizar peticiones a Supabase.
  - Gestionar el caching, la revalidación y la sincronización de datos.
  - Proporcionar estados de `isLoading`, `isError`, `isSuccess` de forma automática.
- **Estado Global**: Para el estado de autenticación y la información del usuario, se utiliza `React.Context` (`AuthContext`).

### 2.3. Capa de Acceso a Datos
- **Cliente de Supabase**: Toda la comunicación con Supabase se realiza a través de un cliente singleton definido en `src/integrations/supabase/client.ts`.
- **Llamadas a la API**: Las llamadas a la API de Supabase (ej. `supabase.from('services').select('*')`) se realizan dentro de los hooks personalizados, gestionados por React Query.

## 3. Patrones de Diseño

- **Custom Hook Pattern**: Para la reutilización de lógica y separación de responsabilidades. Cada hook es responsable de un dominio de negocio.
- **Provider Pattern (Context API)**: Para inyectar dependencias y estado global (ej. `AuthProvider`).
- **Composición de Componentes**: Se prefiere la composición sobre la herencia, un principio fundamental de React. Los componentes de `shadcn/ui` hacen un uso extensivo de este patrón.
- **Separation of Concerns**: La estructura de carpetas y el uso de hooks aseguran que la UI, la lógica de estado y el acceso a datos estén desacoplados.

