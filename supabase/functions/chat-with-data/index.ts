import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TABLES = [
  'services', 'costs', 'cost_categories', 'cost_subcategories',
  'invoices', 'invoice_items', 'clients', 'cranes', 'operators',
  'payments', 'incomes', 'income_categories', 'crane_maintenance',
  'crane_parts', 'inventory_items', 'inventory_stock', 'inventory_movements',
  'inventory_locations', 'inventory_categories', 'inventory_suppliers',
  'debts', 'debt_installments', 'debt_payments', 'creditors',
  'calendar_events', 'fuel_prices', 'cost_centers',
  'service_closures', 'closure_services', 'service_resources',
  'supplier_invoices', 'supplier_invoice_items',
];

const DB_SCHEMA = `
Tablas disponibles (PostgreSQL). USA EXACTAMENTE estos nombres de columna:

services: id, folio, request_date (date), service_date (date), client_id (uuid FK→clients), crane_id (uuid FK→cranes), operator_id (uuid FK→operators), service_type_id (uuid), status (enum: pendiente/en_proceso/completado/facturado/cancelado), value (numeric, monto del servicio), origin (text), destination (text), vehicle_brand, vehicle_model, license_plate, purchase_order, observations, has_excess (bool), excess_amount, start_time, end_time, created_at
costs: id, date (date), description, amount (numeric), category_id (uuid FK→cost_categories), subcategory (text), crane_id (uuid FK→cranes), operator_id (uuid FK→operators), service_id (uuid FK→services), service_folio (text), payment_date (date, null si no pagado), notes, created_at
cost_categories: id, name, description
cost_subcategories: id, category_id (FK→cost_categories), name
invoices: id, folio, client_id (FK→clients), issue_date (date), due_date (date), subtotal, vat, total, status (text: draft/sent/paid/overdue/cancelled), paid_amount, remaining_amount, payment_date, notes, created_at
clients: id, name, rut, email, phone, address, department, billing_type, is_active (bool), contact_name
cranes: id, license_plate, brand, model, type (enum: pluma/plataforma/rescate_vial/portavehiculos), is_active (bool), toll_vehicle_category
operators: id, name, rut, phone, license_number, is_active (bool), user_id, operator_type, department, position
payments: id, client_id (FK→clients), amount, payment_date (date), payment_method, bank_reference, status, applied_amount, remaining_amount, notes, created_at
incomes: id, description, amount, income_date (date), client_id (FK→clients), category_id (FK→income_categories), payment_method, subcategory, notes
income_categories: id, name
crane_maintenance: id, crane_id (FK→cranes), maintenance_type, description, status (text: scheduled/in_progress/completed), cost (numeric), scheduled_date, completed_date, provider, notes
crane_parts: id, crane_id (FK→cranes), part_name, supplier, quantity, unit_price, date (date), total_value
inventory_items: id, name, sku, unit_of_measure, unit_cost, minimum_stock, is_active, category_id
inventory_stock: id, item_id (FK→inventory_items), location_id, current_quantity, reserved_quantity, available_quantity
inventory_movements: id, item_id (FK→inventory_items), location_id, movement_type (text: entrada/salida/ajuste/transferencia), quantity, unit_cost, reason, movement_date
debts: id, creditor_id (FK→creditors), description, total_amount, installments_count, status (text: active/paid/cancelled), currency
debt_installments: id, debt_id (FK→debts), installment_number, due_date (date), total_amount, paid_amount, status (text: pending/paid/overdue)
creditors: id, name, type
cost_centers: id, code, name, budget_amount, budget_period
fuel_prices: id, fuel_type, price_per_liter, price_date, is_current (bool)

Relaciones clave:
- services.client_id → clients.id | services.operator_id → operators.id | services.crane_id → cranes.id
- costs.category_id → cost_categories.id | costs.crane_id → cranes.id | costs.operator_id → operators.id
- invoices.client_id → clients.id
- payments.client_id → clients.id
- crane_maintenance.crane_id → cranes.id
- inventory_stock.item_id → inventory_items.id
- debts.creditor_id → creditors.id | debt_installments.debt_id → debts.id

IMPORTANTE: La columna de fecha en services es "service_date" (NO "date"). La columna de monto en services es "value" (NO "amount").
Moneda: CLP (pesos chilenos). Formatear con separador de miles (punto).
Zona horaria: America/Santiago.
`;

