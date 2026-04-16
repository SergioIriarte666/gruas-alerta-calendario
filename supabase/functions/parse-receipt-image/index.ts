import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseGatewayError = (raw: string) => {
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
  } catch {
    // Ignore JSON parse issues and fall back to raw text
  }

  return raw;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    // 2. Parse body
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Body inválido" }, 400);
    }

    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
    const imageMimeType = typeof body.imageMimeType === "string" ? body.imageMimeType : "image/jpeg";
    const docMode = body.mode === "invoice" ? "invoice" : "receipt";

    if (!imageUrl && !imageBase64) {
      return jsonResponse({ error: "Se requiere imageUrl o imageBase64" }, 400);
    }

    // 3. Check API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY is not configured");
      return jsonResponse({ error: "Falta configurar la clave de OpenAI (OPENAI_API_KEY)" }, 500);
    }

    // 4. Download image and convert to data URL
    let dataUrl: string;
    if (imageBase64) {
      dataUrl = `data:${imageMimeType};base64,${imageBase64}`;
    } else {
      try {
        const res = await fetch(imageUrl!);
        if (!res.ok) {
          console.error(`Failed to download image: HTTP ${res.status}`);
          return jsonResponse({ error: `No se pudo descargar la imagen (HTTP ${res.status})` }, 400);
        }
        const mime = res.headers.get("content-type") || "image/jpeg";
        const buf = new Uint8Array(await res.arrayBuffer());
        dataUrl = `data:${mime};base64,${base64Encode(buf)}`;
      } catch (downloadErr) {
        console.error("Image download error:", downloadErr);
        const message = downloadErr instanceof Error ? downloadErr.message : "No se pudo descargar la imagen";
        return jsonResponse({ error: message }, 400);
      }
    }

    const imagePayload = { type: "image_url", image_url: { url: dataUrl } };

    const systemPrompt = docMode === "invoice"
      ? `Eres un extractor de datos de FACTURAS y BOLETAS chilenas (DTE) a partir de la imagen del documento (escaneo o PDF renderizado).
Devuelve SIEMPRE datos estructurados usando la herramienta extract_receipt.

Reglas:
- Prioriza la fecha de emisión del documento (no fecha de impresión).
- Montos en CLP normalmente sin decimales. Devuelve números (no strings).
- Si no encuentras un campo, devuelve string vacío o null según corresponda.
- RUT formato XX.XXX.XXX-X o XXXXXXXXX (limpia puntos si lo prefieres).
- Tipo documento: "Factura", "Factura Electrónica", "Boleta", "Boleta Electrónica", "Nota de Crédito", "Nota de Débito", u "Otro".
- Número documento: folio, N°, Nro, etc.
- vendorName / vendorRut = EMISOR (proveedor que emite la factura), NO el receptor.
- Si la factura tiene neto + IVA + total, devuelve los tres. Si solo hay total (boleta), devuelve solo total.
- Intenta extraer medio de pago si aparece (efectivo, débito, crédito, transferencia, cheque, otro).
- Si la factura tiene múltiples ítems/líneas, devuélvelos en "items" con descripción, cantidad, precio unitario y total. Si no hay líneas claras, omite items.
`
      : `Eres un extractor de datos de comprobantes de gasto chilenos (boleta/factura) a partir de una imagen.
Devuelve SIEMPRE datos estructurados usando la herramienta extract_receipt.

Reglas:
- Si hay múltiples fechas, prioriza la fecha de emisión del documento.
- Montos en CLP normalmente sin decimales. Devuelve números (no strings).
- Si no encuentras un campo, devuelve string vacío o null según corresponda.
- RUT formato XX.XXX.XXX-X o XXXXXXXXX.
- Tipo documento: "Boleta", "Boleta Electrónica", "Factura", "Factura Electrónica", u "Otro".
- Número documento: folio, N°, Nro, etc.
- También intenta extraer medio de pago si aparece (efectivo, débito, crédito, transferencia, otro).
`;

    const userInstruction = docMode === "invoice"
      ? "Extrae todos los datos de la factura/boleta del documento. Identifica al EMISOR (proveedor) y todos los ítems si existen."
      : "Extrae todos los datos del comprobante de gasto de la imagen.";

    // 5. Call OpenAI API
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userInstruction },
              imagePayload,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt",
              description: "Extraer datos estructurados de un comprobante de gasto o factura",
              parameters: {
                type: "object",
                properties: {
                  vendorName: { type: "string", description: "Nombre/razón social del emisor (proveedor)" },
                  vendorRut: { type: "string", description: "RUT del emisor (proveedor)" },
                  documentType: { type: "string", description: "Tipo de documento (Boleta/Factura/etc.)" },
                  documentNumber: { type: "string", description: "Número/folio del documento" },
                  date: { type: "string", description: "Fecha del documento en formato YYYY-MM-DD o null" },
                  currency: { type: "string", description: "Moneda (CLP, USD, etc.)" },
                  totals: {
                    type: "object",
                    properties: {
                      neto: { type: "number" },
                      iva: { type: "number" },
                      total: { type: "number" },
                    },
                    required: ["total"],
                  },
                  paymentMethod: { type: "string", description: "Medio de pago detectado" },
                  notes: { type: "string", description: "Notas o glosa relevante para describir el gasto" },
                  items: {
                    type: "array",
                    description: "Líneas/ítems de la factura cuando existan. Omitir si no hay detalle.",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unitPrice: { type: "number" },
                        total: { type: "number" },
                      },
                    },
                  },
                  confidence: {
                    type: "object",
                    description: "Confianza 0..1 por campo",
                    additionalProperties: { type: "number" },
                  },
                },
                required: ["vendorName", "vendorRut", "documentType", "documentNumber", "date", "currency", "totals", "paymentMethod", "notes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      const gatewayMessage = parseGatewayError(errorText);
      console.error("AI gateway error:", aiResponse.status, gatewayMessage || errorText);

      if (aiResponse.status === 429) {
        return jsonResponse({ error: "Límite de solicitudes excedido, intenta más tarde" }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: "Créditos de IA insuficientes" }, 402);
      }
      if (aiResponse.status === 401) {
        return jsonResponse({ error: gatewayMessage || "Error de autenticación con el gateway de IA" }, 500);
      }
      return jsonResponse({ error: gatewayMessage || `Error del gateway de IA (HTTP ${aiResponse.status})` }, 500);
    }

    // 6. Parse AI response
    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return jsonResponse({ error: "No se pudo extraer datos del comprobante" }, 500);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Failed to parse tool arguments:", toolCall.function.arguments, parseError);
      return jsonResponse({ error: "La IA devolvió una respuesta inválida" }, 500);
    }

    const result = {
      vendorName: parsed.vendorName || "",
      vendorRut: parsed.vendorRut || "",
      documentType: parsed.documentType || "",
      documentNumber: parsed.documentNumber || "",
      date: parsed.date || null,
      currency: parsed.currency || "CLP",
      totals: parsed.totals || { neto: 0, iva: 0, total: 0 },
      paymentMethod: parsed.paymentMethod || "",
      notes: parsed.notes || "",
      items: Array.isArray(parsed.items) ? parsed.items : [],
      confidence: parsed.confidence || {},
    };

    return jsonResponse(result);
  } catch (error) {
    console.error("Error processing receipt image:", error);
    return jsonResponse({ error: "Error procesando la imagen. Intente nuevamente." }, 500);
  }
});
