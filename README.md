# TMS Gruas

Aplicacion web para gestionar la operacion y las finanzas de una empresa de gruas en Chile. El sistema centraliza servicios, cierres, facturacion, costos, inventario, proveedores, inspecciones en terreno, portal cliente y herramientas administrativas sobre Supabase.

## Estado del repositorio

- Frontend SPA con React 18, TypeScript y Vite
- Backend apoyado en Supabase: Auth, Postgres, Storage, Realtime y Edge Functions
- Tres superficies activas:
  - Backoffice administrativo
  - App de operador (`/operator`)
  - Portal cliente (`/portal`)
- Estado offline validado al 27 de junio de 2026:
  - App de operador con inspeccion inicial offline, persistencia local y sincronizacion posterior
  - Modulos administrativos offline fuera de alcance actual
- Documentacion funcional vigente en [PRD.md](./PRD.md) y [docs/README.md](./docs/README.md)

## Modulos principales

- Servicios, calendario y cierres operacionales
- Facturas, pagos/cobros, costos y cuentas por pagar
- Inventario, compras y proveedores
- Dashboard, reportes y proyecciones
- App de operador con inspeccion, fotos, firma y PDF
- Portal cliente con servicios, facturas, solicitud de servicio y ordenes de compra
- Historico financiero con importaciones SAP y DTE
- Biblioteca documental y Recovery Center
- Notificaciones por email, push y WhatsApp

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI + shadcn/ui
- TanStack React Query
- React Router
- Supabase JS
- Vitest + Testing Library
- Playwright

## Estructura del repositorio

```text
src/
  components/     Componentes por modulo
  contexts/       Auth, usuario, tema, notificaciones
  hooks/          Hooks de datos, UI y flujos de negocio
  integrations/   Cliente tipado de Supabase
  pages/          Rutas principales del sistema
  schemas/        Validaciones Zod
  services/       Servicios de dominio reutilizables
  utils/          Helpers transversales
supabase/
  functions/      Edge Functions
  migrations/     Migraciones vigentes
docs/
  modules/        Documentacion tecnica por modulo
  technical/      Configuracion y soporte
  architecture/   Vista general y relaciones entre capas
```

## Inicio rapido

### Requisitos

- Node.js 18 o superior
- npm 8 o superior
- Proyecto Supabase configurado

### Instalacion

```bash
npm install
cp .env.example .env.local
npm run dev
```

La aplicacion levanta por defecto en `http://localhost:5173`.

## Variables de entorno

Definidas en [.env.example](./.env.example):

```bash
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
VITE_TURNSTILE_SITE_KEY=
```

Turnstile es opcional. La configuracion tecnica ampliada esta en [docs/technical/configuration.md](./docs/technical/configuration.md).

## Scripts disponibles

```bash
npm run dev
npm run build
npm run build:dev
npm run lint
npm run test
npm run preview
```

## Documentacion recomendada

- [PRD.md](./PRD.md): alcance funcional vigente
- [docs/README.md](./docs/README.md): indice general de documentacion
- [docs/modules/README.md](./docs/modules/README.md): mapa tecnico por modulo
- [docs/user-manual-vigente.md](./docs/user-manual-vigente.md): manual funcional
- [docs/modules/settings-admin.md](./docs/modules/settings-admin.md): configuracion administrativa vigente
- [docs/modules/backup.md](./docs/modules/backup.md): respaldos y utilidades administrativas
- [docs/guia-configuracion-whatsapp.md](./docs/guia-configuracion-whatsapp.md): integracion WhatsApp
- [docs/technical/operator-offline-test-plan.md](./docs/technical/operator-offline-test-plan.md): pauta y resultado de validacion offline del portal operador
- [docs/technical/supabase-workflow.md](./docs/technical/supabase-workflow.md): flujo recomendado para mantener migraciones, local y remoto sincronizados
- [docs/technical/supabase-security-hardening.md](./docs/technical/supabase-security-hardening.md): endurecimiento de funciones, storage y auth en Supabase

## Notas de mantenimiento

- La fuente de verdad del routing es `src/App.tsx`.
- El producto es single-tenant en su estado actual.
- Existen documentos historicos y de planificacion en `docs/enhancements/`; no deben tratarse como alcance implementado sin contrastarlos con `PRD.md` y el codigo.
