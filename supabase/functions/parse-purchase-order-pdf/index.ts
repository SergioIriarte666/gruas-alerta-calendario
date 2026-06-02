import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { corsHeadersExtended as corsHeaders } from "../_shared/cors.ts";
const allowedRoles = ['admin', 'viewer'] as const;

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

// Detecta si un string es (o contiene) un RUT chileno o la etiqueta "RUT".
// Esto evita que el RUT del cliente se use como patente del vehículo.
const RUT_LIKE_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/;
const looksLikeRut = (value: string) => {
  if (!value) return false;
  const upper = value.toUpperCase();
  if (upper.includes('R.U.T') || upper.includes('RUT')) return true;
  if (RUT_LIKE_REGEX.test(value)) return true;
  // Cuerpo de RUT sin DV (7-8 dígitos solo numéricos)
  const onlyDigits = value.replace(/\D/g, '');
  if (/^\d{7,9}$/.test(onlyDigits) && !/[A-Z]/i.test(value)) return true;
  return false;
};

// Una patente válida en Chile contiene letras + números (ej: BBCC12, STVK15)
// o un VIN (16-17 caracteres alfanuméricos). Rechaza valores puramente numéricos.
const isValidPatenteShape = (value: string) => {
  if (!value) return false;
  const cleaned = value.replace(/[\s.-]/g, '').toUpperCase();
  if (cleaned.length < 4 || cleaned.length > 20) return false;
  if (!/[A-Z]/.test(cleaned)) return false; // debe tener al menos una letra
  if (!/\d/.test(cleaned)) return false;    // debe tener al menos un número
  return true;
};

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

type SanitizedVipItem = { patente: string; detail: string; amount: number; quantity: number; serviceDate: string | null };

const sanitizePurchaseOrderResult = (parsed: Record<string, unknown>) => {
  const rawItems = Array.isArray((parsed as any).items) ? (parsed as any).items : [];

  const mappedItems: SanitizedVipItem[] = rawItems.map((raw: any) => {
    const rawPatente = typeof raw?.patente === "string" ? raw.patente.trim() : "";
    // Rechazar RUTs o textos que contengan "RUT" — nunca son patentes.
    const patente = (looksLikeRut(rawPatente) || !isValidPatenteShape(rawPatente)) ? "" : rawPatente;
    const detail = typeof raw?.detail === "string" ? normalizeSpaces(raw.detail) : "";
    const amount = parseClpNumber(raw?.amount);
    const quantity = typeof raw?.quantity === "number" && Number.isFinite(raw.quantity) && raw.quantity > 0
      ? raw.quantity
      : 1;
    let serviceDate: string | null = typeof raw?.serviceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.serviceDate)
      ? raw.serviceDate
      : null;
    if (!serviceDate && detail) {
      const m = detail.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
        serviceDate = `${yy}-${mm}-${dd}`;
      }
    }
    return { patente, detail, amount: Math.max(0, Math.round(amount)), quantity, serviceDate };
  });

  const sanitizedItems = mappedItems.filter((item) => item.patente || item.detail || item.amount > 0);

  const dedupedByKey = new Map<string, SanitizedVipItem & { score: number }>();
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

