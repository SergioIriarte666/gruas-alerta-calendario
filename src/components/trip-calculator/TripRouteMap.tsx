import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';


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
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!geometry?.coordinates?.length) return;

    let cancelled = false;

    const loadMap = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('mapbox-proxy', {
          body: {
            action: 'static_map',
            geometry,
            origin: originCoords,
            destination: destinationCoords,
          },
        });

        if (fnError || !data?.url || cancelled) {
          setError(true);
          setLoading(false);
          return;
        }

        setMapUrl(data.url);
        setLoading(false);
      } catch {
        setError(true);
        setLoading(false);
      }
    };

    loadMap();

    return () => { cancelled = true; };
  }, [geometry, originCoords, destinationCoords]);

  const hours = Math.floor(estimatedTimeHours);
  const minutes = Math.round((estimatedTimeHours - hours) * 60);

  const googleMapsUrl = `https://www.google.com/maps/dir/${originCoords[1]},${originCoords[0]}/${destinationCoords[1]},${destinationCoords[0]}`;

  if (error) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-violet-600" />
              Mapa de Ruta
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {distanceKm.toFixed(1)} km · {hours}h {minutes}min estimados
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(googleMapsUrl, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Google Maps
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-lg overflow-hidden border bg-muted" style={{ height: 420 }}>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          )}
          {mapUrl && (
            <img
              src={mapUrl}
              alt={`Ruta de ${originName} a ${destinationName}`}
              className="w-full h-full object-cover"
              onLoad={() => setLoading(false)}
              onError={() => { setError(true); }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
