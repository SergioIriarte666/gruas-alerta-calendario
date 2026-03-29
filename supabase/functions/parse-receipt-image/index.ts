import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageUrl = body?.imageUrl as string | undefined;
    const imageBase64 = body?.imageBase64 as string | undefined;
    const imageMimeType = (body?.imageMimeType as string | undefined) || "image/jpeg";

    if (!imageUrl && !imageBase64) {
      return new Response(JSON.stringify({ error: "Se requiere imageUrl o imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dataUrl: string;
    if (imageBase64) {
      dataUrl = `data:${imageMimeType};base64,${imageBase64}`;
    } else {
      const res = await fetch(imageUrl!);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "No se pudo descargar la imagen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mime = res.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await res.arrayBuffer());
      dataUrl = `data:${mime};base64,${base64Encode(buf)}`;
    }

    const imagePayload = { type: "image_url", image_url: { url: dataUrl } };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `Eres un extractor de datos de comprobantes de gasto chilenos (boleta/factura) a partir de una imagen.
Devuelve SIEMPRE datos estructurados usando la herramienta extract_receipt.

Reglas:
- Si hay múltiples fechas, prioriza la fecha de emisión del documento.
- Montos en CLP normalmente sin decimales. Devuelve números (no strings).
- Si no encuentras un campo, devuelve string vacío o null según corresponda.
- RUT formato XX.XXX.XXX-X o XXXXXXXXX.
- Tipo documento: "Boleta", "Boleta Electrónica", "Factura", "Factura Electrónica", u "Otro".
- Número documento: folio, N°, Nro, etc.
- También intenta extraer medio de pago si aparece (efectivo, débito, crédito, transferencia, otro).
`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrae todos los datos del comprobante de gasto de la imagen." },
              imagePayload,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt",
              description: "Extraer datos estructurados de un comprobante de gasto",
              parameters: {
                type: "object",
                properties: {
                  vendorName: { type: "string", description: "Nombre/razón social del proveedor" },
                  vendorRut: { type: "string", description: "RUT del proveedor" },
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
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta más tarde" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No se pudo extraer datos del comprobante");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
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
      confidence: parsed.confidence || {},
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing receipt image:", error);
    const message = error instanceof Error ? error.message : "Error procesando la imagen. Intente nuevamente.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
