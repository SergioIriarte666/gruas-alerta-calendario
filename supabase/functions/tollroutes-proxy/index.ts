import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
const allowedRoles = ["admin", "viewer"] as const;

const GETAPI_BASE = "https://chile.getapi.cl/v1/tollroutes/api";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, getCorsHeaders(req));
    }

    const API_KEY =
      Deno.env.get("GETAPI_CHILE_TOLL_API_KEY") ??
      Deno.env.get("GETAPI_CHILE_API_KEY");

    if (!API_KEY) {
      return new Response(
        JSON.stringify({ error: "GetAPI key not configured (GETAPI_CHILE_TOLL_API_KEY)" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { action, origin, destination, category } = body;
    const apiHeaders = { "X-Api-Key": API_KEY };

    // List available locations
    if (action === "locations") {
      const res = await fetch(`${GETAPI_BASE}/locations`, {
        headers: apiHeaders,
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // List vehicle categories
    if (action === "categories") {
      const res = await fetch(`${GETAPI_BASE}/categories`, {
        headers: apiHeaders,
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // List highways
    if (action === "highways") {
      const res = await fetch(`${GETAPI_BASE}/highways`, {
        headers: apiHeaders,
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Calculate route toll cost
    if (action === "route-cost") {
      if (!origin || !destination) {
        return new Response(
          JSON.stringify({ error: "origin and destination are required" }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }

      const params = new URLSearchParams({ origin, destination });
      if (category) {
        params.append("category", category);
      }

      console.log("Toll route-cost request:", params.toString());

      const res = await fetch(`${GETAPI_BASE}/route-cost?${params}`, {
        headers: apiHeaders,
      });
      const data = await res.json();

      if (!res.ok) {
        console.log("Toll API error:", res.status, JSON.stringify(data));
        // Return 200 with error payload so supabase.functions.invoke doesn't throw
        return new Response(
          JSON.stringify({
            error: data?.message || "Toll API error",
            details: data,
            apiStatus: res.status,
          }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }

      console.log("Toll route-cost response:", JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (action === "route-cost-by-coords") {
      const { origin, destination, categoryCode } = body;

      if (
        origin?.lat === undefined ||
        origin?.lng === undefined ||
        destination?.lat === undefined ||
        destination?.lng === undefined
      ) {
        return new Response(
          JSON.stringify({ error: "origin y destination deben incluir lat y lng" }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }

      const payload: Record<string, unknown> = {
        origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
        destination: { lat: Number(destination.lat), lng: Number(destination.lng) },
        categoryCode: categoryCode ?? "LIVIANO",
      };

      console.log("Toll route-cost-by-coords:", JSON.stringify(payload));

      const res = await fetch(`${GETAPI_BASE}/route-cost-by-coords`, {
        method: "POST",
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        console.log("Toll API error (coords):", res.status, JSON.stringify(data));
        return new Response(
          JSON.stringify({
            error: data?.message || "Toll API error",
            details: data,
            apiStatus: res.status,
          }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }

      console.log("Toll route-cost-by-coords response:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error:
          "Invalid action. Use 'route-cost', 'route-cost-by-coords', 'locations', 'categories', or 'highways'",
      }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
