import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
const allowedRoles = ['admin', 'viewer'] as const;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ('response' in authContext) {
      return withHeaders(authContext.response, getCorsHeaders(req));
    }

    const { licensePlate } = await req.json();

    if (!licensePlate) {
      return new Response(
        JSON.stringify({ error: 'La patente es requerida' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GETAPI_CHILE_API_KEY');
    if (!apiKey) {
      console.error('GETAPI_CHILE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key no configurada' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
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
          { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de consultas excedido. Intenta más tarde.' }),
          { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      const errorText = await response.text();
      console.error(`GetAPI error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Error al consultar la API de patentes' }),
        { status: response.status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Vehicle data received:', data);

    // Check if API returned success
    if (!data.success || !data.data) {
      return new Response(
        JSON.stringify({ error: 'No se encontró información para esta patente' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract vehicle information (basic + Pro Light fields)
    const vehicleInfo = data.data;
    const vehicleData = {
      marca: vehicleInfo.model?.brand?.name || 'No disponible',
      modelo: vehicleInfo.model?.name || 'No disponible',
      año: vehicleInfo.year || null,
      color: vehicleInfo.color || null,
      vin: vehicleInfo.vinNumber || null,
      combustible: vehicleInfo.fuel || null,
      transmision: vehicleInfo.transmission || null,
      motor: vehicleInfo.engine || null,
      rtFecha: vehicleInfo.rtDate || null,
      rtResultado: vehicleInfo.rtResult || null,
      mesRT: vehicleInfo.monthRT || null,
    };

    return new Response(
      JSON.stringify({ data: vehicleData }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-vehicle-patent function:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
