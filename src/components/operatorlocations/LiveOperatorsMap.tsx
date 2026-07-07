import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  OPERATOR_STATUS_COLORS,
  OPERATOR_STATUS_LABELS,
  deriveOperatorStatus,
  formatMinutesAgo,
  type OperatorLiveLocation,
} from '@/types/operatorLocations';
import { createLogger } from '@/lib/logger';
import { loadMapbox, type MapboxModule } from '@/lib/loadMapbox';

const logger = createLogger('LiveOperatorsMap');

const COPIAPO_CENTER: [number, number] = [-70.33, -27.37];
const DEFAULT_ZOOM = 12;

export interface LiveOperatorsMapHandle {
  flyToOperator: (operatorId: string) => void;
}

interface LiveOperatorsMapProps {
  locations: OperatorLiveLocation[];
  onSelectOperator?: (operatorId: string) => void;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildPopupHtml = (location: OperatorLiveLocation): string => {
  const status = deriveOperatorStatus(location);
  const parts = [
    `<div style="font-size:15px;font-weight:700;color:#0f172a">${escapeHtml(location.operator_name)}</div>`,
    `<div style="margin-top:4px;font-size:13px;font-weight:600;color:#334155">${OPERATOR_STATUS_LABELS[status]} · ${formatMinutesAgo(location.recorded_at)}</div>`,
  ];
  if (location.service_folio) {
    parts.push(`<div style="margin-top:3px;font-size:13px;font-weight:600;color:#475569">Folio ${escapeHtml(location.service_folio)}</div>`);
  }
  if (typeof location.speed_mps === 'number') {
    parts.push(`<div style="margin-top:3px;font-size:12px;font-weight:600;color:#64748b">${Math.round(location.speed_mps * 3.6)} km/h</div>`);
  }
  return `<div style="min-width:180px;padding:2px 4px;font-size:12px;line-height:1.45;color:#0f172a">${parts.join('')}</div>`;
};

export const LiveOperatorsMap = forwardRef<LiveOperatorsMapHandle, LiveOperatorsMapProps>(
  ({ locations, onSelectOperator }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<import('mapbox-gl').Map | null>(null);
    const markersRef = useRef<Map<string, import('mapbox-gl').Marker>>(new Map());
    const coordsRef = useRef<Map<string, [number, number]>>(new Map());
    const mapboxRef = useRef<MapboxModule | null>(null);
    const [mapboxReady, setMapboxReady] = useState(false);

    useImperativeHandle(ref, () => ({
      flyToOperator: (operatorId: string) => {
        const coords = coordsRef.current.get(operatorId);
        if (!coords || !mapRef.current) return;
        mapRef.current.flyTo({ center: coords, zoom: 15 });
        markersRef.current.get(operatorId)?.togglePopup();
      },
    }), []);

    useEffect(() => {
      if (!containerRef.current || !MAPBOX_TOKEN) return;

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
            zoom: DEFAULT_ZOOM,
          });

          localMap.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'top-right');
          mapRef.current = localMap;
          setMapboxReady(true);
        })
        .catch((error) => {
          logger.error('Could not load Mapbox for live operators map', error);
        });

      return () => {
        cancelled = true;
        setMapboxReady(false);
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current.clear();
        coordsRef.current.clear();
        localMap?.remove();
        mapRef.current = null;
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      const mapboxgl = mapboxRef.current;
      if (!map || !mapboxgl || !MAPBOX_TOKEN) return;

      const activeIds = new Set<string>();
      const bounds = new mapboxgl.default.LngLatBounds();
      let hasCoords = false;

      for (const location of locations) {
        if (location.longitude === null || location.latitude === null) continue;

        activeIds.add(location.operator_id);
        const coords: [number, number] = [location.longitude, location.latitude];
        coordsRef.current.set(location.operator_id, coords);
        bounds.extend(coords);
        hasCoords = true;

        const status = deriveOperatorStatus(location);
        const color = OPERATOR_STATUS_COLORS[status];
        const popupHtml = buildPopupHtml(location);

        let marker = markersRef.current.get(location.operator_id);
        if (marker) {
          marker.setLngLat(coords);
          const el = marker.getElement();
          el.style.backgroundColor = color;
          marker.getPopup()?.setHTML(popupHtml);
        } else {
          const el = document.createElement('div');
          el.style.width = '18px';
          el.style.height = '18px';
          el.style.borderRadius = '9999px';
          el.style.border = '3px solid rgba(255,255,255,0.9)';
          el.style.boxShadow = '0 4px 10px rgba(15,23,42,0.35)';
          el.style.cursor = 'pointer';
          el.style.backgroundColor = color;

          const popup = new mapboxgl.default.Popup({ offset: 14, closeButton: false }).setHTML(popupHtml);

          marker = new mapboxgl.default.Marker({ element: el })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map);

          el.addEventListener('click', () => onSelectOperator?.(location.operator_id));

          markersRef.current.set(location.operator_id, marker);
        }
      }

      for (const [operatorId, marker] of markersRef.current.entries()) {
        if (!activeIds.has(operatorId)) {
          marker.remove();
          markersRef.current.delete(operatorId);
          coordsRef.current.delete(operatorId);
        }
      }

      if (hasCoords) {
        try {
          map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 0 });
        } catch (error) {
          logger.warn('Could not fit bounds to operator markers', error);
        }
      }
    }, [locations, mapboxReady, onSelectOperator]);

    if (!MAPBOX_TOKEN) {
      return (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-sm text-amber-200">
          <TriangleAlert className="size-6" />
          <p>Configura VITE_MAPBOX_PUBLIC_TOKEN para ver el mapa en vivo.</p>
        </div>
      );
    }

    return (
      <div className="relative h-full min-h-[320px] w-full">
        <div ref={containerRef} className="h-full min-h-[320px] w-full rounded-2xl" />
        {!mapboxReady && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-white/5 bg-zinc-950/35 text-sm text-zinc-500">
            Cargando mapa en vivo...
          </div>
        )}
      </div>
    );
  },
);

LiveOperatorsMap.displayName = 'LiveOperatorsMap';
