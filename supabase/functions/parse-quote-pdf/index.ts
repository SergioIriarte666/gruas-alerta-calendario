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

const getGatewayAuthConfig = () => {
  const rawKey = Deno.env.get('LOVABLE_API_KEY');
  if (!rawKey) return null;

  const trimmedKey = rawKey.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
  const normalizedKey = trimmedKey.replace(/^Bearer\s+/i, '').trim();

  return {
    apiKey: normalizedKey || trimmedKey,
    debug: {
      rawStartsWithBearer: /^Bearer\s+/i.test(trimmedKey),
      rawStartsWithSk: trimmedKey.startsWith('sk_'),
      normalizedStartsWithSk: normalizedKey.startsWith('sk_'),
      rawLength: trimmedKey.length,
      normalizedLength: normalizedKey.length,
    },
  };
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

    const gatewayAuth = getGatewayAuthConfig();
    if (!gatewayAuth?.apiKey) {
      console.error('LOVABLE_API_KEY is not configured');
      return jsonResponse({ error: 'Falta configurar la clave del gateway de IA' }, 500);
    }
    const gatewayApiKey = gatewayAuth.apiKey;

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
              content: `Eres un extractor de datos de Cotizaciones chilenas en formato PDF.
Debes extraer la información estructurada del documento usando la herramienta extract_quote.

*** LEE EL DOCUMENTO COMPLETO: encabezado, tabla de items, observaciones, notas al pie, glosas, y CUALQUIER otro texto visible en el PDF. No omitas NINGUNA sección. ***

- El número de cotización suele aparecer como "N°", "Cotización N°", "Presupuesto N°", "N 4120", o similar.
- Las patentes chilenas tienen formato de 4 letras + 2 dígitos (ej: TKFK-99, VJYG13) o 2 letras + 4 dígitos (ej: AB1234). Pueden tener guión o no.
- Los montos están en pesos chilenos (CLP), sin decimales.
- Si no encuentras algún dato, devuelve string vacío o 0 según corresponda.
- IMPORTANTE: La patente frecuentemente aparece DENTRO de la descripción del servicio, NO como campo separado.
- Busca patrones de patente (XXXX-99, XXXX99, XX-9999, XX9999) dentro del texto de cada ítem.
- Ejemplos reales: "Remolque de Vehiculos Toyota Hilux TKFK-99 Norte a Franklin", "Servicio grúa VJYG-13".
- NUNCA devuelvas patente vacía si hay una patente en la descripción del ítem.
- Extrae TODAS las patentes que aparezcan en el documento.
- IMPORTANTE: Si un ítem tiene MÚLTIPLES patentes separadas por "/" o "," (ej: "TKFL-65/TKFL-67"), genera UN ÍTEM SEPARADO por cada patente, con el mismo detalle y dividiendo el monto proporcionalmente por la cantidad de patentes.
- Ejemplo: "Remolque Toyota Hilux TKFL-65/TKFL-67" con valor $100.000 debe generar 2 items: uno con patente "TKFL-65" y monto $50.000, otro con patente "TKFL-67" y monto $50.000.
- Lee TODAS las secciones del documento incluyendo observaciones, notas y glosas para extraer información completa.
- Extrae el RUT del cliente/empresa destinatario de la cotización (formato XX.XXX.XXX-X o similar). Busca en campos como "Señor(es)", "Cliente", "Razón Social", "RUT", "R.U.T.". Si no lo encuentras, devuelve string vacío.
- VEHICULOS SIN PATENTE PERO CON VIN: Algunos vehiculos se identifican por su numero VIN (Vehicle Identification Number) de 16-17 caracteres alfanumericos en lugar de patente chilena.
  CRITICO: El VIN frecuentemente aparece PEGADO al nombre del modelo sin espacio. Los VINs brasileños empiezan con "9B" (ej: 9BG, 9BD).
  Ejemplo: "Colorado9BG148K0TC427662" -> modelo="Colorado", patente="9BG148K0TC427662" (el VIN empieza en "9BG", NO en "BG")
  Ejemplo: "Sail LZWADAGA9SF003022" -> patente="LZWADAGA9SF003022"
  Ejemplo: "GrooveLZWADAGA3TN041614" -> patente="LZWADAGA3TN041614"
  NUNCA incluyas letras del nombre del modelo como parte del VIN. NUNCA cortes el primer digito del VIN.
  Si no hay patente chilena pero hay un codigo largo alfanumerico (16-17 chars), usalo como patente.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extrae todos los datos de esta Cotización: número de cotización, fecha, lista de items con patente/detalle/monto/cantidad, totales, y lee TODO el documento completo incluyendo observaciones, notas y glosas.'
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
                name: 'extract_quote',
                description: 'Extraer datos estructurados de una cotización',
                parameters: {
                  type: 'object',
                  properties: {
                    quoteNumber: {
                      type: 'string',
                      description: 'Número de la cotización/presupuesto'
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
                          patente: { type: 'string', description: 'Patente/placa del vehículo encontrada en la descripción' },
                          detail: { type: 'string', description: 'Descripción del servicio' },
                          amount: { type: 'number', description: 'Valor total del ítem en CLP' },
                          quantity: { type: 'number', description: 'Cantidad de unidades del ítem (default 1)' }
                        },
                        required: ['patente', 'detail', 'amount']
                      },
                      description: 'Lista de items/líneas de la cotización con patentes'
                    },
                    clientRut: {
                      type: 'string',
                      description: 'RUT del cliente/empresa destinatario de la cotización (ej: 76.XXX.XXX-X)'
                    },
                    totals: {
                      type: 'object',
                      properties: {
                        neto: { type: 'number', description: 'Monto neto' },
                        iva: { type: 'number', description: 'IVA' },
                        total: { type: 'number', description: 'Total' }
                      },
                      required: ['neto', 'iva', 'total']
                    }
                  },
                  required: ['quoteNumber', 'items', 'totals']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'extract_quote' } }
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
        return jsonResponse({ error: gatewayMessage || 'Error de autenticación con el gateway de IA' }, 401);
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
    
    console.log('Parsed Quote:', JSON.stringify({
      quoteNumber: parsed.quoteNumber,
      itemCount: (parsed.items as any[])?.length || 0,
      patentes: (parsed.items as any[])?.map((i: any) => i.patente) || []
    }));

    const result = {
      quoteNumber: parsed.quoteNumber || '',
      date: parsed.date || null,
      items: parsed.items || [],
      totals: parsed.totals || { neto: 0, iva: 0, total: 0 },
      clientRut: parsed.clientRut || '',
      rawText: `Extraído con IA - ${(parsed.items as any[])?.length || 0} items encontrados`,
    };

    return jsonResponse(result);
  } catch (error) {
    console.error('Error processing PDF:', error);
    return jsonResponse({ error: 'Error procesando el PDF. Intente nuevamente.' }, 500);
  }
});
