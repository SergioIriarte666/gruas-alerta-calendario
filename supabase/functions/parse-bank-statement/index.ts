import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserRoles, withHeaders } from "./_shared/auth.ts";
import { corsHeadersExtended as corsHeaders } from "./_shared/cors.ts";
// @deno-types="https://esm.sh/v135/xlsx@0.18.5/types/index.d.ts"
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const allowedRoles = ["admin"] as const;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─────────────────────────────────────────────────────────────
// Normalización de montos chilenos: "$1.439.900" → 1439900
// ─────────────────────────────────────────────────────────────
const parseClpAmount = (raw: unknown): number => {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(Math.abs(raw)) : 0;
  if (raw == null) return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  const cleaned = str.replace(/[$ ]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(Math.abs(parsed)) : 0;
};

const parseDate = (raw: unknown): string | null => {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const str = String(raw).trim();
  // DD/MM/YYYY o DD-MM-YYYY
  const m1 = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
};

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────
interface RawCredit {
  movement_date: string;
  amount: number;
  description: string;
  reference: string | null;
  branch: string | null;
}

interface EnrichedCredit extends RawCredit {
  extracted_rut: string | null;
  extracted_invoice_ref: string | null;
  extracted_payer_name: string | null;
}

interface MatchedMovement extends EnrichedCredit {
  suggested_invoice_id: string | null;
  match_confidence: "high" | "medium" | "low" | null;
  match_reason: string | null;
}

// ─────────────────────────────────────────────────────────────
// Parser XLSX/XLS — detecta columnas CARGO y ABONO
// ─────────────────────────────────────────────────────────────
const parseXlsx = (buffer: ArrayBuffer): RawCredit[] => {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const normalizeKey = (k: string) =>
    k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[°\s.#]/g, "");

  const credits: RawCredit[] = [];
  for (const row of rows) {
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) mapped[normalizeKey(k)] = v;

    const cargoKey = Object.keys(mapped).find((k) => k.includes("cargo") || k.includes("debito") || k.includes("debe"));
    const abonoKey = Object.keys(mapped).find((k) => k.includes("abono") || k.includes("credito") || k.includes("deposito") || k.includes("haber"));
    const fechaKey = Object.keys(mapped).find((k) => k.includes("fecha") || k === "fec");
    const descKey = Object.keys(mapped).find((k) => k.includes("descripcion") || k.includes("glosa") || k.includes("detalle") || k.includes("concepto"));
    const refKey = Object.keys(mapped).find((k) => k.includes("doc") || k.includes("referencia") || k.includes("ndoc") || k.includes("nodoc"));
    const branchKey = Object.keys(mapped).find((k) => k.includes("sucursal"));

    const cargo = cargoKey ? parseClpAmount(mapped[cargoKey]) : 0;
    const abono = abonoKey ? parseClpAmount(mapped[abonoKey]) : 0;

    if (abono <= 0 || cargo > 0) continue;

    const movementDate = fechaKey ? parseDate(mapped[fechaKey]) : null;
    if (!movementDate) continue;

    const description = descKey ? String(mapped[descKey] ?? "").trim() : "";
    if (!description) continue;

    credits.push({
      movement_date: movementDate,
      amount: abono,
      description,
      reference: refKey ? (String(mapped[refKey] ?? "").trim() || null) : null,
      branch: branchKey ? (String(mapped[branchKey] ?? "").trim() || null) : null,
    });
  }
  return credits;
};

// ─────────────────────────────────────────────────────────────
// Parser CSV — detecta separador y columnas
// ─────────────────────────────────────────────────────────────
const parseCsv = (text: string): RawCredit[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const headers = lines[0].split(sep).map((h) =>
    h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[°\s.#"']/g, "")
  );

  const colIndex = (keywords: string[]) => headers.findIndex((h) => keywords.some((k) => h.includes(k)));
  const cargoIdx = colIndex(["cargo", "debito", "debe"]);
  const abonoIdx = colIndex(["abono", "credito", "deposito", "haber"]);
  const fechaIdx = colIndex(["fecha", "fec"]);
  const descIdx = colIndex(["descripcion", "glosa", "detalle", "concepto"]);
  const refIdx = colIndex(["ndoc", "nodoc", "doc", "referencia"]);
  const branchIdx = colIndex(["sucursal"]);

  const credits: RawCredit[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
    const cargo = cargoIdx >= 0 ? parseClpAmount(cols[cargoIdx]) : 0;
    const abono = abonoIdx >= 0 ? parseClpAmount(cols[abonoIdx]) : 0;

    if (abono <= 0 || cargo > 0) continue;

    const movementDate = fechaIdx >= 0 ? parseDate(cols[fechaIdx]) : null;
    if (!movementDate) continue;

    const description = descIdx >= 0 ? (cols[descIdx] || "") : "";
    if (!description) continue;

    credits.push({
      movement_date: movementDate,
      amount: abono,
      description,
      reference: refIdx >= 0 ? (cols[refIdx] || null) : null,
      branch: branchIdx >= 0 ? (cols[branchIdx] || null) : null,
    });
  }
  return credits;
};

// ─────────────────────────────────────────────────────────────
// Extracción de texto raw de PDF (fallback para Responses API)
// Busca objetos Tj / TJ en el stream del PDF
// ─────────────────────────────────────────────────────────────
const extractPdfTextRaw = (bytes: Uint8Array): string => {
  const raw = new TextDecoder("latin1").decode(bytes);
  const tokens: string[] = [];

  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw)) !== null) {
    const t = m[1]
      .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
      .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    if (t.trim()) tokens.push(t.trim());
  }

  const TJRe = /\[([^\]]+)\]\s*TJ/g;
  while ((m = TJRe.exec(raw)) !== null) {
    const inner = m[1];
    const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(inner)) !== null) {
      if (sm[1].trim()) tokens.push(sm[1].trim());
    }
  }

  return tokens.join(" ");
};

