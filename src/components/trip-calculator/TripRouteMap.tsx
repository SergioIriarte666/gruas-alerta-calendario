import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { createLogger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, ExternalLink, Maximize2, Loader2, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DlgTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const logger = createLogger('TripRouteMap');

interface TripRouteMapProps {
  geometry: { type: string; coordinates: [number, number][] };
  originCoords: [number, number];
  destinationCoords: [number, number];
  originName: string;
  destinationName: string;
  distanceKm: number;
  estimatedTimeHours: number;
}

interface InteractiveRouteMapProps {
  geometry: { type: string; coordinates: [number, number][] };
  originCoords: [number, number];
  destinationCoords: [number, number];
  gestureHandling: 'greedy' | 'cooperative';
  className?: string;
}

function InteractiveRouteMap({
  geometry,
  originCoords,
  destinationCoords,
  gestureHandling,
  className,
}: InteractiveRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: number | undefined;

    const init = async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;

        const map = new g.maps.Map(containerRef.current, {
          mapTypeId: 'roadmap',
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: g.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: g.maps.ControlPosition.TOP_RIGHT,
            mapTypeIds: ['roadmap', 'satellite', 'terrain'],
          },
          zoomControl: true,
          zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling,
        });

        const path = geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));

        new g.maps.Polyline({
          path,
          strokeColor: '#7c3aed',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map,
        });

        new g.maps.Marker({
          position: { lat: originCoords[1], lng: originCoords[0] },
          map,
          label: { text: 'A', color: '#ffffff', fontWeight: 'bold' },
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            fillColor: '#16a34a',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 11,
          },
        });

        new g.maps.Marker({
          position: { lat: destinationCoords[1], lng: destinationCoords[0] },
          map,
          label: { text: 'B', color: '#ffffff', fontWeight: 'bold' },
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 11,
          },
        });

        const bounds = new g.maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        bounds.extend({ lat: originCoords[1], lng: originCoords[0] });
        bounds.extend({ lat: destinationCoords[1], lng: destinationCoords[0] });
        map.fitBounds(bounds, 48);

        // El contenedor puede no tener su tamaño final (animación de modal,
        // layout todavía asentándose) en el momento del fitBounds inicial.
        resizeTimer = window.setTimeout(() => {
          g.maps.event.trigger(map, 'resize');
          map.fitBounds(bounds, 48);
        }, 150);

        if (!cancelled) setStatus('ready');
      } catch (error) {
        logger.error('No se pudo inicializar el mapa interactivo', error);
        if (!cancelled) setStatus('error');
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
    };
  }, [geometry, originCoords, destinationCoords, gestureHandling]);

  if (status === 'error') {
    return (
      <div className={`${className ?? ''} flex flex-col items-center justify-center gap-2 text-muted-foreground`}>
        <MapPinOff className="size-6" />
        <span className="text-sm">No se pudo cargar el mapa. Usa el botón Google Maps.</span>
      </div>
    );
  }

  return (
    <div className={`${className ?? ''} relative`}>
      <div ref={containerRef} className="size-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <Loader2 className="size-6 animate-spin text-violet-600" />
        </div>
      )}
    </div>
  );
}

export const TripRouteMap = ({
  geometry,
  originCoords,
  destinationCoords,
  originName,
  destinationName,
  distanceKm,
  estimatedTimeHours,
}: TripRouteMapProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const hours = Math.floor(estimatedTimeHours);
  const minutes = Math.round((estimatedTimeHours - hours) * 60);

  const googleMapsUrl = `https://www.google.com/maps/dir/${originCoords[1]},${originCoords[0]}/${destinationCoords[1]},${destinationCoords[0]}`;
  const googleTerrainUrl = `${googleMapsUrl}/data=!5m1!1e4`;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapIcon className="size-5 text-violet-600" />
                Mapa de Ruta
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {distanceKm.toFixed(1)} km · {hours}h {minutes}min estimados
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setModalOpen(true)}
              >
                <Maximize2 className="size-3.5" />
                Ver completo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(googleMapsUrl, '_blank')}
              >
                <ExternalLink className="size-3.5" />
                Google Maps
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <InteractiveRouteMap
            geometry={geometry}
            originCoords={originCoords}
            destinationCoords={destinationCoords}
            gestureHandling="cooperative"
            className="h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
          />
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DlgTitle className="flex items-center gap-2 text-lg">
                  <MapIcon className="size-5 text-violet-600" />
                  Mapa de Ruta Completo
                </DlgTitle>
                <DialogDescription>
                  {originName} → {destinationName} · {distanceKm.toFixed(1)} km · {hours}h {minutes}min
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(googleTerrainUrl, '_blank')}
                >
                  <ExternalLink className="size-3.5" />
                  Vista terreno
                </Button>
              </div>
            </div>
          </DialogHeader>
          {modalOpen && (
            <InteractiveRouteMap
              key="route-map-modal"
              geometry={geometry}
              originCoords={originCoords}
              destinationCoords={destinationCoords}
              gestureHandling="greedy"
              className="h-[68vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
