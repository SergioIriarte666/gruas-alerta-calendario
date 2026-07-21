import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { loadMapbox } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OriginPinMap');
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

interface OriginPinMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

/**
 * Mini-mapa con un pin arrastrable: las coordenadas guardadas son las del pin
 * confirmado por el admin, no las que devolvio el catalogo/geocoder. Reutiliza
 * loadMapbox() (mismo cargador que TrackService.tsx) pero es un componente
 * propio: la logica de marcador aqui es de arrastre, no de tracking en vivo.
 */
export const OriginPinMap = ({ lat, lng, onChange }: OriginPinMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [mapboxReady, setMapboxReady] = useState(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    let cancelled = false;
    let localMap: import('mapbox-gl').Map | null = null;

    void loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || !containerRef.current) return;

        mapboxgl.default.accessToken = MAPBOX_TOKEN;

        localMap = new mapboxgl.default.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [lng, lat],
          zoom: 14,
        });
        localMap.addControl(new mapboxgl.default.NavigationControl({ showCompass: false }), 'top-right');

        const marker = new mapboxgl.default.Marker({ color: 'hsl(var(--info))', draggable: true })
          .setLngLat([lng, lat])
          .addTo(localMap);

        marker.on('dragend', () => {
          const position = marker.getLngLat();
          onChangeRef.current(position.lat, position.lng);
        });

        markerRef.current = marker;
        mapRef.current = localMap;
        setMapboxReady(true);
      })
      .catch((error) => {
        logger.error('No se pudo cargar el mapa', error);
      });

    return () => {
      cancelled = true;
      setMapboxReady(false);
      markerRef.current?.remove();
      markerRef.current = null;
      localMap?.remove();
      mapRef.current = null;
    };
    // Solo se inicializa una vez; los cambios de lat/lng posteriores mueven el
    // marcador existente (efecto de abajo) en vez de recrear el mapa.
  }, []);

  useEffect(() => {
    if (!mapboxReady || !markerRef.current) return;

    const current = markerRef.current.getLngLat();
    // Evita relocalizar el mapa mientras el usuario arrastra el mismo pin
    // (dragend ya actualizo lat/lng via onChange, que vuelve a entrar aqui).
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;

    markerRef.current.setLngLat([lng, lat]);
    mapRef.current?.setCenter([lng, lat]);
  }, [lat, lng, mapboxReady]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-warning/20 bg-warning/10 p-4 text-center text-xs text-warning-text">
        <TriangleAlert className="size-4" />
        <p>Mapa no disponible: falta configurar VITE_MAPBOX_PUBLIC_TOKEN.</p>
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border">
      <div ref={containerRef} className="h-full w-full" />
      {!mapboxReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs text-muted-foreground">
          Cargando mapa...
        </div>
      )}
    </div>
  );
};
