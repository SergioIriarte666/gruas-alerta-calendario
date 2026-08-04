import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Loader2, MapPin, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { loadMapbox } from '@/lib/loadMapbox';
import { createLogger } from '@/lib/logger';
import { startsWithPlusCode } from '@/lib/locationParser';
import { formatChileAddress } from '@/utils/chileLocationLabel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const logger = createLogger('LocationPickerDialog');
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

// Base G5N: encuadre por defecto cuando el servicio todavia no tiene punto.
const FALLBACK_CENTER = { lat: -27.3464, lng: -70.6339, zoom: 9 };
const PIN_ZOOM = 15;
const REVERSE_GEOCODE_DEBOUNCE_MS = 600;

const MAP_STYLES = {
  // En caminos mineros el satelital es lo unico que orienta: no hay calles que
  // reconocer, pero si huellas, piscinas de relave y plantas.
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

export interface LocationPickerResult {
  lat: number;
  lng: number;
  address: string | null;
}

interface LocationPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialLabel?: string;
  onConfirm: (result: LocationPickerResult) => void;
}

/**
 * Captura manual de coordenadas para lo que ningun geocodificador puede
 * resolver: "camino a Mantoverde, km 12, poste 45". El punto vale por si mismo
 * — la direccion de referencia es informativa y su ausencia jamas impide
 * confirmar.
 */
