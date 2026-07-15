import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
const allowedRoles = ["admin", "viewer", "operator", "client"] as const;

function encodePolyline(coordinates: [number, number][]): string {
  let encoded = '';
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
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  let encoded = '';
  while (sgn >= 0x20) {
    encoded += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>= 5;
  }
  encoded += String.fromCharCode(sgn + 63);
  return encoded;
}

function simplifyCoords(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const simplified = coords.filter((_: unknown, i: number) => i % step === 0);
  if (simplified[simplified.length - 1] !== coords[coords.length - 1]) {
    simplified.push(coords[coords.length - 1]);
  }
  return simplified;
}

function computeBbox(coords: [number, number][], origin: [number, number], destination: [number, number], marginPct = 0.10): [number, number, number, number] {
  const allLngs = coords.map(c => c[0]).concat([origin[0], destination[0]]);
  const allLats = coords.map(c => c[1]).concat([origin[1], destination[1]]);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const lngMargin = (maxLng - minLng) * marginPct || 0.01;
  const latMargin = (maxLat - minLat) * marginPct || 0.01;
  return [minLng - lngMargin, minLat - latMargin, maxLng + lngMargin, maxLat + latMargin];
}

function buildStaticMapUrl(
  token: string,
  overlays: string,
  mode: 'preview' | 'full',
  coords: [number, number][],
  origin: [number, number],
  destination: [number, number],
): string {
  if (mode === 'full') {
    const bbox = computeBbox(coords, origin, destination, 0.12);
    const bboxStr = `[${bbox.join(',')}]`;
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/${bboxStr}/1280x900@2x?access_token=${token}&padding=40`;
  }
  // preview mode — auto with compact size
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/auto/700x400@2x?access_token=${token}&padding=60`;
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

    const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!MAPBOX_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Mapbox token not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, origin, destination, query, geometry, mode = 'preview', proximity } = body;

    // Static map image with route
    if (action === "static_map") {
      if (!geometry?.coordinates || !origin || !destination) {
        return new Response(
          JSON.stringify({ error: "geometry, origin and destination required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const coords: [number, number][] = geometry.coordinates;
      const maxPts = mode === 'full' ? 120 : 80;
      const simplified = simplifyCoords(coords, maxPts);

      const polyline = encodePolyline(simplified);
      const encodedPolyline = encodeURIComponent(polyline);

      const pathOverlay = `path-4+7c3aed-0.8(${encodedPolyline})`;
      const originMarker = `pin-l-a+16a34a(${origin[0]},${origin[1]})`;
      const destMarker = `pin-l-b+dc2626(${destination[0]},${destination[1]})`;
      const overlays = `${originMarker},${destMarker},${pathOverlay}`;

      let mapUrl = buildStaticMapUrl(MAPBOX_TOKEN, overlays, mode, coords, origin, destination);

      // If URL too long, re-simplify
      if (mapUrl.length > 8192) {
        const simplified2 = simplifyCoords(coords, 40);
        const polyline2 = encodePolyline(simplified2);
        const encodedPolyline2 = encodeURIComponent(polyline2);
        const pathOverlay2 = `path-4+7c3aed-0.8(${encodedPolyline2})`;
        const overlays2 = `${originMarker},${destMarker},${pathOverlay2}`;
        mapUrl = buildStaticMapUrl(MAPBOX_TOKEN, overlays2, mode, coords, origin, destination);
      }

      // Fetch the image server-side so the Mapbox token is never exposed to clients
      const imageRes = await fetch(mapUrl);
      if (!imageRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch static map" }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const imageData = await imageRes.arrayBuffer();
      const contentType = imageRes.headers.get("Content-Type") ?? "image/png";
      return new Response(imageData, {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    // Geocoding action
    if (action === "geocode") {
      if (!query) {
        return new Response(JSON.stringify({ error: "query is required" }), {
          status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      let proximityParam = "";
      if (
        Array.isArray(proximity) &&
        proximity.length === 2 &&
        typeof proximity[0] === "number" &&
        typeof proximity[1] === "number"
      ) {
        proximityParam = `&proximity=${proximity[0]},${proximity[1]}`;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=cl&language=es&limit=5${proximityParam}`;
      const res = await fetch(url);
      const data = await res.json();

      const results = (data.features || []).map(
        (f: { place_name: string; center: [number, number] }) => ({
          name: f.place_name,
          coordinates: f.center,
        })
      );

      return new Response(JSON.stringify({ results }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Directions action
    if (action === "directions") {
      if (!origin || !destination) {
        return new Response(
          JSON.stringify({ error: "origin and destination are required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        return new Response(JSON.stringify({ error: "No route found" }), {
          status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const route = data.routes[0];
      return new Response(
        JSON.stringify({
          distance_km: Math.round((route.distance / 1000) * 10) / 10,
          estimated_time_hours: Math.round((route.duration / 3600) * 10) / 10,
          geometry: route.geometry,
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'geocode' or 'directions'" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
