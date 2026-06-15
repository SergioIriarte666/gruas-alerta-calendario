import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { corsHeadersExtended as corsHeaders } from "../_shared/cors.ts";

const allowedRoles = ["admin", "viewer"] as const;

type BankCandidate = {
  invoice_id: string;
  folio?: string | null;
  numero_fiscal?: string | null;
  client_name?: string | null;
  client_rut?: string | null;
  total: number;
  due_date?: string | null;
  match_score: number;
  match_reason?: string | null;
  amount_matches: boolean;
  already_paid: boolean;
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const buildFallbackSuggestion = (candidates: BankCandidate[]) => {
  const strictPendingCandidates = candidates
    .filter((candidate) => candidate.amount_matches && !candidate.already_paid)
    .sort((left, right) => right.match_score - left.match_score);

  if (strictPendingCandidates.length === 0) {
    return {
      invoice_id: null,
      confidence: 0,
      reasoning: "No hay una factura pendiente con monto exacto suficiente para sugerir automáticamente.",
      suggestion_type: "none",
    };
  }

  const [topCandidate, secondCandidate] = strictPendingCandidates;
  const scoreGap = topCandidate.match_score - (secondCandidate?.match_score ?? 0);
  const hasClearLead = strictPendingCandidates.length === 1 || scoreGap >= 35;

  if (!hasClearLead) {
    return {
      invoice_id: null,
      confidence: 0.48,
      reasoning: "Existen varias facturas exactas posibles y la IA no pudo diferenciarlas con suficiente certeza.",
      suggestion_type: "uncertain",
    };
  }

  return {
    invoice_id: topCandidate.invoice_id,
    confidence: strictPendingCandidates.length === 1 ? 0.88 : 0.76,
    reasoning:
      topCandidate.match_reason ||
      "La mejor candidata conserva monto exacto y concentra las señales mas fuertes detectadas en la cartola.",
    suggestion_type: strictPendingCandidates.length === 1 ? "exact" : "probable",
  };
};

const validateSuggestion = (
  suggestion: { invoice_id?: string | null; confidence?: number; reasoning?: string; suggestion_type?: string },
  candidates: BankCandidate[],
) => {
  const strictPendingCandidates = candidates
    .filter((candidate) => candidate.amount_matches && !candidate.already_paid)
    .sort((left, right) => right.match_score - left.match_score);

  if (!suggestion.invoice_id) {
    return buildFallbackSuggestion(candidates);
  }

  const selectedCandidate = candidates.find((candidate) => candidate.invoice_id === suggestion.invoice_id);
  if (!selectedCandidate) {
    return {
      invoice_id: null,
      confidence: 0,
      reasoning: "La IA no devolvio una factura valida dentro de las candidatas disponibles.",
      suggestion_type: "none",
    };
  }

  if (strictPendingCandidates.length > 0 && (!selectedCandidate.amount_matches || selectedCandidate.already_paid)) {
    return buildFallbackSuggestion(candidates);
  }

  return {
    invoice_id: selectedCandidate.invoice_id,
    confidence: Number(suggestion.confidence ?? 0),
    reasoning:
      suggestion.reasoning?.trim() ||
      selectedCandidate.match_reason ||
      "La IA priorizo esta factura por las senales detectadas en la cartola.",
    suggestion_type:
      suggestion.suggestion_type === "exact" ||
      suggestion.suggestion_type === "probable" ||
      suggestion.suggestion_type === "uncertain" ||
      suggestion.suggestion_type === "none"
        ? suggestion.suggestion_type
        : "probable",
  };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, corsHeaders);
    }

    const { movement, candidates } = await req.json();

    if (!movement || !Array.isArray(candidates)) {
      return jsonResponse({ error: "movement y candidates son requeridos" }, 400);
    }

    if (candidates.length === 0) {
      return jsonResponse({
        invoice_id: null,
        confidence: 0,
        reasoning: "No hay facturas candidatas para analizar.",
        suggestion_type: "none",
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "OPENAI_API_KEY no configurada" }, 500);
    }

    const typedCandidates = (candidates as BankCandidate[]).map((candidate) => ({
      ...candidate,
      total: Number(candidate.total),
      match_score: Number(candidate.match_score),
    }));
    const pendingCandidates = typedCandidates.filter((candidate) => !candidate.already_paid);
    const paidCandidates = typedCandidates.filter((candidate) => candidate.already_paid);

    const fmtCLP = (n: number) =>
      new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

    const candidatesText = pendingCandidates.length > 0
      ? pendingCandidates.map((c: BankCandidate, i: number) =>
          `${i + 1}. invoice_id="${c.invoice_id}" | Folio: ${c.folio} | N° Fiscal: ${c.numero_fiscal || "N/D"} | Cliente: ${c.client_name} (RUT ${c.client_rut || "N/D"}) | Monto: ${fmtCLP(Number(c.total))} | Vencimiento: ${c.due_date} | Score sistema: ${c.match_score} | Monto exacto: ${c.amount_matches ? "si" : "no"} | Senales: ${c.match_reason || "sin detalle"}`
        ).join("\n")
      : "Ninguna factura pendiente encontrada.";

    const paidText = paidCandidates.length > 0
      ? "\n\nFACTURAS YA PAGADAS (no conciliables, solo referencia):\n" +
        paidCandidates.map((c: BankCandidate) =>
          `- Folio: ${c.folio} | Cliente: ${c.client_name} | Monto: ${fmtCLP(Number(c.total))} | Vence: ${c.due_date}`
        ).join("\n")
      : "";

    const systemPrompt = `Eres un asistente experto en conciliación bancaria para una empresa de grúas y transporte en Chile.
Analizas movimientos de cartola bancaria y determinas con cuál factura pendiente corresponde cada pago.

CONTEXTO DEL NEGOCIO:
- Los clientes chilenos suelen transferir con glosas como "PAGO FACT XXXX", "PAGO PROVEEDOR [nombre truncado]", su RUT, o el número de factura.
- Los bancos chilenos truncan los nombres a 20-30 caracteres en la descripción.
- El plazo de pago habitual es 30 días desde la emisión de la factura.
- El campo "N° Fiscal" es el número de factura del SII (Servicio de Impuestos Internos de Chile).
- El campo "Referencia" en la cartola suele ser el RUT del ordenante o un código interno del banco.

REGLAS DE RESPUESTA:
1. Responde SOLO con JSON válido, sin texto adicional ni bloques markdown.
2. "invoice_id" debe ser el UUID exacto de una de las facturas candidatas, o null.
3. "confidence": 0.9+ = muy seguro, 0.7-0.89 = probable, 0.5-0.69 = posible, <0.5 = incierto.
4. "reasoning": explicación concisa en español (1-2 oraciones) para mostrar al usuario final.
5. "suggestion_type": "exact" (monto coincide + señal clara), "probable" (señal pero sin certeza total), "uncertain" (suposición débil), "none" (imposible determinar).
6. Si hay facturas ya pagadas y ninguna pendiente, sugiere null e indica que posiblemente ya fue conciliado.
7. Si existe al menos una factura pendiente con monto exacto, NUNCA recomiendes una candidata con monto distinto.
8. Si una candidata ya esta pagada y existe otra pendiente con monto exacto, NUNCA recomiendes la ya pagada.
9. Prioriza en este orden: monto exacto pendiente > RUT exacto > numero fiscal/folio > razon social > score del sistema.`;

    const userPrompt = `MOVIMIENTO BANCARIO:
- Descripción: "${movement.description || "Sin descripción"}"
- Ordenante: "${movement.payer_name || "No disponible"}"
- Referencia: "${movement.reference_id || "No disponible"}"
- Monto: ${fmtCLP(Number(movement.amount))}
- Fecha del movimiento: ${movement.transaction_date}

FACTURAS CANDIDATAS PENDIENTES:
${candidatesText}${paidText}

¿A cuál factura corresponde este pago? Responde en JSON:
{ "invoice_id": "uuid-o-null", "confidence": 0.0, "reasoning": "...", "suggestion_type": "exact|probable|uncertain|none" }`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 250,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", openaiResponse.status, errText);
      return jsonResponse({ error: "Error al consultar IA", details: errText }, 500);
    }

    const aiResult = await openaiResponse.json();
    const content: string = aiResult.choices?.[0]?.message?.content ?? "";

    let jsonStr = content.trim();
    const mdMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) jsonStr = mdMatch[1].trim();

    try {
      const suggestion = JSON.parse(jsonStr);
      return jsonResponse(validateSuggestion(suggestion, typedCandidates));
    } catch {
      console.error("Error parseando respuesta IA:", content);
      return jsonResponse(buildFallbackSuggestion(typedCandidates));
    }
  } catch (error) {
    console.error("suggest-bank-match error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
