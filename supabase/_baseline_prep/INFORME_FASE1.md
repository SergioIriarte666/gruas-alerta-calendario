# Informe Fase 1 — Baseline candidato (2026-06-10)

Preparación NO destructiva. Nada fue aplicado, movido ni reparado. Producción solo se leyó.

## Método de dump

- `supabase db dump --linked` **no fue posible**: requiere Docker y Docker Desktop no está instalado en esta máquina. Tampoco hay `pg_dump`/`psql` nativos, y la pooler URL local solo contiene un placeholder de password.
- Método usado: **Management API** (`POST /v1/projects/.../database/query`, solo SELECTs sobre catálogos `pg_*`), autenticado con el token de la CLI ya logueada. El DDL se generó con `pg_get_functiondef`, `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_triggerdef`, `pg_get_viewdef`, `format_type` y `pg_policies`.
- Verificación de completitud: los conteos del archivo coinciden 1:1 con el inventario remoto.

| Objeto | Remoto | En baseline |
|---|---|---|
| Extensiones (sin plpgsql) | 8 | 8 |
| Enums | 10 | 10 |
| Secuencias standalone | 4 | 4 |
| Tablas (public) | 98 | 98 |
| Constraints (PK/U/CHECK + FK) | 220 + 189 | 409 |
| Índices no-constraint | 174 | 174 |
| Funciones (sin las de extensiones) | 273 | 273 |
| Vistas | 2 | 2 |
| Triggers | 123 | 123 |
| RLS habilitado | 98 tablas | 98 |
| Policies public | 268 | 268 |
| Grants tabla (anon/authenticated/service_role) | — | 300 |
| Realtime publication | 8 tablas | 8 |

## Archivos generados

| Archivo | Contenido | Tamaño |
|---|---|---|
| `baseline_candidate_schema.sql` | Esquema public completo + grants + realtime | 649 KB |
| `baseline_cron_jobs.sql` | Los 7 jobs de `cron.job` como `cron.schedule(...)` | 3.5 KB |
| `baseline_storage.sql` | 8 buckets + 30 policies de `storage.objects` | 9 KB |
| `baseline_seed_cost_taxonomy.sql` | DATOS: 31 `cost_categories` + 90 `cost_subcategories`, tal cual producción | 62 KB |
| `recovered/*.recovered.sql` | SQL exacto de las 4 migraciones huérfanas | 4 archivos |

## Cron jobs (cron.job en producción) — todos activos

| jobid | jobname | schedule | ¿en baseline_cron_jobs.sql? |
|---|---|---|---|
| 1 | cleanup-orphaned-costs | 0 2 * * * | Sí |
| 2 | send-daily-pending-report | 0 12 * * 1-5 | Sí |
| 3 | send-daily-pending-report-hourly | 5 * * * * | Sí |
| 4 | generate-auto-backup-daily | 15 3 * * * | Sí |
| 5 | scheduled-backup-email-hourly | 5 * * * * | Sí |
| 6 | whatsapp-daily-alerts | 0 11 * * 1-5 | Sí |
| 7 | whatsapp-weekly-summary | 0 11 * * 1 | Sí |

El dump del esquema public NO los incluía (viven en el esquema `cron`); por eso el complemento.
Los comandos usan `vault.decrypted_secrets WHERE name='CRON_SECRET'` — el secreto NO está en los archivos, solo la referencia por nombre.

## Paridad de las 4 huérfanas

| Huérfana (versión remota) | Qué hace | ¿Está en el baseline? | Dónde |
|---|---|---|---|
| 20260605205249 add_whatsapp_daily_alerts_cron_job | cron job jobid 6 | Sí | `baseline_cron_jobs.sql` |
| 20260605210125 add_notify_weekly_summary | columna `whatsapp_settings.notify_weekly_summary` + comment | Sí | `baseline_candidate_schema.sql` (tabla y COMMENT) |
| 20260605210132 add_whatsapp_weekly_summary_cron | cron job jobid 7 | Sí | `baseline_cron_jobs.sql` |
| 20260609171331 approve_user_profiles | UPDATE one-off + `profiles.status DEFAULT 'approved'` | DEFAULT: sí (línea de la tabla profiles). UPDATE: **no aplica** (data-fix puntual, no pertenece a un baseline) | `baseline_candidate_schema.sql` |

## Qué cubre el dump y qué NO

Cubierto en `baseline_candidate_schema.sql`: extensiones (con su esquema), enums, secuencias, tablas (defaults, identity, NOT NULL), PK/UNIQUE/CHECK, FKs, índices, funciones, vistas (con reloptions), triggers, RLS enable, policies, grants de tabla a roles API, comments de tablas/columnas, publication realtime.

NO cubierto por un dump de public → complementado:
- **Cron jobs** → `baseline_cron_jobs.sql`
- **Buckets y policies de storage** → `baseline_storage.sql` (avatars, backups-auto, company-assets, crane-documents, inspection-pdfs, inspection-photos, operator-documents, quick-entry-photos)
- **Datos de taxonomía de costos** → `baseline_seed_cost_taxonomy.sql`, incluye las categorías bloqueadas SIN renombrar: Gastos de Servicios, Mantenimiento, Comisión Operador, Inventario.

NO cubierto y NO complementado (decisión pendiente para Fase 2):
1. **Resto de datos seed/config**: `income_categories` (5 filas), `supplier_categories` (22), `inventory_categories` (9), `service_types` (26), `system_settings` (1), `whatsapp_settings` (1), y cualquier otra tabla de configuración. Un entorno desde cero arrancaría sin ellas.
2. **Secretos de Vault** (`CRON_SECRET`): hay que recrearlo a mano en cada entorno nuevo; nunca va en migraciones.
3. **Configuración de Auth** (providers OAuth, templates de email) y **Edge Functions**: viven fuera de la base; las funciones ya están en el repo y `config.toml`.
4. **Default privileges**: verificados en remoto — son los estándar de Supabase (ALL a anon/authenticated/service_role en public). Un proyecto Supabase nuevo ya los trae, por eso no se exportaron; los GRANT explícitos de tabla quedaron en el baseline como redundancia segura.
5. **Owners de objetos**: el baseline asume ejecución como `postgres` (el rol estándar al aplicar migraciones).

## Riesgos / dudas para decidir antes de Fase 2

1. **El baseline se generó por reconstrucción de catálogos, no con pg_dump.** La paridad de conteos es 1:1 y las muestras revisadas son correctas, pero antes de adoptarlo como migración 0 conviene una validación de replay: aplicarlo en un proyecto/branch Supabase desechable o en local con Docker y comparar `db diff` contra producción. Si se instala Docker Desktop, `supabase db dump --linked` serviría como doble verificación independiente.
2. `CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog`: en proyectos Supabase nuevos pg_cron se habilita desde el dashboard; esa línea puede requerir privilegios que `postgres` no tiene en plataforma. Igual con `supabase_vault`. En Fase 2 conviene marcarlas como "habilitar por dashboard".
3. El UPDATE one-off de `approve_user_profiles` (aprobar a siriartev@gmail.com) quedó documentado en `recovered/` pero excluido del baseline a propósito.
4. Los grants explícitos duplican los default privileges; son inocuos pero se pueden recortar en la revisión.
5. Ningún archivo de `_baseline_prep/` debe aplicarse contra producción: producción ya tiene todo esto.
