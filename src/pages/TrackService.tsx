import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Coffee,
  Fuel,
  Loader2,
  MapPin,
  PauseCircle,
  Phone,
  Ticket,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { getCraneTypeLabel } from '@/utils/craneType';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const logger = createLogger('PublicTracking');

const POLL_INTERVAL_MS = 15000;
const RELATIVE_TIME_TICK_MS = 10000;
const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const DEFAULT_ZOOM = 13;
// Distancia grua-origen mas alla de la cual el dato de origen se considera
// sospechoso (p.ej. geocoding de baja calidad que devolvio un centroide lejano)
// y se ignora en el encuadre del mapa.
const MAX_PLAUSIBLE_ORIGIN_DISTANCE_KM = 300;

const EARTH_RADIUS_KM = 6371;

const LOGO_SRC = '/logo-gruas-5-norte.png';
const COMPANY_NAME = 'Grúas 5 Norte';
const COMPANY_LOCATION = 'Copiapó';
// Fallback si Configuracion > Empresa > "Contacto operativo" esta vacio: el
// backend (service-tracking) manda ese valor como support_phone; este es
// solo el respaldo para que el boton nunca quede roto/sin numero.
const DEFAULT_COMPANY_PHONE_E164 = '+56962380627';

// El valor guardado en Configuracion trae formato "+56 9 1234 5678" (ver
// PhoneInput): quitar espacios para armar un href tel: valido.
const toTelHref = (phone: string): string => `tel:${phone.replace(/\s+/g, '')}`;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PULSE_STYLE_ID = 'tm-marker-pulse-style';

// Inyectado una sola vez: Mapbox renderiza los marcadores como elementos DOM
// planos, no hay forma de usar CSS-in-JS/modulos aqui.
const ensurePulseStyleInjected = () => {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes tm-pulse-ring {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
};

// Trazos de lucide-react (Truck / MapPin) embebidos a mano: los marcadores de
// Mapbox son elementos DOM crudos, fuera del arbol de React.
const TRUCK_ICON_PATHS = `
  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
  <path d="M15 18H9" />
  <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
  <circle cx="17" cy="18" r="2" />
  <circle cx="7" cy="18" r="2" />
`;

const MAP_PIN_ICON_PATH = `
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
  <circle cx="12" cy="10" r="3" />
`;

// Flecha de rumbo: apunta al norte sin rotar, la rotacion la aplica el
// contenedor. Va RELLENA y con contorno blanco a proposito — el movil avanza
// por la ruta, asi que la flecha siempre queda sobre la polyline morada; un
// chevron de solo trazo en color primario desaparecia encima de ella.
const HEADING_ARROW_PATH = `<path d="M12 3 L19.5 20 L12 15.5 L4.5 20 Z" />`;

const CRANE_MARKER_SIZE = 48;
const CRANE_ICON_SIZE = 28;
// Logo dentro del circulo del movil: ~70% del diametro interior (48 - 2px de
// borde a cada lado = 44), para que no toque el borde.
const CRANE_LOGO_SIZE = 31;
// Flecha de rumbo montada en el borde exterior del circulo. Es lo UNICO que
// rota con heading_degrees: el logo va siempre derecho.
const HEADING_ARROW_SIZE = 16;

type TrackingColorToken =
  | '--primary'
  | '--muted-foreground'
  | '--signature-surface';

// Mapbox requiere HSL legacy con comas; los tokens CSS se guardan con la
// sintaxis moderna "h s% l%". Si el token no existe, la capa queda
// transparente en lugar de introducir un color fijo ajeno al tema.
const resolveTrackingColor = (token: TrackingColorToken): string => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const parts = raw.split(/\s+/);
  if (parts.length !== 3) return 'transparent';
  const [h, s, l] = parts;
  return `hsl(${h}, ${s}, ${l})`;
};

const createCraneMarkerElement = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = `${CRANE_MARKER_SIZE}px`;
  wrapper.style.height = `${CRANE_MARKER_SIZE}px`;

  const ring = document.createElement('div');
  ring.className = 'tm-crane-pulse';
  ring.style.position = 'absolute';
  ring.style.inset = '0';
  ring.style.borderRadius = '9999px';

  const circle = document.createElement('div');
  circle.className = 'tm-crane-circle';
  circle.style.position = 'absolute';
  circle.style.inset = '0';
  circle.style.borderRadius = '9999px';
  circle.style.backgroundColor = 'hsl(var(--signature-surface))';
  circle.style.boxShadow = '0 4px 12px hsl(var(--overlay) / 0.35)';
  circle.style.display = 'flex';
  circle.style.alignItems = 'center';
  circle.style.justifyContent = 'center';

  // Logo de la marca, mismo asset que el header de la pagina (LOGO_SRC): una
  // <img> raster, sin canvas — Safari iOS corre esto dentro de WKWebView y un
  // canvas por marcador es justamente lo que conviene evitar ahi.
  const logo = document.createElement('img');
  logo.src = LOGO_SRC;
  logo.alt = '';
  logo.decoding = 'async';
  logo.style.width = `${CRANE_LOGO_SIZE}px`;
  logo.style.height = `${CRANE_LOGO_SIZE}px`;
  logo.style.objectFit = 'contain';
  logo.style.display = 'block';
  logo.style.pointerEvents = 'none';

  // Fallback: si el asset no carga, se muestra el SVG de grua de siempre. Queda
  // en el DOM oculto desde el inicio, no se construye a posteriori.
  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'tm-crane-icon';
  iconWrapper.style.width = `${CRANE_ICON_SIZE}px`;
  iconWrapper.style.height = `${CRANE_ICON_SIZE}px`;
  iconWrapper.style.display = 'none';
  iconWrapper.innerHTML = `<svg width="${CRANE_ICON_SIZE}" height="${CRANE_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRUCK_ICON_PATHS}</svg>`;

  logo.addEventListener('error', () => {
    logo.style.display = 'none';
    iconWrapper.style.display = 'block';
  });

  // Contenedor concentrico al circulo que SOLO existe para el rumbo: el chevron
  // va montado en el borde superior, asi que rotar el contenedor lo hace
  // orbitar hasta la direccion de avance (0deg = norte, igual que la brujula).
  const headingWrapper = document.createElement('div');
  headingWrapper.style.position = 'absolute';
  headingWrapper.style.inset = '0';
  headingWrapper.style.transition = 'transform 0.3s ease';
  headingWrapper.style.pointerEvents = 'none';
  headingWrapper.style.display = 'none';

  const chevron = document.createElement('div');
  chevron.style.position = 'absolute';
  chevron.style.top = `-${Math.round(HEADING_ARROW_SIZE * 0.6)}px`;
  chevron.style.left = '50%';
  chevron.style.transform = 'translateX(-50%)';
  chevron.style.lineHeight = '0';
  chevron.style.filter = 'drop-shadow(0 1px 2px hsl(var(--overlay) / 0.35))';
  chevron.innerHTML = `<svg width="${HEADING_ARROW_SIZE}" height="${HEADING_ARROW_SIZE}" viewBox="0 0 24 24" stroke="hsl(var(--signature-surface))" stroke-width="2.5" stroke-linejoin="round">${HEADING_ARROW_PATH}</svg>`;

  headingWrapper.appendChild(chevron);

  circle.appendChild(logo);
  circle.appendChild(iconWrapper);
  wrapper.appendChild(ring);
  wrapper.appendChild(circle);
  wrapper.appendChild(headingWrapper);

  return { wrapper, ring, circle, iconWrapper, logo, headingWrapper, chevron };
};

