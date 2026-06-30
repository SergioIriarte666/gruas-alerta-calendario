import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Check, Loader2, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGoogleMaps, type PlaceSuggestion, type PlaceResult } from '@/hooks/useGoogleMaps';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AddressAutocomplete');

export type { PlaceResult };

export interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: PlaceResult) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: boolean;
  /** Optional list of historical suggestions to show when input is empty or short */
  historySuggestions?: string[];
  className?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Buscar dirección en Chile...',
  disabled = false,
  label,
  error = false,
  historySuggestions = [],
  className,
  id,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const { autocomplete, getPlaceDetails } = useGoogleMaps();

  const runSearch = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text || text.length < 2) {
        setSuggestions([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const results = await autocomplete(text);
          setSuggestions(results);
        } catch (e) {
          logger.warn('autocomplete fetch error', e);
        } finally {
          setLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [autocomplete],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);
    runSearch(text);
    if (!open) setOpen(true);
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    // Optimistically set the text right away
    onChange(suggestion.text);
    setOpen(false);
    setSuggestions([]);

    if (!onPlaceSelected) return;

    setFetchingDetails(true);
    try {
      const place = await getPlaceDetails(suggestion.placeId);
      if (place) {
        // Use the formatted address from Details (more accurate than prediction text)
        onChange(place.formattedAddress);
        onPlaceSelected(place);
        logger.debug('place selected', place);
      }
    } catch (e) {
      logger.warn('getPlaceDetails error', e);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleSelectHistory = (address: string) => {
    onChange(address);
    setOpen(false);
    setSuggestions([]);
  };

  const filteredHistory =
    value.trim().length >= 2
      ? historySuggestions.filter((h) =>
          h.toLowerCase().includes(value.toLowerCase()),
        ).slice(0, 5)
      : historySuggestions.slice(0, 5);

  const hasPlaceSuggestions = suggestions.length > 0;
  const hasHistory = filteredHistory.length > 0;
  const showEmpty = !loading && !hasPlaceSuggestions && !hasHistory && value.trim().length >= 2;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id} className={error ? 'text-destructive' : ''}>
          {label}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              id={id}
              value={value}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Small delay so CommandItem onClick can fire first
                setTimeout(() => setOpen(false), 150);
              }}
              placeholder={placeholder}
              disabled={disabled || fetchingDetails}
              autoComplete="off"
              className={cn(
                'pr-8',
                error && 'border-destructive focus-visible:ring-destructive',
              )}
              aria-expanded={open}
              aria-haspopup="listbox"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              {(loading || fetchingDetails) ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <MapPin className="size-4 text-muted-foreground opacity-50" />
              )}
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 shadow-lg"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {showEmpty && (
                <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                  Sin resultados en Chile para "{value}"
                </CommandEmpty>
              )}

              {hasHistory && (
                <CommandGroup heading="Del historial">
                  {filteredHistory.map((address) => (
                    <CommandItem
                      key={address}
                      value={address}
                      onSelect={() => handleSelectHistory(address)}
                      className="gap-2"
                    >
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="truncate text-sm">{address}</span>
                        <Check
                          className={cn(
                            'ml-auto size-4 shrink-0',
                            value === address ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {hasPlaceSuggestions && (
                <CommandGroup heading="Sugerencias de Google">
                  {suggestions.map((s) => (
                    <CommandItem
                      key={s.placeId}
                      value={s.placeId}
                      onSelect={() => handleSelectSuggestion(s)}
                      className="gap-2"
                    >
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.mainText}</p>
                        {s.secondaryText && (
                          <p className="text-xs text-muted-foreground truncate">
                            {s.secondaryText}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
