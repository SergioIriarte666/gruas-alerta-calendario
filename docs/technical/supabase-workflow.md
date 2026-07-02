# Workflow Supabase

## Objetivo

Mantener `local`, `supabase/migrations/` y `remote` sincronizados sin depender de cambios manuales en el Dashboard.

En este repositorio, la fuente de verdad del esquema es:

1. `supabase/migrations/`
2. El historial remoto `supabase_migrations.schema_migrations`
3. Los tipos generados en `src/integrations/supabase/types.ts`

## Regla principal

Diseña cambios de esquema en migraciones versionadas.

No uses el Dashboard de Supabase para crear o modificar tablas, enums, constraints, índices o funciones salvo una emergencia real. Si ocurre una emergencia, el siguiente paso obligatorio es capturarla con `supabase db pull` y commitearla.

## Configuración inicial

Una vez por clon del repo:

```bash
supabase login
supabase link --project-ref jqszxljtfuknhuvuheko
supabase start
```

Verificaciones útiles:

```bash
supabase migration list
supabase status
```

## Flujo recomendado para cambios de esquema

### 1. Crear migración

```bash
supabase migration new nombre_del_cambio
```

Agregar SQL manualmente en `supabase/migrations/<timestamp>_nombre_del_cambio.sql`.

Notas:

- Para cambios simples y deliberados, escribir SQL a mano.
- Para cambios exploratorios hechos localmente en Studio, capturarlos luego con `supabase db diff`.

### 2. Probar local

Levantar stack local y reconstruir desde cero:

```bash
supabase start
supabase db reset
```

Esto confirma que el proyecto local puede recrearse solo desde migraciones y seed.

Si necesitas aplicar solo lo pendiente en local sin reset completo:

```bash
supabase migration up
```

### 3. Validar aplicación

```bash
npm run build
```

Si el cambio toca queries o tipos:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 4. Desplegar a remoto

```bash
supabase db push --linked
```

Antes de empujar, puedes revisar qué se aplicará:

```bash
supabase db push --linked --dry-run
```

### 5. Regenerar tipos contra remoto

Después de aplicar la migración remota:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### 6. Confirmar sincronía

```bash
supabase migration list
```

Local y remote deben mostrar la misma secuencia de versiones.

## Qué hacer si alguien cambió remoto manualmente

Si hubo cambios hechos en el Dashboard o por SQL directo en remoto:

```bash
supabase db pull
```

Esto crea una migración nueva que captura el delta remoto actual.

Después:

1. Revisar la migración generada.
2. Commit inmediato.
3. Ejecutar `supabase db reset` local para validar que el estado reconstruye bien.

No sigas creando migraciones nuevas encima de un remoto cambiado si antes no hiciste `db pull`.

## Qué hacer si local y remote se desalinean

Diagnóstico:

```bash
supabase migration list
```

### Caso 1: falta un archivo local pero remoto ya lo tiene aplicado

La mejor salida suele ser:

1. Recuperar el archivo faltante desde git o respaldo.
2. Si no existe, usar `supabase migration fetch` o `supabase db pull` según el caso.

### Caso 2: existe archivo local que remoto no tiene aplicado

Normalmente basta con:

```bash
supabase db push --linked
```

### Caso 3: el historial remoto quedó incorrecto

Usar `migration repair` solo para corregir historial, no para “simular” despliegues:

```bash
supabase migration repair <version> --status applied
supabase migration repair <version> --status reverted
```

Después volver a verificar:

```bash
supabase migration list
```

## Políticas de equipo

- No editar esquema en producción desde el Dashboard.
- Toda migración debe ser idempotente cuando aplique.
- Todo cambio de esquema debe pasar por `supabase db reset`.
- Todo cambio que afecte tipos debe regenerar `src/integrations/supabase/types.ts`.
- Todo cambio relevante debe validar `npm run build`.
- Si una migración requiere cuidado especial, documentarlo en el mismo SQL.

## Rutina mínima antes de merge

```bash
supabase start
supabase db reset
npm run build
supabase db push --linked --dry-run
supabase gen types typescript --linked > src/integrations/supabase/types.ts
supabase migration list
```

## Rutina mínima después de deploy de esquema

```bash
supabase db push --linked
supabase gen types typescript --linked > src/integrations/supabase/types.ts
npm run build
```

## Para este proyecto

- Proyecto remoto actual: `jqszxljtfuknhuvuheko`
- Deploy app: `app.gruas5norte.cl`
- Los cambios de esquema deben considerarse sensibles porque impactan backoffice, app operador y portal cliente.