const updateCraneMarkerElement = (
  refs: ReturnType<typeof createCraneMarkerElement>,
  heading: number | null,
  isActive: boolean,
) => {
  const color = isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
  refs.circle.style.border = `2px solid ${color}`;
  const svg = refs.iconWrapper.querySelector('svg');
  if (svg) svg.setAttribute('stroke', color);

  // El logo va SIEMPRE derecho: el rumbo lo indica el chevron del borde, que es
  // lo unico que rota. Sin heading el chevron se oculta en vez de quedar
  // apuntando al norte por defecto (seria una direccion inventada).
  // La flecha es rellena: el color de estado va en el fill, el contorno queda
  // blanco para que se despegue de la polyline morada que hay debajo.
  const chevronSvg = refs.chevron.querySelector('svg');
  if (chevronSvg) chevronSvg.setAttribute('fill', color);
  if (typeof heading === 'number') {
    refs.headingWrapper.style.display = 'block';
    refs.headingWrapper.style.transform = `rotate(${heading}deg)`;
  } else {
    refs.headingWrapper.style.display = 'none';
  }

  const animate = isActive && !prefersReducedMotion();
  refs.ring.style.backgroundColor = animate ? 'hsl(var(--primary))' : 'transparent';
  refs.ring.style.animation = animate ? 'tm-pulse-ring 2s ease-out infinite' : 'none';
};

const ORIGIN_LABEL_MAX_CHARS = 24;

// El texto de origen viene tal como se tipeo en el formulario (p.ej.
// "salares norte"): se capitaliza solo para mostrar, sin tocar el dato.
const toTitleCase = (text: string): string =>
  text.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

const truncateLabel = (text: string): string =>
  text.length > ORIGIN_LABEL_MAX_CHARS ? `${text.slice(0, ORIGIN_LABEL_MAX_CHARS).trimEnd()}…` : text;

const createOriginMarkerElement = () => {
  // Ancla de tamano cero: el pin se dibuja hacia arriba desde este punto (su
  // punta queda exactamente en la coordenada) y la etiqueta se posiciona
  // debajo, sin desplazar el punto de anclaje real usado por Mapbox.
  const anchor = document.createElement('div');
  anchor.style.position = 'relative';
  anchor.style.width = '0px';
  anchor.style.height = '0px';

  const pin = document.createElement('div');
  pin.style.position = 'absolute';
  pin.style.bottom = '0';
  pin.style.left = '0';
  pin.style.transform = 'translate(-50%, 0)';
  pin.style.lineHeight = '0';
  pin.innerHTML = `<svg width="32" height="40" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="hsl(var(--signature-surface))" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px hsl(var(--overlay) / 0.35));">${MAP_PIN_ICON_PATH}</svg>`;

  const label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.top = '6px';
  label.style.left = '0';
  label.style.transform = 'translate(-50%, 0)';
  label.style.whiteSpace = 'nowrap';
  label.style.backgroundColor = 'hsl(var(--signature-surface))';
  label.style.borderRadius = '9999px';
  label.style.padding = '2px 8px';
  label.style.boxShadow = '0 2px 6px hsl(var(--overlay) / 0.25)';
  label.style.fontSize = '11px';
  label.style.fontWeight = '600';
  label.style.color = 'hsl(var(--signature-ink))';

  anchor.appendChild(pin);
  anchor.appendChild(label);

  return { anchor, label };
};

// +38% sobre los 26px originales: a zoom alejado (ruta Copiapo-La Coipa entera
// en pantalla de iPhone) el numero era ilegible. El movil sigue siendo el
// elemento mas grande del mapa (48px) para no perder la jerarquia visual.
const STOP_MARKER_SIZE = 36;
const STOP_NUMBER_FONT_SIZE = 16;
const STOP_FLAG_SIZE = 20;

// Bandera de meta (lucide Flag) para la parada stop_type 'final'.
const FLAG_ICON_PATHS = `
  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
  <line x1="4" x2="4" y1="22" y2="15" />
`;

