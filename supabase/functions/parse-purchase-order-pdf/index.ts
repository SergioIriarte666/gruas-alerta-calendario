import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseGatewayError = (raw: string) => {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
  } catch { /* ignore */ }
  return raw;
};

const normalizeSpaces = (value: string) => value.replace(/\s+/g, " ").trim();
const parseClpNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const raw = value.trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d.,-]/g, "");

  if (/,(\d{2})$/.test(normalized)) {
    const integerPart = normalized.split(",")[0] ?? "";
    const digits = integerPart.replace(/[^\d-]/g, "").replace(/\./g, "");
    return digits ? Number.parseInt(digits, 10) : 0;
  }

  if (/\.(\d{2})$/.test(normalized)) {
    const integerPart = normalized.split(".")[0] ?? "";
    const digits = integerPart.replace(/[^\d-]/g, "").replace(/,/g, "");
    return digits ? Number.parseInt(digits, 10) : 0;
  }

  const digits = normalized.replace(/[^\d-]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
};

type SanitizedVipItem = { patente: string; detail: string; amount: number; quantity: number };

const sanitizePurchaseOrderResult = (parsed: Record<string, unknown>) => {
  const rawItems = Array.isArray((parsed as any).items) ? (parsed as any).items : [];

  const mappedItems: SanitizedVipItem[] = rawItems.map((raw: any) => {
    const patente = typeof raw?.patente === "string" ? raw.patente.trim() : "";
    const detail = typeof raw?.detail === "string" ? normalizeSpaces(raw.detail) : "";
    const amount = parseClpNumber(raw?.amount);
    const quantity = typeof raw?.quantity === "number" && Number.isFinite(raw.quantity) && raw.quantity > 0
      ? raw.quantity
      : 1;

    return { patente, detail, amount: Math.max(0, Math.round(amount)), quantity };
  });

  const sanitizedItems = mappedItems.filter((item) => item.patente || item.detail || item.amount > 0);

  const dedupedByKey = new Map<string, { patente: string; detail: string; amount: number; quantity: number; score: number }>();
  for (const item of sanitizedItems) {
    const key = `${item.patente.toUpperCase()}|${item.detail.toUpperCase()}|${item.amount}|${item.quantity}`;
    const score = (item.amount > 0 ? 100 : 0) + Math.min(item.detail.length, 40);
    const existing = dedupedByKey.get(key);
    if (!existing || score > existing.score) {
      dedupedByKey.set(key, { ...item, score });
    }
  }

  const dedupedItems = Array.from(dedupedByKey.values()).map(({ score, ...rest }) => rest);

  const cleanedItems: SanitizedVipItem[] = [];
  const groupedByPatente = new Map<string, SanitizedVipItem[]>();

  for (const item of dedupedItems) {
    const patenteKey = item.patente.replace(/[-\s]/g, "").toUpperCase();
    if (!patenteKey) {
      cleanedItems.push(item);
      continue;
    }
    const current = groupedByPatente.get(patenteKey) ?? [];
    current.push(item);
    groupedByPatente.set(patenteKey, current);
  }

  for (const [patenteKey, group] of groupedByPatente.entries()) {
    const hasPositive = group.some((item) => item.amount > 0);
    const filtered = hasPositive ? group.filter((item) => item.amount > 0) : group;
    const hasStrongDetail = filtered.some((item) => {
      const detailKey = item.detail.replace(/[-\s]/g, "").toUpperCase();
      return detailKey.length >= 8 && detailKey !== patenteKey;
    });
    const filteredByDetail = hasStrongDetail
      ? filtered.filter((item) => {
          const detailKey = item.detail.replace(/[-\s]/g, "").toUpperCase();
          return detailKey.length >= 8 && detailKey !== patenteKey;
        })
      : filtered;
    const bestByDetail = new Map<string, SanitizedVipItem>();

    for (const item of filteredByDetail) {
      const detailKey = item.detail.toUpperCase();
      const existing = bestByDetail.get(detailKey);
      if (!existing || item.amount > existing.amount || (item.amount === existing.amount && item.detail.length > existing.detail.length)) {
        bestByDetail.set(detailKey, item);
      }
    }

    cleanedItems.push(...bestByDetail.values());
  }

  const items = cleanedItems;

  const totalsRaw = (parsed as any).totals ?? {};
  const neto = parseClpNumber(totalsRaw?.neto);
  const iva = parseClpNumber(totalsRaw?.iva);
  let total = parseClpNumber(totalsRaw?.total);

  const sumItems = items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
  const target = total > 0 ? total : neto > 0 ? neto : sumItems;

  if (total === 0 && neto === 0 && sumItems > 0) {
    total = sumItems;
  }

  if (target >= 10_000 && sumItems > target * 5) {
    const ratio = sumItems / target;
    const candidates = [10, 100, 1000];
    let factor: number | null = null;
    for (const candidate of candidates) {
      if (Math.abs(ratio - candidate) / candidate < 0.15) {
        factor = candidate;
        break;
      }
    }

    if (factor) {
      for (const item of items) {
        item.amount = Math.max(0, Math.round(item.amount / factor));
      }
    }
  } else if (target > 0 && target < 10_000 && sumItems >= 10_000) {
    total = sumItems;
  }

  (parsed as any).items = items;
  (parsed as any).totals = { neto: Math.max(0, Math.round(neto)), iva: Math.max(0, Math.round(iva)), total: Math.max(0, Math.round(total)) };
};