export const LocationPickerDialog = ({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  initialLabel,
  onConfirm,
}: LocationPickerDialogProps) => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markerRef = useRef<import('mapbox-gl').Marker | null>(null);
  const reverseTimerRef = useRef<number | null>(null);
  const reverseRequestRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('satellite');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const hasInitialPoint = initialLat != null && initialLng != null;

  /**
   * Direccion referencial del punto. Es un adorno util, no una validacion: si
   * vuelve null (o solo un plus code) el boton de confirmar sigue habilitado.
   */
  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseTimerRef.current) window.clearTimeout(reverseTimerRef.current);

    const requestId = ++reverseRequestRef.current;
    setLoadingAddress(true);

    reverseTimerRef.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('maps-proxy', {
          body: { action: 'reverse_geocode', lat, lng },
        });
        if (requestId !== reverseRequestRef.current) return;

        const resolved = !error && typeof data?.address === 'string' ? data.address : null;
        setAddress(resolved && !startsWithPlusCode(resolved) ? formatChileAddress(resolved) : null);
      } catch (reverseError) {
        logger.warn('No se pudo obtener la direccion de referencia', reverseError);
        if (requestId === reverseRequestRef.current) setAddress(null);
      } finally {
        if (requestId === reverseRequestRef.current) setLoadingAddress(false);
      }
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!open) return;

    const start = hasInitialPoint
      ? { lat: initialLat as number, lng: initialLng as number, zoom: PIN_ZOOM }
      : FALLBACK_CENTER;

    setPosition({ lat: start.lat, lng: start.lng });
    setAddress(null);
    setMapStyle('satellite');
    setMapReady(false);
    if (hasInitialPoint) scheduleReverseGeocode(start.lat, start.lng);

    // El contenedor del mapa solo existe una vez que el Dialog monto su
    // contenido, de ahi el rAF antes de instanciar Mapbox.
    let cancelled = false;
    let localMap: import('mapbox-gl').Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const frame = window.requestAnimationFrame(() => {
      if (cancelled || !containerRef.current || !MAPBOX_TOKEN) return;

      void loadMapbox()
        .then((mapboxgl) => {
          if (cancelled || !containerRef.current) return;

          mapboxgl.default.accessToken = MAPBOX_TOKEN;

          localMap = new mapboxgl.default.Map({
            container: containerRef.current,
            style: MAP_STYLES.satellite,
            center: [start.lng, start.lat],
            zoom: start.zoom,
          });
          localMap.addControl(
            new mapboxgl.default.NavigationControl({ showCompass: false }),
            'top-right',
          );

          // El modal se anima y su área útil cambia con el encabezado y el
          // pie. Mantener Mapbox sincronizado con el tamaño real evita que el
          // canvas conserve las dimensiones (a veces 0px) de su primer frame.
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => localMap?.resize());
            resizeObserver.observe(containerRef.current);
          }

          localMap.once('load', () => {
            if (cancelled) return;
            localMap?.resize();
            localMap?.triggerRepaint();
            setMapReady(true);

            // Radix termina la animación del modal después del evento load.
            // Un segundo frame garantiza el canvas final incluso con zoom de
            // pantalla o cuando este diálogo está sobre otro diálogo.
            window.requestAnimationFrame(() => {
              if (cancelled) return;
              localMap?.resize();
              localMap?.triggerRepaint();
            });
          });

          const marker = new mapboxgl.default.Marker({
            color: 'hsl(var(--destructive))',
            draggable: true,
          })
            .setLngLat([start.lng, start.lat])
            .addTo(localMap);

          marker.on('dragend', () => {
            const next = marker.getLngLat();
            setPosition({ lat: next.lat, lng: next.lng });
            scheduleReverseGeocode(next.lat, next.lng);
          });

          localMap.on('click', (event) => {
            const { lat, lng } = event.lngLat;
            marker.setLngLat([lng, lat]);
            setPosition({ lat, lng });
            scheduleReverseGeocode(lat, lng);
          });

          markerRef.current = marker;
          mapRef.current = localMap;
        })
        .catch((mapError) => {
          logger.error('No se pudo cargar el mapa', mapError);
        });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (reverseTimerRef.current) window.clearTimeout(reverseTimerRef.current);
      reverseRequestRef.current += 1;
      setMapReady(false);
      setLoadingAddress(false);
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      localMap?.remove();
      mapRef.current = null;
    };
    // Se re-crea el mapa en cada apertura: el Dialog desmonta su contenido al
    // cerrarse y el contenedor anterior deja de existir.
  }, [open]);

  useEffect(() => {
    if (!mapReady) return;
    mapRef.current?.setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle, mapReady]);

  const handleConfirm = () => {
    if (!position) return;
    onConfirm({ lat: position.lat, lng: position.lng, address });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          className={cn(
            'flex h-[calc(100dvh-2rem)] max-h-[92dvh] flex-col gap-3 overflow-hidden p-4 sm:h-[92dvh] sm:p-6',
            isMobile ? 'w-screen max-w-none' : 'w-[95vw] max-w-4xl',
          )}
        >
          <DialogHeader className="space-y-1">
            <DialogTitle>Fijar el punto en el mapa</DialogTitle>
            <DialogDescription>
              {initialLabel?.trim()
                ? `Ubicación de "${initialLabel.trim()}". Arrastra el pin o toca el mapa donde está realmente el vehículo.`
                : 'Arrastra el pin o toca el mapa donde está realmente el vehículo. No necesitas que el punto tenga dirección.'}
            </DialogDescription>
          </DialogHeader>

          {!MAPBOX_TOKEN ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-xl border border-warning/20 bg-warning/10 p-4 text-center text-sm text-warning-text">
              <TriangleAlert className="size-5" />
              <p>Mapa no disponible: falta configurar VITE_MAPBOX_PUBLIC_TOKEN.</p>
            </div>
          ) : (
            <div className="relative min-h-[18rem] flex-1 overflow-hidden rounded-xl border border-border sm:min-h-[22rem]">
              <div
                ref={containerRef}
                className="size-full"
                style={{ position: 'absolute', inset: 0 }}
              />

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute left-3 top-3 z-10 shadow-md"
                onClick={() => setMapStyle((prev) => (prev === 'satellite' ? 'streets' : 'satellite'))}
              >
                <Layers className="mr-1.5 size-3.5" />
                {mapStyle === 'satellite' ? 'Ver calles' : 'Ver satélite'}
              </Button>

              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
                  Cargando mapa...
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span className="select-all font-mono text-sm tabular-nums text-foreground">
                {position
                  ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
                  : '—'}
              </span>
            </div>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {loadingAddress ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Buscando dirección de referencia...
                </>
              ) : address ? (
                <span className="truncate">Referencia: {address}</span>
              ) : (
                'Sin dirección de referencia (el punto es válido igual)'
              )}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={!position}>
              Usar este punto
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};