// ─────────────────────────────────────────────────────────────
// Prompt compartido para extraer abonos de cartola Santander
// ─────────────────────────────────────────────────────────────
const PDF_EXTRACTION_PROMPT = `Eres un extractor de datos de cartolas bancarias chilenas Santander.

Analiza el contenido y extrae ÚNICAMENTE los movimientos donde la columna ABONO tiene un valor numérico mayor a cero.
IGNORA completamente todas las filas donde solo la columna CARGO tiene valor.
IGNORA encabezados de tabla repetidos, saldos diarios y resúmenes de comisiones.

Columnas de la tabla: FECHA | CARGO | ABONO | DESCRIPCIÓN | SALDO | N° DOC | SUCURSAL

Para cada abono, extrae también de DESCRIPCIÓN:
- extracted_rut: RUT si aparece (ej: "77078150-7", "76.769.841-0")
- extracted_invoice_ref: N° factura si aparece — SIEMPRE el numero_fiscal (ej: "F4076", "F4077", "F4075")
- extracted_payer_name: nombre del pagador/empresa

Responde SOLO con JSON válido, sin markdown ni bloques de código:
{
  "movements": [
    {
      "movement_date": "YYYY-MM-DD",
      "amount": 1439900,
      "description": "texto completo de DESCRIPCIÓN",
      "reference": "N° DOC o null",
      "branch": "SUCURSAL o null",
      "extracted_rut": "RUT o null",
      "extracted_invoice_ref": "ref factura o null",
      "extracted_payer_name": "nombre pagador o null"
    }
  ]
}

Reglas de conversión:
- Montos: "$1.439.900" → 1439900 (pesos enteros, sin decimales, sin separador de miles)
- Fechas: "31/03/2026" → "2026-03-31"
- Si no hay abonos, devuelve: {"movements": []}`;