const normalizeGatewayApiKey = (raw: string) =>
  raw
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();

const getGatewayApiKey = () => {
  const primary = Deno.env.get("LOVABLE_API_KEY");
  if (primary) {
    const apiKey = normalizeGatewayApiKey(primary);
    if (apiKey) return apiKey;
  }

  const fallback = Deno.env.get("AI_GATEWAY_KEY");
  if (fallback) {
    const apiKey = normalizeGatewayApiKey(fallback);
    if (apiKey) return apiKey;
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'No autorizado' }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'Body inválido' }, 400);
    }

    const { pdfBase64 } = body;
    if (!pdfBase64) {
      return jsonResponse({ error: 'Se requiere el PDF en base64' }, 400);
    }

    const gatewayApiKey = getGatewayApiKey();
    if (!gatewayApiKey) {
      console.error("AI gateway key is not configured");
      return jsonResponse({ error: "Falta configurar la clave del gateway de IA" }, 503);
    }

    let aiResponse: Response | null = null;
    let lastErrorText = '';
    let lastStatus = 0;

    {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `Eres un extractor de datos de Órdenes de Compra (OC) chilenas en formato PDF.
Debes extraer la información estructurada del documento usando la herramienta extract_purchase_order.

*** LEE EL DOCUMENTO COMPLETO: encabezado, tabla de items, observaciones, notas al pie, glosas, y CUALQUIER otro texto visible en el PDF. No omitas NINGUNA sección. ***

- El número de OC suele aparecer como "N° de OC", "Orden de Compra", "Purchase Order" o similar, generalmente es un número de 10 dígitos.
- Las patentes chilenas tienen formato de 4 letras + 2 dígitos (ej: VHZJ75, VJYG13) o 2 letras + 4 dígitos (ej: AB1234). Pueden tener guión (VJYG-13) o no (VJYG13).
- Los montos están en pesos chilenos (CLP), sin decimales.
- Si no encuentras algún dato, devuelve string vacío o 0 según corresponda.
- Extrae TODAS las patentes que aparezcan en el documento.
- IMPORTANTE: La patente frecuentemente aparece DENTRO de la descripción del servicio, NO como campo separado. Busca patrones de patente (XXXX-99, XXXX99, XX-9999, XX9999) dentro del texto de cada ítem.
- Ejemplos reales: "Traslado grúa VJYG-13 desde...", "Servicio vehículo VHZJ75", "Grúa para patente AB1234", "Rescate camión BBDD50".
- Si un ítem no tiene patente visible como campo separado, REVISA la descripción completa del ítem buscando estos patrones.
- Si la OC tiene un solo ítem sin patente visible, revisa TODO el texto del documento buscando patentes.
- NUNCA devuelvas patente vacía si hay una patente en la descripción del ítem.
- Cada ítem puede tener una cantidad (quantity). Si la línea dice "2 x 80.000 = 160.000", el amount es 160.000 y quantity es 2.
- VEHICULOS SIN PATENTE PERO CON VIN: Algunos vehiculos se identifican por su numero VIN (Vehicle Identification Number) de 16-17 caracteres alfanumericos en lugar de patente chilena.
  CRITICO: El VIN frecuentemente aparece PEGADO al nombre del modelo sin espacio. Los VINs brasileños empiezan con "9B" (ej: 9BG, 9BD).
  Ejemplo: "Colorado9BG148K0TC427662" -> modelo="Colorado", patente="9BG148K0TC427662" (el VIN empieza en "9BG", NO en "BG")
  Ejemplo: "Sail LZWADAGA9SF003022" -> patente="LZWADAGA9SF003022"
  Ejemplo: "GrooveLZWADAGA3TN041614" -> patente="LZWADAGA3TN041614"
  NUNCA incluyas letras del nombre del modelo como parte del VIN. NUNCA cortes el primer digito del VIN.
  PRECISIÓN EN DÍGITOS DE VIN: Los VINs tienen dígitos que se confunden fácilmente en PDFs. Presta MÁXIMA atención a: 5 vs 6, 7 vs 1, 0 vs O, 8 vs B, 2 vs Z. Si un dígito es ambiguo, analiza el contexto (otros VINs similares en el documento, patrón del fabricante) para decidir.
  Si no hay patente chilena pero hay un codigo largo alfanumerico (16-17 chars), usalo como patente.

*** CRÍTICO - REFERENCIAS A COTIZACIONES/PRESUPUESTOS (quoteReference): ***
- Busca en TODO el documento (encabezado, items, observaciones, notas, glosas, pie de página) frases que referencien cotizaciones o presupuestos.
- Patrones a buscar: "SEGUN COTIZACION", "SEGÚN COTIZACIÓN", "COTIZACION N", "COTIZACIÓN N°", "PRESUPUESTO", "PRESUPUESTOS", "COT-", "PPTO", "REF COTIZACION", "REF. COTIZACIÓN", "SEGUN COT", "SEGÚN PRESUPUESTO".
- La referencia puede estar en la sección de Observaciones, Notas, Glosa, descripción del ítem, encabezado, o CUALQUIER parte del documento.
- Ejemplo: "TRASLADO UNIDAD PLV SEGUN COTIZACION 4100" → quoteReference debe ser "4100".
- Ejemplo: "PRESUPUESTOS 4090" → quoteReference debe ser "4090".
- NUNCA devuelvas quoteReference vacío si hay una referencia a cotización o presupuesto en CUALQUIER parte del documento.
- Extrae SOLO el número (ej: "4100", "4090").
- Extrae el RUT de la empresa/entidad que EMITE la orden de compra (el comprador). Busca en campos como "RUT", "R.U.T.", encabezado de la empresa emisora. Formato XX.XXX.XXX-X o similar. Si no lo encuentras, devuelve string vacío.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extrae todos los datos de esta Orden de Compra: número de OC, fecha, lista de items con patente/detalle/monto, totales, Y MUY IMPORTANTE busca en TODO el documento (especialmente en observaciones, notas, glosas y descripciones de items) cualquier referencia a cotizaciones o presupuestos y extrae el número como quoteReference.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${pdfBase64}`
                  }
                }
              ]
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'extract_purchase_order',
                description: 'Extraer datos estructurados de una orden de compra',
                parameters: {
                  type: 'object',
                  properties: {
                    ocNumber: {
                      type: 'string',
                      description: 'Número de la orden de compra'
                    },
                    date: {
                      type: 'string',
                      description: 'Fecha del documento en formato YYYY-MM-DD, o null si no se encuentra'
                    },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          patente: { type: 'string', description: 'Patente/placa del vehículo' },
                          detail: { type: 'string', description: 'Descripción del servicio' },
                          amount: { type: 'number', description: 'Monto total en CLP (cantidad x precio unitario)' },
                          quantity: { type: 'number', description: 'Cantidad de unidades del ítem (default 1)' }
                        },
                        required: ['patente', 'detail', 'amount']
                      },
                      description: 'Lista de items/líneas de la OC con patentes'
                    },
                    totals: {
                      type: 'object',
                      properties: {
                        neto: { type: 'number', description: 'Monto neto' },
                        iva: { type: 'number', description: 'IVA' },
                        total: { type: 'number', description: 'Total' }
                      },
                      required: ['neto', 'iva', 'total']
                    },
                    quoteReference: {
                      type: 'string',
                      description: 'Número de referencia de presupuesto/cotización encontrado en observaciones (solo el número, ej: "4090")'
                    },
                    clientRut: {
                      type: 'string',
                      description: 'RUT de la empresa/entidad que emite la orden de compra (ej: 76.XXX.XXX-X)'
                    }
                  },
                  required: ['ocNumber', 'items', 'totals']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'extract_purchase_order' } }
        }),
      });

      lastStatus = aiResponse.status;
      if (!aiResponse.ok) {
        lastErrorText = await aiResponse.text().catch(() => '');
      }
    }

    if (!aiResponse?.ok) {
      const gatewayMessage = parseGatewayError(lastErrorText);
      console.error('AI gateway error:', lastStatus, gatewayMessage || lastErrorText);

      if (lastStatus === 429) {
        return jsonResponse({ error: 'Límite de solicitudes excedido, intenta más tarde' }, 429);
      }
      if (lastStatus === 402) {
        return jsonResponse({ error: 'Créditos de IA insuficientes' }, 402);
      }
      if (lastStatus === 401) {
        return jsonResponse({ error: gatewayMessage || "Error de autenticación con el gateway de IA" }, 401);
      }
      return jsonResponse({ error: gatewayMessage || `Error del gateway de IA (HTTP ${lastStatus})` }, 500);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData).substring(0, 500));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('No tool call in AI response:', JSON.stringify(aiData));
      return jsonResponse({ error: 'No se pudo extraer datos del PDF' }, 500);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse tool arguments:', toolCall.function.arguments, parseError);
      return jsonResponse({ error: 'La IA devolvió una respuesta inválida' }, 500);
    }

    sanitizePurchaseOrderResult(parsed);
    
    console.log('Parsed OC:', JSON.stringify({
      ocNumber: parsed.ocNumber,
      itemCount: (parsed.items as any[])?.length || 0,
      patentes: (parsed.items as any[])?.map((i: any) => i.patente) || []
    }));

    const result = {
      ocNumber: parsed.ocNumber || '',
      date: parsed.date || null,
      items: parsed.items || [],
      totals: parsed.totals || { neto: 0, iva: 0, total: 0 },
      quoteReference: parsed.quoteReference || '',
      clientRut: parsed.clientRut || '',
      rawText: `Extraído con IA - ${(parsed.items as any[])?.length || 0} items encontrados`,
    };

    return jsonResponse(result);
  } catch (error) {
    console.error('Error processing PDF:', error);
    return jsonResponse({ error: 'Error procesando el PDF. Intente nuevamente.' }, 500);
  }
});
