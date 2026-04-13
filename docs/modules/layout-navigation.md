# layout-navigation

## Resumen
Módulo transversal que implementa:
- layouts principales (admin, operador y portal),
- navegación (header/sidebar),
- guards de autorización por rol/permisos (`ProtectedRoute`, `AdminOnlyRoute`),
- componentes UI base (shadcn/radix) y utilitarios de styling.

**Entrypoints**
- Layout admin: [Layout](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/layout/Layout.tsx#L1-L50)
- Guard de acceso: [ProtectedRoute](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/layout/ProtectedRoute.tsx#L1-L120)
- Componentes UI base: [src/components/ui](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/ui)

## Arquitectura y componentes

### Layout admin (shell + outlet)
El layout administra:
- composición `Sidebar` + `Header`,
- padding responsive vía `useDeviceType`,
- render de páginas internas con `Outlet` (react-router),
- `QuickEntryProvider` y `QuickEntryFAB` global (acción flotante),
- setup de alertas con `useServiceRequestAlerts`.

Referencia: [Layout.tsx](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/layout/Layout.tsx#L13-L49).

### Guards de acceso (auth/roles/permisos)
`ProtectedRoute` implementa un pipeline de autorización:
- valida sesión (`useAuth`) y perfil (`useUser`),
- reintenta `forceRefreshProfile()` si hay sesión pero no hay perfil,
- aplica `allowedRoles`/`requireRole`,
- opcional: valida permisos de módulo con `useUserModulePermissions` + `getModuleByRoute(pathname)`.

Referencia: [ProtectedRoute.tsx](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/layout/ProtectedRoute.tsx#L24-L118).

### UI base (shadcn/radix)
Los componentes en `src/components/ui` encapsulan Radix primitives y patrones de shadcn/ui:
- accesibilidad (focus management, ARIA),
- composición por props,
- estilos con Tailwind + `class-variance-authority` y `tailwind-merge`.

## API expuesta

### Exports públicos (componentes)
- `Layout`:
  - `import { Layout } from '@/components/layout/Layout'`
- `ProtectedRoute` (default export):
  - `import ProtectedRoute from '@/components/layout/ProtectedRoute'`
- Layouts especializados:
  - `OperatorLayout`: `@/components/layout/OperatorLayout`
  - `PortalLayout`: `@/components/portal/layout/PortalLayout`

### Contratos relevantes
`ProtectedRoute`:
- `allowedRoles?: string[]` roles aceptados
- `requireRole?: string` rol único requerido
- `moduleKey?: string` override de permiso por módulo

## Especificación de uso (con ejemplos)

### Proteger una ruta por rol
```tsx
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'

<Route element={
  <ProtectedRoute allowedRoles={['admin', 'viewer']}>
    <Layout />
  </ProtectedRoute>
}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>
```

### Proteger por permisos de módulo
```tsx
<ProtectedRoute allowedRoles={['admin']} moduleKey="invoices">
  <Invoices />
</ProtectedRoute>
```

## Dependencias

### Externas (principales)
- `react`, `react-router-dom`
- `@radix-ui/*` (primitives)
- `class-variance-authority`, `tailwind-merge`, `clsx`
- `lucide-react`

### Internas (principales)
- Contexts: `@/contexts/AuthContext`, `@/contexts/UserContext`, `@/contexts/QuickEntryContext`
- Hooks: `@/hooks/useDeviceType`, `@/hooks/useServiceRequestAlerts`, `@/hooks/useUserModulePermissions`
- Constantes: `@/constants/modules` (mapeo ruta → módulo)
- UI helpers: `@/lib/utils` (`cn`, formateos, etc.)

## Configuración requerida
- Tailwind/shadcn:
  - `components.json`, `tailwind.config` y estilos base (`src/index.css`) deben estar activos para el look & feel.
- Hosting SPA:
  - rewrites a `index.html` para rutas profundas (`/dashboard`, `/invoices`, etc.).

## Casos de uso principales
- Navegación consistente y responsive (desktop/tablet/mobile).
- Control de acceso por rol y permisos por módulo.
- Surface UI reutilizable (inputs, dialogs, tables, tabs, etc.).

## Diagramas

```mermaid
flowchart TD
  R[Route] --> PR[ProtectedRoute]
  PR -->|allow| L[Layout]
  PR -->|deny| N[Navigate /auth o /dashboard]
  L --> S[Sidebar]
  L --> H[Header]
  L --> O[Outlet (Page)]
  L --> Q[QuickEntryFAB]
```

## Rendimiento
- `Outlet` con `Suspense` en layout amortigua lazy-load de páginas.
- Componentes UI Radix pueden agregar listeners/portals; evitar render masivo en listas grandes sin virtualización.
- Guards hacen “refresh profile” con timeout: minimizar re-render y evitar loops.

## Seguridad
- `ProtectedRoute` implementa control de acceso **solo en frontend**; debe existir enforcement server-side (RLS) en Supabase.
- Permisos por módulo deben coincidir con políticas en base de datos para evitar exposición de datos por endpoints PostgREST.
