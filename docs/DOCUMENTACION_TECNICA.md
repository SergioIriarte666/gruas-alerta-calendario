
# Documentación Técnica - Sistema de Gestión de Transportes (TMS)

## 1. Stack Tecnológico

- **Frontend**:
  - **Framework**: React 18
  - **Bundler**: Vite
  - **Lenguaje**: TypeScript
  - **Estilos**: Tailwind CSS
  - **Componentes UI**: shadcn/ui
  - **Iconos**: lucide-react
- **Backend & Base de Datos**:
  - **Plataforma**: Supabase
  - **Base de Datos**: PostgreSQL
  - **Autenticación**: Supabase Auth
  - **Almacenamiento**: Supabase Storage (para logos, documentos, etc.)
- **Librerías Clave**:
  - **Gestión de Estado del Servidor**: `@tanstack/react-query` (React Query) para fetching, caching y sincronización de datos.
  - **Enrutamiento**: `react-router-dom`
  - **Formularios**: `react-hook-form` con `zod` para validación de esquemas.
  - **Fechas y Horas**: `date-fns`
  - **Gráficos**: `recharts`
  - **Generación de PDF**: `jspdf` y `jspdf-autotable`
  - **Manejo de CSV/Excel**: `papaparse`, `xlsx`

## 2. Arquitectura del Software

Consulte el archivo `ARQUITECTURA.md` para una descripción detallada.

## 3. Base de Datos (Supabase)

La base de datos es PostgreSQL, gestionada a través de Supabase.

### Tablas Principales:
- `services`: Almacena todos los servicios de grúa. Es la tabla central del sistema.
- `clients`, `cranes`, `operators`: Catálogos de recursos.
- `invoices`: Facturas generadas. Relacionada con `clients` y `services`.
- `service_closures`: Agrupaciones de servicios para facturación.
- `costs`: Registro de costos operativos.
- `calendar_events`: Eventos del calendario (servicios, mantenimientos, etc.).
- `profiles`: Perfiles de usuario, extendiendo `auth.users` de Supabase.
- `company_data`: Configuración general de la empresa.

### Seguridad:
- Se utiliza Row Level Security (RLS) de PostgreSQL para asegurar que los usuarios solo puedan acceder a los datos que les corresponden según su rol y pertenencia a la organización. Las políticas están definidas en las migraciones de Supabase.

## 4. Estructura del Proyecto Frontend

El código fuente está en la carpeta `src/` y sigue una estructura modular:

- `components/`: Componentes React reutilizables, organizados por funcionalidad (ej. `components/services`, `components/clients`).
- `pages/`: Componentes que representan las páginas principales de la aplicación (ej. `Dashboard.tsx`, `Services.tsx`).
- `hooks/`: Hooks de React personalizados que encapsulan la lógica de negocio y el acceso a datos (ej. `useServices.ts`, `useAuth.ts`).
- `contexts/`: Proveedores de Contexto de React para estado global (ej. `AuthContext.tsx`).
- `integrations/`: Conexión con servicios externos.
  - `supabase/client.ts`: Cliente de Supabase singleton.
  - `supabase/types.ts`: Tipos autogenerados a partir del schema de la DB.
- `lib/`: Funciones de utilidad de bajo nivel (ej. `utils.ts` de shadcn).
- `schemas/`: Esquemas de validación de `zod` para formularios.
- `types/`: Definiciones de tipos de TypeScript personalizadas.
- `utils/`: Funciones de utilidad de la aplicación (ej. formateadores de fecha, generadores de reportes).

