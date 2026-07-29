import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  rankOfStage,
  resolveEffectiveStage,
  serviceStatusAllowsJourneyProgress,
  STAGE_RANK,
  type JourneyStage,
} from "../_shared/journeyStage.ts";

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

// "Servicio iniciado" = el operador pulso "Iniciar Servicio" (pending ->
// in_progress) o ya paso por la inspeccion inicial. `pending` es "asignado
// pero NO iniciado": el link de seguimiento puede existir desde mucho antes.
//
// Bug SRV-6853 (23/07): el motor multidestino ruteaba hacia la parada 1 desde
// el instante en que existian link + paradas. El operador hizo un tramo previo
// AJENO al servicio durante la mañana y el mapa le indicaba "devolverse" hacia
// la parada 1 todo el rato. La guia de ruta (polyline + ETA) y el avance por
// geofence solo tienen sentido una vez iniciado el servicio.
//
// OJO: armed_at NO sirve como criterio de "iniciado" — se setea por distancia
// GPS (>1 km de la parada), asi que el tramo previo del 23/07 lo habria
// activado igual. El criterio real es el estado del servicio.
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

// La linea de tiempo del cliente SOLO AVANZA y NO depende de que el link haya
// visto el viaje entero. STAGE_RANK, el piso por estado del servicio y la
// combinacion de ambos con el maximo persistido viven en ../_shared/
// journeyStage.ts: es logica pura, cubierta por los tests del repo.

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

// Desde que el vehiculo va cargado, el ETA deja de mirar al origen: lo que el
// cliente espera saber es cuando llega SU CARGA al destino (Fix 8, SRV-6858).
// Etapas de rango >= towing rutean al destino del servicio.
const DESTINATION_TARGET_MIN_RANK = STAGE_RANK.towing;

