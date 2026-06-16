import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const allowedRoles = ['admin', 'viewer'] as const;

const TTL_HOURS: Record<string, number> = {
  plate: 24,
  vin: 720,
  stolen: 2,
  recall: 168,
  appraisal: 24,
};

const VALID_ENDPOINTS = new Set(['plate', 'vin', 'stolen', 'recall', 'appraisal']);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ('response' in authContext) {
      return withHeaders(authContext.response, getCorsHeaders(req));
    }

    const body = await req.json();
    const { endpoint, value } = body;

    if (!endpoint || !value) {
      return new Response(
        JSON.stringify({ success: false, error: 'endpoint y value son requeridos' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_ENDPOINTS.has(endpoint)) {
      return new Response(
        JSON.stringify({ success: false, error: 'endpoint inválido' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const cleanValue = String(value).trim().replace(/[-\s]/g, '').toUpperCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check cache
    const { data: cached } = await supabaseAdmin
      .from('vehicle_api_cache')
      .select('response')
      .eq('endpoint', endpoint)
      .eq('lookup_value', cleanValue)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      console.log(`[vehicle-api] Cache hit: ${endpoint}/${cleanValue}`);
      return new Response(
        JSON.stringify({ success: true, data: cached.response, cached: true }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GETAPI_CHILE_API_KEY');
    if (!apiKey) {
      console.error('[vehicle-api] GETAPI_CHILE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key no configurada' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://chile.getapi.cl/v1/vehicles/${endpoint}/${cleanValue}`;
    console.log(`[vehicle-api] Fetching: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: true, data: null }),
          { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: 'API key inválida' }),
          { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 422) {
        return new Response(
          JSON.stringify({ success: false, error: 'Formato inválido' }),
          { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Límite de consultas alcanzado. Intenta en unos minutos.' }),
          { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error(`[vehicle-api] GetAPI error ${response.status}: ${errText}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al consultar la API' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    if (!data.success) {
      return new Response(
        JSON.stringify({ success: true, data: null }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const responseData = data.data;

    // Store in cache with TTL
    const ttlHours = TTL_HOURS[endpoint] ?? 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('vehicle_api_cache')
      .upsert(
        {
          endpoint,
          lookup_value: cleanValue,
          response: responseData,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint,lookup_value' }
      );

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[vehicle-api] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
