# Retención de respaldos de inspección

La fila de `public.inspections` es permanente. Esta política administra únicamente los PDFs y las fotografías asociadas.

## Política

- `hot`: desde la creación hasta los 30 días, los archivos permanecen en los buckets privados `inspection-pdfs` e `inspection-photos` de Supabase Storage.
- `cold`: al cumplir 30 días, todos los archivos se copian y verifican en Cloudflare R2; solo después se eliminan de Supabase Storage.
- `deleted`: 2 años después de `archived_at`, los objetos se eliminan de R2. La fila y la auditoría permanecen.

El archivado usa una ruta determinista `inspections/{service_id}/...` y un manifiesto con tamaño y SHA-256. El orden obligatorio es: copiar todo, verificar todo, guardar el manifiesto y recién entonces borrar desde Storage. Un reintento reutiliza objetos ya verificados.

## Acceso desde la aplicación

La sección **Documentos del servicio** distingue automáticamente entre archivos `hot` y `cold`. Los recientes se firman en Supabase Storage; los históricos solicitan a `get-archived-inspection-files` un enlace privado temporal de R2 usando el `inspection_id` exacto.

El usuario puede ver, descargar o compartir el PDF inicial y el PDF de entrega sin restaurarlos a Supabase. En dispositivos compatibles se comparte el PDF real; si el navegador no acepta archivos, la interfaz utiliza el enlace temporal como respaldo. Las URLs firmadas nunca se persisten.

## Secrets y bucket

El bucket R2 debe ser privado. Las siguientes variables se configuran exclusivamente como secrets de Supabase Edge Functions:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME (también se admite el nombre legado R2_BUCKET)
CRON_SECRET
```

El token R2 necesita permiso de lectura y escritura de objetos únicamente sobre el bucket de archivo. `CRON_SECRET` también debe existir en Supabase Vault con el mismo valor, porque `pg_cron` lo envía en `x-cron-secret`.

Para que las fotos archivadas puedan incorporarse al PDF de retiro desde el navegador, el bucket debe permitir CORS `GET` y `HEAD` desde el origen del TMS. No se debe habilitar acceso público al bucket.

## Despliegue

Aplicar el esquema únicamente contra el proyecto enlazado:

```bash
npx supabase db push --linked
```

Desplegar las tres funciones:

```bash
npx supabase functions deploy archive-inspections-to-r2 --project-ref jqszxljtfuknhuvuheko --no-verify-jwt
npx supabase functions deploy purge-cold-inspections --project-ref jqszxljtfuknhuvuheko --no-verify-jwt
npx supabase functions deploy get-archived-inspection-files --project-ref jqszxljtfuknhuvuheko
```

## Programación y IDs

La migración agenda:

- `archive-inspections-to-r2-daily`: todos los días, 03:30 UTC, en lotes de hasta 10 inspecciones.
- `purge-cold-inspections-monthly`: día 2 de cada mes, 04:30 UTC.

Los IDs reales asignados por `pg_cron` quedan documentados en `public.inspection_retention_cron_jobs` y pueden consultarse con:

```sql
select job_name, job_id, schedule
from public.inspection_retention_cron_jobs
order by job_name;
```

Los resultados por inspección se guardan en `public.inspection_retention_audit`.

## Validación controlada

Usar una inspección de prueba con archivos prescindibles y conservar sus IDs antes de modificar las fechas.

1. Ajustar temporalmente `created_at` a más de 30 días.
2. Invocar `archive-inspections-to-r2` con `x-cron-secret` y, si se desea aislar una corrida pequeña, `?limit=1`.
3. Confirmar el objeto en R2, su ausencia en Supabase Storage y `storage_tier = 'cold'` con rutas R2.
4. Abrir el servicio en el TMS y comprobar PDF y fotografías.
5. Repetir con credenciales R2 deliberadamente inválidas en un entorno de prueba: la fila debe seguir `hot` y todos los archivos deben continuar en Supabase Storage.
6. Para purga, ajustar una copia de prueba a `storage_tier = 'cold'` y `archived_at` anterior a 2 años; invocar `purge-cold-inspections` y confirmar `deleted` más `deleted_at`.

No se debe borrar manualmente ninguna fila de `inspections` durante estas pruebas.
