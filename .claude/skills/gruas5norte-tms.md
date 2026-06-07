---
name: gruas5norte-tms
description: >
  Skill especializado para el TMS (Transport Management System) de Grúas 5 Norte SpA
  (repositorio SergioIriarte666/gruas-alerta-calendario, deploy en app.gruas5norte.cl).
  Usar SIEMPRE que el usuario pida instrucciones para Claude Code, un prompt para Code,
  agregar un módulo, corregir un bug, crear una migración SQL, modificar un componente,
  o hacer cualquier cambio en este proyecto. También usar cuando el usuario mencione
  "el TMS", "el repo", "gruas-alerta-calendario", "app.gruas5norte", "Claude Code prompt",
  o cualquier tarea de desarrollo sobre este sistema.
---

# Grúas 5 Norte TMS — Skill de desarrollo

## Regla de oro
**Toda respuesta debe ser un prompt listo para pegar en Claude Code.**
No explicaciones directas. No código suelto. Siempre: prompt estructurado con contexto,
archivos exactos, bloques before/after cuando aplica, y pasos de validación.

---

## Stack y configuración

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite (`@vitejs/plugin-react-swc`) |
| UI | shadcn/ui + Radix UI + Tailwind CSS v3 + lucide-react |
| Estado servidor | TanStack Query v5 (`staleTime: 5min`, `refetchOnWindowFocus: false`) |
| Tablas | TanStack Table v8 |
| Routing | React Router v6 (lazy + Suspense por ruta) |
| Backend | Supabase (proyecto `jqszxljtfuknhuvuheko`) |
| Deploy | Cloudflare Pages → `app.gruas5norte.cl` |
| Auth storage | `sessionStorage` (no localStorage) |
| Logger | `createLogger('NombreModulo')` desde `@/lib/logger` |
| Alias | `@/` apunta a `src/` |

**Variables de entorno requeridas:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Arquitectura de módulos

Cada módulo sigue este patrón exacto:

```
src/
├── pages/ModuloX.tsx                    ← Estado UI, lógica batch, render
├── hooks/
│   ├── useModuloX.ts                    ← Hook principal (re-exporta sub-hooks)
│   └── modulox/
│       ├── useModuloXFetcher.ts         ← useQuery: fetch + transformación
│       └── useModuloXManager.ts         ← useMutation: create/update/delete
├── components/modulox/
│   ├── ModuloXTable.tsx                 ← TanStack Table (desktop)
│   ├── ModuloXMobileView.tsx            ← Vista móvil
│   ├── ModuloXHeader.tsx                ← Título + botones acción
│   ├── ModuloXFilters.tsx               ← Búsqueda + filtros
│   ├── ModuloXForm.tsx                  ← Formulario crear/editar
│   └── ModuloXDialogs.tsx               ← Contenedor de modales
└── types/modulox.ts                     ← Tipos TypeScript
```

**Reglas del patrón:**
- El fetcher usa `queryKey: ['nombre-modulo']` y `staleTime: 5 * 60 * 1000`
- Las mutaciones invalidan con `queryClient.invalidateQueries({ queryKey: ['nombre-modulo'] })`
- Los toasts usan `sonner` (`import { toast } from 'sonner'`)
- Los formularios usan `react-hook-form` + `zod`
- Paginación con `AppPagination` de `@/components/shared/AppPagination`
- Mobile detection con `useIsMobile()` de `@/hooks/use-mobile`

---

## Roles y permisos

| Rol | Acceso |
|-----|--------|
| `admin` | Todo, incluyendo rutas `AdminOnlyRoute` |
| `viewer` | Rutas protegidas, solo lectura |
| `operator` | Portal operador (`/operator/*`) |
| `client` | Portal cliente (`/portal/*`) |

Obtener rol: `const { user } = useUser()` → `user.role === 'admin'`

---

## Categorías de costos BLOQUEADAS

Estas 4 categorías tienen nombre hardcodeado en SQL triggers y lógica TypeScript.
**Nunca renombrar ni eliminar:**

