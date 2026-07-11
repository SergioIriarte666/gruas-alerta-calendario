import { createLogger } from '@/lib/logger';

const logger = createLogger('LocationParser');

// Chile continental + insular cercano: descarta pares que claramente no
// corresponden a una direccion local (typos, telefonos, fechas capturadas
// por error) y habilita la auto-correccion de pares lat/lng invertidos.
const CHILE_LAT_RANGE: [number, number] = [-56, -17];
const CHILE_LNG_RANGE: [number, number] = [-76, -66];

const inRange = (value: number, [min, max]: [number, number]) => value >= min && value <= max;

const isPlausibleChileCoords = (lat: number, lng: number) =>
  inRange(lat, CHILE_LAT_RANGE) && inRange(lng, CHILE_LNG_RANGE);

// Normaliza variantes tipograficas de guion/menos que llegan por copy-paste
// (WhatsApp, notas de iOS, etc.) a un hyphen-minus estandar.
const normalizeDashes = (input: string) => input.replace(/[‐‑‒–—−]/g, '-');

const toDecimal = (raw: string): number => parseFloat(raw.replace(',', '.'));

export type LocationParseSource = 'decimal' | 'dms' | 'gmaps_url' | 'gmaps_url_center';

export interface ParsedLocationCoords {
  lat: number;
  lng: number;
  source: LocationParseSource;
}

export interface ParsedLocationNeedsServerResolve {
  needsServerResolve: true;
  url: string;
}

export interface ParsedLocationUnresolvedUrl {
  error: 'unresolvable_url';
}

export type ParsedLocation =
  | ParsedLocationCoords
  | ParsedLocationNeedsServerResolve
  | ParsedLocationUnresolvedUrl;

const DECIMAL_PAIR_REGEX = /(-?\d{1,2}[.,]\d{3,})[,;\s]+(-?\d{1,3}[.,]\d{3,})/;

const tryParseDecimalPair = (input: string): ParsedLocationCoords | null => {
  const match = DECIMAL_PAIR_REGEX.exec(input);
  if (!match) return null;

  const a = toDecimal(match[1]);
  const b = toDecimal(match[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  if (isPlausibleChileCoords(a, b)) {
    return { lat: a, lng: b, source: 'decimal' };
  }

  if (isPlausibleChileCoords(b, a)) {
    logger.info('Par de coordenadas invertido detectado y corregido automaticamente', {
      original: [a, b],
      corrected: [b, a],
    });
    return { lat: b, lng: a, source: 'decimal' };
  }

  return null;
};

// Tolera los simbolos ASCII (' ") y las variantes tipograficas que el
// autocorrector de los telefonos suele introducir (' " y los primes ′ ″).
const DMS_TOKEN_REGEX = /(\d{1,3})°\s*(\d{1,2})['’′]\s*(\d{1,2}(?:[.,]\d+)?)?["”″]?\s*([NSEWnsew])/g;

const dmsToDecimal = (degrees: number, minutes: number, seconds: number, direction: string): number => {
  const magnitude = degrees + minutes / 60 + seconds / 3600;
  return direction === 'S' || direction === 'W' ? -magnitude : magnitude;
};

const tryParseDms = (input: string): ParsedLocationCoords | null => {
  const tokens = [...input.matchAll(DMS_TOKEN_REGEX)];
  if (tokens.length < 2) return null;

  let lat: number | null = null;
  let lng: number | null = null;

  for (const token of tokens) {
    const degrees = parseInt(token[1], 10);
    const minutes = parseInt(token[2], 10);
    const seconds = token[3] ? parseFloat(token[3].replace(',', '.')) : 0;
    const direction = token[4].toUpperCase();
    const decimal = dmsToDecimal(degrees, minutes, seconds, direction);

    if (direction === 'N' || direction === 'S') {
      lat = decimal;
    } else {
      lng = decimal;
    }
  }

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (!isPlausibleChileCoords(lat, lng)) return null;

  return { lat, lng, source: 'dms' };
};

const SHORT_URL_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const LONG_URL_HOSTS = new Set(['google.com', 'www.google.com']);

const EXACT_PIN_REGEX = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const VIEWPORT_CENTER_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

/** Aplica el mismo parseo que el servidor (resolve_link) usa sobre la URL final. */
export const parseGoogleMapsLongUrl = (url: string): ParsedLocationCoords | null => {
  const exactPin = EXACT_PIN_REGEX.exec(url);
  if (exactPin) {
    const lat = parseFloat(exactPin[1]);
    const lng = parseFloat(exactPin[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng, source: 'gmaps_url' };
    }
  }

  const center = VIEWPORT_CENTER_REGEX.exec(url);
  if (center) {
    const lat = parseFloat(center[1]);
    const lng = parseFloat(center[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng, source: 'gmaps_url_center' };
    }
  }

  return null;
};

const parseAsUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
};

const tryParseGoogleMapsUrl = (input: string): ParsedLocation | null => {
  const url = parseAsUrl(input);
  if (!url) return null;

  const host = url.hostname.toLowerCase();

  if (SHORT_URL_HOSTS.has(host)) {
    return { needsServerResolve: true, url: url.toString() };
  }

  if (LONG_URL_HOSTS.has(host) && url.pathname.startsWith('/maps')) {
    const parsed = parseGoogleMapsLongUrl(url.toString());
    return parsed ?? { error: 'unresolvable_url' };
  }

  return null;
};

/**
 * Cascada nivel 0: intenta interpretar el input como una ubicacion explicita
 * (coordenadas decimales, DMS, o link de Google Maps) antes de tratarlo como
 * texto de direccion para la cascada catalogo -> Places -> Geocoding.
 * Devuelve null cuando el input no matchea ningun formato de ubicacion
 * explicita (texto de direccion normal, seguir con la cascada de siempre).
 */
export function parseLocationInput(input: string): ParsedLocation | null {
  const trimmed = normalizeDashes(input.trim());
  if (!trimmed) return null;

  const urlResult = tryParseGoogleMapsUrl(trimmed);
  if (urlResult) return urlResult;

  return tryParseDecimalPair(trimmed) ?? tryParseDms(trimmed);
}
