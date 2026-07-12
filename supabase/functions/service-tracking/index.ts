import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Seguimiento publico por link con token (Fase 1, sin login).
 * GET/POST ?token=... -> ultima posicion conocida de la grua asignada al servicio.
 * Usa SUPABASE_SERVICE_ROLE_KEY: la tabla service_tracking_links no tiene policies
 * para anon, este es el unico punto de acceso publico.
 */

const FINISHED_STATUSES = ["completed", "cancelled", "invoiced"];
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

// Journey stage (Fase 2): distancias del ultimo punto al origen que marcan
// llegada ("on_site") y posterior alejamiento con carga ("towing"). on_site
// es "sticky" via on_site_reached_at: una vez detectado no vuelve a en_route.
const ON_SITE_METERS = 300;
const TOWING_METERS = 500;
const ETA_CACHE_MS = 60 * 1000;
const ROUTES_BASE = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

type Eta = { seconds: number; distance_meters: number; polyline: string } | null;

const jsonResponse = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Duracion/distancia/polyline via Routes API. La polyline viaja codificada:
 * el cliente la decodifica (mismo algoritmo que usa maps-proxy). */
async function fetchEta(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<Eta> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const res = await fetch(ROUTES_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        languageCode: "es-CL",
        units: "METRIC",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const route = Array.isArray(data.routes) ? data.routes[0] : null;
    if (!route?.polyline?.encodedPolyline) return null;
    return {
      seconds: parseInt(String(route.duration ?? "0s").replace("s", ""), 10) || 0,
      distance_meters: Number(route.distanceMeters ?? 0),
      polyline: route.polyline.encodedPolyline,
    };
  } catch (error) {
    console.warn("[service-tracking] fetchEta failed:", error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  let token: string | null = null;
  if (req.method === "GET") {
    token = new URL(req.url).searchParams.get("token");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      token = typeof body?.token === "string" ? body.token : null;
    } catch {
      return jsonResponse(req, { error: "invalid_body" }, 400);
    }
  } else {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  if (!token) {
    return jsonResponse(req, { error: "missing_token" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: link, error: linkError } = await supabase
    .from("service_tracking_links")
    .select(`
      id, service_id, revoked_at, expires_at, access_count,
      eta_seconds, eta_distance_meters, eta_polyline, eta_cached_at,
      on_site_reached_at
    `)
    .eq("token", token)
    .maybeSingle();

  if (linkError || !link) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  const now = Date.now();
  if (new Date(link.expires_at).getTime() <= now) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select(`
      folio,
      status,
      origin,
      origin_lat,
      origin_lng,
      operator_id,
      crane:cranes(license_plate, type),
      operator:operators(name)
    `)
    .eq("id", link.service_id)
    .maybeSingle();

  if (serviceError || !service) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  // Fire-and-forget (awaited, error swallowed): no bloquea ni falla la respuesta.
  try {
    await supabase
      .from("service_tracking_links")
      .update({ access_count: (link.access_count ?? 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq("id", link.id);
  } catch {
    // no-op: el contador es informativo, nunca debe romper el seguimiento publico
  }

  const crane = Array.isArray(service.crane) ? service.crane[0] : service.crane;
  const operator = Array.isArray(service.operator) ? service.operator[0] : service.operator;
  const operatorFirstName = typeof operator?.name === "string" && operator.name.trim() !== ""
    ? operator.name.trim().split(" ")[0]
    : null;

  const origin = {
    lat: service.origin_lat ?? null,
    lng: service.origin_lng ?? null,
    text: service.origin ?? null,
  };

  if (FINISHED_STATUSES.includes(service.status)) {
    // El trigger de revocacion corre en el mismo instante en que el servicio
    // cierra, asi que revoked_at siempre estara seteado aqui: mostrar
    // "finalizado" de todas formas (sin posicion, no hay riesgo de exponer
    // tracking en vivo) en vez del invalid_link generico de mas abajo.
    return jsonResponse(req, { state: "finished", folio: service.folio, journey_stage: "finished", eta: null });
  }

  // Revocacion manual/anticipada (servicio aun no finalizado): a diferencia
  // del caso de arriba, aqui si debe cortar el acceso por completo.
  if (link.revoked_at) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  let session: { id: string } | null = null;

  const { data: serviceSession } = await supabase
    .from("operator_location_sessions")
    .select("id")
    .eq("service_id", link.service_id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (serviceSession) {
    session = serviceSession;
  } else if (service.operator_id) {
    const { data: operatorSession } = await supabase
      .from("operator_location_sessions")
      .select("id")
      .eq("operator_id", service.operator_id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    session = operatorSession;
  }

  const craneInfo = crane ? { plate: crane.license_plate, type: crane.type } : null;

  if (!session) {
    return jsonResponse(req, {
      state: "waiting",
      folio: service.folio,
      crane: craneInfo,
      operator_first_name: operatorFirstName,
      position: null,
      origin,
      journey_stage: "assigned",
      eta: null,
    });
  }

  const { data: point } = await supabase
    .from("operator_location_points")
    .select("latitude, longitude, heading_degrees, speed_mps, recorded_at")
    .eq("session_id", session.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!point) {
    return jsonResponse(req, {
      state: "waiting",
      folio: service.folio,
      crane: craneInfo,
      operator_first_name: operatorFirstName,
      position: null,
      origin,
      journey_stage: "assigned",
      eta: null,
    });
  }

  const isStale = now - new Date(point.recorded_at).getTime() > STALE_THRESHOLD_MS;
  const state = isStale ? "no_signal" : "active";

  const hasOrigin = origin.lat != null && origin.lng != null;
  const distanceToOriginM = hasOrigin
    ? haversineMeters(point.latitude, point.longitude, origin.lat as number, origin.lng as number)
    : null;

  let journeyStage: "assigned" | "en_route" | "on_site" | "towing" = "en_route";
  let onSiteReachedAt = link.on_site_reached_at as string | null;

  if (distanceToOriginM !== null) {
    if (onSiteReachedAt && distanceToOriginM > TOWING_METERS) {
      journeyStage = "towing";
    } else if (distanceToOriginM < ON_SITE_METERS) {
      journeyStage = "on_site";
      if (!onSiteReachedAt) {
        onSiteReachedAt = new Date().toISOString();
        try {
          await supabase
            .from("service_tracking_links")
            .update({ on_site_reached_at: onSiteReachedAt })
            .eq("id", link.id);
        } catch {
          // no-op: el hito es informativo, nunca debe romper el seguimiento publico
        }
      }
    } else if (onSiteReachedAt) {
      journeyStage = "on_site";
    }
  }

  let eta: Eta = null;
  if (state === "active" && hasOrigin) {
    const cachedAt = link.eta_cached_at ? new Date(link.eta_cached_at as string).getTime() : 0;
    if (now - cachedAt < ETA_CACHE_MS && link.eta_polyline) {
      eta = {
        seconds: link.eta_seconds as number,
        distance_meters: link.eta_distance_meters as number,
        polyline: link.eta_polyline as string,
      };
    } else {
      eta = await fetchEta(point.latitude, point.longitude, origin.lat as number, origin.lng as number);
      if (eta) {
        try {
          await supabase
            .from("service_tracking_links")
            .update({
              eta_seconds: eta.seconds,
              eta_distance_meters: eta.distance_meters,
              eta_polyline: eta.polyline,
              eta_cached_at: new Date().toISOString(),
            })
            .eq("id", link.id);
        } catch {
          // no-op: el cache de ETA es una optimizacion, nunca debe romper el seguimiento publico
        }
      }
    }
  }

  return jsonResponse(req, {
    state,
    folio: service.folio,
    crane: craneInfo,
    operator_first_name: operatorFirstName,
    position: {
      lat: point.latitude,
      lng: point.longitude,
      heading: point.heading_degrees,
      speed: point.speed_mps,
      recorded_at: point.recorded_at,
    },
    origin,
    journey_stage: journeyStage,
    eta,
  });
});