// Marcador numerado de parada (multidestino). Elemento DOM crudo, igual que
// el resto de los marcadores de Mapbox: circulo con número/check + anillo de
// pulso (solo la próxima) + bandera para la parada final + label en
// hover (desktop) o tap (móvil).
const createStopMarkerElement = () => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = `${STOP_MARKER_SIZE}px`;
  wrapper.style.height = `${STOP_MARKER_SIZE}px`;
  wrapper.style.cursor = 'pointer';

  const ring = document.createElement('div');
  ring.style.position = 'absolute';
  ring.style.inset = '0';
  ring.style.borderRadius = '9999px';

  const circle = document.createElement('div');
  circle.style.position = 'absolute';
  circle.style.inset = '0';
  circle.style.borderRadius = '9999px';
  circle.style.display = 'flex';
  circle.style.alignItems = 'center';
  circle.style.justifyContent = 'center';
  circle.style.fontSize = `${STOP_NUMBER_FONT_SIZE}px`;
  circle.style.fontWeight = '700';
  circle.style.border = '2px solid hsl(var(--signature-surface))';
  circle.style.boxShadow = '0 2px 6px hsl(var(--overlay) / 0.3)';

  const flag = document.createElement('div');
  flag.style.position = 'absolute';
  flag.style.top = '-7px';
  flag.style.right = '-7px';
  flag.style.width = `${STOP_FLAG_SIZE}px`;
  flag.style.height = `${STOP_FLAG_SIZE}px`;
  flag.style.borderRadius = '9999px';
  flag.style.backgroundColor = 'hsl(var(--signature-surface))';
  flag.style.boxShadow = '0 1px 3px hsl(var(--overlay) / 0.3)';
  flag.style.display = 'none';
  flag.style.alignItems = 'center';
  flag.style.justifyContent = 'center';
  flag.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--signature-ink))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${FLAG_ICON_PATHS}</svg>`;

  const label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.top = `${STOP_MARKER_SIZE + 6}px`;
  label.style.left = '50%';
  label.style.transform = 'translateX(-50%)';
  label.style.display = 'none';
  label.style.whiteSpace = 'nowrap';
  label.style.backgroundColor = 'hsl(var(--signature-surface))';
  label.style.borderRadius = '9999px';
  label.style.padding = '2px 8px';
  label.style.boxShadow = '0 2px 6px hsl(var(--overlay) / 0.25)';
  label.style.fontSize = '11px';
  label.style.fontWeight = '600';
  label.style.color = 'hsl(var(--signature-ink))';
  label.style.pointerEvents = 'none';

  // hover en desktop, tap (click) en móvil; el click no debe llegar al mapa.
  wrapper.addEventListener('mouseenter', () => {
    label.style.display = 'block';
  });
  wrapper.addEventListener('mouseleave', () => {
    label.style.display = 'none';
  });
  wrapper.addEventListener('click', (event) => {
    event.stopPropagation();
    label.style.display = label.style.display === 'block' ? 'none' : 'block';
  });

  wrapper.appendChild(ring);
  wrapper.appendChild(circle);
  wrapper.appendChild(flag);
  wrapper.appendChild(label);

  return { wrapper, ring, circle, flag, label };
};

// Alcanzada: atenuada con check. Próxima (next_stop): destacada en color
// primario con pulso coherente con el del móvil. Futuras: estilo neutro.
// visualNumber = orden 1..n SOLO entre paradas con coordenadas.
const updateStopMarkerElement = (
  refs: ReturnType<typeof createStopMarkerElement>,
  stop: TrackingStop,
  isNext: boolean,
  visualNumber: number,
) => {
  const { ring, circle, flag, label } = refs;

  if (stop.reached) {
    circle.style.backgroundColor = 'hsl(var(--muted-foreground))';
    circle.style.color = 'hsl(var(--signature-surface))';
    circle.style.opacity = '0.55';
    circle.textContent = '✓';
  } else if (isNext) {
    circle.style.backgroundColor = 'hsl(var(--primary))';
    circle.style.color = 'hsl(var(--signature-surface))';
    circle.style.opacity = '1';
    circle.textContent = String(visualNumber);
  } else {
    circle.style.backgroundColor = 'hsl(var(--signature-surface))';
    circle.style.color = 'hsl(var(--signature-ink))';
    circle.style.opacity = '1';
    circle.textContent = String(visualNumber);
  }

  const animate = isNext && !stop.reached && !prefersReducedMotion();
  ring.style.backgroundColor = animate ? 'hsl(var(--primary))' : 'transparent';
  ring.style.animation = animate ? 'tm-pulse-ring 2s ease-out infinite' : 'none';

  flag.style.display = stop.stop_type === 'final' ? 'flex' : 'none';
  label.textContent = stop.label;
};

const haversineDistanceKm = (a: [number, number], b: [number, number]): number => {
  const [lngA, latA] = a;
  const [lngB, latB] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Decodifica una polyline codificada de Google (mismo algoritmo que usa
// maps-proxy) — el backend de service-tracking envia la polyline sin
// decodificar, este es el unico consumidor.
const decodePolyline = (encoded: string): [number, number][] => {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
};

const ROUTE_SOURCE_ID = 'tm-route-source';
const ROUTE_CASING_LAYER_ID = 'tm-route-casing';
const ROUTE_LINE_LAYER_ID = 'tm-route-line';
// "Tramo fuera de ruta": Google rutea hasta el punto de red vial más cercano al
// destino, no hasta las coordenadas exactas. Con pines fuera de camino (faenas
// mineras en cordillera) el marcador quedaba visualmente despegado del final
// del trazado. Sobre este umbral el marcador se dibuja en el último vértice de
// la polyline (el punto navegable real) y un punteado gris lo une con las
// coordenadas crudas, igual que hace Google Maps.
const OFF_ROUTE_SNAP_METERS = 150;
// Guarda de cordura: un hueco absurdo significa que la polyline no corresponde
// al destino que creemos. Ahí NO se mueve nada — se degrada al comportamiento
// actual (pin en las coordenadas crudas) en vez de teletransportar el marcador.
const MAX_OFF_ROUTE_GAP_KM = 50;
const OFF_ROUTE_SOURCE_ID = 'tm-offroute-source';
const OFF_ROUTE_LAYER_ID = 'tm-offroute-line';
// Mapbox GL usa csscolorparser internamente, que solo entiende la sintaxis
// legacy "hsl(h, s%, l%)" con comas — la sintaxis moderna sin comas que usan
// los tokens del tema ("271 81% 56%") hace que addLayer falle en silencio
// (emite un error async, no lanza), dejando la capa sin dibujar. Bug real
// encontrado en producción: la polyline nunca se veía desde Fase 2 por esto.
const resolvePrimaryColor = (): string => resolveTrackingColor('--primary');

// > 60 min -> "4 h 54 min" (nunca "294 min").
const formatDurationLabel = (seconds: number): string => {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
};

// >= 10 km sin decimales, bajo eso con 1 decimal.
const formatDistanceLabel = (meters: number): string => {
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
};

/**
 * Hora local de la operación, 'HH:mm'.
 *
 * Esta página es pública y no importa el cliente Supabase (ver el fetch directo
 * contra SUPABASE_URL), así que no puede usar businessClock, que lee la TZ del
 * negocio desde la BD. Se fija la misma zona que businessClock usa de fallback.
 */
const OPERATION_TIMEZONE = 'America/Santiago';

const formatOperationTime = (isoTimestamp: string): string =>
  formatInTimeZone(new Date(isoTimestamp), OPERATION_TIMEZONE, 'HH:mm');

const formatRelativeShort = (isoTimestamp: string, nowMs: number): string => {
  const diffSec = Math.max(0, Math.round((nowMs - new Date(isoTimestamp).getTime()) / 1000));
  if (diffSec < 10) return 'justo ahora';
  if (diffSec < 60) return `hace ${diffSec} s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  return `hace ${diffDay} d`;
};

// Fuerza un re-render periodico para que los relativos ("hace X s") avancen
// solos entre polls. UI pura: Date.now() se lee en el render, no aqui.
const useTick = (intervalMs: number) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
};

