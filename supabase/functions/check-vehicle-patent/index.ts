import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
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

    const { licensePlate } = await req.json();

    if (!licensePlate) {
      return new Response(
        JSON.stringify({ error: 'La patente es requerida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GETAPI_CHILE_API_KEY');
    if (!apiKey) {
      console.error('GETAPI_CHILE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the license plate (remove spaces and hyphens)
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    
    console.log(`Consulting patent: ${cleanPlate}`);

    const response = await fetch(`https://chile.getapi.cl/v1/vehicles/plate/${cleanPlate}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Patente no encontrada en el registro chileno' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de consultas excedido. Intenta más tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorText = await response.text();
      console.error(`GetAPI error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Error al consultar la API de patentes' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Vehicle data received:', data);

    // Check if API returned success
    if (!data.success || !data.data) {
      return new Response(
        JSON.stringify({ error: 'No se encontró información para esta patente' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract basic vehicle information from the correct structure
    const vehicleInfo = data.data;
    const vehicleData: { marca: string; modelo: string; año: number | null; color: string | null } = {
      marca: vehicleInfo.model?.brand?.name || 'No disponible',
      modelo: vehicleInfo.model?.name || 'No disponible',
      año: vehicleInfo.year || null,
      color: vehicleInfo.color || null,
    };

    return new Response(
      JSON.stringify({ data: vehicleData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-vehicle-patent function:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