function validateSQL(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  
  // Must start with SELECT or WITH (for CTEs)
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return false;
  }
  
  // Block dangerous keywords
  const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC'];
  for (const keyword of blocked) {
    // Check for keyword as a standalone word
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return false;
    }
  }
  
  // Verify only allowed tables are referenced
  const fromRegex = /\bFROM\s+([a-z_]+)/gi;
  const joinRegex = /\bJOIN\s+([a-z_]+)/gi;
  let match;
  
  while ((match = fromRegex.exec(sql)) !== null) {
    if (!ALLOWED_TABLES.includes(match[1].toLowerCase())) {
      return false;
    }
  }
  while ((match = joinRegex.exec(sql)) !== null) {
    if (!ALLOWED_TABLES.includes(match[1].toLowerCase())) {
      return false;
    }
  }
  
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'API key de IA no configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Se requiere al menos un mensaje' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Eres un asistente de datos para un sistema TMS (Transport Management System) de grúas en Chile.
Tu trabajo es responder preguntas sobre los datos del sistema usando consultas SQL.

${DB_SCHEMA}

INSTRUCCIONES:
1. Cuando el usuario haga una pregunta sobre datos, genera una consulta SQL SELECT para obtener la información.
2. Responde SIEMPRE en español.
3. Formatea montos en CLP con separador de miles (punto) sin decimales.
4. Formatea fechas en formato DD/MM/YYYY.
5. Usa tablas y listas markdown cuando sea apropiado.
6. Si no puedes responder con los datos disponibles, explica por qué.
7. NUNCA generes queries que modifiquen datos.
8. Limita resultados a 100 filas máximo usando LIMIT.
9. Usa JOINs para enriquecer datos con nombres en vez de solo IDs.
10. Responde de forma concisa y profesional.

Cuando necesites consultar la base de datos, usa la función query_database.`;

    // Step 1: Ask AI what query to run
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10), // Last 10 messages for context
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'query_database',
            description: 'Ejecuta una consulta SQL SELECT contra la base de datos del TMS para obtener información.',
            parameters: {
              type: 'object',
              properties: {
                sql: {
                  type: 'string',
                  description: 'Consulta SQL SELECT a ejecutar. Solo SELECT permitido.',
                },
                explanation: {
                  type: 'string',
                  description: 'Breve explicación de qué busca esta consulta.',
                },
              },
              required: ['sql'],
            },
          },
        }],
        tool_choice: 'auto',
        temperature: 0.1,
      }),
    });

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    if (!choice) {
      return new Response(JSON.stringify({ error: 'No se pudo procesar la solicitud' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If AI doesn't want to query (general question)
    if (choice.finish_reason === 'stop' && choice.message?.content) {
      return new Response(JSON.stringify({ response: choice.message.content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If AI wants to query
    if (choice.message?.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      // Strip trailing semicolons that AI sometimes adds
      const sql = args.sql.replace(/;\s*$/, '').trim();

      console.log('Generated SQL:', sql);

      // Validate SQL
      if (!validateSQL(sql)) {
        console.error('SQL validation failed:', sql);
        return new Response(JSON.stringify({
          response: 'Lo siento, no puedo ejecutar esa consulta por razones de seguridad. Por favor, reformula tu pregunta.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Execute query via direct REST call with service role (bypasses RLS/permissions)
      let queryResult;
      try {
        const pgResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_readonly_query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query_text: sql }),
          signal: AbortSignal.timeout(8000),
        });

        if (!pgResponse.ok) {
          const errText = await pgResponse.text();
          console.error('Query execution error:', errText);
          queryResult = { error: `Error ejecutando la consulta: ${errText.slice(0, 200)}` };
        } else {
          queryResult = await pgResponse.json();
        }
      } catch (e) {
        console.error('Query timeout/error:', e.message);
        queryResult = { error: `Timeout o error en la consulta: ${e.message}` };
      }

      // Step 2: Send results back to AI for formatting
      const formatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10),
            choice.message,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(queryResult).slice(0, 8000), // Limit response size
            },
          ],
          temperature: 0.3,
        }),
      });

      const formatData = await formatResponse.json();
      const formattedResponse = formatData.choices?.[0]?.message?.content || 'No se pudo formatear la respuesta.';

      return new Response(JSON.stringify({ response: formattedResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback
    return new Response(JSON.stringify({
      response: choice.message?.content || 'No pude procesar tu pregunta. Intenta reformularla.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-data:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
