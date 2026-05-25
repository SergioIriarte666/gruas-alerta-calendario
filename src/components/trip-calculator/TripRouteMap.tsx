import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Loader2, ExternalLink, Maximize2 } from 'lucide-react';
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

export const TripRouteMap = ({
  geometry,
  originCoords,
  destinationCoords,
  originName,
  destinationName,
  distanceKm,
  estimatedTimeHours,
}: TripRouteMapProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(false);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMapImage = async (mode: 'preview' | 'full'): Promise<string | null> => {
    const { data, error: fnError } = await supabase.functions.invoke('mapbox-proxy', {
      body: {
        action: 'static_map',
        geometry,
        origin: originCoords,
        destination: destinationCoords,
        mode,
      },
    });
    if (fnError || !data) return null;
    // Edge function returns binary image data — wrap as a Blob URL
    const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: 'image/png' });
    return URL.createObjectURL(blob);
  };

  // Load preview map
  useEffect(() => {
    if (!geometry?.coordinates?.length) return;
    let cancelled = false;

    const loadMap = async () => {
      try {
        const url = await fetchMapImage('preview');
        if (cancelled) return;
        if (!url) {
          setError(true);
          setLoading(false);
          return;
        }
        setPreviewUrl(url);
        setLoading(false);
      } catch {
        setError(true);
        setLoading(false);
      }
    };

    loadMap();
    return () => { cancelled = true; };
  }, [geometry, originCoords, destinationCoords]);

  // Load full map on modal open
  useEffect(() => {
    if (!modalOpen || fullUrl || !geometry?.coordinates?.length) return;

    let cancelled = false;
    setFullLoading(true);

    const loadFull = async () => {
      try {
        const url = await fetchMapImage('full');
        if (cancelled) return;
        if (!url) {
          setFullLoading(false);
          return;
        }
        setFullUrl(url);
        setFullLoading(false);
      } catch {
        setFullLoading(false);
      }
    };

    loadFull();
    return () => { cancelled = true; };
  }, [modalOpen, fullUrl, geometry, originCoords, destinationCoords]);

  const hours = Math.floor(estimatedTimeHours);
  const minutes = Math.round((estimatedTimeHours - hours) * 60);

  const googleMapsUrl = `https://www.google.com/maps/dir/${originCoords[1]},${originCoords[0]}/${destinationCoords[1]},${destinationCoords[0]}`;

  if (error) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
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
          <div className="relative rounded-lg overflow-hidden border bg-muted" style={{ height: 280 }}>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-violet-600" />
              </div>
            )}
            {previewUrl && (
              <img
                src={previewUrl}
                alt={`Ruta de ${originName} a ${destinationName}`}
                className="size-full object-contain cursor-pointer"
                onClick={() => setModalOpen(true)}
                onLoad={() => setLoading(false)}
                onError={() => { setError(true); }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full map modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DlgTitle className="flex items-center gap-2 text-lg">
              <MapIcon className="size-5 text-violet-600" />
              Mapa de Ruta Completo
            </DlgTitle>
            <DialogDescription>
              {originName} → {destinationName} · {distanceKm.toFixed(1)} km · {hours}h {minutes}min
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto">
            {fullLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-violet-600" />
              </div>
            )}
            {fullUrl && (
              <img
                src={fullUrl}
                alt={`Ruta completa de ${originName} a ${destinationName}`}
                className="w-full h-auto max-h-[75vh] object-contain rounded-lg"
              />
            )}
            {!fullLoading && !fullUrl && (
              <div className="text-center py-10 text-muted-foreground">
                <p>No se pudo cargar el mapa completo.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => window.open(googleMapsUrl, '_blank')}
                >
                  <ExternalLink className="size-3.5" />
                  Ver en Google Maps
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
