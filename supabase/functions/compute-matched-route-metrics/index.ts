// Fase 2 de Map Matching: km REALES por vía en service_route_metrics.
// Sweep batch invocado por pg_cron (cada 10 min) o manualmente por un admin.
// Replica la selección de puntos/ventana/fases de compute_service_route_metrics
// (SQL) pero calcula la distancia matcheada con la Matching API de Mapbox.
// NO toca la métrica haversine primaria: solo llena las columnas matched_*.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserRoles, withHeaders } from "../_shared/auth.ts";
import { runMapMatching, type MatchPoint } from "../_shared/mapMatching.ts";

// --- Constantes (ajustables) ---
const BATCH_LIMIT = 5;                              // servicios por ciclo del cron
// Corte anti-backfill: solo métricas computadas desde el deploy de Fase 2. El
// backfill de históricos se hace aparte con { backfill: true }.
const CUTOFF_DATE = "2026-07-24T00:00:00-03:00";
const FINAL_STATUSES = ["completed", "cancelled", "failed"];

interface DbPoint {
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
}

const ms = (ts: string) => new Date(ts).getTime();
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Primera transición de status a alguno de newValues (opcionalmente >= afterTs). */
async function firstStatusChange(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  newValues: string[],
  afterTs: string | null,
): Promise<string | null> {
  let q = supabase
    .from("service_change_history")
    .select("changed_at")
    .eq("service_id", serviceId)
    .eq("field_name", "status")
    .in("new_value", newValues)
    .order("changed_at", { ascending: true })
    .limit(1);
  if (afterTs) q = q.gte("changed_at", afterTs);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data?.[0]?.changed_at ?? null;
}

