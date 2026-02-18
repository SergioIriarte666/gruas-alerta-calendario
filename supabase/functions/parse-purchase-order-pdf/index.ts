import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
- El número de OC suele aparecer como "N° de OC", "Orden de Compra", "Purchase Order" o similar, generalmente es un número de 10 dígitos.
- Las patentes chilenas tienen formato de 4 letras + 2 dígitos (ej: VHZJ75) o 2 letras + 4 dígitos (ej: AB1234).
- Los montos están en pesos chilenos (CLP), sin decimales.
- Si no encuentras algún dato, devuelve string vacío o 0 según corresponda.
- Extrae TODAS las patentes que aparezcan en el documento.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae todos los datos de esta Orden de Compra: número de OC, fecha, lista de items con patente/detalle/monto, y totales.'
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
                        amount: { type: 'number', description: 'Monto en CLP' }
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
      rawText: `Extraído con IA - ${parsed.items?.length || 0} items encontrados`,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: `Error procesando PDF: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