type JourneyStage = 'assigned' | 'en_route' | 'on_site' | 'towing' | 'last_leg' | 'arrived' | 'finished';

const JOURNEY_STEPS: { key: JourneyStage; label: string }[] = [
  { key: 'assigned', label: 'Asignado' },
  { key: 'en_route', label: 'En camino' },
  { key: 'on_site', label: 'En el lugar' },
  { key: 'towing', label: 'Trasladando' },
  { key: 'finished', label: 'Finalizado' },
];

const STAGE_TITLES: Record<JourneyStage, string> = {
  assigned: 'Preparando tu servicio',
  en_route: 'Tu grúa va en camino',
  on_site: 'Tu grúa llegó al punto de origen',
  towing: 'Trasladando tu vehículo',
  // Etapas exclusivas de servicios multidestino (con paradas).
  last_leg: 'En la última etapa del recorrido',
  arrived: 'Llegamos al destino final',
  finished: 'Servicio finalizado',
};

// Pildora compacta: en 390px de ancho no entran los 5 labels completos, asi
// que solo se muestra el label del paso activo + puntos para el resto.
const JourneyStepper = ({ stage }: { stage: JourneyStage }) => {
  const currentIndex = JOURNEY_STEPS.findIndex((step) => step.key === stage);
  const currentLabel = JOURNEY_STEPS[currentIndex]?.label ?? JOURNEY_STEPS[0].label;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-2 shadow-md backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {JOURNEY_STEPS.map((step, index) => {
          const isDone = currentIndex >= 0 && index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <span key={step.key} className="relative flex size-2.5 items-center justify-center">
              {isCurrent && (
                <span className="motion-safe:animate-ping absolute inline-flex size-2.5 rounded-full bg-primary opacity-60" />
              )}
              <span
                className={cn(
                  'relative inline-block rounded-full transition-all',
                  isCurrent ? 'size-2.5 bg-primary' : isDone ? 'size-2 bg-primary/50' : 'size-2 bg-muted-foreground/30',
                )}
              />
            </span>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-foreground">{currentLabel}</span>
    </div>
  );
};

// Variante del stepper para servicios multidestino: un punto por parada,
// alcanzadas atenuadas, la próxima con pulso; el label muestra la parada
// objetivo. "Recorrido completado" SOLO llega vía `completed` (journey_stage
// arrived en estado activo): sin próxima parada por otra razón (waiting,
// paradas sin coordenadas) se muestra la fase preparatoria — nunca inferir
// "completado" desde la ausencia de next_stop (bug SRV-6853).
const StopsStepper = ({
  stops,
  nextStopOrder,
  completed,
  routeArmed = true,
}: {
  stops: TrackingStop[];
  nextStopOrder: number | null;
  completed: boolean;
  /** false = servicio aún no iniciado: paradas informativas, sin objetivo. */
  routeArmed?: boolean;
}) => {
  const currentLabel = !routeArmed
    ? 'Servicio no iniciado'
    : completed
      ? 'Recorrido completado'
      : nextStopOrder !== null
        ? stops.find((stop) => stop.order === nextStopOrder)?.label ?? 'En ruta'
        : 'Preparando el recorrido';

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-2 shadow-md backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {stops.map((stop) => {
          const isCurrent = nextStopOrder !== null && stop.order === nextStopOrder;
          const isDone = stop.reached;
          return (
            <span key={stop.order} className="relative flex size-2.5 items-center justify-center">
              {isCurrent && (
                <span className="motion-safe:animate-ping absolute inline-flex size-2.5 rounded-full bg-primary opacity-60" />
              )}
              <span
                className={cn(
                  'relative inline-block rounded-full transition-all',
                  isCurrent ? 'size-2.5 bg-primary' : isDone ? 'size-2 bg-primary/50' : 'size-2 bg-muted-foreground/30',
                )}
              />
            </span>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-foreground">{currentLabel}</span>
    </div>
  );
};

type TrackingState = 'active' | 'no_signal' | 'waiting' | 'finished';

// Parada de un servicio multidestino tal como la expone service-tracking.
interface TrackingStop {
  label: string;
  lat: number | null;
  lng: number | null;
  stop_type: 'pickup' | 'dropoff' | 'waypoint' | 'final';
  /** null = parada sin coordenadas: no verificable, no participa del motor. */
  reached: boolean | null;
  order: number;
}

interface TrackingResponse {
  state: TrackingState;
  folio: string;
  crane?: { plate: string; type: string } | null;
  operator_first_name?: string | null;
  position?: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    recorded_at: string;
  } | null;
  origin?: { lat: number | null; lng: number | null; text: string | null };
  // Destino del servicio. Las coordenadas se resuelven en el servidor recién al
  // entrar en "towing" y pueden ser null si el destino es texto no geocodable.
  destination?: { lat: number | null; lng: number | null; text: string | null };
  journey_stage?: JourneyStage;
  eta?: { seconds: number; distance_meters: number; polyline: string } | null;
  // Hacia dónde apunta el ETA: 'origin' antes de la carga, 'destination' desde
  // que el vehículo va cargado, 'stop' en multidestino. Manda el rótulo de la
  // tarjeta: mostrar "tu grúa llega en" con el ETA al destino (o viceversa) es
  // el bug de SRV-6858. Ausente en respuestas de versiones anteriores.
  eta_target?: 'origin' | 'destination' | 'stop';
  // true cuando el objetivo existe pero Google no puede rutear la zona: la UI
  // muestra distancia en línea recta en vez de "Calculando..." permanente.
  eta_unavailable?: boolean;
  support_phone?: string | null;
  // Solo presentes en servicios multidestino: sin paradas, la respuesta es
  // idéntica al flujo original.
  stops?: TrackingStop[];
  next_stop?: { label: string; order: number } | null;
  // false = servicio con recorrido pero aún no iniciado por el operador: las
  // paradas se muestran como pines informativos, sin guía ni ETA (SRV-6853).
  // Ausente en servicios sin paradas navegables (flujo original).
  route_armed?: boolean;
  // Detención declarada en curso. El backend expone SOLO motivo y hora: la nota
  // interna y el operador nunca salen al cliente. Mientras exista, el ETA queda
  // suspendido en vez de correr solo y llegar falso.
  stop_event?: { reason: StopReason; started_at: string } | null;
}

type StopReason = 'combustible' | 'alimentacion' | 'descanso' | 'peaje' | 'otro';

const STOP_REASON_LABELS: Record<StopReason, string> = {
  combustible: 'Combustible',
  alimentacion: 'Alimentación',
  descanso: 'Descanso',
  peaje: 'Peaje',
  otro: 'Detención',
};

const STOP_REASON_ICONS: Record<StopReason, typeof Fuel> = {
  combustible: Fuel,
  alimentacion: UtensilsCrossed,
  descanso: Coffee,
  peaje: Ticket,
  otro: PauseCircle,
};

type PageStatus = 'loading' | 'ready' | 'invalid' | 'error';

const useServiceTrackingPoll = (token: string | undefined) => {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [data, setData] = useState<TrackingResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;
    let finished = false;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const poll = async () => {
      if (document.hidden || finished) return;
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/service-tracking?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;

        if (!response.ok) {
          setStatus('invalid');
          return;
        }

        const json = (await response.json()) as TrackingResponse;
        setData(json);
        setStatus('ready');

        if (json.state === 'finished') {
          finished = true;
          stopPolling();
        }
      } catch (error) {
        if (cancelled) return;
        logger.warn('No se pudo obtener el estado de seguimiento', error);
        setStatus((prev) => (prev === 'ready' ? prev : 'error'));
      }
    };

    void poll();
    if (!finished) {
      intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    }

    const handleVisibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token]);

  return { status, data };
};

const TrackingMap = ({ data }: { data: TrackingResponse }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const mapboxRef = useRef<MapboxModule | null>(null);
  const craneMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const craneElRefs = useRef<ReturnType<typeof createCraneMarkerElement> | null>(null);
  const originMarkerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const originElRefs = useRef<ReturnType<typeof createOriginMarkerElement> | null>(null);
  // Marcadores de paradas (multidestino), indexados por stop_order. Se crean
  // una vez y se MUTAN en cada poll (check de alcanzadas, cambio de destacada)
  // sin recrearlos.
  const stopMarkersRef = useRef<Map<number, { marker: import('mapbox-gl').Marker; refs: ReturnType<typeof createStopMarkerElement> }>>(new Map());
  // Encuadre: solo se recalcula cuando cambia la parada objetivo (o aparece la
  // primera posición del móvil), no en cada poll — no pelear con el usuario
  // que movió el mapa a mano.
  const lastFitKeyRef = useRef<string | null>(null);
  const [mapboxReady, setMapboxReady] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // La polyline se decodifica UNA vez por cadena recibida: mientras el backend
  // sirva el mismo trazado (caché de 60 s + polls de 15 s) el resultado es
  // idéntico por identidad, así que el marcador ajustado no se recoloca ni
  // parpadea entre polls.
  const routeCoords = useMemo(
    () => (data.eta?.polyline ? decodePolyline(data.eta.polyline) : []),
    [data.eta?.polyline],
  );

  // Solo la parada OBJETIVO del ETA se ajusta: es la única cuyo destino Google
  // realmente ruteó. El resto conserva sus coordenadas crudas.
  const targetStop = data.next_stop
    ? (data.stops ?? []).find(
        (stop) => stop.order === data.next_stop?.order && stop.lat != null && stop.lng != null,
      ) ?? null
    : null;
  const targetOrder = targetStop?.order ?? null;
  const targetLng = targetStop?.lng ?? null;
  const targetLat = targetStop?.lat ?? null;

  // Dependencias primitivas a propósito: `data.stops` es un array nuevo en cada
  // poll, memorizar sobre él reintroduciría el parpadeo que esto evita.
  const offRouteTail = useMemo(() => {
    const routeEnd = routeCoords.length > 1 ? routeCoords[routeCoords.length - 1] : null;
    if (!routeEnd || targetLng == null || targetLat == null) return null;

    const rawStop: [number, number] = [targetLng, targetLat];
    const gapKm = haversineDistanceKm(routeEnd, rawStop);
    if (gapKm * 1000 <= OFF_ROUTE_SNAP_METERS) return null;
    if (gapKm > MAX_OFF_ROUTE_GAP_KM) {
      logger.warn('Fin de ruta implausiblemente lejos de la parada objetivo, se ignora el ajuste', {
        gapKm: Math.round(gapKm),
      });
      return null;
    }
    return { anchor: routeEnd, rawStop };
  }, [routeCoords, targetLng, targetLat]);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    ensurePulseStyleInjected();

    let cancelled = false;
    let localMap: import('mapbox-gl').Map | null = null;

    void loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || !containerRef.current) return;

        mapboxRef.current = mapboxgl;
        mapboxgl.default.accessToken = MAPBOX_TOKEN;

        localMap = new mapboxgl.default.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: COPIAPO_CENTER,
          zoom: 13,
        });
        localMap.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'top-right');
        // addSource/addLayer (linea de ruta) exigen que el estilo ya haya
        // cargado; los Marker DOM no, por eso mapboxReady no basta para ellos.
        localMap.once('load', () => {
          if (!cancelled) setStyleLoaded(true);
        });
        mapRef.current = localMap;
        setMapboxReady(true);
      })
      .catch((error) => {
        logger.error('No se pudo cargar el mapa', error);
      });

    return () => {
      cancelled = true;
      setMapboxReady(false);
      setStyleLoaded(false);
      craneMarkerRef.current?.remove();
      craneMarkerRef.current = null;
      craneElRefs.current = null;
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      originElRefs.current = null;
      stopMarkersRef.current.forEach(({ marker }) => marker.remove());
      stopMarkersRef.current.clear();
      localMap?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapboxReady) return;

    // Linea de ruta hasta el origen: casing blanco ancho 8 debajo + linea
    // color primario ancho 4.5 encima, ambas bajo los marcadores (los
    // marcadores son elementos DOM, no layers del mapa GL).
    if (styleLoaded) {
      const routeData = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: routeCoords },
      };

      const existingSource = map.getSource(ROUTE_SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(routeData);
      } else if (routeCoords.length > 1) {
        map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: routeData });
        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': resolveTrackingColor('--signature-surface'), 'line-width': 8, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': resolvePrimaryColor(), 'line-width': 4.5 },
        });
      }

      // Tramo fuera de ruta (punteado gris): del fin del trazado navegable a
      // las coordenadas crudas de la parada objetivo. Sin ajuste aplicable la
      // capa queda con geometría vacía en vez de eliminarse — así no hay que
      // recrear source/layer cada vez que el destino vuelve a estar sobre camino.
      const offRouteData = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: offRouteTail ? [offRouteTail.anchor, offRouteTail.rawStop] : [],
        },
      };

      const existingOffRoute = map.getSource(OFF_ROUTE_SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
      if (existingOffRoute) {
        existingOffRoute.setData(offRouteData);
      } else if (offRouteTail) {
        map.addSource(OFF_ROUTE_SOURCE_ID, { type: 'geojson', data: offRouteData });
        map.addLayer({
          id: OFF_ROUTE_LAYER_ID,
          type: 'line',
          source: OFF_ROUTE_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': resolveTrackingColor('--muted-foreground'),
            'line-width': 3,
            'line-dasharray': [2, 2],
          },
        });
      }
    }

    const craneCoords: [number, number] | null = data.position
      ? [data.position.lng, data.position.lat]
      : null;
    const rawOriginCoords: [number, number] | null = data.origin?.lat != null && data.origin?.lng != null
      ? [data.origin.lng, data.origin.lat]
      : null;

    let originCoords = rawOriginCoords;
    if (craneCoords && rawOriginCoords) {
      const distanceKm = haversineDistanceKm(craneCoords, rawOriginCoords);
      if (distanceKm > MAX_PLAUSIBLE_ORIGIN_DISTANCE_KM) {
        logger.warn('Origen sospechoso: distancia grua-origen supera el umbral, se ignora en el encuadre', {
          distanceKm: Math.round(distanceKm),
        });
        originCoords = null;
      }
    }

    // Fix 8: desde que la carga va a bordo, el punto de interés del mapa es el
    // DESTINO, no el origen ya visitado — el trazado del ETA apunta allá y
    // encuadrar contra el origen dejaba la ruta entera fuera de pantalla.
    // OJO: el umbral de "origen sospechoso" NO se aplica al destino. Nace de
    // detectar un origen mal geocodificado; en un traslado real (Copiapó ->
    // Viña, 800 km) una distancia enorme al destino es exactamente lo esperado.
    const toDestination = data.eta_target === 'destination';
    const destinationCoords: [number, number] | null =
      data.destination?.lat != null && data.destination?.lng != null
        ? [data.destination.lng, data.destination.lat]
        : null;
    const focusCoords = toDestination && destinationCoords ? destinationCoords : originCoords;
    const focusLabel = toDestination && destinationCoords ? data.destination?.text : data.origin?.text;

    if (data.position && craneCoords) {
      if (!craneMarkerRef.current) {
        const refs = createCraneMarkerElement();
        craneElRefs.current = refs;
        craneMarkerRef.current = new mapboxgl.default.Marker({ element: refs.wrapper, anchor: 'center' })
          .setLngLat(craneCoords)
          .addTo(map);
      } else {
        craneMarkerRef.current.setLngLat(craneCoords);
      }

      if (craneElRefs.current) {
        updateCraneMarkerElement(craneElRefs.current, data.position.heading, data.state === 'active');
      }
    }

    const stops = data.stops ?? [];
    const hasStops = stops.length > 0;

    // Con paradas, el itinerario reemplaza al marcador de origen: el punto de
    // partida (base) no aporta al viaje y solo ensucia el encuadre.
    if (focusCoords && !hasStops) {
      if (!originMarkerRef.current) {
        const refs = createOriginMarkerElement();
        originElRefs.current = refs;
        originMarkerRef.current = new mapboxgl.default.Marker({ element: refs.anchor, anchor: 'bottom' })
          .setLngLat(focusCoords)
          .addTo(map);
      } else {
        originMarkerRef.current.setLngLat(focusCoords);
      }

      if (originElRefs.current && focusLabel) {
        originElRefs.current.label.textContent = truncateLabel(toTitleCase(focusLabel));
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
      originElRefs.current = null;
    }

    // Marcadores numerados de paradas: alcanzadas atenuadas con check, la
    // próxima destacada con pulso. Las paradas SIN coordenadas no van al mapa;
    // la numeración visual es 1..n entre las que sí tienen, en su orden real.
    // Los marcadores se crean una vez y se mutan en cada poll.
    const nextStopOrder = data.next_stop?.order ?? null;
    const coordStops = stops.filter((stop) => stop.lat != null && stop.lng != null);
    coordStops.forEach((stop, index) => {
      // La parada objetivo con destino fuera de la red vial se dibuja en el fin
      // del trazado (punto navegable real) y el punteado la une con su pin
      // original; las demás siempre en sus coordenadas crudas.
      const markerCoords: [number, number] =
        offRouteTail && stop.order === targetOrder
          ? offRouteTail.anchor
          : [stop.lng as number, stop.lat as number];

      let entry = stopMarkersRef.current.get(stop.order);
      if (!entry) {
        const refs = createStopMarkerElement();
        const marker = new mapboxgl.default.Marker({ element: refs.wrapper, anchor: 'center' })
          .setLngLat(markerCoords)
          .addTo(map);
        entry = { marker, refs };
        stopMarkersRef.current.set(stop.order, entry);
      } else {
        entry.marker.setLngLat(markerCoords);
      }
      updateStopMarkerElement(entry.refs, stop, stop.order === nextStopOrder, index + 1);
    });

    try {
      // Encuadre: posición del móvil + paradas pendientes (multidestino) o
      // posición + origen (flujo original). padding extra abajo/arriba: el
      // bottom sheet y el header flotantes tapan parte del mapa en mobile.
      // Con paradas, el encuadre SOLO se recalcula cuando cambia la parada
      // objetivo o aparece la primera posición del móvil — nunca en cada
      // poll, para no pelear con un usuario que movió el mapa a mano.
      const fitKey = hasStops ? `stops:${nextStopOrder ?? 'done'}:${craneCoords ? 'pos' : 'nopos'}` : null;
      const shouldFit = hasStops ? lastFitKeyRef.current !== fitKey : true;

      if (shouldFit) {
        const boundsCoords: [number, number][] = [];
        if (craneCoords) boundsCoords.push(craneCoords);
        if (hasStops) {
          for (const stop of coordStops) {
            if (!stop.reached) {
              boundsCoords.push([stop.lng as number, stop.lat as number]);
            }
          }
        } else if (focusCoords) {
          boundsCoords.push(focusCoords);
        }

        if (boundsCoords.length > 1) {
          map.fitBounds(
            boundsCoords.reduce(
              (bounds, coord) => bounds.extend(coord),
              new mapboxgl.default.LngLatBounds(boundsCoords[0], boundsCoords[0]),
            ),
            { padding: { top: 150, bottom: 270, left: 48, right: 48 }, maxZoom: 15, duration: 0 },
          );
          lastFitKeyRef.current = fitKey;
        } else if (boundsCoords.length === 1) {
          // Sin segundo punto (waiting o recorrido completo): centrar en lo que haya.
          map.jumpTo({ center: boundsCoords[0], zoom: DEFAULT_ZOOM });
          lastFitKeyRef.current = fitKey;
        }
      }
    } catch (error) {
      logger.warn('No se pudo ajustar el mapa a los marcadores', error);
    }
  }, [data, mapboxReady, styleLoaded, routeCoords, offRouteTail, targetOrder]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-warning/10 p-6 text-center text-sm text-warning">
        <TriangleAlert className="size-6" />
        <p>Mapa no disponible en este momento.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!mapboxReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60 text-sm text-muted-foreground">
          Cargando mapa...
        </div>
      )}
    </div>
  );
};

