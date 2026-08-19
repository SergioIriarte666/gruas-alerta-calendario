import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { createR2Config, listObjectKeys, r2ObjectUrl } from "../_shared/r2.ts";
import { assertCronRequest, errorMessage, json } from "../_shared/retention.ts";

/**
 * Simulacro de restauración, mensual.
 *
 * Descarga el respaldo más reciente de R2, extrae las filas de unas tablas y
 * las restaura de verdad en una tabla temporal para compararlas con producción
 * (verify_backup_sample, que revierte todo lo que ejecuta).
 *
 * Existe porque un respaldo que nadie restaura no se sabe si sirve: esta misma
 * comparación descubrió que `float8::text` redondeaba las coordenadas GPS y que
 * el archivo, en apariencia correcto, no devolvía los datos originales.
 */

const DEFAULT_TABLES = ["clients", "services"];

/**
 * Lee el .gz descomprimiéndolo al vuelo y se queda SOLO con las secciones
 * pedidas. La primera versión acumulaba el archivo entero y lo recorría en cada
 * trozo: coste cuadrático y muerte por memoria a los 4 s. Ahora cada trozo se
 * procesa y se descarta, conservando apenas un solapamiento para los marcadores
 * que caen partidos entre dos trozos.
 */
const END_RE = /\n-- \d+ filas\n/;
const OVERLAP = 256;

const extractSections = async (
  body: ReadableStream<BufferSource>,
  tables: string[],
): Promise<Map<string, string>> => {
  const sections = new Map<string, string>();
  const pending = new Set(tables);
  const reader = body
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let carry = "";
  let collecting: { table: string; parts: string[] } | null = null;

  try {
    while (pending.size > 0) {
      const { value, done } = await reader.read();
      if (done) break;

      let buf = carry + value;
      carry = "";

      // Un mismo trozo puede cerrar una sección y abrir la siguiente.
      let progressed = true;
      while (progressed) {
        progressed = false;

        if (collecting) {
          const match = END_RE.exec(buf);
          if (match) {
            collecting.parts.push(buf.slice(0, match.index + 1));
            sections.set(collecting.table, collecting.parts.join(""));
            pending.delete(collecting.table);
            collecting = null;
            buf = buf.slice(match.index);
            progressed = true;
          }
          continue;
        }

        for (const table of pending) {
          const marker = `-- ===== ${table} =====\n`;
          const at = buf.indexOf(marker);
          if (at === -1) continue;
          collecting = { table, parts: [] };
          buf = buf.slice(at + marker.length);
          progressed = true;
          break;
        }
      }

      // Lo ya recorrido se descarta; solo sobrevive el solapamiento.
      if (collecting) {
        if (buf.length > OVERLAP) {
          collecting.parts.push(buf.slice(0, buf.length - OVERLAP));
          carry = buf.slice(-OVERLAP);
        } else {
          carry = buf;
        }
      } else {
        carry = buf.length > OVERLAP ? buf.slice(-OVERLAP) : buf;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return sections;
};

Deno.serve(async (req: Request) => {
  try {
    assertCronRequest(req);
  } catch (response) {
    return response as Response;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json().catch(() => ({}));
    const tables: string[] = Array.isArray(body?.tables) && body.tables.length > 0
      ? body.tables.map(String)
      : DEFAULT_TABLES;

    const r2 = createR2Config(Deno.env.get("R2_BACKUPS_BUCKET")?.trim());
    const keys = await listObjectKeys(r2);
    const sqlKeys = keys.filter((k) => k.endsWith(".sql.gz")).sort();
    const latest = sqlKeys.at(-1);
    if (!latest) throw new Error("R2 no tiene ningún respaldo .sql.gz que probar");

    const response = await r2.client.fetch(r2ObjectUrl(r2, latest), { method: "GET" });
    if (!response.ok || !response.body) {
      throw new Error(`No se pudo descargar ${latest}: HTTP ${response.status}`);
    }

    const sections = await extractSections(response.body, tables);

    const results: Record<string, unknown>[] = [];
    const problems: string[] = [];

    for (const table of tables) {
      const inserts = sections.get(table);
      if (!inserts) {
        problems.push(`El respaldo no trae la sección de ${table}`);
        results.push({ table, error: "sección ausente" });
        continue;
      }

      const { data, error } = await supabase.rpc("verify_backup_sample", {
        p_table: table,
        p_inserts: inserts,
      });
      if (error) {
        problems.push(`${table}: ${error.message}`);
        results.push({ table, error: error.message });
        continue;
      }

      const row = Array.isArray(data) ? data[0] : data;
      results.push({ table, ...row });

      if (!row || row.rows_restored === 0) {
        problems.push(`${table}: el respaldo no restauró ninguna fila`);
      } else if (row.rows_differing > 0) {
        problems.push(
          `${table}: ${row.rows_differing} de ${row.rows_restored} filas no coinciden con producción`,
        );
      }
      // `rows_only_in_backup` no es un problema: son filas borradas después del
      // respaldo, que es justo lo que debe conservar.
    }

    const healthy = problems.length === 0;
    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: healthy ? "completed" : "failed",
      error_message: healthy ? null : problems.join(" | ").substring(0, 500),
      metadata: { source: "verify_backup_restore", archivo: latest, resultados: results, problems },
    });

    console.log(`${healthy ? "✅" : "⚠️"} Simulacro sobre ${latest}: ${JSON.stringify(results)}`);
    return json({ success: true, healthy, archivo: latest, resultados: results, problems });
  } catch (error) {
    const detail = errorMessage(error);
    console.error(`❌ verify-backup-restore: ${detail}`);
    await supabase.from("backup_logs").insert({
      backup_type: "auto",
      status: "failed",
      error_message: detail.substring(0, 500),
      metadata: { source: "verify_backup_restore" },
    }).then(() => {}, () => {});
    return json({ success: false, error: detail }, 500);
  }
});
