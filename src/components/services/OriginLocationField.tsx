import { useMemo, useState } from 'react';
import { Building2, Loader2, MapPin, Star } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useFavoriteLocations, matchFavoriteLocations } from '@/hooks/useFavoriteLocations';
import { useOriginSearchCascade } from '@/hooks/useOriginSearchCascade';
import { OriginPinMap } from '@/components/services/OriginPinMap';
import type { QuickAddress } from '@/components/services/MapboxAddressInput';

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

  const { data: favoriteLocations = [] } = useFavoriteLocations();
  const catalogMatches = useMemo(
    () => (open ? matchFavoriteLocations(value, favoriteLocations) : []),
    [open, value, favoriteLocations],
  );

  const trimmed = value.trim();
  const showNetworkTier = open && !disabled && trimmed.length >= 3;
  const { result: networkResult, loading: networkLoading } = useOriginSearchCascade(value, {
    enabled: showNetworkTier,
    department,
  });

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
    setOpen(false);
  };

  const selectNetworkResult = () => {
    if (!networkResult) return;
    onCoordsChange({ lat: networkResult.lat, lng: networkResult.lng, catalogId: null });
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
              {networkLoading ? (
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
              {showCatalog ? (
                <CommandGroup heading="Catalogo de ubicaciones">
                  {catalogMatches.map((match) => (
                    <CommandItem
                      key={match.id}
                      value={match.id}
                      className="gap-3 px-3 py-3"
                      onSelect={() => selectCatalogMatch(match)}
                    >
                      <Building2 className="size-4 shrink-0 text-cyan-600" />
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
                      <Star className="size-4 shrink-0 text-amber-500" />
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
                    <MapPin className="size-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{value}</p>
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
