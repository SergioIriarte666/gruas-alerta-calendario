import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, MapPin, MapPinCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import {
  useFavoriteLocations,
  matchFavoriteLocations,
  normalizeLocationText,
} from '@/hooks/useFavoriteLocations';
import { useGoogleMaps, type PlaceSuggestion } from '@/hooks/useGoogleMaps';
import { OriginPinMap } from '@/components/services/OriginPinMap';
import { parseLocationInput, type ParsedLocation } from '@/lib/locationParser';

const logger = createLogger('OriginLocationField');
const EXACT_LOCATION_RESOLVE_DEBOUNCE_MS = 400;
const PLACE_AUTOCOMPLETE_DEBOUNCE_MS = 300;

const formatCoordsFallback = (lat: number, lng: number) => `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;

export interface OriginResolvedCoords {
  lat: number | null;
  lng: number | null;
  catalogId: string | null;
}

interface OriginLocationFieldProps {
  value: string;
  onChange: (value: string) => void;
  coords: OriginResolvedCoords;
  onCoordsChange: (coords: OriginResolvedCoords) => void;
  department?: string | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}

export function OriginLocationField({
  value,
  onChange,
  coords,
  onCoordsChange,
  department,
  placeholder = 'Direccion de origen del servicio',
  className,
  disabled = false,
  error = false,
  id,
}: OriginLocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [isExactLocation, setIsExactLocation] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [networkSuggestions, setNetworkSuggestions] = useState<PlaceSuggestion[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const resolvingValueRef = useRef<string | null>(null);

  const { data: favoriteLocations = [] } = useFavoriteLocations();
  const { autocomplete, getPlaceDetails } = useGoogleMaps();
  const catalogMatches = useMemo(
    () => {
      if (!open) return [];
      if (normalizeLocationText(value).length < 2) {
        return favoriteLocations
          .filter((location) => location.latitude != null && location.longitude != null)
          .slice(0, 8);
      }
      return matchFavoriteLocations(value, favoriteLocations);
    },
    [open, value, favoriteLocations],
  );

  const trimmed = value.trim();
  // Nivel 0: si el texto ya es una ubicacion explicita (coordenadas, DMS o
  // link de Google Maps), no tiene sentido gastar llamadas a Places/Geocoding
  // en el mientras tanto.
  const parsedLocation = useMemo(() => parseLocationInput(trimmed), [trimmed]);
  const showNetworkTier = open && !disabled && trimmed.length >= 2 && !parsedLocation;

  useEffect(() => {
    if (!showNetworkTier) {
      setNetworkSuggestions([]);
      setNetworkLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setNetworkLoading(true);
      try {
        const query = department ? `${trimmed}, ${department}` : trimmed;
        const suggestions = await autocomplete(query);
        if (!cancelled) setNetworkSuggestions(suggestions);
      } catch (error) {
        if (!cancelled) {
          logger.warn('No se pudo buscar la ubicación en Google Places', error);
          setNetworkSuggestions([]);
        }
      } finally {
        if (!cancelled) setNetworkLoading(false);
      }
    }, PLACE_AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autocomplete, department, showNetworkTier, trimmed]);

  const handleParsedLocation = async (parsed: ParsedLocation) => {
    if ('error' in parsed) {
      toast.error('No reconocimos ese link de Google Maps. Ingresa la dirección manualmente.');
      onChange('');
      onCoordsChange({ lat: null, lng: null, catalogId: null });
      setOpen(false);
      return;
    }

    setIsResolvingLocation(true);
    try {
      let resolved: { lat: number; lng: number } | null = null;

      if ('needsServerResolve' in parsed) {
        const { data, error: resolveError } = await supabase.functions.invoke('maps-proxy', {
          body: { action: 'resolve_link', url: parsed.url },
        });
        if (!resolveError && data && typeof data.lat === 'number' && typeof data.lng === 'number') {
          resolved = { lat: data.lat, lng: data.lng };
        }
      } else {
        resolved = { lat: parsed.lat, lng: parsed.lng };
      }

      if (!resolved) {
        toast.error('No pudimos resolver ese link. Ingresa la dirección manualmente.');
        onChange('');
        onCoordsChange({ lat: null, lng: null, catalogId: null });
        setOpen(false);
        return;
      }

      onCoordsChange({ lat: resolved.lat, lng: resolved.lng, catalogId: null });
      setIsExactLocation(true);
      setOpen(false);

      const { data: reverseData, error: reverseError } = await supabase.functions.invoke('maps-proxy', {
        body: { action: 'reverse_geocode', lat: resolved.lat, lng: resolved.lng },
      });
      const address = !reverseError && typeof reverseData?.address === 'string' ? reverseData.address : null;
      onChange(address || formatCoordsFallback(resolved.lat, resolved.lng));
    } catch (err) {
      logger.warn('No se pudo resolver la ubicacion exacta', err);
      toast.error('No pudimos resolver esa ubicación. Ingresa la dirección manualmente.');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  useEffect(() => {
    if (disabled || !parsedLocation) return;
    // Evita re-resolver el mismo valor si el efecto se re-monta (StrictMode)
    // mientras la resolucion anterior sigue en curso.
    if (resolvingValueRef.current === trimmed) return;

    const timer = window.setTimeout(() => {
      resolvingValueRef.current = trimmed;
      void handleParsedLocation(parsedLocation).finally(() => {
        resolvingValueRef.current = null;
      });
    }, EXACT_LOCATION_RESOLVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [trimmed, disabled]);

  const showCatalog = catalogMatches.length > 0;
  const showEmpty =
    showNetworkTier && !networkLoading && networkSuggestions.length === 0 && !showCatalog;
  const hasConfirmedCoords = coords.lat != null && coords.lng != null;

  const selectCatalogMatch = (match: (typeof catalogMatches)[number]) => {
    onChange(match.name);
    onCoordsChange({ lat: match.latitude, lng: match.longitude, catalogId: match.id });
    setIsExactLocation(false);
    setOpen(false);
  };

  const selectNetworkSuggestion = async (suggestion: PlaceSuggestion) => {
    setOpen(false);
    setNetworkSuggestions([]);
    setIsResolvingLocation(true);

    try {
      if (suggestion.source === 'geocode' && suggestion.coordinates) {
        const [lng, lat] = suggestion.coordinates;
        onChange(suggestion.text);
        onCoordsChange({ lat, lng, catalogId: null });
        setIsExactLocation(false);
        return;
      }

      if (!suggestion.placeId) return;
      const place = await getPlaceDetails(suggestion.placeId);
      if (!place) {
        toast.error('No pudimos obtener la ubicación exacta seleccionada.');
        return;
      }

      onChange(place.formattedAddress || suggestion.text);
      onCoordsChange({ lat: place.lat, lng: place.lng, catalogId: null });
      setIsExactLocation(false);
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handlePinDrag = (lat: number, lng: number) => {
    // El pin ya no representa exactamente la ubicacion del catalogo una vez
    // arrastrado, asi que se habilita "guardar como nueva" si es admin.
    onCoordsChange({ lat, lng, catalogId: null });
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              id={id}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                onCoordsChange({ lat: null, lng: null, catalogId: null });
                setIsExactLocation(false);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete="off"
              className={cn(
                'pr-9',
                error && 'border-destructive focus-visible:ring-destructive',
                className,
              )}
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {isResolvingLocation || networkLoading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : hasConfirmedCoords ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="pointer-events-auto">
                        <MapPinCheck className="size-4 text-success-text" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isExactLocation ? 'Coordenadas exactas del enlace' : 'Ubicacion confirmada en el mapa'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <MapPin className="size-4 text-muted-foreground/70" />
              )}
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command shouldFilter={false} className="bg-background">
            <CommandList className="max-h-72">
              {showCatalog ? (
                <CommandGroup heading="Catalogo de ubicaciones">
                  {catalogMatches.map((match) => (
                    <CommandItem
                      key={match.id}
                      value={match.id}
                      className="gap-3 px-3 py-3"
                      onSelect={() => selectCatalogMatch(match)}
                    >
                      <Building2 className="size-4 shrink-0 text-info-text" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{match.name}</p>
                        {match.address ? (
                          <p className="truncate text-xs text-muted-foreground">{match.address}</p>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {showNetworkTier && networkSuggestions.length > 0 ? (
                <CommandGroup heading="Resultados de Google">
                  {networkSuggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.placeId ?? `${suggestion.source}-${suggestion.text}`}
                      value={suggestion.placeId ?? `${suggestion.source}-${suggestion.text}`}
                      className="gap-3 px-3 py-3"
                      onSelect={() => void selectNetworkSuggestion(suggestion)}
                    >
                      <MapPin className="size-4 shrink-0 text-success-text" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {suggestion.mainText || suggestion.text}
                        </p>
                        {suggestion.secondaryText ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {suggestion.secondaryText}
                          </p>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {showEmpty ? (
                <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                  No encontramos coincidencias para &quot;{value}&quot;.
                </CommandEmpty>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hasConfirmedCoords && (
        <OriginPinMap lat={coords.lat as number} lng={coords.lng as number} onChange={handlePinDrag} />
      )}
    </div>
  );
}
