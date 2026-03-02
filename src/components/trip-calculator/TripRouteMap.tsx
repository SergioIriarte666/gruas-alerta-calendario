import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Loader2 } from 'lucide-react';

interface TripRouteMapProps {
  geometry: { type: string; coordinates: [number, number][] };
  originCoords: [number, number];
  destinationCoords: [number, number];
  originName: string;
  destinationName: string;
  distanceKm: number;
  estimatedTimeHours: number;
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current || !geometry?.coordinates?.length) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
          body: { action: 'get_token' },
        });

        if (error || !data?.token || cancelled) return;

        mapboxgl.accessToken = data.token;

        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: originCoords,
          zoom: 6,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;

          // Add route line
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: geometry as GeoJSON.Geometry,
            },
          });

          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#7c3aed',
              'line-width': 4,
              'line-opacity': 0.8,
            },
          });

          // Origin marker
          new mapboxgl.Marker({ color: '#16a34a' })
            .setLngLat(originCoords)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(originName))
            .addTo(map);

          // Destination marker
          new mapboxgl.Marker({ color: '#dc2626' })
            .setLngLat(destinationCoords)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(destinationName))
            .addTo(map);

          // Fit bounds to route
          const coords = geometry.coordinates;
          const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
          coords.forEach((c) => bounds.extend(c as [number, number]));
          map.fitBounds(bounds, { padding: 50 });

          setLoading(false);
        });
      } catch {
        setLoading(false);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geometry, originCoords, destinationCoords, originName, destinationName]);

  const hours = Math.floor(estimatedTimeHours);
  const minutes = Math.round((estimatedTimeHours - hours) * 60);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-violet-600" />
          Mapa de Ruta
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {distanceKm.toFixed(1)} km · {hours}h {minutes}min estimados
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-lg overflow-hidden border" style={{ height: 400 }}>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/60">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          )}
          <div ref={mapContainer} className="w-full h-full" />
        </div>
      </CardContent>
    </Card>
  );
};