const getOpenAiApiKey = () => {
  const key = Deno.env.get("OPENAI_API_KEY");
  return key?.trim() || null;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ('response' in authContext) {
      return withHeaders(authContext.response, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'Body inválido' }, 400);
    }

    const { pdfText, pdfBase64 } = body;
    const textContent = pdfText || pdfBase64;
    if (!textContent) {
      return jsonResponse({ error: 'Se requiere pdfText o pdfBase64' }, 400);
    }

    const openaiApiKey = getOpenAiApiKey();
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return jsonResponse({ error: 'Falta configurar la clave de OpenAI (OPENAI_API_KEY)' }, 503);
    }

    let aiResponse: Response | null = null;
    let lastErrorText = '';
    let lastStatus = 0;

    {
      const userContent = pdfText
        ? [
            {
              type: 'text',
              text: `Extrae todos los datos de esta Orden de Compra: número de OC, fecha, lista de items con patente/detalle/monto/serviceDate, totales, Y MUY IMPORTANTE busca en TODO el documento cualquier referencia a cotizaciones (quoteReference) y presupuestos (budgetReference) y extrae el número.\n\nContenido del PDF:\n\n${pdfText}`
            }
          ]
        : [
            {
              type: 'text',
              text: 'Extrae todos los datos de esta Orden de Compra: número de OC, fecha, lista de items con patente/detalle/monto/serviceDate, totales, Y MUY IMPORTANTE busca en TODO el documento cualquier referencia a cotizaciones (quoteReference) y presupuestos (budgetReference).'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`
              }
            }
          ];

      aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres un extractor de datos de Órdenes de Compra (OC) chilenas en formato PDF.
Debes extraer la información estructurada del documento usando la herramienta extract_purchase_order.

*** LEE EL DOCUMENTO COMPLETO: encabezado, tabla de items, observaciones, notas al pie, glosas, y CUALQUIER otro texto visible en el PDF. No omitas NINGUNA sección. ***

- El número de OC suele aparecer como "N° de OC", "Orden de Compra", "Purchase Order" o similar.
- Las patentes chilenas tienen formato de 4 letras + 2 dígitos o 2 letras + 4 dígitos. Pueden tener guión o no.
- Los montos están en pesos chilenos (CLP), sin decimales.
- IMPORTANTE: La patente frecuentemente aparece DENTRO de la descripción del servicio.
- Busca patrones de patente dentro del texto de cada ítem.
- VEHICULOS SIN PATENTE PERO CON VIN: Algunos vehiculos se identifican por su numero VIN de 16-17 caracteres alfanumericos.
  Si no hay patente chilena pero hay un codigo largo alfanumerico (16-17 chars), usalo como patente.
- IDENTIFICADORES CORTOS: Acepta también códigos cortos alfanuméricos en la columna Patente (ej: "STVK15", "PR1234", 6+ caracteres). NO los descartes por ser cortos. NUNCA dejes vacío el campo patente si hay un código en esa columna.
- DETAIL LITERAL: Devuelve el texto del detalle TAL CUAL aparece en la tabla del PDF. NO PARAFRASEAR, NO RESUMIR (ej: "TRASLADO DE UNIDADES", "TRASLADO DE INSUMOS A FAENA 09-03-26"). Mantener mayúsculas y números intactos.
- FECHA DEL SERVICIO (serviceDate por ítem): Si dentro del texto de "Detalle" aparece una fecha embebida (formato DD-MM-YY, DD/MM/YY, DD-MM-YYYY), extráela como serviceDate del ítem en formato YYYY-MM-DD. Si no hay fecha embebida, deja serviceDate como null.

*** CRÍTICO - REFERENCIAS A COTIZACIONES/PRESUPUESTOS (quoteReference): ***
- quoteReference = número de COTIZACIÓN. Patrones: "COTIZACION N°", "COTIZACIÓN", "COT-XXXX", "SEGUN COTIZACION".
- budgetReference = número de PRESUPUESTO. Patrones: "PRESUPUESTO N°", "PRESUPUESTO XXXX", "PPTO XXXX", "PRES. XXXX". Frecuente en línea "Observación".
- Si solo hay uno de los dos, llena el correspondiente y deja el otro vacío. Extrae SOLO el número (ej: "4142").
- Busca en TODAS las secciones: encabezado, tabla, observación, notas.
- CRÍTICO SOBRE clientRut: Extrae el RUT de la empresa/entidad que EMITE la orden de compra (el comprador/cliente).
  NO extraigas el RUT de la empresa PROVEEDORA/DESTINATARIA de la OC (ej: la empresa de grúas que recibe la OC).
  El RUT del emisor aparece en el encabezado de la OC como "Empresa emisora", "Comprador", etc.
  Si solo ves el RUT del proveedor/destinatario, devuelve string vacío.`
            },
            {
              role: 'user',
              content: userContent
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
                          quantity: { type: 'number', description: 'Cantidad de unidades del ítem (default 1)' },
                          serviceDate: { type: ['string', 'null'], description: 'Fecha embebida en el detalle del ítem (YYYY-MM-DD), o null si no aparece' }
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
                    budgetReference: {
                      type: 'string',
                      description: 'Número de PRESUPUESTO (PPTO) si aparece en Observación o glosas (solo el número, ej: "4142")'
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

    // Filter out company's own RUT if AI mistakenly extracted it
    const normalizeRutForCompare = (r: string) => (r || '').replace(/[.\s-]/g, '').toUpperCase();
    let extractedClientRut = typeof parsed.clientRut === 'string' ? parsed.clientRut : '';
    
    if (extractedClientRut) {
      try {
        const { data: companyData } = await authContext.supabaseAdmin
          .from('company_data')
          .select('rut')
          .limit(1)
          .single();
        
        if (companyData?.rut && normalizeRutForCompare(extractedClientRut) === normalizeRutForCompare(companyData.rut)) {
          console.log(`Filtered out company's own RUT: ${extractedClientRut}`);
          extractedClientRut = '';
        }
      } catch (e) {
        // If company_data query fails, just proceed
      }
    }
    
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
      budgetReference: (parsed as any).budgetReference || '',
      clientRut: extractedClientRut,
      rawText: `Extraído con IA - ${(parsed.items as any[])?.length || 0} items encontrados`,
    };

    return jsonResponse(result);
  } catch (error) {
    console.error('Error processing PDF:', error);
    return jsonResponse({ error: 'Error procesando el PDF. Intente nuevamente.' }, 500);
  }
});