// ─────────────────────────────────────────────────────────────
// PDF → EnrichedCredit[] via OpenAI
//
// Estrategia 1 (primaria): Responses API con input_file (PDF base64 nativo)
// Estrategia 2 (fallback):  Chat Completions con texto extraído del PDF
// ─────────────────────────────────────────────────────────────
const parsePdfWithOpenAI = async (
  pdfBase64: string,
  fileName: string,
  openaiKey: string,
): Promise<EnrichedCredit[]> => {

  // ── Estrategia 1: Responses API (soporta PDF directamente) ──
  try {
    const ac1 = new AbortController();
    const t1 = setTimeout(() => ac1.abort(), 90_000);
    const responsesRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ac1.signal,
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: fileName,
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
              {
                type: "input_text",
                text: PDF_EXTRACTION_PROMPT,
              },
            ],
          },
        ],
        max_output_tokens: 4096,
      }),
    });
    clearTimeout(t1);

    if (responsesRes.ok) {
      const data = await responsesRes.json();
      // Responses API returns: { output: [{ type: "message", content: [{ type: "output_text", text }] }] }
      const text: string = data?.output?.[0]?.content?.[0]?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { movements: EnrichedCredit[] };
        const credits = (parsed.movements ?? []).filter((m) => m.amount > 0 && m.movement_date);
        if (credits.length > 0) {
          console.log(`Responses API: extracted ${credits.length} credits from PDF`);
          return credits;
        }
      }
      console.warn("Responses API returned 0 credits — trying text fallback");
    } else {
      const errText = await responsesRes.text().catch(() => "");
      console.warn(`Responses API failed (${responsesRes.status}): ${errText} — trying text fallback`);
    }
  } catch (e) {
    console.warn("Responses API error, trying text fallback:", e);
  }

  // ── Estrategia 2: Extracción de texto + Chat Completions ──
  const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const pdfText = extractPdfTextRaw(pdfBytes);

  if (!pdfText.trim()) {
    throw new Error("PDF_UNREADABLE");
  }

  console.log(`Text fallback: extracted ${pdfText.length} chars from PDF`);

  const ac2 = new AbortController();
  const t2 = setTimeout(() => ac2.abort(), 60_000);
  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: ac2.signal,
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Eres experto en cartolas bancarias chilenas. Responde solo con JSON válido.",
        },
        {
          role: "user",
          content: `${PDF_EXTRACTION_PROMPT}\n\nTexto extraído del PDF:\n${pdfText.slice(0, 12000)}`,
        },
      ],
    }),
  });
  clearTimeout(t2);

  if (!chatRes.ok) {
    const errText = await chatRes.text().catch(() => "");
    throw new Error(`OpenAI Chat error ${chatRes.status}: ${errText}`);
  }

  const chatData = await chatRes.json();
  const chatText: string = chatData?.choices?.[0]?.message?.content ?? "{}";
  const chatParsed = JSON.parse(chatText) as { movements: EnrichedCredit[] };
  const credits = (chatParsed.movements ?? []).filter((m) => m.amount > 0 && m.movement_date);
  console.log(`Chat fallback: extracted ${credits.length} credits from PDF text`);
  return credits;
};