/** Último hito on_site_reached_at registrado para el servicio. */
async function latestOnSite(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("service_tracking_links")
    .select("on_site_reached_at")
    .eq("service_id", serviceId)
    .not("on_site_reached_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.on_site_reached_at ?? null;
}

interface UpdatePayload {
  matched_total_distance_km: number | null;
  matched_en_route_distance_km: number | null;
  matched_towing_distance_km: number | null;
  matching_confidence: number | null;
}

async function markComputed(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  payload: UpdatePayload,
): Promise<void> {
  const { error } = await supabase
    .from("service_route_metrics")
    .update({ ...payload, matched_computed_at: new Date().toISOString() })
    .eq("service_id", serviceId);
  if (error) throw new Error(error.message);
}

type Outcome = "updated" | "skipped";

async function computeForService(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  token: string,
): Promise<Outcome> {
  const { data: allPoints, error: pointsError } = await supabase
    .from("operator_location_points")
    .select("latitude, longitude, accuracy_meters, recorded_at")
    .eq("service_id", serviceId)
    .order("recorded_at", { ascending: true });
  if (pointsError) throw new Error(pointsError.message);

  const points = (allPoints ?? []) as DbPoint[];

  // Sin puntos: sacar de la cola con matched_* NULL (no reintentar).
  if (points.length === 0) {
    await markComputed(supabase, serviceId, {
      matched_total_distance_km: null,
      matched_en_route_distance_km: null,
      matched_towing_distance_km: null,
      matching_confidence: null,
    });
    return "skipped";
  }

  const overallFirst = points[0].recorded_at;
  const overallLast = points[points.length - 1].recorded_at;

  // Ventana operacional (mismo criterio que compute_service_route_metrics):
  // inicio = primera transición a in_progress; fin = primer estado final >= inicio.
  const rawStart = await firstStatusChange(supabase, serviceId, ["in_progress"], null);
  const rawEnd = await firstStatusChange(supabase, serviceId, FINAL_STATUSES, rawStart);

  let winStart = rawStart ?? overallFirst;
  let winEnd = rawEnd ?? overallLast;
  if (ms(winEnd) <= ms(winStart)) {
    winStart = overallFirst;
    winEnd = overallLast;
  }

  const wS = ms(winStart);
  const wE = ms(winEnd);
  let inWindow = points.filter((p) => ms(p.recorded_at) >= wS && ms(p.recorded_at) <= wE);
  // Ventana sin puntos: caer al rango completo.
  if (inWindow.length === 0) inWindow = points.slice();

  // Hito on_site: válido para el desglose solo si cae dentro de la ventana.
  const onSiteAt = await latestOnSite(supabase, serviceId);
  const onSiteMs = onSiteAt ? ms(onSiteAt) : null;
  const hasOnsite = onSiteMs != null && onSiteMs >= wS && onSiteMs <= wE;

  let matchedTotalMeters = 0;
  let matchedEnRouteKm: number | null = null;
  let matchedTowingKm: number | null = null;
  let weightedConf = 0;
  let weightMeters = 0;
  let apiCalls = 0;
  let apiErrors = 0;

  if (hasOnsite && onSiteMs != null) {
    // Fase ida [inicio, hito] y traslado (hito, fin], con solape de 1 punto (el
    // último punto <= hito entra en ambas) para no perder el segmento del corte.
    const enRoutePoints = inWindow.filter((p) => ms(p.recorded_at) <= onSiteMs);
    const afterPoints = inWindow.filter((p) => ms(p.recorded_at) > onSiteMs);

    const er = await runMapMatching(enRoutePoints as MatchPoint[], token);
    matchedEnRouteKm = round1(er.totalMatchedMeters / 1000);
    matchedTotalMeters += er.totalMatchedMeters;
    if (er.avgConfidence != null) {
      weightedConf += er.avgConfidence * er.totalMatchedMeters;
      weightMeters += er.totalMatchedMeters;
    }
    apiCalls += er.apiRequests;
    apiErrors += er.apiErrors;

    if (afterPoints.length > 0) {
      const boundary = enRoutePoints[enRoutePoints.length - 1];
      const towingPoints = boundary ? [boundary, ...afterPoints] : afterPoints;
      const tw = await runMapMatching(towingPoints as MatchPoint[], token);
      matchedTowingKm = round1(tw.totalMatchedMeters / 1000);
      matchedTotalMeters += tw.totalMatchedMeters;
      if (tw.avgConfidence != null) {
        weightedConf += tw.avgConfidence * tw.totalMatchedMeters;
        weightMeters += tw.totalMatchedMeters;
      }
      apiCalls += tw.apiRequests;
      apiErrors += tw.apiErrors;
    } else {
      // Sin puntos posteriores al hito: no hubo tramo de traslado registrado.
      matchedTowingKm = null;
    }
  } else {
    // Sin hito válido: una sola corrida, fases NULL.
    const run = await runMapMatching(inWindow as MatchPoint[], token);
    matchedTotalMeters += run.totalMatchedMeters;
    if (run.avgConfidence != null) {
      weightedConf += run.avgConfidence * run.totalMatchedMeters;
      weightMeters += run.totalMatchedMeters;
    }
    apiCalls += run.apiRequests;
    apiErrors += run.apiErrors;
  }

  // Falla completa de Mapbox (todas las llamadas fallaron): no marcar computed,
  // queda para el próximo ciclo del cron.
  if (apiCalls > 0 && apiErrors === apiCalls) {
    throw new Error(`Mapbox matching failed for all ${apiCalls} chunk(s)`);
  }

  const confidence = weightMeters > 0 ? Math.round((weightedConf / weightMeters) * 100) / 100 : null;

  await markComputed(supabase, serviceId, {
    matched_total_distance_km: round1(matchedTotalMeters / 1000),
    matched_en_route_distance_km: matchedEnRouteKm,
    matched_towing_distance_km: matchedTowingKm,
    matching_confidence: confidence,
  });
  return "updated";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  const cors = getCorsHeaders(req);
  const jsonRes = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  // Auth: x-cron-secret (pg_cron) o JWT admin (invocación manual).
  const cronSecret = Deno.env.get("CRON_SECRET")?.trim();
  const requestSecret = req.headers.get("x-cron-secret")?.trim();
  const isCron = Boolean(cronSecret && requestSecret && cronSecret === requestSecret);
  if (!isCron) {
    const authContext = await requireUserRoles(req, ["admin"]);
    if ("response" in authContext) return withHeaders(authContext.response, cors);
  }

  const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
  if (!MAPBOX_TOKEN) return jsonRes({ error: "Mapbox token not configured" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const backfill = body?.backfill === true;
  const rawLimit = Number(body?.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 50) : BATCH_LIMIT;

  let selectQuery = supabase
    .from("service_route_metrics")
    .select("service_id")
    .is("matched_computed_at", null)
    .order("computed_at", { ascending: true })
    .limit(limit);
  if (!backfill) selectQuery = selectQuery.gte("computed_at", CUTOFF_DATE);

  const { data: rows, error: rowsError } = await selectQuery;
  if (rowsError) return jsonRes({ error: rowsError.message }, 500);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const serviceId = (row as { service_id: string }).service_id;
    processed += 1;
    try {
      const outcome = await computeForService(supabase, serviceId, MAPBOX_TOKEN);
      if (outcome === "updated") updated += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      console.error("[compute-matched-route-metrics] service failed", serviceId, err instanceof Error ? err.message : String(err));
    }
  }

  return jsonRes({ processed, updated, skipped, failed });
});
