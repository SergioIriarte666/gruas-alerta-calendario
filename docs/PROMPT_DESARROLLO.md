
# Prompt de Desarrollo para el TMS

Este documento sirve como una guía o "prompt" para cualquier desarrollador (IA o humano) que trabaje en este proyecto. Su objetivo es asegurar la consistencia y calidad del código.

## 1. Contexto del Proyecto

- **Aplicación**: Sistema de Gestión de Transportes (TMS).
- **Objetivo**: Digitalizar y centralizar la gestión de servicios de grúas, incluyendo clientes, vehículos, operadores, costos, facturación y reportes.
- **Usuario Objetivo**: Personal administrativo de una empresa de servicios de grúas.

## 2. Stack Tecnológico y Convenciones

- **Core**: React, TypeScript, Vite.
- **UI**: Tailwind CSS y **siempre** priorizar componentes de **shadcn/ui**.
- **Iconos**: Exclusivamente de **lucide-react**.
- **Estado del Servidor**: **React Query** (`@tanstack/react-query`) es mandatorio para toda la interacción con la API de Supabase.
- **Formularios**: `react-hook-form` con validación mediante esquemas de `zod`.
- **Backend**: **Supabase**. Las interacciones se hacen con el cliente JS. Las modificaciones de schema se hacen vía migraciones SQL.

## 3. Guía de Estilo y Codificación

- **Componentes**:
  - Siempre funcionales, con hooks.
  - Nombrados en `PascalCase`.
  - Archivos `.tsx`.
  - Deben ser pequeños y enfocados en una sola responsabilidad.
- **Hooks**:
  - Nombrados en `camelCase` (ej. `useServices.ts`).
  - Encapsulan toda la lógica de un dominio.
- **Tipado**:
  - TypeScript es estricto. Evitar el uso de `any`.
  - Usar los tipos de `src/types` y los tipos generados de Supabase (`src/integrations/supabase/types.ts`).
- **Estilos**:
  - Usar clases de Tailwind CSS directamente en el JSX.
  - Para clases condicionales, usar `clsx` o `tailwind-merge` (ya incluidos en `lib/utils.ts`).

## 4. Flujo de Trabajo para Añadir una Nueva Funcionalidad (Ej. "Proveedores")

1.  **Base de Datos (Supabase)**:
    - Diseñar la tabla `providers`.
    - Crear una nueva migración SQL en `supabase/migrations/` con el `CREATE TABLE` y las políticas de RLS.

2.  **Tipos (TypeScript)**:
    - Añadir la nueva interfaz `Provider` en `src/types/index.ts`.
    - (Opcional) Regenerar los tipos de Supabase si es necesario.

3.  **Hook de Datos**:
    - Crear `src/hooks/useProviders.ts`.
    - Implementar la lógica para `fetch`, `create`, `update`, `delete` usando React Query y el cliente de Supabase.

4.  **Componentes y Página**:
    - Crear la página `src/pages/Providers.tsx`.
    - Crear los componentes necesarios en `src/components/providers/`, como `ProvidersTable.tsx` y `ProviderForm.tsx`.

5.  **Enrutamiento y Navegación**:
    - Añadir la nueva ruta en `src/App.tsx`.
    - Añadir el enlace a la nueva página en el componente `src/components/layout/Sidebar.tsx`.

## 5. Principios Clave

- **Mantenlo Simple (KISS)**: No sobre-ingenierizar. Empezar con la solución más simple que funcione.
- **No te Repitas (DRY)**: Reutilizar lógica con hooks y componentes.
- **Responsivo por Defecto**: Todos los componentes y páginas deben ser usables en dispositivos móviles y de escritorio. Usar las variantes responsivas de Tailwind (`sm:`, `md:`, `lg:`).
- **La Experiencia de Usuario es Prioridad**: Las interfaces deben ser intuitivas, rápidas y accesibles. Utilizar `Skeleton` para estados de carga y `Toast` para notificaciones.

