---
name: gruas5norte-tms
description: >
  Skill especializado para el TMS (Towing Management System) de Grúas 5 Norte SpA
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

## Calendarios y fechas UI

**Regla obligatoria de consistencia visual:**
- Todo nuevo selector de fecha o calendario debe usar los componentes compartidos de la app.
- **Nunca** insertar `input type="date"` en interfaces nuevas o refactors, salvo requerimiento explícito del usuario o una limitación técnica documentada.
- Si existe un calendario inconsistente en un módulo, el prompt debe pedir unificarlo con el patrón estándar antes de agregar otro selector.

**Componentes aprobados:**
- `@/components/common/DatePickerInput` para campos de fecha simples en formularios y filtros.
- `@/components/ui/calendar` junto con `@/components/ui/popover` para casos avanzados, rangos, restricciones o layouts custom.

**Patrón visual por defecto:**
- Trigger con `Button variant="outline"` + `CalendarIcon`.
- Fecha visible en formato `dd/MM/yyyy`.
- Popover con `Popover`, `PopoverTrigger`, `PopoverContent`.
- Selector interno con `Calendar` desde `@/components/ui/calendar`.
- Locale `es` desde `date-fns/locale`.

**Formato de datos obligatorio:**
- En formularios y filtros usar string `yyyy-MM-dd`.
- Convertir a `Date` solo dentro del componente visual.
- Mantener fechas locales sin desfases de zona horaria.

**Archivo de referencia principal:**
- `src/components/common/DatePickerInput.tsx`
- `src/components/ui/calendar.tsx`

**Antipatrón conocido a corregir cuando aparezca:**
- `src/components/services/ServiceFilters.tsx` usa `Input type="date"` y debe migrarse al patrón compartido.

**Instrucción obligatoria para prompts que toquen fechas:**
- Si la tarea crea o modifica filtros, formularios o diálogos con fechas, incluir en `ARCHIVOS A LEER PRIMERO`:
  - `src/components/common/DatePickerInput.tsx`
  - `src/components/ui/calendar.tsx`
- Y en `NOTAS` indicar:
  - "No usar `input type=\"date\"`; reutilizar `DatePickerInput` o `Calendar` + `Popover` para mantener coherencia visual con el resto de la app."

---

## Fuente de tiempo: businessClock (regla obligatoria)

`businessClock` (`src/utils/businessClock.ts`) es la **fuente única de verdad de zona horaria** en toda la app. Lee `company_data.report_timezone` (default `America/Santiago`) y todas las fechas del negocio deben pasar por él.

### Prohibido (causa bugs de TZ en reportes, duplicados, vencimientos)

| Patrón prohibido | Por qué está mal | Usar en su lugar |
|---|---|---|
| `new Date().toISOString()` | UTC, no TZ del negocio | `businessClock.nowISO()` |
| `new Date()` para cálculo de fecha de negocio | Hora del navegador, no del negocio | `businessClock.todayDate()` |
| `dateStr.split('T')[0]` | Frágil, no respeta TZ | `businessClock.format(date, 'yyyy-MM-dd')` |
| `new Date(str + 'T00:00:00')` | Medianoche UTC, desfasa en CHL | `businessClock.format(new Date(\`${str}T12:00:00Z\`), fmt)` |
| `new Date(Date.now() - N)` para ventanas de detección | UTC, inconsistente con DB | `businessClock.format(new Date(Date.now() - N), "yyyy-MM-dd'T'HH:mm:ssXXX")` |

### API de businessClock (referencia rápida)

```typescript
import { businessClock } from '@/utils/businessClock';

businessClock.now()       // Date "ahora" en TZ del negocio
businessClock.nowISO()    // string ISO con offset → para created_at/updated_at/movement_date en DB
businessClock.today()     // 'YYYY-MM-DD' → para columnas date
businessClock.todayDate() // Date a las 12:00 del día comercial → para comparaciones (subMonths, etc.)
businessClock.timezone()  // 'America/Santiago' (o lo configurado)
businessClock.format(date, 'yyyy-MM-dd')  // formatea Date o string en TZ del negocio
businessClock.toTimestamp(date) // fecha elegida por usuario → timestamp ISO con offset
businessClock.bootstrap() // precarga el cache (una vez al iniciar la app)
businessClock.invalidate() // fuerza refresh (cuando el usuario cambia la TZ en Config)
```

### Helpers en timezoneUtils que ya derivan de businessClock (seguros, mantenerlos)

- `getCurrentChileDateString()` → OK, llama a `businessClock.today()`
- `getCurrentMonthRange()` → OK, usa `businessClock.todayDate()`
- `getTodayString()` → OK, llama a `businessClock.today()`
- `getBusinessToday()` / `getBusinessTodayDate()` → OK, wrappers directos
- `queryToday()` / `queryNowISO()` / `queryDateRange()` → OK, helpers para queries Supabase

### Funciones deprecadas (no usar en código nuevo)

- `getTodayLocal()` → `@deprecated` → usar `businessClock.today()`
- `toLocalDateString()` → `@deprecated` → usar `formatForDatabase()` o `businessClock.today()`
- `getCurrentChileDateString()` → `@deprecated` → usar `businessClock.today()`

### Instrucción obligatoria para prompts que toquen fechas, timestamps o reportes

- Incluir en `ARCHIVOS A LEER PRIMERO`:
  - `src/utils/businessClock.ts`
  - `src/utils/timezoneUtils.ts`
- Y en `NOTAS` indicar:
  - "Toda fecha/hora de negocio debe pasar por `businessClock`. Prohibido `new Date().toISOString()`, `new Date(str + 'T00:00:00')`, y `.split('T')[0]`. Usar `businessClock.nowISO()` para escrituras DB, `businessClock.today()` para columnas date, y `businessClock.format()` para formateo."

### Verificación pre-commit recomendada

```bash
# Después de cambios en fechas, verificar que no haya regresiones:
grep -rn "new Date()\.toISOString()" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -rn "T00:00:00" src/utils/reports/ --include="*.ts"
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