1. `Gastos de Servicios` — se registra desde el formulario de servicio, auto-pagado, vinculado a folio
2. `Mantenimiento` — código centro de costo `MANT`
3. `Comisión Operador` — generada automáticamente por triggers
4. `Inventario` — sincronización con módulo de bodega

---

## Tablas Supabase principales

| Tabla | Propósito |
|-------|-----------|
| `services` | Servicios de grúa (tabla central) |
| `clients` | Clientes (empresa o persona) |
| `operators` | Operadores de grúa |
| `cranes` | Equipos/grúas |
| `costs` | Todos los costos operacionales |
| `cost_categories` | Categorías de costo |
| `cost_subcategories` | Subcategorías de costo |
| `cost_centers` | Centros de costo (códigos: OPER-SERV, MANT, OPER-GRU, REMU, ADMIN, IPTOS) |
| `closures` | Cierres de facturación por cliente |
| `invoices` | Facturas emitidas |
| `profiles` | Usuarios del sistema (roles) |
| `user_activity_log` | Auditoría de navegación |
| `audit_log` | Auditoría de cambios en datos |

---

## Edge Functions activas

Ubicadas en `supabase/functions/`. Las más usadas:

- `send-whatsapp-admin` / `send-whatsapp-operator` / `send-whatsapp-retiro`
- `whatsapp-daily-alerts` / `whatsapp-webhook`
- `send-inspection-email` / `send-invoice-email`
- `parse-receipt-image` / `parse-purchase-order-pdf` / `parse-quote-pdf`
- `generate-backup` / `scheduled-backup-email`
- `classify-cost` — clasificación IA de costos

CORS helper compartido en `supabase/functions/_shared/`.

---

## Convenciones de código

```typescript
// Logger (siempre al inicio del archivo)
import { createLogger } from '@/lib/logger';
const logger = createLogger('NombreModulo');

// Supabase client
import { supabase } from '@/integrations/supabase/client';

// Tipos desde DB
import type { Database } from '@/integrations/supabase/types';
type MiTabla = Database['public']['Tables']['mi_tabla']['Row'];

// Toast
import { toast } from 'sonner';
toast.success('Guardado');
toast.error('Error al guardar');
```

---

## Migraciones SQL

- Carpeta: `supabase/migrations/`
- Formato nombre: `YYYYMMDDHHMMSS_descripcion_snake_case.sql`
- Siempre usar `BEGIN; ... COMMIT;`
- Hacer inserts idempotentes con `WHERE NOT EXISTS (...)`
- Última migración: `20260606120000_restructure_cost_taxonomy.sql`

---

## Estructura de un prompt para Claude Code

Todo prompt generado con este skill debe tener esta forma:

```
CONTEXTO
- Repo: SergioIriarte666/gruas-alerta-calendario
- Deploy: app.gruas5norte.cl (Cloudflare Pages)
- Supabase project: jqszxljtfuknhuvuheko
- [descripción breve del objetivo]

ARCHIVOS A LEER PRIMERO
- [lista de archivos relevantes con su ruta exacta]

TAREA
[descripción precisa de qué hacer]

IMPLEMENTACIÓN
[pasos ordenados con rutas exactas y bloques de código before/after si aplica]

VALIDACIÓN
[cómo verificar que funcionó: build, comportamiento en UI, query SQL, etc.]

NOTAS
[restricciones, categorías bloqueadas, convenciones a respetar]
```

---

## Módulos disponibles en sidebar (referencia rápida)

**Operaciones:** Dashboard · Portal Operador · Informe Diario · Servicios
**Comercial:** Clientes · Calendario
**Flota:** Grúas · Operadores · Vehículos
**Bodega:** Bodega (Inventory) · Proveedores
**Finanzas:** Costos · Cuentas por Pagar · Comisiones · Cierres · Facturas · Históricos · Cálculo de Viajes
**Reportes:** Proyección de Ingresos · Reportes
**Configuración:** Tipos de Servicio · Tarifas · Centros de Costo · Registros Rápidos · Respaldos · Configuración

**Portales separados:**
- Operador: `/operator/*` con `OperatorLayout`
- Cliente: `/portal/*` con `PortalLayout`