// ─────────────────────────────────────────────────────────────
// OpenAI — enriquecimiento batch (para XLSX/CSV)
// Extrae RUT, N° factura y nombre del pagador
// ─────────────────────────────────────────────────────────────
const enrichWithAI = async (credits: RawCredit[], openaiKey: string): Promise<EnrichedCredit[]> => {
  if (credits.length === 0) return [];

  const movementsText = credits
    .map((c, i) => `${i + 1}. FECHA: ${c.movement_date} | MONTO: ${c.amount} | DESCRIPCION: "${c.description}"`)
    .join("\n");

  const userPrompt = `Analiza los siguientes movimientos bancarios (abonos) y extrae de la DESCRIPCIÓN de cada uno:
1. RUT del ordenante/pagador (formato chileno, ej: "77078150-7", "76.769.841-0")
2. N° de factura — SIEMPRE usar numero_fiscal (ej: "F4076", "F4077")
3. Nombre del pagador

Responde SOLO con JSON: {"results": [{"extracted_rut": string|null, "extracted_invoice_ref": string|null, "extracted_payer_name": string|null}]}
Exactamente ${credits.length} elementos en el mismo orden. null si no encuentras el dato.

Movimientos:
${movementsText}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2048,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Extrae información de movimientos bancarios chilenos. Responde solo con JSON." },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI enrichment error:", response.status);
      return credits.map((c) => ({ ...c, extracted_rut: null, extracted_invoice_ref: null, extracted_payer_name: null }));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      results: Array<{ extracted_rut: string | null; extracted_invoice_ref: string | null; extracted_payer_name: string | null }>;
    };
    const results = parsed.results ?? [];

    return credits.map((c, i) => ({
      ...c,
      extracted_rut: results[i]?.extracted_rut ?? null,
      extracted_invoice_ref: results[i]?.extracted_invoice_ref ?? null,
      extracted_payer_name: results[i]?.extracted_payer_name ?? null,
    }));
  } catch (err) {
    console.error("Error in enrichWithAI:", err);
    return credits.map((c) => ({ ...c, extracted_rut: null, extracted_invoice_ref: null, extracted_payer_name: null }));
  }
};

// ─────────────────────────────────────────────────────────────
// Matching contra tabla invoices
// Prioridad: numero_fiscal > RUT+monto > monto único
// ─────────────────────────────────────────────────────────────
const normalizeRut = (rut: string) => rut.replace(/[.\s]/g, "").toLowerCase();

const matchInvoice = async (
  credit: EnrichedCredit,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
): Promise<{ invoice_id: string | null; confidence: "high" | "medium" | "low" | null; reason: string | null }> => {

  // 1. Match por numero_fiscal (máxima prioridad)
  if (credit.extracted_invoice_ref) {
    const ref = credit.extracted_invoice_ref.replace(/\s/g, "").toUpperCase();
    const { data: byFiscal } = await supabaseAdmin
      .from("invoices")
      .select("id, numero_fiscal")
      .ilike("numero_fiscal", `%${ref}%`)
      .neq("status", "paid")
      .limit(1)
      .maybeSingle();

    if (byFiscal?.id) {
      return { invoice_id: byFiscal.id, confidence: "high", reason: `N° fiscal: ${byFiscal.numero_fiscal}` };
    }
  }

  // 2. Match por RUT → cliente → factura con monto exacto
  if (credit.extracted_rut) {
    const rutNorm = normalizeRut(credit.extracted_rut);
    const { data: clients } = await supabaseAdmin.from("clients").select("id, rut").limit(50);
    const matchedClient = (clients ?? []).find((c: { rut: string }) => normalizeRut(c.rut) === rutNorm);

    if (matchedClient) {
      const { data: byAmount } = await supabaseAdmin
        .from("invoices")
        .select("id, total, numero_fiscal")
        .eq("client_id", matchedClient.id)
        .eq("total", credit.amount)
        .neq("status", "paid")
        .limit(2);

      if (byAmount?.length === 1) {
        return { invoice_id: byAmount[0].id, confidence: "high", reason: `RUT (${credit.extracted_rut}) + monto exacto` };
      }
      if (byAmount?.length > 1) {
        return { invoice_id: byAmount[0].id, confidence: "medium", reason: `RUT exacto, múltiples facturas con ese monto` };
      }

      const { data: anyPending } = await supabaseAdmin
        .from("invoices")
        .select("id")
        .eq("client_id", matchedClient.id)
        .neq("status", "paid")
        .limit(1)
        .maybeSingle();

      if (anyPending?.id) {
        return { invoice_id: anyPending.id, confidence: "medium", reason: `RUT exacto (${credit.extracted_rut}), monto no coincide` };
      }
    }
  }

  // 3. Match por monto único (baja confianza)
  const { data: byAmountOnly } = await supabaseAdmin
    .from("invoices")
    .select("id")
    .eq("total", credit.amount)
    .neq("status", "paid")
    .limit(2);

  if (byAmountOnly?.length === 1) {
    return { invoice_id: byAmountOnly[0].id, confidence: "low", reason: `Solo monto exacto $${credit.amount.toLocaleString("es-CL")}, única factura pendiente` };
  }

  return { invoice_id: null, confidence: null, reason: null };
};

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ("response" in authContext) return withHeaders(authContext.response, corsHeaders);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonResponse({ error: "Body inválido" }, 400);

    const { fileBase64, fileType, fileName } = body as {
      fileBase64?: string;
      fileType?: string;
      fileName?: string;
    };

    if (!fileBase64 || !fileType || !fileName) {
      return jsonResponse({ error: "Se requieren fileBase64, fileType y fileName" }, 400);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return jsonResponse({ error: "OPENAI_API_KEY no configurado" }, 503);

    const { supabaseAdmin, user } = authContext;

    const binaryStr = atob(fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const buffer = bytes.buffer;

    const lowerType = fileType.toLowerCase();
    let enrichedCredits: EnrichedCredit[] = [];

    if (lowerType === "xlsx" || lowerType === "xls") {
      const raw = parseXlsx(buffer);
      enrichedCredits = await enrichWithAI(raw, openaiKey);
    } else if (lowerType === "csv") {
      const raw = parseCsv(new TextDecoder("utf-8").decode(bytes));
      enrichedCredits = await enrichWithAI(raw, openaiKey);
    } else if (lowerType === "pdf") {
      try {
        enrichedCredits = await parsePdfWithOpenAI(fileBase64, fileName, openaiKey);
      } catch (e) {
        const msg = (e as Error).message;
        console.error("PDF parse error:", msg);
        if (msg === "PDF_UNREADABLE") {
          return jsonResponse({
            error: "No se pudo leer el PDF. Descarga la cartola en Excel desde Santander Office Banking → Exportar → Excel, y sube el archivo XLSX.",
          }, 422);
        }
        return jsonResponse({
          error: "Error al procesar el PDF. Para mejor compatibilidad, descarga la cartola como XLSX desde Santander Office Banking → Exportar → Excel.",
        }, 422);
      }
    } else {
      return jsonResponse({ error: `Tipo no soportado: ${fileType}. Use pdf, xlsx, xls o csv.` }, 400);
    }

    if (enrichedCredits.length === 0) {
      return jsonResponse({ error: "No se encontraron abonos. Verifique que el archivo contenga movimientos con columna ABONO con valor." }, 422);
    }

    console.log(`Processing ${enrichedCredits.length} credits from ${fileName} (${lowerType})`);

    // Matching contra tabla invoices — en paralelo para reducir latencia
    const matchResults = await Promise.all(
      enrichedCredits.map((credit) => matchInvoice(credit, supabaseAdmin))
    );
    const matched: MatchedMovement[] = enrichedCredits.map((credit, i) => ({
      ...credit,
      suggested_invoice_id: matchResults[i].invoice_id,
      match_confidence: matchResults[i].confidence,
      match_reason: matchResults[i].reason,
    }));

    // Insert bank_import
    const totalAmount = matched.reduce((sum, m) => sum + m.amount, 0);
    const { data: importRow, error: importErr } = await supabaseAdmin
      .from("bank_imports")
      .insert({
        filename: fileName,
        bank: "Santander",
        total_movements: matched.length,
        total_credits: matched.length,
        total_amount: totalAmount,
        status: "completed",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (importErr || !importRow?.id) {
      console.error("Error inserting bank_import:", importErr);
      return jsonResponse({ error: "Error guardando importación en base de datos" }, 500);
    }

    const importId: string = importRow.id;

    // Insert bank_movements
    const movementRows = matched.map((m) => ({
      import_id: importId,
      movement_date: m.movement_date,
      amount: m.amount,
      description: m.description,
      reference: m.reference ?? null,
      branch: m.branch ?? null,
      extracted_rut: m.extracted_rut ?? null,
      extracted_invoice_ref: m.extracted_invoice_ref ?? null,
      extracted_payer_name: m.extracted_payer_name ?? null,
      status: m.suggested_invoice_id ? "matched" : "pending",
      suggested_invoice_id: m.suggested_invoice_id ?? null,
      match_confidence: m.match_confidence ?? null,
      match_reason: m.match_reason ?? null,
    }));

    const { error: movErr } = await supabaseAdmin.from("bank_movements").insert(movementRows);
    if (movErr) {
      console.error("Error inserting bank_movements:", movErr);
      await supabaseAdmin.from("bank_imports").delete().eq("id", importId);
      return jsonResponse({ error: "Error guardando movimientos en base de datos" }, 500);
    }

    const { data: movements } = await supabaseAdmin
      .from("bank_movements")
      .select("*")
      .eq("import_id", importId)
      .order("movement_date", { ascending: false });

    return jsonResponse({
      import_id: importId,
      total_parsed: matched.length,
      credits_found: matched.length,
      movements: movements ?? [],
    });
  } catch (err) {
    console.error("Unhandled error in parse-bank-statement:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
