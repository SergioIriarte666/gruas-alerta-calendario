import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { haversineMeters, runMapMatching, type MatchPoint } from "../_shared/mapMatching.ts";
const allowedRoles = ["admin", "viewer", "operator", "client"] as const;

// Reverse geocoding: un POI (negocio/hito) solo se prefiere sobre la dirección
// si está a lo sumo a esta distancia del punto GPS, para no etiquetar con un
// comercio lejano. Ajustable tras validar con puntos reales.
const REVERSE_POI_MAX_METERS = 150;

// Catálogo propio (saved_locations): un punto GPS se etiqueta con el nombre
// operativo (portería, faena, negocio) si hay una ubicación guardada a lo sumo a
// esta distancia. Las porterías/faenas son grandes, por eso el radio es amplio.
const CATALOG_MATCH_MAX_METERS = 300;

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

function buildStaticPointMapUrl(
  token: string,
  coordinates: [number, number],
): string {
  const [lng, lat] = coordinates;
  // La vista del operador necesita una cámara estable alrededor de su GPS, no
  // el encuadre automático pensado para rutas. Una imagen cuadrada funciona
  // tanto en la tarjeta como al ampliarla y evita recalcular el mapa al abrirlo.
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `${lng},${lat},15.5,0/900x900@2x` +
    `?access_token=${token}&logo=true&attribution=true`
  );
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
    const { action, origin, destination, query, geometry, mode = 'preview', proximity, session_id, coordinates } = body;

    // Reverse geocoding: nombre/dirección legible de una coordenada (lng, lat).
    // Se usa para etiquetar el punto final de una ruta en el historial.
    if (action === "reverse_geocode") {
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number"
      ) {
        return new Response(
          JSON.stringify({ error: "coordinates [lng, lat] required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const [lng, lat] = coordinates;

      // 1) Catálogo propio primero: nombres operativos (porterías, faenas,
      //    negocios) que Mapbox no tiene. Mismo criterio que la resolución de
      //    orígenes catalog-first.
      const { data: savedLocations } = await authContext.supabaseAdmin
        .from("saved_locations")
        .select("name, latitude, longitude")
        .eq("is_active", true);

      let bestCatalog: { name: string } | null = null;
      let bestCatalogDist = Infinity;
      for (const loc of savedLocations ?? []) {
        const la = Number(loc.latitude);
        const lo = Number(loc.longitude);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
        const d = haversineMeters(lat, lng, la, lo);
        if (d < bestCatalogDist) {
          bestCatalog = { name: loc.name };
          bestCatalogDist = d;
        }
      }
      if (bestCatalog && bestCatalogDist <= CATALOG_MATCH_MAX_METERS) {
        return new Response(
          JSON.stringify({ name: bestCatalog.name, place_name: bestCatalog.name, source: "catalog" }),
          {
            headers: {
              ...getCorsHeaders(req),
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=86400",
            },
          },
        );
      }

      // 2) Mapbox reverse geocoding (POI cercano → dirección → localidad).
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${MAPBOX_TOKEN}&country=cl&language=es&limit=5&types=poi,address,place`;

      const res = await fetch(url);
      const data = await res.json();
      const features: Array<Record<string, any>> = Array.isArray(data?.features) ? data.features : [];

      const distanceOf = (feature: Record<string, any>): number => {
        const center = feature?.center;
        if (!Array.isArray(center) || center.length !== 2) return Infinity;
        return haversineMeters(lat, lng, center[1], center[0]);
      };
      const hasType = (feature: Record<string, any>, type: string): boolean =>
        Array.isArray(feature?.place_type) && feature.place_type.includes(type);

      // Preferencia: POI cercano (nombre del lugar, p.ej. "Salfa Copiapó") →
      // dirección (calle + número) → primer resultado (localidad).
      let chosen: Record<string, any> | null = null;
      let bestPoiDist = Infinity;
      for (const feature of features) {
        if (!hasType(feature, "poi")) continue;
        const d = distanceOf(feature);
        if (d <= REVERSE_POI_MAX_METERS && d < bestPoiDist) {
          chosen = feature;
          bestPoiDist = d;
        }
      }
      if (!chosen) chosen = features.find((f) => hasType(f, "address")) ?? null;
      if (!chosen) chosen = features[0] ?? null;

      const placeName: string = chosen?.place_name ?? "";
      let name = placeName;
      if (chosen) {
        if (hasType(chosen, "poi")) {
          name = chosen.text ?? placeName;
        } else if (hasType(chosen, "address")) {
          name = chosen.address ? `${chosen.text} ${chosen.address}` : chosen.text;
        } else {
          name = chosen.text ?? placeName;
        }
      }

      return new Response(JSON.stringify({ name, place_name: placeName, source: "mapbox" }), {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // Map Matching — pega los puntos GPS crudos de una sesión a la red vial.
    if (action === "map_matching") {
      if (!session_id || typeof session_id !== "string") {
        return new Response(
          JSON.stringify({ error: "session_id is required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = authContext.supabaseAdmin;

      const { data: session, error: sessionError } = await supabaseAdmin
        .from("operator_location_sessions")
        .select("id, status, ended_at")
        .eq("id", session_id)
        .maybeSingle();

      if (sessionError) {
        return new Response(
          JSON.stringify({ error: "Failed to load session" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const isClosed = session.status !== "active" || Boolean(session.ended_at);

      // Cache hit: sesión cerrada con matching ya computado → devolver sin llamar a Mapbox.
      if (isClosed) {
        const { data: cached } = await supabaseAdmin
          .from("matched_routes")
          .select("segments, avg_confidence, points_input, points_used, api_requests, computed_at")
          .eq("session_id", session_id)
          .maybeSingle();
        if (cached) {
          return new Response(JSON.stringify({ ...cached, cached: true }), {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }

      const { data: rawPoints, error: pointsError } = await supabaseAdmin
        .from("operator_location_points")
        .select("latitude, longitude, accuracy_meters, recorded_at")
        .eq("session_id", session_id)
        .order("recorded_at", { ascending: true });

      if (pointsError) {
        return new Response(
          JSON.stringify({ error: "Failed to load points" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const pointsInput = (rawPoints ?? []).length;
      const { segments, apiRequests, pointsUsed } = await runMapMatching(
        (rawPoints ?? []) as MatchPoint[],
        MAPBOX_TOKEN,
      );

      // Contrato Fase 1 sin cambios: avg_confidence = media simple por segmento
      // (la confianza ponderada por distancia del helper es solo para Fase 2).
      const confidences = segments.map((s) => s.confidence);
      const avgConfidence = confidences.length
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : null;

      const result = {
        segments,
        avg_confidence: avgConfidence,
        points_input: pointsInput,
        points_used: pointsUsed,
        api_requests: apiRequests,
      };

      // Cachear solo sesiones cerradas (una fila por sesión, upsert por session_id).
      if (isClosed && segments.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from("matched_routes")
          .upsert(
            { session_id, ...result, computed_at: new Date().toISOString() },
            { onConflict: "session_id" },
          );
        if (upsertError) {
          console.error("matched_routes upsert failed", upsertError.message);
        }
      }

      return new Response(JSON.stringify({ ...result, cached: false }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Static map centered on the operator's current GPS position.
    if (action === "static_point_map") {
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number" ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
      ) {
        return new Response(
          JSON.stringify({ error: "coordinates [lng, lat] required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      const imageRes = await fetch(
        buildStaticPointMapUrl(MAPBOX_TOKEN, coordinates as [number, number]),
      );
      if (!imageRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch static point map" }),
          { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
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
      JSON.stringify({ error: "Invalid action. Use 'geocode', 'reverse_geocode', 'directions', 'static_point_map', 'static_map' or 'map_matching'" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
