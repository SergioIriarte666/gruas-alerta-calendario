import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const allowedRoles = ["admin", "viewer", "operator", "client"] as const;

const PLACES_BASE = "https://places.googleapis.com/v1";
const ROUTES_BASE = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GEOCODING_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const STATIC_MAPS_BASE = "https://maps.googleapis.com/maps/api/staticmap";

/** Decode a Google-encoded polyline into GeoJSON [lng, lat] pairs. */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    // GeoJSON convention: [longitude, latitude]
    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}

/** Encode GeoJSON [lng, lat] pairs into a Google polyline string. */
function encodePolyline(coordinates: [number, number][]): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lng, lat] of coordinates) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encoded += encodeSignedNumber(latE5 - prevLat);
    encoded += encodeSignedNumber(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  let value = num << 1;
  if (num < 0) value = ~value;

  let encoded = "";
  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  encoded += String.fromCharCode(value + 63);
  return encoded;
}

const VALID_MAP_TYPES = new Set(["roadmap", "hybrid", "satellite", "terrain"]);

/**
 * Expande el bounding box de la ruta con un margen porcentual y devuelve las
 * dos esquinas opuestas. Se usan como puntos "visible" (invisibles en el mapa)
 * para forzar a la Static Maps API a alejar el zoom lo suficiente y evitar que
 * el trazo o los marcadores queden pegados/cortados en el borde de la imagen.
 */
function paddedBoundsCorners(
  points: [number, number][],
  paddingRatio = 0.15,
): [[number, number], [number, number]] {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngPad = lngSpan * paddingRatio;
  const latPad = latSpan * paddingRatio;

  return [
    [minLng - lngPad, minLat - latPad],
    [maxLng + lngPad, maxLat + latPad],
  ];
}

