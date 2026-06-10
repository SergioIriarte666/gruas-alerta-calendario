# Informe de validación del baseline (2026-06-10)

Dos verificaciones independientes sobre el baseline candidato de Fase 1.
NO destructivo: producción intacta, `schema_migrations` intacta, los 588 archivos intactos.

## 1. Dump oficial

- `supabase db dump --linked -f supabase/_baseline_prep/baseline_official_pgdump.sql` funcionó con Docker activo: **817 KB**.
- Cobertura del oficial: esquema public completo + extensiones + grants + default privileges + publication realtime. **NO incluye** cron jobs (0), storage buckets/policies (0), ni datos seed — los complementos de Fase 1 siguen siendo necesarios.

## 2. Comparación reconstruido ↔ oficial (a nivel de objetos)

| Categoría | Reconstruido | Oficial | Diferencia real |
|---|---|---|---|
| Tablas | 98 | 98 | ninguna |
| Funciones | 273 | 273 | ninguna |
| Enums | 10 | 10 | ninguna |
| Índices | 174 | 174 | ninguna |
| Triggers | 118* | 118* | ninguna (*mismo regex en ambos) |
| Policies | 268 | 268 | ninguna |
| Vistas | 2 | 2 | ninguna |
| Constraints | 409 | 335 + 74 inline | ninguna — los 74 CHECK están inline en los CREATE TABLE del oficial (verificado uno a uno) |
| Secuencias | 4 | 3 | cosmética/defecto menor: el reconstruido emite `CREATE SEQUENCE user_activity_log_id_seq` redundante (es la secuencia de una columna IDENTITY) |

Conclusión: **equivalentes en contenido**. Ninguna diferencia de fondo.

## 3. Replay en Postgres limpio

Método: contenedor Docker efímero `supabase/postgres:17.4.1.043` (misma versión que producción: 17.4.1.043), `psql ON_ERROR_STOP=1`, orden schema → cron → storage → seed. `supabase db reset` se descartó porque aplicaría las 588 migraciones del repo, justo lo que se quiere evitar. Los `recovered/*.sql` no se aplicaron: su contenido ya está dentro del baseline + cron (documentado en Fase 1).

### Replay del OFICIAL — ✅ CERO errores (log: `replay_oficial.log`)

Inventario final idéntico a producción: 98 tablas, 273 funciones, 268 policies, 123 triggers, 320 índices, 10 enums, RLS en 98 tablas, **7 cron jobs**, **8 buckets**, **31 + 90 filas de taxonomía con las 4 categorías bloqueadas tal cual**.

### Replay del RECONSTRUIDO — ❌ falla (log: `replay_reconstruido.log`)

Error exacto, en la sección de tablas:
```
psql:<stdin>:1087: ERROR:  function generate_service_cash_receipt_folio() does not exist
LINE 4:   folio text DEFAULT generate_service_cash_receipt_folio() N...
```
Es exactamente el riesgo anticipado: dependencia hacia adelante. La tabla `service_cash_receipts` usa una función en un DEFAULT, pero el reconstruido crea funciones DESPUÉS de las tablas; pg_dump las ordena por dependencias (funciones antes). Corregible, pero innecesario habiendo oficial validado.

### Ajustes de entorno del replay (no son fallos del baseline)

1. La imagen trae un esquema `storage` antiguo (sin columnas `public`/`file_size_limit`/`allowed_mime_types`); en un proyecto real las crea storage-api. Se agregaron al contenedor antes de aplicar.
2. `storage.buckets`/`storage.objects` pertenecen a `supabase_storage_admin` en la imagen; `baseline_storage.sql` se aplicó como `supabase_admin`. En producción real las policies de storage se crean vía migraciones como `postgres` (los 30 policies actuales lo prueban).
3. `CREATE PUBLICATION supabase_realtime` la crea el servicio realtime en un proyecto real; en el contenedor ya existía.
4. Extensiones `pg_cron`, `pg_net`, `supabase_vault`: disponibles en la imagen y se crearon sin intervención. En un proyecto Supabase nuevo, pg_cron puede requerir habilitación por dashboard.

### Hallazgo corregido durante el replay

El seed original fallaba: `cost_categories.default_cost_center_id` → FK a `cost_centers`, que no estaba en el seed. **`baseline_seed_cost_taxonomy.sql` fue regenerado** (ahora 136 INSERTs): `cost_centers` (15 filas, padres primero) → `cost_categories` (31) → `cost_subcategories` (90). Los `created_by` se emiten como NULL (en origen apuntan a profiles/auth.users, inexistentes en un entorno nuevo; columnas nullable). Validado: el replay final carga todo sin errores.

## 4. Veredicto

| Verificación | Resultado | Detalle |
|---|---|---|
| Dump oficial generado | ✅ | 817 KB vía `supabase db dump --linked` |
| Equivalencia reconstruido ↔ oficial | ✅ | Idénticos en objetos; solo diferencias cosméticas + 1 secuencia redundante en el reconstruido |
| Replay oficial + complementos | ✅ | 0 errores; inventario 1:1 con producción, cron/buckets/seed incluidos |
| Replay reconstruido | ❌ | Dependencia hacia adelante (DEFAULT con función creada después); riesgo anticipado, confirmado |

**Recomendación: adoptar `baseline_official_pgdump.sql` (pg_dump) como migración 0, complementado con `baseline_cron_jobs.sql`, `baseline_storage.sql` y `baseline_seed_cost_taxonomy.sql`.** El reconstruido cumplió su rol (validar paridad de contenido por una vía independiente) y queda como referencia; no usarlo como baseline.

### Pasos manuales en un proyecto nuevo (fuera del baseline)

1. Habilitar extensiones desde dashboard si fallara el CREATE EXTENSION (pg_cron, supabase_vault).
2. Crear el secreto `CRON_SECRET` en Vault (los 7 cron jobs lo leen por nombre en runtime).
3. Configuración de Auth (providers OAuth, templates de email) y despliegue de Edge Functions + `config.toml` (ya en el repo).
4. Datos seed restantes si se quiere entorno funcional completo: service_types, supplier_categories, income_categories, inventory_categories, system_settings, whatsapp_settings (decisión de Fase 2).
