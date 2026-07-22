import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Seguimiento publico por link con token (Fase 1, sin login).
 * GET/POST ?token=... -> ultima posicion conocida de la grua asignada al servicio.
 * Usa SUPABASE_SERVICE_ROLE_KEY: la tabla service_tracking_links no tiene policies
 * para anon, este es el unico punto de acceso publico.
 */

// El seguimiento en vivo existe SOLO durante la fase operacional del rescate.
// Cualquier otro estado —finales operacionales (completed/cancelled/failed),
// administrativos (quoted/purchase_order_pending/with_purchase_order/invoiced/
// partially_invoiced) o cualquiera futuro— responde "finished": un link viejo
// abierto sobre un servicio facturado jamas debe exponer posicion.
const ACTIVE_TRACKING_STATUSES = ["pending", "in_progress", "inspection_completed"];
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

// Journey stage (Fase 2): distancias del ultimo punto al origen que marcan
// llegada ("on_site") y posterior alejamiento con carga ("towing"). on_site
// es "sticky" via on_site_reached_at: una vez detectado no vuelve a en_route.
const ON_SITE_METERS = 300;
const TOWING_METERS = 500;
// Multidestino: radio para marcar una parada como alcanzada (sticky via
// reached_at, mismo patron que on_site_reached_at).
const STOP_GEOFENCE_METERS = 300;
// Guard de "armado": una parada solo puede marcarse si el movil estuvo antes
// a mas de esta distancia (armed_at sticky). Evita marcar paradas al crear el
// servicio con el movil ya dentro del geofence. Espejo del trigger
// mark_reached_service_stops.
const STOP_ARMING_METERS = 1000;
const ETA_CACHE_MS = 60 * 1000;
const ROUTES_BASE = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

type Eta = { seconds: number; distance_meters: number; polyline: string } | null;

// Paradas de un servicio multidestino. Si el servicio no tiene paradas, todo
// el flujo multi-stop se salta y el comportamiento original (ETA al origen,
// on_site/towing) queda intacto.
type ServiceStop = {
  id: string;
  stop_order: number;
  label: string;
  lat: number | null;
  lng: number | null;
  stop_type: "pickup" | "dropoff" | "waypoint" | "final";
  reached_at: string | null;
  armed_at: string | null;
};

