import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { pdfBase64 } = body;

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'Se requiere el PDF en base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
- VEHICULOS SIN PATENTE PERO CON VIN: Algunos vehiculos se identifican por su numero VIN (Vehicle Identification Number) de exactamente 17 caracteres alfanumericos en lugar de patente chilena. Ejemplo: "Sail LZWADAGA9SF003022" -> patente = "LZWADAGA9SF003022". Si no hay patente chilena pero hay un codigo de 17 caracteres alfanumericos, usalo como patente.`
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes excedido, intenta más tarde' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA insuficientes' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData).substring(0, 500));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      const content = aiData.choices?.[0]?.message?.content || '';
      console.error('No tool call in response, content:', content);
      throw new Error('No se pudo extraer datos del PDF');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    console.log('Parsed Quote:', JSON.stringify({
      quoteNumber: parsed.quoteNumber,
      itemCount: parsed.items?.length || 0,
      patentes: parsed.items?.map((i: any) => i.patente) || []
    }));

    const result = {
      quoteNumber: parsed.quoteNumber || '',
      date: parsed.date || null,
      items: parsed.items || [],
      totals: parsed.totals || { neto: 0, iva: 0, total: 0 },
      clientRut: parsed.clientRut || '',
      rawText: `Extraído con IA - ${parsed.items?.length || 0} items encontrados`,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: 'Error procesando el PDF. Intente nuevamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
