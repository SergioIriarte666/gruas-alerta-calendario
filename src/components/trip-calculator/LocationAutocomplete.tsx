import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, Loader2, MapPin, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import {
  matchFavoriteLocations,
  useFavoriteLocations,
  type FavoriteLocation,
} from '@/hooks/useFavoriteLocations';
import { createLogger } from '@/lib/logger';

const logger = createLogger('LocationAutocomplete');

interface AutocompletePrediction {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
  };
}

export interface SelectedLocation {
  name: string;
  latitude: number;
  longitude: number;
  source: 'favorite' | 'google';
}

interface LocationAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (location: SelectedLocation) => void;
  placeholder?: string;
  label: string;
}

function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function LocationAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder,
  label,
}: LocationAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useFavoriteLocations();
  const selectableFavorites = useMemo(
    () =>
      favorites.filter(
        (location) => location.latitude != null && location.longitude != null,
      ),
    [favorites],
  );
  const favoriteMatches = matchFavoriteLocations(query, selectableFavorites);
  const displayedFavorites = useMemo(() => {
    if (query.trim().length < 2) {
      return selectableFavorites.slice(0, 8);
    }

    return favoriteMatches;
  }, [favoriteMatches, query, selectableFavorites]);
  const shouldCallGoogle =
    query.trim().length >= 3 && favoriteMatches.length === 0;

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!shouldCallGoogle) {
      setPredictions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('maps-proxy', {
          body: {
            action: 'autocomplete',
            input: query.trim(),
            sessionToken: sessionTokenRef.current,
          },
        });

        if (error) throw error;
        setPredictions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } catch (err) {
        logger.error('Location autocomplete error', err);
        setPredictions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query, shouldCallGoogle]);

  const handleFavoriteSelect = (location: FavoriteLocation) => {
    if (location.latitude == null || location.longitude == null) {
      return;
    }

    setQuery(location.name);
    onValueChange(location.name);
    onSelect({
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      source: 'favorite',
    });
    setOpen(false);

    supabase
      .from('saved_locations')
      .update({ usage_count: location.usage_count + 1 })
      .eq('id', location.id)
      .then(({ error }) => {
        if (error) {
          logger.error('Error incrementing usage_count', error);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['favorite-locations'] });
      });
  };

  const handleGoogleSelect = async (prediction: AutocompletePrediction) => {
    setResolvingPlace(true);
    try {
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: {
          action: 'place_details',
          placeId: prediction.placePrediction.placeId,
          sessionToken: sessionTokenRef.current,
        },
      });

      if (error) throw error;

      const lat = data?.location?.latitude;
      const lng = data?.location?.longitude;
      const displayName =
        data?.displayName?.text ??
        data?.formattedAddress ??
        prediction.placePrediction.text.text;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        toast.error('No se pudo obtener las coordenadas de la ubicacion');
        return;
      }

      setQuery(displayName);
      onValueChange(displayName);
      onSelect({
        name: displayName,
        latitude: lat,
        longitude: lng,
        source: 'google',
      });
      setOpen(false);
      sessionTokenRef.current = generateSessionToken();
    } catch (err) {
      logger.error('Place details error', err);
      toast.error('Error obteniendo detalles del lugar');
    } finally {
      setResolvingPlace(false);
    }
  };

  const handleSaveAsFavorite = async () => {
    if (predictions.length === 0) return;

    try {
      const firstPrediction = predictions[0];
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: {
          action: 'place_details',
          placeId: firstPrediction.placePrediction.placeId,
          sessionToken: sessionTokenRef.current,
        },
      });

      if (error) throw error;

      const lat = data?.location?.latitude;
      const lng = data?.location?.longitude;
      const address =
        data?.formattedAddress ?? firstPrediction.placePrediction.text.text;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        toast.error('No se pudo obtener coordenadas');
        return;
      }

      const { error: insertError } = await supabase.from('saved_locations').insert({
        name: query.trim(),
        address,
        latitude: lat,
        longitude: lng,
        category: 'otro',
        aliases: [],
      });

      if (insertError) {
        logger.error('Error saving favorite', insertError);
        toast.error('No se pudo guardar el lugar');
        return;
      }

      toast.success(`"${query.trim()}" guardado como lugar frecuente`);
      queryClient.invalidateQueries({ queryKey: ['favorite-locations'] });
    } catch (err) {
      logger.error('Save favorite error', err);
      toast.error('Error guardando lugar');
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div>
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                setQuery(nextValue);
                onValueChange(nextValue);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="max-h-96 w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {displayedFavorites.length > 0 ? (
                <CommandGroup heading="Lugares frecuentes">
                  {displayedFavorites.map((location) => (
                    <CommandItem
                      key={location.id}
                      onSelect={() => handleFavoriteSelect(location)}
                      className="cursor-pointer"
                    >
                      <Star className="mr-2 h-4 w-4 shrink-0 text-warning" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate font-medium text-foreground">
                          {location.name}
                        </span>
                        {location.address && location.address !== location.name ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {location.address}
                          </span>
                        ) : null}
                      </div>
                      {location.usage_count > 0 ? (
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                          {location.usage_count} usos
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {searchLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando ubicaciones...
                </div>
              ) : null}

              {resolvingPlace ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Obteniendo ubicacion...
                </div>
              ) : null}

              {shouldCallGoogle && !searchLoading && predictions.length === 0 ? (
                <CommandEmpty>Sin resultados</CommandEmpty>
              ) : null}

              {!shouldCallGoogle &&
              displayedFavorites.length === 0 &&
              !searchLoading &&
              !resolvingPlace ? (
                <CommandEmpty>No hay lugares frecuentes disponibles.</CommandEmpty>
              ) : null}

              {predictions.length > 0 ? (
                <CommandGroup heading="Sugerencias de ubicacion">
                  {predictions.map((prediction) => {
                    const mainText =
                      prediction.placePrediction.structuredFormat?.mainText?.text ??
                      prediction.placePrediction.text.text;
                    const secondaryText =
                      prediction.placePrediction.structuredFormat?.secondaryText?.text;

                    return (
                      <CommandItem
                        key={prediction.placePrediction.placeId}
                        onSelect={() => handleGoogleSelect(prediction)}
                        className="cursor-pointer"
                      >
                        <MapPin className="mr-2 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <span className="truncate font-medium text-foreground">
                            {mainText}
                          </span>
                          {secondaryText ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {secondaryText}
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}

              {predictions.length > 0 ? (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={handleSaveAsFavorite}
                  >
                    <Bookmark className="mr-2 h-3 w-3" />
                    Guardar "{query.trim()}" como lugar frecuente
                  </Button>
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
