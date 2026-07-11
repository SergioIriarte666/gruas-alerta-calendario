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

const jsonResponse = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });

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
    .select("id, service_id, revoked_at, expires_at, access_count")
    .eq("token", token)
    .maybeSingle();

  if (linkError || !link) {
    return jsonResponse(req, { error: "invalid_link" }, 404);
  }

  const now = Date.now();
  if (link.revoked_at || new Date(link.expires_at).getTime() <= now) {
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
    return jsonResponse(req, { state: "finished", folio: service.folio });
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
    });
  }

  const isStale = now - new Date(point.recorded_at).getTime() > STALE_THRESHOLD_MS;

  return jsonResponse(req, {
    state: isStale ? "no_signal" : "active",
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
  });
});
