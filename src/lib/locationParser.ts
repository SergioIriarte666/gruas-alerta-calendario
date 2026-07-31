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

/**
 * Union discriminada con lo que el input de direccion puede ser. El consumidor
 * decide la ruta de resolucion a partir de `kind`; 'text' es el caso normal que
 * baja por la cascada catalogo -> autocomplete -> text_search -> geocode.
 */
export type ParsedLocationInput =
  | { kind: 'coords'; lat: number; lng: number; source: LocationParseSource }
  | { kind: 'short_link'; url: string }
  | { kind: 'long_url'; url: string; lat?: number; lng?: number }
  | { kind: 'plus_code_global'; code: string }
  | { kind: 'plus_code_local'; code: string }
  | { kind: 'text'; value: string };

// Alfabeto oficial de Open Location Code (20 caracteres).
const OLC = '[23456789CFGHJMPQRVWX]';

/** Plus code global: 8 caracteres + "+" + 2 o 3. Ej: 575FCMMC+QQ */
export const PLUS_CODE_GLOBAL = new RegExp(`^${OLC}{8}\\+${OLC}{2,3}$`, 'i');

/** Plus code local/corto: requiere localidad adjunta. Ej: M939+CF Copiapo */
export const PLUS_CODE_LOCAL = new RegExp(`^${OLC}{4,6}\\+${OLC}{2,3}\\s+\\S.*$`, 'i');

// Un plus code al inicio de un texto cualquiera. Sirve para detectar cuando
// Google devuelve el plus code como "direccion" y evitar mostrarlo pelado.
const PLUS_CODE_PREFIX = new RegExp(`^${OLC}{4,8}\\+${OLC}{2,3}\\b`, 'i');

/**
 * True cuando una etiqueta empieza con un plus code ("575FCMMC+QQ", o
 * "575FCMMC+QQ Chanaral, Atacama"): nunca debe quedar visible en el campo si
 * existe una alternativa legible.
 */
export const startsWithPlusCode = (label: string | null | undefined): boolean =>
  !!label && PLUS_CODE_PREFIX.test(label.trim());

const DECIMAL_PAIR_REGEX = /(-?\d{1,2}[.,]\d{3,})[,;\s]+(-?\d{1,3}[.,]\d{3,})/;

const tryParseDecimalPair = (input: string): { lat: number; lng: number; source: LocationParseSource } | null => {
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

const tryParseDms = (input: string): { lat: number; lng: number; source: LocationParseSource } | null => {
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
const LONG_URL_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com']);

const EXACT_PIN_REGEX = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const VIEWPORT_CENTER_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

/** Aplica el mismo parseo que el servidor (resolve_link) usa sobre la URL final. */
export const parseGoogleMapsLongUrl = (
  url: string,
): { lat: number; lng: number; source: LocationParseSource } | null => {
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

const tryParseGoogleMapsUrl = (input: string): ParsedLocationInput | null => {
  const url = parseAsUrl(input);
  if (!url) return null;

  const host = url.hostname.toLowerCase();

  if (SHORT_URL_HOSTS.has(host)) {
    return { kind: 'short_link', url: url.toString() };
  }

  if (LONG_URL_HOSTS.has(host) && url.pathname.startsWith('/maps')) {
    const parsed = parseGoogleMapsLongUrl(url.toString());
    // Sin coordenadas en la URL (link de "place" sin data=!3d!4d) se delega al
    // servidor: resolve_link sigue los redirects y devuelve el pin real.
    return parsed
      ? { kind: 'long_url', url: url.toString(), lat: parsed.lat, lng: parsed.lng }
      : { kind: 'long_url', url: url.toString() };
  }

  return null;
};

/**
 * Clasifica el input del campo de direccion, del formato mas especifico al mas
 * generico. Los links de Google Maps se evaluan ANTES que el par decimal suelto:
 * una URL larga contiene tanto el pin exacto (!3d!4d) como el centro del
 * encuadre (@lat,lng), y el scanner de decimales tomaria el encuadre —
 * devolviendo un punto a cientos de metros del lugar apuntado.
 */
export function parseLocationInput(raw: string): ParsedLocationInput {
  const trimmed = normalizeDashes(raw.trim()).replace(/\s+/g, ' ');
  if (!trimmed) return { kind: 'text', value: '' };

  const urlResult = tryParseGoogleMapsUrl(trimmed);
  if (urlResult) return urlResult;

  const coords = tryParseDecimalPair(trimmed) ?? tryParseDms(trimmed);
  if (coords) return { kind: 'coords', ...coords };

  if (PLUS_CODE_GLOBAL.test(trimmed)) {
    return { kind: 'plus_code_global', code: trimmed.toUpperCase() };
  }

  if (PLUS_CODE_LOCAL.test(trimmed)) {
    // Solo el codigo va en mayusculas; la localidad adjunta se conserva tal cual
    // porque es la que permite resolver un plus code corto.
    const [code, ...rest] = trimmed.split(' ');
    return { kind: 'plus_code_local', code: [code.toUpperCase(), ...rest].join(' ') };
  }

  return { kind: 'text', value: trimmed };
}