// Shape publico de cada parada: sin notes ni ids internos. Una parada sin
// coordenadas no participa del motor (no se geofencea ni se rutea): su
// "reached" es null = no verificable, nunca true/false.
const toPublicStop = (stop: ServiceStop) => ({
  label: stop.label,
  lat: stop.lat,
  lng: stop.lng,
  stop_type: stop.stop_type,
  reached: stop.lat != null && stop.lng != null ? stop.reached_at !== null : null,
  order: stop.stop_order,
});

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
      eta_target_stop_id, on_site_reached_at
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

  const [{ data: service, error: serviceError }, { data: companyData }] = await Promise.all([
    supabase
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
      .maybeSingle(),
    // Telefono de contacto operativo (Configuracion > Empresa), independiente
    // del telefono legal/comercial. Fila unica de company_data.
    supabase
      .from("company_data")
      .select("operational_contact_phone")
      .limit(1)
      .maybeSingle(),
  ]);

  if (serviceError || !service) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  const supportPhone = companyData?.operational_contact_phone || null;

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

  if (!ACTIVE_TRACKING_STATUSES.includes(service.status)) {
    // Fuera de la fase operacional (finales o administrativos). El trigger de
    // revocacion corre en el mismo instante en que el servicio cierra, asi que
    // revoked_at suele estar seteado aqui; mostramos "finalizado" de todas
    // formas (sin posicion, no hay riesgo de exponer tracking en vivo) en vez
    // del invalid_link generico de mas abajo.
    return jsonResponse(req, { state: "finished", folio: service.folio, journey_stage: "finished", eta: null, eta_unavailable: false, support_phone: supportPhone });
  }

  // Revocacion manual/anticipada (servicio aun no finalizado): a diferencia
  // del caso de arriba, aqui si debe cortar el acceso por completo.
  if (link.revoked_at) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  // Paradas del servicio multidestino. Sin paradas -> flujo original intacto.
  const { data: stopRows } = await supabase
    .from("service_stops")
    .select("id, stop_order, label, lat, lng, stop_type, reached_at, armed_at")
    .eq("service_id", link.service_id)
    .order("stop_order", { ascending: true });
  const stops: ServiceStop[] = (stopRows as ServiceStop[] | null) ?? [];
  const hasStops = stops.length > 0;

  // Solo las paradas CON coordenadas participan del motor (geofence, ETA,
  // journey_stage). Una parada sin lat/lng se lista pero jamas bloquea ni
  // completa el viaje: si ninguna es navegable, el motor cae al modo legacy
  // (ETA al origen, on_site/towing) y NUNCA reporta "arrived" por esa via
  // (bug SRV-6853: "sin destino navegable" se confundia con "viaje terminado").
  const engineStops = stops.filter((s) => s.lat != null && s.lng != null);
  const hasNavigableStops = engineStops.length > 0;

  // Proxima parada objetivo: primera no alcanzada con coordenadas (una parada
  // sin lat/lng no puede ser geofenceada ni ruteada, se salta).
  const findNextStop = (): ServiceStop | null =>
    stops.find((s) => s.reached_at === null && s.lat != null && s.lng != null) ?? null;

  // Campos extra de la respuesta solo cuando hay paradas: un servicio sin
  // paradas responde exactamente igual que antes.
  const stopsPayload = (nextStop: ServiceStop | null) =>
    hasStops
      ? {
          stops: stops.map(toPublicStop),
          next_stop: nextStop ? { label: nextStop.label, order: nextStop.stop_order } : null,
        }
      : {};

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
      eta_unavailable: false,
      support_phone: supportPhone,
      ...stopsPayload(findNextStop()),
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
      eta_unavailable: false,
      support_phone: supportPhone,
      ...stopsPayload(findNextStop()),
    });
  }

  const isStale = now - new Date(point.recorded_at).getTime() > STALE_THRESHOLD_MS;
  const state = isStale ? "no_signal" : "active";

  const hasOrigin = origin.lat != null && origin.lng != null;

  let journeyStage: "assigned" | "en_route" | "on_site" | "towing" | "last_leg" | "arrived" = "en_route";
  let nextStop: ServiceStop | null = null;

  if (hasNavigableStops) {
    // Armado (espejo del trigger mark_reached_service_stops, sticky): una
    // parada pendiente se arma cuando el movil esta a mas de 1 km de ella.
    const toArm = engineStops.filter(
      (s) =>
        s.reached_at === null &&
        s.armed_at === null &&
        haversineMeters(point.latitude, point.longitude, s.lat as number, s.lng as number) > STOP_ARMING_METERS,
    );
    if (toArm.length > 0) {
      const armedAt = new Date().toISOString();
      toArm.forEach((s) => {
        s.armed_at = armedAt;
      });
      try {
        await supabase
          .from("service_stops")
          .update({ armed_at: armedAt })
          .in("id", toArm.map((s) => s.id));
      } catch {
        // no-op: el armado es un hito, nunca debe romper el seguimiento publico
      }
    }

    // Geofence por parada: si el ultimo punto GPS quedo dentro del radio de la
    // proxima parada ARMADA, se marca alcanzada (sticky, error swallowed) y el
    // objetivo avanza. Loop por si varias paradas caen dentro del mismo radio.
    // Una parada sin armar dentro del radio NO se marca: primero hay que
    // haber estado lejos de ella (viaje real).
    nextStop = findNextStop();
    while (
      nextStop &&
      nextStop.armed_at !== null &&
      haversineMeters(point.latitude, point.longitude, nextStop.lat as number, nextStop.lng as number) < STOP_GEOFENCE_METERS
    ) {
      nextStop.reached_at = new Date().toISOString();
      try {
        await supabase
          .from("service_stops")
          .update({ reached_at: nextStop.reached_at })
          .eq("id", nextStop.id);
      } catch {
        // no-op: el hito es informativo, nunca debe romper el seguimiento publico
      }
      nextStop = findNextStop();
    }

    if (!nextStop) {
      // Todas las paradas NAVEGABLES alcanzadas: "arrived" sin cortar el
      // tracking — el link sigue vivo hasta que el servicio salga de
      // ACTIVE_TRACKING_STATUSES. Las paradas sin coordenadas no cuentan.
      journeyStage = "arrived";
    } else {
      const pending = engineStops.filter((s) => s.reached_at === null);
      journeyStage = pending.every((s) => s.stop_type === "final") ? "last_leg" : "en_route";
    }
  } else {
    const distanceToOriginM = hasOrigin
      ? haversineMeters(point.latitude, point.longitude, origin.lat as number, origin.lng as number)
      : null;

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
  }

  // Destino del ETA: la proxima parada NAVEGABLE pendiente (multidestino) o
  // el origen del servicio (flujo original y paradas sin coordenadas).
  const etaTarget = hasNavigableStops
    ? nextStop
      ? { lat: nextStop.lat as number, lng: nextStop.lng as number }
      : null
    : hasOrigin
      ? { lat: origin.lat as number, lng: origin.lng as number }
      : null;
  const etaTargetStopId = hasNavigableStops ? (nextStop?.id ?? null) : null;

  let eta: Eta = null;
  // true cuando el destino existe pero Google no puede rutear la zona (p. ej.
  // C-13 Termas de Juncal o el tramo cordillerano a Mantos de Oro): el cliente
  // muestra el fallback de distancia en linea recta en vez de "Calculando..."
  // permanente.
  let etaUnavailable = false;
  if (state === "active" && etaTarget) {
    const cachedAt = link.eta_cached_at ? new Date(link.eta_cached_at as string).getTime() : 0;
    // El cache (positivo o negativo) solo vale si apunta a la MISMA parada
    // objetivo: al alcanzar una parada, el ETA cacheado hacia ella es invalido
    // aunque el TTL siga fresco. Sin paradas ambos lados son null.
    const targetMatches = ((link.eta_target_stop_id as string | null) ?? null) === etaTargetStopId;
    const cacheFresh = targetMatches && now - cachedAt < ETA_CACHE_MS;
    if (cacheFresh && link.eta_polyline) {
      // Cache positivo vigente.
      eta = {
        seconds: link.eta_seconds as number,
        distance_meters: link.eta_distance_meters as number,
        polyline: link.eta_polyline as string,
      };
    } else if (cacheFresh) {
      // Cache NEGATIVO vigente (eta_cached_at seteado pero sin polyline): la zona
      // no es ruteable. No se re-llama a Routes hasta que expire el TTL de 60 s.
      etaUnavailable = true;
    } else {
      eta = await fetchEta(point.latitude, point.longitude, etaTarget.lat, etaTarget.lng);
      if (eta) {
        try {
          await supabase
            .from("service_tracking_links")
            .update({
              eta_seconds: eta.seconds,
              eta_distance_meters: eta.distance_meters,
              eta_polyline: eta.polyline,
              eta_cached_at: new Date().toISOString(),
              eta_target_stop_id: etaTargetStopId,
            })
            .eq("id", link.id);
        } catch {
          // no-op: el cache de ETA es una optimizacion, nunca debe romper el seguimiento publico
        }
      } else {
        // Cachear tambien el resultado NEGATIVO (mismo TTL 60 s) para no reintentar
        // Routes en cada poll de cada viewer sobre un destino no ruteable: el
        // servicio real acumulo decenas de llamadas inutiles por esto.
        etaUnavailable = true;
        try {
          await supabase
            .from("service_tracking_links")
            .update({
              eta_seconds: null,
              eta_distance_meters: null,
              eta_polyline: null,
              eta_cached_at: new Date().toISOString(),
              eta_target_stop_id: etaTargetStopId,
            })
            .eq("id", link.id);
        } catch {
          // no-op: el cache negativo es una optimizacion, nunca debe romper el seguimiento publico
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
    eta_unavailable: etaUnavailable,
    support_phone: supportPhone,
    ...stopsPayload(nextStop),
  });
});
