export interface TableStat {
  table: string;
  rows: number;
  error?: string;
}

// Bloques limitados por bytes, incluso dentro de tablas grandes.
const CHUNK_BYTES = 500_000;
const CHUNK_PAGE = 1_000;
const MAX_CHUNKS = 1_000; // tope de seguridad: jamás debería acercarse

interface DumpChunk {
  body: string;
  next_table: string | null;
  next_offset: number;
  rows_by_table: Record<string, number> | null;
}

export async function dumpSql(
  supabase: any,
  stats: TableStat[],
): Promise<Blob> {
  const encoder = new TextEncoder();
  const ts = new TransformStream<Uint8Array, BufferSource>();
  const done = new Response(ts.readable.pipeThrough(new CompressionStream("gzip"))).blob();
  const writer = ts.writable.getWriter();
  const write = (text: string) => writer.write(encoder.encode(text));

  await write(`-- SQL Dump TMS Grúas - ${new Date().toISOString()}\n\n`);

  let nextTable: string | null = null;
  let nextOffset = 0;
  const totals = new Map<string, number>();
  let chunks = 0;

  try {
    while (chunks < MAX_CHUNKS) {
      const { data, error } = await supabase.rpc("backup_dump_chunk_v2", {
        p_start_table: nextTable,
        p_start_offset: nextOffset,
        p_max_bytes: CHUNK_BYTES,
        p_page: CHUNK_PAGE,
      });
      if (error) throw new Error(`bloque ${chunks + 1} desde ${nextTable ?? "el inicio"}: ${error.message}`);

      const chunk = (Array.isArray(data) ? data[0] : data) as DumpChunk | undefined;
      if (!chunk) throw new Error(`bloque ${chunks + 1}: respuesta vacía`);

      if (!Number.isSafeInteger(chunk.next_offset) || chunk.next_offset < 0) {
        throw new Error("Cursor del respaldo inválido");
      }
      if (chunk.next_table !== null && chunk.next_table === nextTable && chunk.next_offset <= nextOffset) {
        throw new Error("El cursor del respaldo no avanzó");
      }
      chunks += 1;
      await write(chunk.body);
      for (const [table, rows] of Object.entries(chunk.rows_by_table ?? {})) {
        totals.set(table, (totals.get(table) ?? 0) + Number(rows));
      }

      nextTable = chunk.next_table;
      nextOffset = chunk.next_offset;
      if (!nextTable) break;
    }

    if (nextTable) {
      // Nunca debería ocurrir; si ocurre, el archivo queda incompleto y hay que
      // decirlo en vez de subirlo como si estuviera entero.
      throw new Error(`El respaldo no terminó: quedó pendiente desde ${nextTable}`);
    }
    await writer.close();
  } catch (error) {
    await writer.abort(error).catch(() => {});
    await done.catch(() => {});
    throw error;
  }

  console.log(`📦 ${chunks} bloques`);
  const blob = await done;
  stats.push(...Array.from(totals, ([table, rows]) => ({ table, rows })));
  return blob;
}