const FullScreenStatus = ({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-muted px-6 text-center">
    <img src={LOGO_SRC} alt={COMPANY_NAME} className="h-9 w-auto opacity-90" />
    {icon}
    <div className="space-y-1.5">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

// Con la señal caída, el mapa muestra el último punto conocido. Decir la hora
// exacta es lo único que impide que el cliente lo lea como posición en vivo.
const NoSignalBanner = ({ recordedAt }: { recordedAt?: string | null }) => (
  <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
    <TriangleAlert className="mt-0.5 size-3.5 flex-shrink-0" />
    <span>
      {recordedAt
        ? `Última posición conocida a las ${formatOperationTime(recordedAt)} — la grúa puede haber avanzado desde entonces`
        : 'Sin señal GPS — la posición puede estar desactualizada'}
    </span>
  </div>
);

const CallButton = ({ phone }: { phone?: string | null }) => (
  <Button variant="outline" size="sm" className="w-full gap-2" asChild>
    <a href={toTelHref(phone || DEFAULT_COMPANY_PHONE_E164)}>
      <Phone className="size-4" />
      Llamar a {COMPANY_NAME}
    </a>
  </Button>
);

/**
 * Insignia de detención declarada. El ícono congelado sin contexto se lee como
 * problema; con motivo y hora se lee como lo que es: una parada normal de un
 * traslado largo.
 */
const StopEventBadge = ({ stopEvent }: { stopEvent: NonNullable<TrackingResponse['stop_event']> }) => {
  const Icon = STOP_REASON_ICONS[stopEvent.reason] ?? PauseCircle;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-2.5 py-1.5 text-xs font-medium text-info">
      <Icon className="size-4 shrink-0" />
      <span>
        Detenido · {STOP_REASON_LABELS[stopEvent.reason] ?? 'Detención'} · desde{' '}
        {formatOperationTime(stopEvent.started_at)}
      </span>
    </div>
  );
};

const EtaHero = ({ data }: { data: TrackingResponse }) => {
  const stops = data.stops ?? [];

  // Detención en curso: el ETA queda suspendido a propósito. Mostrar una hora
  // de llegada que sigue corriendo durante un descanso es peor que no mostrar
  // ninguna — el cliente la toma como compromiso.
  if (data.stop_event) {
    return (
      <div>
        <p className="text-2xl font-bold leading-tight text-foreground">
          Detenido · {STOP_REASON_LABELS[data.stop_event.reason] ?? 'Detención'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Desde las {formatOperationTime(data.stop_event.started_at)}. El tiempo de llegada se actualizará al reanudar.
        </p>
      </div>
    );
  }

  // Recorrido cargado pero servicio aún no iniciado: sin ETA ni guía. Va antes
  // que cualquier otra rama para no caer al render legacy y quedar en
  // "Calculando tiempo de llegada…" permanente (SRV-6853).
  if (stops.length > 0 && data.route_armed === false) {
    return (
      <div>
        <p className="text-2xl font-bold leading-tight text-foreground">Servicio no iniciado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          El recorrido está programado; el seguimiento comienza cuando el operador inicia el servicio.
        </p>
      </div>
    );
  }

  // Flujo multidestino: el ETA apunta a la próxima parada pendiente, no al
  // origen. Solo aplica si hay una parada objetivo o llegada real confirmada
  // (journey_stage arrived en estado activo): con paradas sin coordenadas o
  // en waiting, el backend opera en modo legacy y se cae al render original.
  // El estado (waiting/active) SIEMPRE manda sobre journey_stage.
  const arrivedConfirmed = data.journey_stage === 'arrived' && data.state !== 'waiting';
  if (stops.length > 0 && arrivedConfirmed) {
    return <p className="text-2xl font-bold leading-tight text-foreground">Llegamos al destino final</p>;
  }

  if (stops.length > 0 && data.next_stop) {
    if (data.eta) {
      return (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            En ruta a {data.next_stop.label} · llega en
          </p>
          <p className="mt-0.5 text-4xl font-bold leading-none text-foreground">
            {formatDurationLabel(data.eta.seconds)}
          </p>
        </div>
      );
    }

    // Tramo no ruteable por Google (p. ej. cordillera hacia Mantos de Oro):
    // distancia en línea recta hacia la próxima parada pendiente.
    const nextPending = stops.find((stop) => !stop.reached && stop.lat != null && stop.lng != null);
    if (data.position && data.eta_unavailable && nextPending) {
      const straightLineKm = haversineDistanceKm(
        [data.position.lng, data.position.lat],
        [nextPending.lng as number, nextPending.lat as number],
      );
      const kmLabel = straightLineKm >= 10
        ? Math.round(straightLineKm)
        : Math.round(straightLineKm * 10) / 10;
      return (
        <div>
          <p className="text-2xl font-bold leading-tight text-foreground">
            A ~{kmLabel} km de {nextPending.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiempo estimado no disponible en esta zona
          </p>
        </div>
      );
    }

    if (data.position) {
      return <p className="text-lg font-semibold text-muted-foreground">Calculando tiempo de llegada…</p>;
    }

    return (
      <div className="space-y-2">
        <div className="h-3 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="h-8 w-40 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
    );
  }

  // on_site primero: una vez que la grua llego, el ETA-al-origen cacheado
  // (hasta 60s de antiguedad) queda semanticamente obsoleto y contradice el
  // titulo — "en el lugar" no debe convivir con un numero de minutos.
  if (data.journey_stage === 'on_site') {
    return <p className="text-2xl font-bold leading-tight text-foreground">Tu grúa está en el lugar</p>;
  }

  // Desde que el vehículo va cargado, el ETA apunta al DESTINO y el rótulo debe
  // decirlo: con la grúa ya en ruta a Copiapó, "TU GRÚA LLEGA EN 2 min" (ETA al
  // origen que acababa de dejar atrás) le prometió al cliente de SRV-6858 una
  // entrega inmediata que estaba a ~1,5 h. El objetivo lo declara el servidor.
  const toDestination = data.eta_target === 'destination';

  if (data.eta) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {toDestination ? 'Entrega estimada en' : 'Tu grúa llega en'}
        </p>
        <p className="mt-0.5 text-4xl font-bold leading-none text-foreground">
          {formatDurationLabel(data.eta.seconds)}
        </p>
      </div>
    );
  }

  // Objetivo no ruteable por Google (zona sin ruta, p. ej. C-13 Termas de Juncal
  // o el tramo cordillerano a Mantos de Oro): en vez de "Calculando..."
  // permanente, la distancia en línea recta al punto que corresponda a la etapa.
  const fallbackPoint = toDestination ? data.destination : data.origin;
  if (
    data.position &&
    data.eta_unavailable &&
    fallbackPoint?.lat != null &&
    fallbackPoint?.lng != null
  ) {
    const straightLineKm = haversineDistanceKm(
      [data.position.lng, data.position.lat],
      [fallbackPoint.lng, fallbackPoint.lat],
    );
    const kmLabel = straightLineKm >= 10
      ? Math.round(straightLineKm)
      : Math.round(straightLineKm * 10) / 10;
    return (
      <div>
        <p className="text-2xl font-bold leading-tight text-foreground">
          {toDestination ? `Tu carga está a ~${kmLabel} km` : `Tu grúa está a ~${kmLabel} km`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tiempo estimado no disponible en esta zona
        </p>
      </div>
    );
  }

  // Traslado en curso hacia un destino que el servidor no pudo geocodificar
  // (solo texto). Decir "en traslado" sin número es honesto; caer al ETA-al-
  // origen para tener algo que mostrar es exactamente el bug que esto corrige.
  if (toDestination) {
    return (
      <div>
        <p className="text-2xl font-bold leading-tight text-foreground">Tu carga va en camino</p>
        {data.destination?.text && (
          <p className="mt-1 text-sm text-muted-foreground">Destino: {data.destination.text}</p>
        )}
      </div>
    );
  }

  if (data.position) {
    return <p className="text-lg font-semibold text-muted-foreground">Calculando tiempo de llegada…</p>;
  }

  // Esperando la primera posicion: skeleton en vez de un hueco roto.
  return (
    <div className="space-y-2">
      <div className="h-3 w-28 rounded-full bg-muted motion-safe:animate-pulse" />
      <div className="h-8 w-40 rounded-full bg-muted motion-safe:animate-pulse" />
    </div>
  );
};

const TrackService = () => {
  const { token } = useParams<{ token: string }>();
  const { status, data } = useServiceTrackingPoll(token);
  useTick(RELATIVE_TIME_TICK_MS);

  if (status === 'loading') {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-muted">
        <img src={LOGO_SRC} alt={COMPANY_NAME} className="h-9 w-auto opacity-90" />
        <Loader2 className="size-6 text-primary motion-safe:animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando seguimiento...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <FullScreenStatus
        icon={
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <MapPin className="size-8 text-muted-foreground" />
          </div>
        }
        title="Este enlace ya no está disponible"
        subtitle="El seguimiento se activa solo mientras dura el servicio."
      />
    );
  }

  if (status === 'error' || !data) {
    return (
      <FullScreenStatus
        icon={
          <div className="flex size-16 items-center justify-center rounded-full bg-warning/10">
            <TriangleAlert className="size-8 text-warning" />
          </div>
        }
        title="No se pudo cargar el seguimiento"
        subtitle="Intenta nuevamente en unos segundos."
      />
    );
  }

  if (data.state === 'finished') {
    return (
      <FullScreenStatus
        icon={
          <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="size-9 text-success" />
          </div>
        }
        title="Servicio finalizado"
        subtitle={`Gracias por confiar en ${COMPANY_NAME} · Folio ${data.folio}`}
      />
    );
  }

  // Precedencia: state (waiting/active/no_signal) manda sobre journey_stage.
  // En waiting la página SIEMPRE está en fase inicial, sin importar lo que
  // diga journey_stage — nunca convivir "Preparando tu servicio" con una
  // tarjeta de fase final (bug SRV-6853).
  const stage: JourneyStage = data.state === 'waiting' ? 'assigned' : (data.journey_stage ?? 'assigned');
  const trackingStops = data.stops ?? [];
  const hasStops = trackingStops.length > 0;
  // Recorrido cargado pero servicio aún no iniciado por el operador: las
  // paradas son pines informativos y no hay guía (SRV-6853).
  const routeArmed = data.route_armed !== false;
  // Con paradas, el título nombra la parada objetivo ("En ruta a Vallenar");
  // sin paradas se mantienen los títulos por etapa del flujo original.
  const stageTitle = !routeArmed
    ? 'Servicio no iniciado'
    : hasStops && data.next_stop && stage !== 'assigned'
      ? `En ruta a ${data.next_stop.label}`
      : STAGE_TITLES[stage];
  const relativeLabel = data.position ? formatRelativeShort(data.position.recorded_at, Date.now()) : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-muted">
      <div className="absolute inset-0">
        <TrackingMap data={data} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src={LOGO_SRC} alt={COMPANY_NAME} className="h-7 w-auto" />
              <span className="text-sm font-semibold text-foreground">{COMPANY_NAME}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Folio {data.folio}</span>
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">{stageTitle}</p>
          {data.stop_event && <StopEventBadge stopEvent={data.stop_event} />}
          {data.state === 'no_signal' && <NoSignalBanner recordedAt={data.position?.recorded_at} />}
        </div>

        <div className="pointer-events-auto">
          {hasStops ? (
            <StopsStepper
              stops={trackingStops}
              nextStopOrder={data.next_stop?.order ?? null}
              completed={stage === 'arrived'}
              routeArmed={routeArmed}
            />
          ) : (
            <JourneyStepper stage={stage} />
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-card/95 px-4 py-4 shadow-lg backdrop-blur-md">
          <EtaHero data={data} />

          {(data.crane || data.operator_first_name) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
              {data.crane && (
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-foreground">
                  {data.crane.plate}
                </span>
              )}
              {data.crane && <span>{getCraneTypeLabel(data.crane.type)}</span>}
              {data.operator_first_name && <span>Operador: {data.operator_first_name}</span>}
            </div>
          )}

          {relativeLabel && (
            <p className="text-xs text-muted-foreground">
              Actualizado {relativeLabel}
              {data.eta && ` · ${formatDistanceLabel(data.eta.distance_meters)}`}
            </p>
          )}

          <CallButton phone={data.support_phone} />

          <p className="text-center text-xs text-muted-foreground/80">
            {COMPANY_NAME} SpA · {COMPANY_LOCATION}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrackService;
