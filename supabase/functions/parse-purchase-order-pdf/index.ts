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

    // Validate JWT claims
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

    // Call Lovable AI with the PDF as a base64 image (Gemini supports PDF via data URI)
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

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || '';
      console.error('No tool call in response, content:', content);
      throw new Error('No se pudo extraer datos del PDF');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    console.log('Parsed OC:', JSON.stringify({
      ocNumber: parsed.ocNumber,
      itemCount: parsed.items?.length || 0,
      patentes: parsed.items?.map((i: any) => i.patente) || []
    }));

    const result = {
      ocNumber: parsed.ocNumber || '',
      date: parsed.date || null,
      items: parsed.items || [],
      totals: parsed.totals || { neto: 0, iva: 0, total: 0 },
      quoteReference: parsed.quoteReference || '',
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