type EtaTargetKind = "origin" | "destination" | "stop";

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
      eta_target_stop_id, eta_target_kind, on_site_reached_at, max_stage_reached
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
        destination,
        destination_lat,
        destination_lng,
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

  // Origen y destino son snapshots confirmados al crear/editar el servicio.
  // Este endpoint público jamás geocodifica texto ni consulta el catálogo:
  // hacerlo durante el viaje puede cambiar la ruta que ya recibió el cliente.
  const destination = {
    lat: (service.destination_lat as number | null) ?? null,
    lng: (service.destination_lng as number | null) ?? null,
    text: (service.destination as string | null) ?? null,
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

  // Ruta "armada": el itinerario solo guia (polyline, ETA, avance por geofence)
  // cuando el servicio esta iniciado. Se define sobre hasNavigableStops, no
  // sobre hasStops: sin paradas navegables el motor multidestino no aplica y el
  // flujo original queda intacto — la Fase 1/2 (ETA al origen mientras el
  // servicio esta `pending`) es justamente el "tu grua va en camino" que ve el
  // cliente, y no se toca.
  const serviceStarted = serviceStatusAllowsJourneyProgress(service.status);
  const routeArmed = hasNavigableStops ? serviceStarted : true;

  // `pending` es una asignación, no una continuación del viaje anterior.
  // Si el servicio volvió de inspection_completed/in_progress a pending, el
  // trigger de DB limpia estos hitos. Esta limpieza defensiva cubre links
  // legacy o una lectura concurrente al cambio de estado.
  if (
    !serviceStarted &&
    (
      link.on_site_reached_at ||
      link.max_stage_reached ||
      link.eta_target_kind === "destination"
    )
  ) {
    try {
      await supabase
        .from("service_tracking_links")
        .update({
          on_site_reached_at: null,
          max_stage_reached: null,
          eta_seconds: null,
          eta_distance_meters: null,
          eta_polyline: null,
          eta_cached_at: null,
          eta_target_stop_id: null,
          eta_target_kind: null,
        })
        .eq("id", link.id);
    } catch {
      // no-op: el trigger es la defensa principal; esta es higiene adicional.
    }
  }

  // Proxima parada objetivo: primera no alcanzada con coordenadas (una parada
  // sin lat/lng no puede ser geofenceada ni ruteada, se salta).
  const findNextStop = (): ServiceStop | null =>
    stops.find((s) => s.reached_at === null && s.lat != null && s.lng != null) ?? null;

  // Con la ruta sin armar no hay parada objetivo publica: las paradas viajan
  // como pines informativos y el cliente ve "Servicio no iniciado".
  const publicNextStop = (): ServiceStop | null => (routeArmed ? findNextStop() : null);

  // Campos extra de la respuesta solo cuando hay paradas: un servicio sin
  // paradas responde exactamente igual que antes.
  const stopsPayload = (nextStop: ServiceStop | null) =>
    hasStops
      ? {
          stops: stops.map(toPublicStop),
          next_stop: nextStop ? { label: nextStop.label, order: nextStop.stop_order } : null,
          route_armed: routeArmed,
        }
      : {};

  // Detencion declarada en curso (combustible, comida, descanso, peaje, otro).
  // Al cliente se le exponen SOLO motivo y hora de inicio: `note` y
  // `operator_id` son internos y nunca salen por este endpoint publico.
  const { data: openStopEvent } = await supabase
    .from("service_stop_events")
    .select("reason, started_at")
    .eq("service_id", link.service_id)
    .is("ended_at", null)
    .maybeSingle();

  const stopEventPayload = openStopEvent
    ? { stop_event: { reason: openStopEvent.reason, started_at: openStopEvent.started_at } }
    : {};

  // Sesion que alimenta la pagina, en orden de precedencia:
  //
  //   1. Sesion ACTIVA de este servicio (transmitiendo ahora).
  //   2. Sesion ACTIVA del operador ASIGNADO VIGENTE, aunque todavia no la haya
  //      enganchado al servicio.
  //   3. Ultima sesion del servicio, aunque este cerrada: es el "ultimo punto
  //      conocido" que la pagina rotula como tal.
  //
  // El orden importa por el cambio de operador a mitad de servicio (26/07,
  // Sergio -> Jesus con transbordo de camion). Preferir "la ultima sesion del
  // servicio" —como hacia antes— dejaba al cliente mirando el ultimo punto del
  // operador ANTERIOR mientras el nuevo ya iba rodando: sus puntos existian
  // pero colgaban de otra sesion.
  let session: { id: string } | null = null;

  const { data: activeServiceSession } = await supabase
    .from("operator_location_sessions")
    .select("id")
    .eq("service_id", link.service_id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  session = activeServiceSession;

  if (!session && service.operator_id) {
    // Solo sesiones sin servicio o de ESTE servicio: una sesion activa colgada
    // de OTRO servicio del mismo operador no puede alimentar este link, o el
    // cliente veria la grua atendiendo un trabajo ajeno.
    const { data: operatorSession } = await supabase
      .from("operator_location_sessions")
      .select("id")
      .eq("operator_id", service.operator_id)
      .eq("status", "active")
      .or(`service_id.is.null,service_id.eq.${link.service_id}`)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    session = operatorSession;
  }

  if (!session) {
    const { data: lastServiceSession } = await supabase
      .from("operator_location_sessions")
      .select("id")
      .eq("service_id", link.service_id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    session = lastServiceSession;
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
      ...stopsPayload(publicNextStop()),
      ...stopEventPayload,
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
      ...stopsPayload(publicNextStop()),
      ...stopEventPayload,
    });
  }

  const isStale = now - new Date(point.recorded_at).getTime() > STALE_THRESHOLD_MS;
  const state = isStale ? "no_signal" : "active";

  const hasOrigin = origin.lat != null && origin.lng != null;

  let journeyStage: JourneyStage = "en_route";
  let nextStop: ServiceStop | null = null;

  if (hasNavigableStops && !routeArmed) {
    // Servicio con recorrido pero AUN NO INICIADO: el motor multidestino queda
    // completamente apagado. Ni se arman paradas, ni se marcan por geofence, ni
    // hay parada objetivo — el tramo que el movil hace antes de "Iniciar
    // Servicio" no pertenece a este servicio (SRV-6853). Los puntos GPS se
    // siguen grabando y asociando igual: solo se apaga la GUIA.
    journeyStage = "assigned";
    nextStop = null;

    // Cache de ETA pre-inicio: si quedo un ETA/polyline cacheado apuntando a
    // una parada (de un deploy anterior o de un cambio de estado hacia atras),
    // se limpia aqui para que al armar la ruta se recalcule desde cero en vez
    // de servir una guia calculada antes del inicio.
    if (link.eta_cached_at || link.eta_polyline || link.eta_target_stop_id || link.eta_target_kind) {
      try {
        await supabase
          .from("service_tracking_links")
          .update({
            eta_seconds: null,
            eta_distance_meters: null,
            eta_polyline: null,
            eta_cached_at: null,
            eta_target_stop_id: null,
            eta_target_kind: null,
          })
          .eq("id", link.id);
      } catch {
        // no-op: limpiar el cache es higiene, nunca debe romper el seguimiento publico
      }
    }
  } else if (hasNavigableStops) {
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
  } else if (!serviceStarted) {
    // Con GPS disponible, un servicio asignado pero aún pendiente sólo puede
    // mostrar el trayecto hacia el origen. No se arman hitos on_site/towing
    // hasta que el operador pulse "Iniciar Servicio".
    journeyStage = "en_route";
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

  // Etapa efectiva = max(piso por ESTADO del servicio, etapa por geocerco,
  // maximo persistido).
  //
  // El piso por estado (Fix C) es lo que hace que un link creado a mitad de
  // viaje nazca con la etapa verdadera: el historial de geocercos vive en la
  // sesion, pero "el vehiculo ya esta cargado" es un hecho del SERVICIO
  // (inspection_completed). Sin el, el link nuevo del 26/07 arranco en
  // "en_route" y el ETA apunto al ORIGEN con la carga camino a Viña.
  //
  // Se aplica SOLO con la guia armada: con el servicio aun no iniciado la etapa
  // es "assigned" por decision explicita (SRV-6853) y no debe destaparse ni un
  // maximo viejo ni un piso. Coherente por construccion: un servicio sin
  // iniciar esta en `pending`, que no tiene piso.
  const guidanceOn = !(hasNavigableStops && !routeArmed);
  if (guidanceOn && serviceStarted) {
    const persistedRank = rankOfStage(link.max_stage_reached as string | null);
    const effectiveStage = resolveEffectiveStage(
      journeyStage,
      service.status as string,
      link.max_stage_reached as string | null,
    );

    if (STAGE_RANK[effectiveStage] > persistedRank) {
      // El maximo se persiste tambien cuando lo levanto el piso por estado: asi
      // la linea de tiempo del cliente no rebota si el proximo poll llega antes
      // de que la posicion confirme el traslado.
      try {
        await supabase
          .from("service_tracking_links")
          .update({ max_stage_reached: effectiveStage })
          .eq("id", link.id);
      } catch {
        // no-op: el maximo es memoria de la linea de tiempo, nunca debe romper el seguimiento publico
      }
    }

    journeyStage = effectiveStage;
  }

  // Destino del ETA: la proxima parada NAVEGABLE pendiente (multidestino) o,
  // en el flujo original, un objetivo que DEPENDE DE LA ETAPA. Con la ruta sin
  // armar nextStop es null y no hay destino: ni polyline ni ETA hasta que el
  // operador inicie el servicio.
  //
  // Fix 8: antes de la carga el objetivo es el ORIGEN ("tu grua llega en X" =
  // llegada al rescate); desde "towing" el vehiculo ya va cargado y el objetivo
  // pasa a ser el DESTINO ("tu carga llega en X"). Publicar el ETA al origen
  // durante el traslado es un dato falso: el 26/07 el cliente de SRV-6858 leyo
  // "llega en 2 min · 0.7 km" con la entrega a ~1,5 h de distancia. Con el Fix 4
  // (etapa monotonica) el objetivo tampoco puede retroceder al origen.
  let etaTargetKind: EtaTargetKind = hasNavigableStops ? "stop" : "origin";
  let etaTarget: { lat: number; lng: number } | null = null;
  let destinationCoords: { lat: number; lng: number } | null = null;

  if (hasNavigableStops) {
    etaTarget = nextStop ? { lat: nextStop.lat as number, lng: nextStop.lng as number } : null;
  } else if (STAGE_RANK[journeyStage] >= DESTINATION_TARGET_MIN_RANK) {
    etaTargetKind = "destination";
    destinationCoords = destination.lat != null && destination.lng != null
      ? { lat: destination.lat, lng: destination.lng }
      : null;
    // Un enlace nuevo no puede existir sin ambos snapshots (defensa en DB).
    // Este null sólo protege enlaces legacy; nunca se cae de vuelta al origen.
    etaTarget = destinationCoords;
  } else if (hasOrigin) {
    etaTarget = { lat: origin.lat as number, lng: origin.lng as number };
  }

  const etaTargetStopId = hasNavigableStops ? (nextStop?.id ?? null) : null;

  let eta: Eta = null;
  // true cuando el destino existe pero Google no puede rutear la zona (p. ej.
  // C-13 Termas de Juncal o el tramo cordillerano a Mantos de Oro): el cliente
  // muestra el fallback de distancia en linea recta en vez de "Calculando..."
  // permanente.
  let etaUnavailable = false;
  // Con una detencion declarada el ETA queda SUSPENDIDO: seguir mostrando una
  // hora de llegada mientras la grua esta en un descanso produce un dato que
  // corre solo y llega falso. Tampoco se llama a Routes (ni se toca el cache
  // vigente): al reanudar, el ETA se recalcula desde la posicion real.
  if (state === "active" && etaTarget && !openStopEvent) {
    const cachedAt = link.eta_cached_at ? new Date(link.eta_cached_at as string).getTime() : 0;
    // El cache (positivo o negativo) solo vale si apunta al MISMO objetivo: al
    // alcanzar una parada, el ETA cacheado hacia ella es invalido aunque el TTL
    // siga fresco. La CLASE de objetivo tambien forma parte de la llave: en el
    // flujo legacy el stop_id es null a ambos lados, asi que sin comparar el
    // kind el ETA al ORIGEN seguiria calzando hasta 60 s despues de pasar a
    // "towing" y se serviria el numero equivocado (Fix 8).
    const targetMatches =
      ((link.eta_target_stop_id as string | null) ?? null) === etaTargetStopId &&
      ((link.eta_target_kind as EtaTargetKind | null) ?? null) === etaTargetKind;
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
              eta_target_kind: etaTargetKind,
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
              eta_target_kind: etaTargetKind,
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
    // El destino viaja SIEMPRE (texto + snapshot confirmado): es
    // lo que el cliente necesita leer una vez que su carga va en camino.
    destination: {
      lat: destination.lat,
      lng: destination.lng,
      text: destination.text,
    },
    journey_stage: journeyStage,
    eta,
    // Hacia donde apunta el ETA publicado: el cliente cambia el rotulo
    // ("Tu grua llega en" vs "Entrega estimada en") segun esto (Fix 8).
    eta_target: etaTargetKind,
    eta_unavailable: etaUnavailable,
    support_phone: supportPhone,
    ...stopsPayload(nextStop),
    ...stopEventPayload,
  });
});