function simplifyCoords(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;

  const step = Math.ceil(coords.length / maxPoints);
  const simplified = coords.filter((_, index) => index % step === 0);

  if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
    simplified.push(coords[coords.length - 1]);
  }

  return simplified;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authContext = await requireUserRoles(req, [...allowedRoles]);
    if ("response" in authContext) {
      return withHeaders(authContext.response, getCorsHeaders(req));
    }

    const API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { action } = body;
    const t0 = Date.now();

    // ── AUTOCOMPLETE (Places API New) ────────────────────────────────────────
    if (action === "autocomplete") {
      const { input, sessionToken } = body;
      if (!input) {
        return new Response(
          JSON.stringify({ error: "input is required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const payload: Record<string, unknown> = {
        input,
        languageCode: "es-CL",
        regionCode: "CL",
        includedRegionCodes: ["cl"],
      };

      if (sessionToken) {
        payload.sessionToken = sessionToken;
      }

      const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const durationMs = Date.now() - t0;
      console.log(JSON.stringify({ action: "autocomplete", durationMs, ok: res.ok, status: res.status }));

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.message ?? "Google Places autocomplete error", details: data }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── PLACE DETAILS (Places API New) ──────────────────────────────────────
    if (action === "place_details") {
      const { placeId, sessionToken } = body;
      if (!placeId) {
        return new Response(
          JSON.stringify({ error: "placeId is required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const detailsHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents,displayName",
      };

      if (sessionToken) {
        detailsHeaders["X-Goog-SessionToken"] = sessionToken;
      }

      const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
        headers: detailsHeaders,
      });

      const data = await res.json();
      const durationMs = Date.now() - t0;
      console.log(JSON.stringify({ action: "place_details", durationMs, ok: res.ok, status: res.status }));

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.message ?? "Google Place Details error", details: data }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── ROUTE (Routes API) ───────────────────────────────────────────────────
    if (action === "route") {
      const { origin, destination } = body;
      if (
        origin?.lat === undefined || origin?.lng === undefined ||
        destination?.lat === undefined || destination?.lng === undefined
      ) {
        return new Response(
          JSON.stringify({ error: "origin and destination must include lat and lng" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const payload = {
        origin: { location: { latLng: { latitude: Number(origin.lat), longitude: Number(origin.lng) } } },
        destination: { location: { latLng: { latitude: Number(destination.lat), longitude: Number(destination.lng) } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        languageCode: "es-CL",
        units: "METRIC",
      };

      const res = await fetch(ROUTES_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const durationMs = Date.now() - t0;
      console.log(JSON.stringify({ action: "route", durationMs, ok: res.ok, status: res.status }));

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.message ?? "Google Routes API error", details: data }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const route = Array.isArray(data.routes) ? data.routes[0] : null;
      if (!route) {
        return new Response(
          JSON.stringify({ error: "No route found" }),
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const distanceKm = Math.round((Number(route.distanceMeters) / 1000) * 10) / 10;
      const durationSeconds = parseInt((route.duration ?? "0s").replace("s", ""), 10);
      const estimatedTimeHours = Math.round((durationSeconds / 3600) * 10) / 10;
      const coordinates = route.polyline?.encodedPolyline
        ? decodePolyline(route.polyline.encodedPolyline)
        : [];

      return new Response(
        JSON.stringify({
          distance_km: distanceKm,
          estimated_time_hours: estimatedTimeHours,
          geometry: { type: "LineString", coordinates },
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── STATIC MAP (Maps Static API) ────────────────────────────────────────
    if (action === "static_map") {
      const { geometry, origin, destination, mode = "preview", mapType = "roadmap", center, zoom } = body;
      if (
        !geometry?.coordinates?.length ||
        !Array.isArray(origin) ||
        !Array.isArray(destination)
      ) {
        return new Response(
          JSON.stringify({ error: "geometry, origin and destination are required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const resolvedMapType = VALID_MAP_TYPES.has(mapType) ? mapType : "roadmap";
      const coords: [number, number][] = geometry.coordinates;
      const simplified = simplifyCoords(coords, mode === "full" ? 180 : 90);
      const encodedPath = encodePolyline(simplified);

      const size = mode === "full" ? "640x640" : "600x280";
      const params = new URLSearchParams({
        size,
        scale: "2",
        maptype: resolvedMapType,
        language: "es",
        region: "CL",
        path: `weight:5|color:0x7c3aedcc|enc:${encodedPath}`,
        markers: `color:green|label:A|${origin[1]},${origin[0]}`,
      });

      params.append("markers", `color:red|label:B|${destination[1]},${destination[0]}`);

      // El frontend controla el zoom (botones +/-) calculando su propio encuadre
      // y enviando center+zoom explícitos. Sin esos valores, se cae a un ajuste
      // automático con margen para no cortar el trazo/marcadores.
      if (
        center?.lat !== undefined &&
        center?.lng !== undefined &&
        typeof zoom === "number" &&
        Number.isFinite(zoom)
      ) {
        params.append("center", `${center.lat},${center.lng}`);
        params.append("zoom", String(Math.round(zoom)));
      } else {
        const [nw, se] = paddedBoundsCorners([...coords, origin, destination]);
        params.append("visible", `${nw[1]},${nw[0]}`);
        params.append("visible", `${se[1]},${se[0]}`);
      }

      params.append("key", API_KEY);

      const imageRes = await fetch(`${STATIC_MAPS_BASE}?${params.toString()}`);
      const durationMs = Date.now() - t0;
      console.log(JSON.stringify({ action: "static_map", durationMs, ok: imageRes.ok, status: imageRes.status }));

      if (!imageRes.ok) {
        const errorText = await imageRes.text();
        return new Response(
          JSON.stringify({ error: "Google Static Maps API error", details: errorText }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const imageData = await imageRes.arrayBuffer();
      // supabase-js solo devuelve un Blob cuando Content-Type es exactamente
      // "application/octet-stream" (cualquier otro tipo no-JSON se parsea como texto,
      // lo que corrompe los bytes binarios). Maps Static API devuelve PNG por defecto;
      // el cliente reconstruye el Blob con ese MIME al recibirlo.
      return new Response(imageData, {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/octet-stream",
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    // ── TEXT SEARCH (Places API New) ─────────────────────────────────────────
    // Para nombres coloquiales de lugares ("Salfa Norte") en vez de direcciones
    // postales: Places resuelve establecimientos, Geocoding no. A diferencia de
    // Geocoding, Places nunca devuelve centroides de pais/region como resultado.
    if (action === "text_search") {
      const { textQuery, locationBias, regionCode } = body;
      if (!textQuery) {
        return new Response(
          JSON.stringify({ error: "textQuery is required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const payload: Record<string, unknown> = {
        textQuery,
        languageCode: "es-CL",
        regionCode: regionCode ?? "CL",
      };

      if (locationBias?.lat !== undefined && locationBias?.lng !== undefined) {
        payload.locationBias = {
          circle: {
            center: { latitude: Number(locationBias.lat), longitude: Number(locationBias.lng) },
            radius: Number(locationBias.radius ?? 50000),
          },
        };
      }

      const res = await fetch(`${PLACES_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const durationMs = Date.now() - t0;
      console.log(JSON.stringify({ action: "text_search", durationMs, ok: res.ok, status: res.status }));

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.message ?? "Google Places text search error", details: data }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const results = (data.places ?? []).map((p: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location: { latitude: number; longitude: number };
        types?: string[];
      }) => ({
        name: p.formattedAddress ?? p.displayName?.text ?? "",
        // Keep [lng, lat] to match Mapbox-proxy format used in the codebase
        coordinates: [p.location.longitude, p.location.latitude] as [number, number],
        types: p.types ?? [],
        // Expuestos por separado para que los consumidores puedan validar
        // relevancia (nombre del lugar vs. la consulta original del usuario)
        displayName: p.displayName?.text ?? null,
        formattedAddress: p.formattedAddress ?? null,
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── GEOCODE (Geocoding API) ──────────────────────────────────────────────
    if (action === "geocode") {
      const { address, query } = body;
      const q = address ?? query;
      if (!q) {
        return new Response(
          JSON.stringify({ error: "address or query is required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const params = new URLSearchParams({
        address: q,
        key: API_KEY,
        region: "cl",
        components: "country:CL",
        language: "es",
      });

      const res = await fetch(`${GEOCODING_BASE}?${params}`);
      const data = await res.json();
      const durationMs = Date.now() - t0;
      console.log(JSON.stringify({ action: "geocode", durationMs, ok: res.ok, status: res.status }));

      if (!res.ok || data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
        return new Response(
          JSON.stringify({ error: data?.error_message ?? "Geocoding error", details: data }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const results = (data.results ?? []).map((r: {
        formatted_address: string;
        types?: string[];
        geometry: { location: { lat: number; lng: number }; location_type?: string };
      }) => ({
        name: r.formatted_address,
        // Keep [lng, lat] to match Mapbox-proxy format used in the codebase
        coordinates: [r.geometry.location.lng, r.geometry.location.lat] as [number, number],
        // Granularidad del resultado, para que los consumidores puedan rechazar
        // matches demasiado amplios (pais, region, etc.)
        types: r.types ?? [],
        locationType: r.geometry.location_type ?? null,
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use autocomplete | place_details | route | static_map | geocode" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("maps-proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
