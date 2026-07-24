// Pipeline puro de Map Matching, compartido entre:
//  - mapbox-proxy (acción map_matching, Fase 1 — capa visual)
//  - compute-matched-route-metrics (Fase 2 — km reales por vía)
// Token Mapbox siempre server-side; este helper nunca corre en el cliente.

// --- Umbrales (ajustables tras validar con rutas reales) ---
export const MATCH_ACCURACY_MAX_METERS = 50; // se descartan puntos con accuracy mayor
export const MATCH_MIN_CONFIDENCE = 0.5;     // por debajo, el tramo cae a crudo
export const MATCH_MAX_CHUNK_COORDS = 100;   // límite duro de la Matching API
export const MATCH_RADIUS_MIN = 10;          // radius mínimo por punto (metros)
export const MATCH_RADIUS_MAX = 50;          // radius máximo por punto (metros)
export const MATCH_MAX_SPEED_KMH = 150;      // descarte de saltos GPS (mismo criterio que compute_service_route_metrics)

export interface MatchPoint {
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
}

export interface MatchedSegment {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  confidence: number;
  matched: boolean;
}

export interface MatchResult {
  segments: MatchedSegment[];
  /** Metros totales por vía: distance de Mapbox en chunks matcheados, haversine
   *  con descarte >150 km/h en chunks bajo umbral o con error de API. */
  totalMatchedMeters: number;
  /** Confianza promedio ponderada por la distancia de cada chunk (null si no hubo distancia). */
  avgConfidence: number | null;
  /** Chunks que llamaron a la Matching API (length >= 2). */
  apiRequests: number;
  /** Chunks cuya llamada a Mapbox falló (fetch throw o HTTP no-ok). Si
   *  apiErrors === apiRequests > 0 el matching falló completo para estos puntos. */
  apiErrors: number;
  /** Puntos tras el filtrado de accuracy/dedupe. */
  pointsUsed: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Filtrado previo al matching: descarta puntos imprecisos (accuracy > 50 m, o
 * accuracy nula cuando hay vecinos válidos) y deduplica coordenadas
 * consecutivas idénticas. Preserva el orden temporal.
 */
export function filterPointsForMatching(points: MatchPoint[]): MatchPoint[] {
  const hasAnyAccuracy = points.some((p) => typeof p.accuracy_meters === "number");

  const kept: MatchPoint[] = [];
  for (const p of points) {
    const acc = p.accuracy_meters;
    if (typeof acc === "number") {
      if (acc > MATCH_ACCURACY_MAX_METERS) continue;
    } else if (hasAnyAccuracy) {
      // Punto sin accuracy pero existen vecinos con accuracy válida → descartar.
      continue;
    }
    const prev = kept[kept.length - 1];
    if (prev && prev.latitude === p.latitude && prev.longitude === p.longitude) {
      continue; // dedupe consecutivo con misma lat/lng
    }
    kept.push(p);
  }
  return kept;
}

/** Ventanas de máximo 100 coords con 1 punto de solape entre ventanas. */
export function chunkPoints(points: MatchPoint[]): MatchPoint[][] {
  if (points.length <= MATCH_MAX_CHUNK_COORDS) return [points];
  const chunks: MatchPoint[][] = [];
  let start = 0;
  while (start < points.length) {
    const end = Math.min(start + MATCH_MAX_CHUNK_COORDS, points.length);
    chunks.push(points.slice(start, end));
    if (end >= points.length) break;
    start = end - 1; // solape de 1 punto con la ventana anterior
  }
  return chunks;
}

const rawLineString = (chunk: MatchPoint[]): MatchedSegment["geometry"] => ({
  type: "LineString",
  coordinates: chunk.map((p) => [p.longitude, p.latitude] as [number, number]),
});

/**
 * Distancia cruda del chunk por haversine, aplicando el mismo descarte de
 * velocidad implícita > 150 km/h que compute_service_route_metrics (jitter GPS).
 */
function rawChunkMeters(chunk: MatchPoint[]): number {
  let meters = 0;
  for (let i = 1; i < chunk.length; i++) {
    const a = chunk[i - 1];
    const b = chunk[i];
    const d = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    const minutes = (new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()) / 60000;
    const speedKmh = minutes > 0 ? (d / 1000) / (minutes / 60) : 0;
    if (speedKmh <= MATCH_MAX_SPEED_KMH) meters += d;
  }
  return meters;
}

/**
 * Matchea un chunk contra la Matching API de Mapbox. Nunca lanza: ante cualquier
 * fallo (rate limit, 5xx, sin matching, confianza baja) devuelve el tramo crudo
 * con matched:false y su distancia haversine, para no reventar el pipeline por un
 * solo chunk.
 */
async function matchChunk(
  chunk: MatchPoint[],
  token: string,
): Promise<{ segment: MatchedSegment; called: boolean; meters: number; apiError: boolean }> {
  if (chunk.length < 2) {
    return {
      segment: { geometry: rawLineString(chunk), confidence: 0, matched: false },
      called: false,
      meters: 0,
      apiError: false,
    };
  }

  const coords = chunk.map((p) => `${p.longitude},${p.latitude}`).join(";");
  // La Matching API exige timestamps estrictamente crecientes. Los puntos ya
  // vienen ordenados por recorded_at, pero dos lecturas en el mismo segundo
  // (colisión de epoch) harían fallar el chunk entero → forzamos monotonía.
  let prevTs = -Infinity;
  const timestamps = chunk
    .map((p) => {
      let ts = Math.floor(new Date(p.recorded_at).getTime() / 1000);
      if (ts <= prevTs) ts = prevTs + 1;
      prevTs = ts;
      return ts;
    })
    .join(";");
  const radiuses = chunk
    .map((p) => clamp(p.accuracy_meters ?? MATCH_RADIUS_MAX, MATCH_RADIUS_MIN, MATCH_RADIUS_MAX))
    .join(";");

  const url =
    `https://api.mapbox.com/matching/v5/mapbox/driving/${coords}` +
    `?access_token=${token}&geometries=geojson&overview=full&tidy=true` +
    `&timestamps=${timestamps}&radiuses=${radiuses}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const matching = res.ok ? data?.matchings?.[0] : undefined;
    const confidence = typeof matching?.confidence === "number" ? matching.confidence : 0;

    if (matching?.geometry && confidence >= MATCH_MIN_CONFIDENCE) {
      const meters = typeof matching.distance === "number" ? matching.distance : rawChunkMeters(chunk);
      return {
        segment: { geometry: matching.geometry, confidence, matched: true },
        called: true,
        meters,
        apiError: false,
      };
    }
    // Respuesta válida bajo umbral (apiError:false) vs HTTP no-ok / rate limit (apiError:true).
    return {
      segment: { geometry: rawLineString(chunk), confidence, matched: false },
      called: true,
      meters: rawChunkMeters(chunk),
      apiError: !res.ok,
    };
  } catch (_err) {
    return {
      segment: { geometry: rawLineString(chunk), confidence: 0, matched: false },
      called: true,
      meters: rawChunkMeters(chunk),
      apiError: true,
    };
  }
}

/**
 * Corre el pipeline completo sobre puntos crudos ordenados por recorded_at.
 * Devuelve segmentos (para la capa visual), metros totales por vía, confianza
 * ponderada por distancia y cantidad de llamadas a Mapbox.
 */
export async function runMapMatching(rawPoints: MatchPoint[], token: string): Promise<MatchResult> {
  const filtered = filterPointsForMatching(rawPoints);
  const pointsUsed = filtered.length;

  const segments: MatchedSegment[] = [];
  let apiRequests = 0;
  let apiErrors = 0;
  let totalMatchedMeters = 0;
  let weightedConfSum = 0;
  let weightSum = 0;

  if (pointsUsed >= 2) {
    for (const chunk of chunkPoints(filtered)) {
      const { segment, called, meters, apiError } = await matchChunk(chunk, token);
      segments.push(segment);
      if (called) apiRequests += 1;
      if (apiError) apiErrors += 1;
      totalMatchedMeters += meters;
      weightedConfSum += segment.confidence * meters;
      weightSum += meters;
    }
  }

  const avgConfidence = weightSum > 0 ? weightedConfSum / weightSum : null;

  return { segments, totalMatchedMeters, avgConfidence, apiRequests, apiErrors, pointsUsed };
}
