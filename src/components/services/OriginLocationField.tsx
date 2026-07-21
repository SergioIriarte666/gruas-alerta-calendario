import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, MapPin, MapPinCheck, Star } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { useFavoriteLocations, matchFavoriteLocations } from '@/hooks/useFavoriteLocations';
import { useOriginSearchCascade } from '@/hooks/useOriginSearchCascade';
import { OriginPinMap } from '@/components/services/OriginPinMap';
import type { QuickAddress } from '@/components/services/MapboxAddressInput';
import { parseLocationInput, type ParsedLocation } from '@/lib/locationParser';

const logger = createLogger('OriginLocationField');
const EXACT_LOCATION_RESOLVE_DEBOUNCE_MS = 400;

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
  saveToCatalog: boolean;
  onSaveToCatalogChange: (value: boolean) => void;
  department?: string | null;
  isAdmin: boolean;
  placeholder?: string;
  quickSuggestions?: QuickAddress[];
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
  saveToCatalog,
  onSaveToCatalogChange,
  department,
  isAdmin,
  placeholder = 'Direccion de origen del servicio',
  quickSuggestions = [],
  className,
  disabled = false,
  error = false,
  id,
}: OriginLocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [isExactLocation, setIsExactLocation] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const resolvingValueRef = useRef<string | null>(null);

  const { data: favoriteLocations = [] } = useFavoriteLocations();
  const catalogMatches = useMemo(
    () => (open ? matchFavoriteLocations(value, favoriteLocations) : []),
    [open, value, favoriteLocations],
  );

  const trimmed = value.trim();
  // Nivel 0: si el texto ya es una ubicacion explicita (coordenadas, DMS o
  // link de Google Maps), no tiene sentido gastar llamadas a Places/Geocoding
  // en el mientras tanto.
  const parsedLocation = useMemo(() => parseLocationInput(trimmed), [trimmed]);
  const showNetworkTier = open && !disabled && trimmed.length >= 3 && !parsedLocation;
  const { result: networkResult, loading: networkLoading } = useOriginSearchCascade(value, {
    enabled: showNetworkTier,
    department,
  });

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

  const filteredQuickSuggestions = useMemo(() => {
    const search = trimmed.toLowerCase();
    if (search.length >= 3) return [];

    return quickSuggestions
      .filter((suggestion) =>
        search.length === 0
          ? true
          : suggestion.address.toLowerCase().includes(search) ||
            suggestion.label.toLowerCase().includes(search),
      )
      .slice(0, 6);
  }, [quickSuggestions, trimmed]);

  const showCatalog = catalogMatches.length > 0;
  const showQuickSuggestions = filteredQuickSuggestions.length > 0 && trimmed.length < 3;
  const showEmpty = showNetworkTier && !networkLoading && !networkResult && !showCatalog;
  const hasConfirmedCoords = coords.lat != null && coords.lng != null;
  const showSaveCheckbox = isAdmin && hasConfirmedCoords && !coords.catalogId;

  const selectCatalogMatch = (match: (typeof catalogMatches)[number]) => {
    onChange(match.name);
    onCoordsChange({ lat: match.latitude, lng: match.longitude, catalogId: match.id });
    onSaveToCatalogChange(false);
    setIsExactLocation(false);
    setOpen(false);
  };

  const selectNetworkResult = () => {
    if (!networkResult) return;
    onCoordsChange({ lat: networkResult.lat, lng: networkResult.lng, catalogId: null });
    setIsExactLocation(false);
    setOpen(false);
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
                onSaveToCatalogChange(false);
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
              ) : isExactLocation ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="pointer-events-auto">
                        <MapPinCheck className="size-4 text-success-text" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">Coordenadas exactas del cliente</TooltipContent>
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

              {showQuickSuggestions ? (
                <CommandGroup heading="Sugerencias rapidas">
                  {filteredQuickSuggestions.map((suggestion) => (
                    <CommandItem
                      key={`${suggestion.label}-${suggestion.address}`}
                      value={`${suggestion.label}-${suggestion.address}`}
                      className="gap-3 px-3 py-3"
                      onSelect={() => {
                        onChange(suggestion.address);
                        onCoordsChange({ lat: null, lng: null, catalogId: null });
                        setOpen(false);
                      }}
                    >
                      <Star className="size-4 shrink-0 text-warning-text" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{suggestion.label}</p>
                        {suggestion.address && suggestion.address !== suggestion.label ? (
                          <p className="truncate text-xs text-muted-foreground">{suggestion.address}</p>
                        ) : null}
                      </div>
                      {typeof suggestion.usageCount === 'number' && suggestion.usageCount > 0 ? (
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                          {suggestion.usageCount} usos
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {showNetworkTier && networkResult ? (
                <CommandGroup heading="Resultado de busqueda">
                  <CommandItem
                    value="network-result"
                    className="gap-3 px-3 py-3"
                    onSelect={selectNetworkResult}
                  >
                    <MapPin className="size-4 shrink-0 text-success-text" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{value}</p>
                      {/* Direccion resuelta: deja que el operador confirme que no cayo
                          en una calle homonima antes de guardar. */}
                      {networkResult.formattedAddress &&
                      networkResult.formattedAddress.trim().toLowerCase() !== value.trim().toLowerCase() ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {networkResult.formattedAddress}
                        </p>
                      ) : null}
                    </div>
                  </CommandItem>
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
        <div className="space-y-2">
          <OriginPinMap lat={coords.lat as number} lng={coords.lng as number} onChange={handlePinDrag} />
          {showSaveCheckbox && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={saveToCatalog}
                onCheckedChange={(checked) => onSaveToCatalogChange(checked === true)}
              />
              <Label className="cursor-pointer font-normal">Guardar en catalogo de ubicaciones</Label>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
