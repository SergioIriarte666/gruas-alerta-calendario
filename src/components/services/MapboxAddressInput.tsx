import { useMemo, useState } from 'react';
import { Loader2, MapPin, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useMapboxGeocode } from '@/hooks/useMapboxGeocode';
import { COPIAPO_PROXIMITY } from '@/lib/geoConstants';
import { cn } from '@/lib/utils';

export interface QuickAddress {
  label: string;
  address: string;
  coords?: [number, number];
  usageCount?: number;
}

interface MapboxAddressInputProps {
  value: string;
  onChange: (address: string, coords?: [number, number]) => void;
  placeholder?: string;
  quickSuggestions?: QuickAddress[];
  className?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}

export function MapboxAddressInput({
  value,
  onChange,
  placeholder = 'Direccion',
  quickSuggestions = [],
  className,
  disabled = false,
  error = false,
  id,
}: MapboxAddressInputProps) {
  const [open, setOpen] = useState(false);
  const { results, loading } = useMapboxGeocode(value, {
    enabled: open && !disabled,
    proximity: COPIAPO_PROXIMITY,
  });

  const filteredQuickSuggestions = useMemo(() => {
    const search = value.trim().toLowerCase();
    if (search.length >= 3) return [];

    return quickSuggestions
      .filter((suggestion) =>
        search.length === 0
          ? true
          : suggestion.address.toLowerCase().includes(search) ||
            suggestion.label.toLowerCase().includes(search),
      )
      .slice(0, 6);
  }, [quickSuggestions, value]);

  const showQuickSuggestions = filteredQuickSuggestions.length > 0 && value.trim().length < 3;
  const showMapboxResults = value.trim().length >= 3;
  const showEmpty = showMapboxResults && !loading && results.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
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
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
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
            {showQuickSuggestions ? (
              <CommandGroup heading="Sugerencias rapidas">
                {filteredQuickSuggestions.map((suggestion) => (
                  <CommandItem
                    key={`${suggestion.label}-${suggestion.address}`}
                    value={`${suggestion.label}-${suggestion.address}`}
                    className="gap-3 px-3 py-3"
                    onSelect={() => {
                      onChange(suggestion.address, suggestion.coords);
                      setOpen(false);
                    }}
                  >
                    <Star className="size-4 shrink-0 text-warning-text" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {suggestion.label}
                      </p>
                      {suggestion.address && suggestion.address !== suggestion.label ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {suggestion.address}
                        </p>
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

            {showMapboxResults ? (
              <CommandGroup heading="Resultados de direccion">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.name}-${result.coordinates.join(',')}`}
                    value={result.name}
                    className="gap-3 px-3 py-3"
                    onSelect={() => {
                      onChange(result.name, result.coordinates);
                      setOpen(false);
                    }}
                  >
                    <MapPin className="size-4 shrink-0 text-success-text" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{result.name}</p>
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
  );
}
