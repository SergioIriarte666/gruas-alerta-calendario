import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!MAPBOX_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Mapbox token not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { action, origin, destination, query } = await req.json();

    // Geocoding action
    if (action === "geocode") {
      if (!query) {
        return new Response(JSON.stringify({ error: "query is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${MAPBOX_TOKEN}&country=cl&language=es&limit=5`;

      const res = await fetch(url);
      const data = await res.json();

      const results = (data.features || []).map(
        (f: { place_name: string; center: [number, number] }) => ({
          name: f.place_name,
          coordinates: f.center, // [lng, lat]
        })
      );

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Directions action
    if (action === "directions") {
      if (!origin || !destination) {
        return new Response(
          JSON.stringify({ error: "origin and destination are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // origin/destination should be [lng, lat]
      const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        return new Response(
          JSON.stringify({ error: "No route found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const route = data.routes[0];
      return new Response(
        JSON.stringify({
          distance_km: Math.round((route.distance / 1000) * 10) / 10,
          estimated_time_hours:
            Math.round((route.duration / 3600) * 10) / 10,
          geometry: route.geometry,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'geocode' or 'directions'" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
