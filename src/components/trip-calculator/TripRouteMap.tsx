import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, ExternalLink, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DlgTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface TripRouteMapProps {
  geometry: { type: string; coordinates: [number, number][] };
  originCoords: [number, number];
  destinationCoords: [number, number];
  originName: string;
  destinationName: string;
  distanceKm: number;
  estimatedTimeHours: number;
}

interface RouteLeafletMapProps {
  coordinates: [number, number][];
  originCoords: [number, number];
  destinationCoords: [number, number];
  className?: string;
}

const originIcon = L.divIcon({
  className: 'trip-route-marker trip-route-marker--origin',
  html: '<span class="trip-route-marker__dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const destinationIcon = L.divIcon({
  className: 'trip-route-marker trip-route-marker--destination',
  html: '<span class="trip-route-marker__dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function RouteLeafletMap({
  coordinates,
  originCoords,
  destinationCoords,
  className,
}: RouteLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const latLngs = useMemo(
    () => coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    [coordinates],
  );

  useEffect(() => {
    if (!containerRef.current || latLngs.length === 0) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      tap: false,
    });

    mapRef.current = map;

    map.zoomControl.setPosition('topright');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    L.polyline(latLngs, {
      color: '#5b21b6',
      weight: 7,
      opacity: 0.95,
      lineJoin: 'round',
    }).addTo(map);

    L.polyline(latLngs, {
      color: '#a78bfa',
      weight: 12,
      opacity: 0.28,
      lineJoin: 'round',
    }).addTo(map);

    L.marker([originCoords[1], originCoords[0]], { icon: originIcon }).addTo(map);
    L.marker([destinationCoords[1], destinationCoords[0]], { icon: destinationIcon }).addTo(map);

    const bounds = L.latLngBounds(latLngs);
    bounds.extend([originCoords[1], originCoords[0]]);
    bounds.extend([destinationCoords[1], destinationCoords[0]]);
    map.fitBounds(bounds, { padding: [24, 24] });

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [24, 24] });
    }, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [latLngs, originCoords, destinationCoords]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/10 to-transparent" />
      <style>{`
        .trip-route-marker {
          display: grid;
          place-items: center;
          border-radius: 9999px;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18);
        }
        .trip-route-marker__dot {
          display: block;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: white;
        }
        .trip-route-marker--origin {
          background: #16a34a;
          border: 4px solid rgba(255, 255, 255, 0.95);
        }
        .trip-route-marker--destination {
          background: #ef4444;
          border: 4px solid rgba(255, 255, 255, 0.95);
        }
      `}</style>
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapIcon className="size-5 text-violet-600" />
                Mapa de Ruta
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {distanceKm.toFixed(1)} km · {hours}h {minutes}min estimados
              </p>
            </div>
            <div className="flex gap-2">
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
          <RouteLeafletMap
            coordinates={geometry.coordinates}
            originCoords={originCoords}
            destinationCoords={destinationCoords}
            className="relative h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
          />
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DlgTitle className="flex items-center gap-2 text-lg">
                  <MapIcon className="size-5 text-violet-600" />
                  Mapa de Ruta Completo
                </DlgTitle>
                <DialogDescription>
                  {originName} → {destinationName} · {distanceKm.toFixed(1)} km · {hours}h {minutes}min
                </DialogDescription>
              </div>
              <div className="flex gap-2">
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
            <RouteLeafletMap
              key="route-map-modal"
              coordinates={geometry.coordinates}
              originCoords={originCoords}
              destinationCoords={destinationCoords}
              className="relative h-[68vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
