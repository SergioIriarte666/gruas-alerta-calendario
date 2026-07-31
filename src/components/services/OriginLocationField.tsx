import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Building2,
  Loader2,
  MapPin,
  MapPinCheck,
  MapPinOff,
  Pencil,
  Route,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import {
  useCreateFavoriteLocation,
  useFavoriteLocations,
  matchFavoriteLocations,
  normalizeLocationText,
  prepareLocationAliases,
  useUpdateFavoriteLocation,
  type FavoriteLocation,
} from '@/hooks/useFavoriteLocations';
import { useGoogleMaps, type PlaceSuggestion } from '@/hooks/useGoogleMaps';
import { OriginPinMap } from '@/components/services/OriginPinMap';
import { LocationPickerDialog } from '@/components/shared/LocationPickerDialog';
import { parseLocationInput } from '@/lib/locationParser';
import {
  formatMapPointLabel,
  isResolutionFailure,
  useLocationInputResolver,
} from '@/hooks/useLocationInputResolver';
import { EXACT_LOCATION_SOURCES, type ServiceLocationSource } from '@/types/serviceLocation';
import { formatChileAddress, formatChileLocationLabel } from '@/utils/chileLocationLabel';

const logger = createLogger('OriginLocationField');
const PLACE_AUTOCOMPLETE_DEBOUNCE_MS = 300;
// El blur tambien ocurre al hacer clic en una sugerencia del popover: se espera
// un instante para no resolver el texto tipeado por encima de esa seleccion.
const BLUR_RESOLVE_DELAY_MS = 200;

const CATALOG_CATEGORIES = [
  { value: 'faena_minera', label: 'Faena minera' },
  { value: 'faena', label: 'Faena' },
  { value: 'base', label: 'Base o instalacion' },
  { value: 'ciudad', label: 'Ciudad' },
  { value: 'destino', label: 'Destino' },
  { value: 'recurrente', label: 'Recurrente' },
];
const NO_CATEGORY = '__none__';

export interface OriginResolvedCoords {
  lat: number | null;
  lng: number | null;
  catalogId: string | null;
  /** De donde salio el punto. null = sin coordenada (o servicio historico). */
  source?: ServiceLocationSource | null;
}

const NO_COORDS: OriginResolvedCoords = { lat: null, lng: null, catalogId: null, source: null };

interface OriginLocationFieldProps {
  value: string;
  onChange: (value: string) => void;
  coords: OriginResolvedCoords;
  onCoordsChange: (coords: OriginResolvedCoords) => void;
  department?: string | null;
  canEditCatalog?: boolean;
  canCreateCatalog?: boolean;
  /** Solo admin: habilita fijar el punto a mano en el mapa. */
  canPickOnMap?: boolean;
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
  canEditCatalog = false,
  canCreateCatalog = false,
  canPickOnMap = false,
  placeholder = 'Direccion de origen del servicio',
  className,
  disabled = false,
  error = false,
  id,
}: OriginLocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [networkSuggestions, setNetworkSuggestions] = useState<PlaceSuggestion[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [editingLocation, setEditingLocation] = useState<FavoriteLocation | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingAliases, setEditingAliases] = useState('');
  const [editingRoutingAccess, setEditingRoutingAccess] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [savingToCatalog, setSavingToCatalog] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [catalogAliases, setCatalogAliases] = useState<string[]>([]);
  const [catalogAliasDraft, setCatalogAliasDraft] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>(NO_CATEGORY);

  const { data: favoriteLocations = [] } = useFavoriteLocations();
  const updateFavoriteLocation = useUpdateFavoriteLocation();
  const createFavoriteLocation = useCreateFavoriteLocation();
  const { autocomplete, getPlaceDetails } = useGoogleMaps();
  const { resolve } = useLocationInputResolver({ department });

  // El blur se evalua con un retardo: sin refs leeria el estado del render en
  // que se disparo, no el que dejo una seleccion hecha en el intertanto.
  const valueRef = useRef(value);
  const coordsRef = useRef(coords);
  const selectingRef = useRef(false);
  const resolvingRef = useRef(false);
  const lastResolvedRef = useRef<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
    coordsRef.current = coords;
  }, [value, coords]);
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
  // Nivel 0: si el texto ya es una ubicacion explicita (coordenadas, DMS,
  // plus code o link de Google Maps), no tiene sentido gastar llamadas a
  // Places/Geocoding en el mientras tanto.
  const isExplicitLocationInput = useMemo(
    () => parseLocationInput(trimmed).kind !== 'text',
    [trimmed],
  );
  const showNetworkTier = open && !disabled && trimmed.length >= 2 && !isExplicitLocationInput;

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

  /**
   * Resolucion unica del campo: cataloga el texto (coordenadas, link, plus code
   * o texto libre) y baja por la cascada correspondiente. El texto escrito es
   * soberano: un fracaso avisa, pero NUNCA borra ni bloquea lo que el usuario
   * tipeó. El 99% de los servicios son auxilios en ruta y "camino a Mantoverde,
   * km 12, poste 45" no es geocodificable — para eso está el pin en el mapa.
   */
  const runResolution = async (raw: string) => {
    const query = raw.trim();
    if (!query || disabled) return;

    resolvingRef.current = true;
    lastResolvedRef.current = query;
    setIsResolvingLocation(true);
    setOpen(false);

    try {
      const result = await resolve(query);

      if (isResolutionFailure(result)) {
        onCoordsChange(NO_COORDS);
        if (result.error === 'not_found') {
          toast.info('No ubicamos esa dirección automáticamente. Puedes fijar el punto en el mapa.');
          return;
        }

        toast.error(
          result.error === 'link_unresolvable'
            ? 'No pudimos resolver ese enlace. Fija el punto en el mapa o escribe la referencia.'
            : 'No pudimos resolver ese plus code. Fija el punto en el mapa o escribe la referencia.',
        );
        return;
      }

      onChange(result.label);
      lastResolvedRef.current = result.label;
      onCoordsChange({
        lat: result.lat,
        lng: result.lng,
        catalogId: result.catalogId,
        source: result.source,
      });
    } catch (err) {
      logger.warn('No se pudo resolver la ubicacion', err);
      toast.error('No pudimos resolver esa ubicación. Fija el punto en el mapa si lo necesitas.');
    } finally {
      resolvingRef.current = false;
      setIsResolvingLocation(false);
    }
  };

  /**
   * Punto fijado a mano. La etiqueta escrita manda: solo se rellena el campo si
   * está vacío, y con la direccion de referencia o las coordenadas — nunca
   * pisando lo que el usuario escribió.
   */
  const handlePickerConfirm = ({
    lat,
    lng,
    address,
  }: {
    lat: number;
    lng: number;
    address: string | null;
  }) => {
    onCoordsChange({ lat, lng, catalogId: null, source: 'manual_pin' });

    if (!valueRef.current.trim()) {
      const label = address ?? formatMapPointLabel(lat, lng);
      onChange(label);
      lastResolvedRef.current = label;
    }
  };

  const handleBlurResolve = () => {
    if (disabled) return;

    window.setTimeout(() => {
      if (selectingRef.current || resolvingRef.current) return;

      const current = valueRef.current.trim();
      if (!current) return;
      if (coordsRef.current.lat != null && coordsRef.current.lng != null) return;
      if (lastResolvedRef.current === current) return;

      void runResolution(current);
    }, BLUR_RESOLVE_DELAY_MS);
  };

  const showCatalog = catalogMatches.length > 0;
  const showEmpty =
    showNetworkTier && !networkLoading && networkSuggestions.length === 0 && !showCatalog;
  const hasConfirmedCoords = coords.lat != null && coords.lng != null;

  const selectCatalogMatch = (match: (typeof catalogMatches)[number]) => {
    selectingRef.current = true;
    const label = formatChileAddress(match.name);
    onChange(label);
    lastResolvedRef.current = label;
    onCoordsChange({
      lat: match.latitude,
      lng: match.longitude,
      catalogId: match.id,
      source: 'catalog',
    });
    setOpen(false);
    window.setTimeout(() => {
      selectingRef.current = false;
    }, BLUR_RESOLVE_DELAY_MS * 2);
  };

  const openCatalogEditor = (location: FavoriteLocation) => {
    setEditingLocation(location);
    setEditingName(formatChileAddress(location.name));
    setEditingAliases(location.aliases.join('\n'));
    setEditingRoutingAccess(
      location.routing_access_latitude != null &&
        location.routing_access_longitude != null
        ? {
            lat: location.routing_access_latitude,
            lng: location.routing_access_longitude,
          }
        : null,
    );
    setOpen(false);
  };

  const saveCatalogEditor = async () => {
    if (!editingLocation) return;

    const name = editingName.trim();
    if (!name) {
      toast.error('El nombre visible del lugar es obligatorio.');
      return;
    }

    const rawAliases = editingAliases
      .split(/[\n,;]+/)
      .map((alias) => alias.trim())
      .filter(Boolean);
    const aliases = prepareLocationAliases({
      name,
      previousName: editingLocation.name,
      aliases: rawAliases,
    });

    try {
      await updateFavoriteLocation.mutateAsync({
        id: editingLocation.id,
        name,
        aliases,
        routingAccess: editingRoutingAccess,
      });

      if (coords.catalogId === editingLocation.id) {
        onChange(name);
      }

      toast.success('Lugar actualizado');
      setEditingLocation(null);
    } catch (updateError) {
      logger.error('No se pudo actualizar el catálogo de lugares', updateError);
      toast.error('No se pudo actualizar el lugar.');
    }
  };

  const selectNetworkSuggestion = async (suggestion: PlaceSuggestion) => {
    selectingRef.current = true;
    setOpen(false);
    setNetworkSuggestions([]);
    setIsResolvingLocation(true);

    try {
      if (suggestion.source === 'geocode' && suggestion.coordinates) {
        const [lng, lat] = suggestion.coordinates;
        const label = formatChileAddress(suggestion.text);
        onChange(label);
        lastResolvedRef.current = label;
        onCoordsChange({ lat, lng, catalogId: null, source: 'places' });
        return;
      }

      if (!suggestion.placeId) return;
      const place = await getPlaceDetails(suggestion.placeId);
      if (!place) {
        toast.error('No pudimos obtener la ubicación exacta seleccionada.');
        return;
      }

      const label = formatChileLocationLabel({
        mainText: suggestion.mainText,
        secondaryText: suggestion.secondaryText,
        formattedAddress: place.formattedAddress || suggestion.text,
      });
      onChange(label);
      lastResolvedRef.current = label;
      onCoordsChange({ lat: place.lat, lng: place.lng, catalogId: null, source: 'places' });
    } finally {
      selectingRef.current = false;
      setIsResolvingLocation(false);
    }
  };

  const handlePinDrag = (lat: number, lng: number) => {
    // El pin ya no representa exactamente la ubicacion del catalogo una vez
    // arrastrado, asi que se habilita "guardar como nueva" si es admin.
    onCoordsChange({ lat, lng, catalogId: null, source: 'manual_pin' });
  };

  const openCatalogSave = () => {
    setCatalogName(value.trim());
    setCatalogAliases([]);
    setCatalogAliasDraft('');
    setCatalogCategory(NO_CATEGORY);
    setSavingToCatalog(true);
  };

  const addCatalogAlias = (raw: string) => {
    const alias = raw.trim().replace(/,$/, '').trim();
    if (!alias) return;
    setCatalogAliases((prev) =>
      prev.some((existing) => normalizeLocationText(existing) === normalizeLocationText(alias))
        ? prev
        : [...prev, alias],
    );
    setCatalogAliasDraft('');
  };

  const saveToCatalog = async () => {
    const name = catalogName.trim();
    if (!name) {
      toast.error('El nombre del lugar es obligatorio.');
      return;
    }
    if (coords.lat == null || coords.lng == null) return;

    try {
      const newId = await createFavoriteLocation.mutateAsync({
        name,
        aliases: prepareLocationAliases({ name, aliases: catalogAliases }),
        category: catalogCategory === NO_CATEGORY ? null : catalogCategory,
        address: value.trim() && value.trim() !== name ? value.trim() : null,
        lat: coords.lat,
        lng: coords.lng,
      });

      onChange(name);
      lastResolvedRef.current = name;
      onCoordsChange({ lat: coords.lat, lng: coords.lng, catalogId: newId, source: 'catalog' });
      setSavingToCatalog(false);
      toast.success('Lugar guardado en el catálogo');
    } catch (saveError) {
      logger.error('No se pudo guardar el lugar en el catálogo', saveError);
      toast.error('No se pudo guardar el lugar en el catálogo.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Input
              id={id}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                onCoordsChange(NO_COORDS);
                lastResolvedRef.current = null;
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={handleBlurResolve}
              onPaste={(event) => {
                // Solo se toma el control cuando el pegado reemplaza todo el
                // campo (caso real: pegar un enlace o un plus code). Un pegado
                // parcial sigue el camino normal y se resuelve al salir.
                const input = event.currentTarget;
                const replacesAll =
                  input.value.trim() === '' ||
                  (input.selectionStart === 0 && input.selectionEnd === input.value.length);
                if (!replacesAll) return;

                const pasted = (event.clipboardData?.getData('text') ?? '').trim();
                if (!pasted) return;

                event.preventDefault();
                onChange(pasted);
                onCoordsChange(NO_COORDS);
                void runResolution(pasted);
              }}
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
                      {coords.source === 'catalog'
                        ? 'Punto verificado del catálogo'
                        : coords.source === 'manual_pin'
                          ? 'Punto fijado a mano en el mapa'
                          : coords.source && EXACT_LOCATION_SOURCES.has(coords.source)
                            ? 'Coordenadas exactas del enlace o plus code'
                            : 'Ubicacion confirmada en el mapa'}
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
                        <p className="truncate text-sm font-medium text-foreground">
                          {formatChileAddress(match.name)}
                        </p>
                        {match.address ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {formatChileAddress(match.address)}
                          </p>
                        ) : null}
                        {match.aliases.length > 0 ? (
                          <p className="truncate text-xs text-muted-foreground">
                            Alias: {match.aliases.map(formatChileAddress).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                      {canEditCatalog ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Editar ${match.name}`}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openCatalogEditor(match);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
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

      {/* Auxilio en ruta: el punto casi nunca tiene nombre. Fijarlo a mano es
          la unica via real, y por eso vive al lado del campo y no escondido. */}
      {canPickOnMap && !disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                aria-label="Fijar el punto en el mapa"
                onClick={() => setPickerOpen(true)}
              >
                <MapPin className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Fijar el punto en el mapa</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      </div>

      {/* Estado permanente de la coordenada: sin esto, un servicio sin punto se
          guardaba igual pero nadie se enteraba hasta que faltaba el tracking. */}
      {isResolvingLocation ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Resolviendo la ubicación...
        </p>
      ) : hasConfirmedCoords ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-success-text">
          <MapPinCheck className="size-3.5 shrink-0" />
          <span>Punto fijado</span>
          <span className="select-all font-mono tabular-nums text-muted-foreground">
            {(coords.lat as number).toFixed(6)}, {(coords.lng as number).toFixed(6)}
          </span>
          {canPickOnMap && !disabled ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setPickerOpen(true)}
            >
              ver en mapa
            </Button>
          ) : null}
        </p>
      ) : trimmed ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warning-text">
          <MapPinOff className="size-3.5 shrink-0" />
          <span>Sin coordenada — no habrá seguimiento ni métricas de ruta</span>
          {canPickOnMap && !disabled ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-warning-text"
              onClick={() => setPickerOpen(true)}
            >
              Fijar en mapa
            </Button>
          ) : null}
        </p>
      ) : null}

      {canPickOnMap ? (
        <LocationPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialLat={coords.lat}
          initialLng={coords.lng}
          initialLabel={value}
          onConfirm={handlePickerConfirm}
        />
      ) : null}

      {hasConfirmedCoords && (
        <OriginPinMap lat={coords.lat as number} lng={coords.lng as number} onChange={handlePinDrag} />
      )}

      {/* El punto se resolvio fuera del catalogo (enlace, plus code,
          coordenadas o Places): ofrecer guardarlo evita repetir el mismo
          rodeo la proxima vez que alguien escriba ese nombre. */}
      {canCreateCatalog && hasConfirmedCoords && coords.catalogId == null && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={openCatalogSave}
        >
          <BookmarkPlus className="mr-1.5 size-3.5" />
          Guardar en catálogo
        </Button>
      ) : null}

      <Dialog
        open={savingToCatalog}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !createFavoriteLocation.isPending) setSavingToCatalog(false);
        }}
      >
        {savingToCatalog && coords.lat != null && coords.lng != null && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Guardar en el catálogo</DialogTitle>
              <DialogDescription>
                Las coordenadas quedan bloqueadas tal como se resolvieron: nadie las
                volverá a geocodificar. Los alias permiten encontrar este mismo punto
                escribiendo otros nombres.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id ?? 'location'}-new-catalog-name`}>Nombre</Label>
                <Input
                  id={`${id ?? 'location'}-new-catalog-name`}
                  value={catalogName}
                  onChange={(event) => setCatalogName(event.target.value)}
                  placeholder="Ej: Minera Mantoverde Portería"
                  disabled={createFavoriteLocation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${id ?? 'location'}-new-catalog-aliases`}>
                  Alias de búsqueda <span className="text-muted-foreground">(opcional)</span>
                </Label>
                {catalogAliases.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {catalogAliases.map((alias) => (
                      <Badge key={alias} variant="secondary" className="gap-1 pr-1">
                        {alias}
                        <button
                          type="button"
                          aria-label={`Quitar alias ${alias}`}
                          className="rounded-full p-0.5 hover:bg-muted"
                          onClick={() =>
                            setCatalogAliases((prev) => prev.filter((item) => item !== alias))
                          }
                          disabled={createFavoriteLocation.isPending}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Input
                  id={`${id ?? 'location'}-new-catalog-aliases`}
                  value={catalogAliasDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next.endsWith(',')) {
                      addCatalogAlias(next);
                      return;
                    }
                    setCatalogAliasDraft(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addCatalogAlias(catalogAliasDraft);
                      return;
                    }
                    if (event.key === 'Backspace' && !catalogAliasDraft) {
                      setCatalogAliases((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => addCatalogAlias(catalogAliasDraft)}
                  placeholder="Escribe un alias y presiona Enter"
                  disabled={createFavoriteLocation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${id ?? 'location'}-new-catalog-category`}>
                  Categoría <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Select
                  value={catalogCategory}
                  onValueChange={setCatalogCategory}
                  disabled={createFavoriteLocation.isPending}
                >
                  <SelectTrigger id={`${id ?? 'location'}-new-catalog-category`}>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                    {CATALOG_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                Punto: {(coords.lat as number).toFixed(6)}, {(coords.lng as number).toFixed(6)}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSavingToCatalog(false)}
                disabled={createFavoriteLocation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void saveToCatalog()}
                disabled={createFavoriteLocation.isPending || !catalogName.trim()}
              >
                {createFavoriteLocation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* El cuerpo se monta SOLO con editingLocation presente. Los hijos de
          <Dialog> son JSX que React evalúa en CADA render del campo, esté
          abierto o no: con editingLocation en null, el `editingLocation.latitude`
          de "Definir acceso vial" reventaba el formulario entero apenas se
          pintaba el paso "Ubicación". */}
      <Dialog
        open={editingLocation != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !updateFavoriteLocation.isPending) setEditingLocation(null);
        }}
      >
        {editingLocation && (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar lugar frecuente</DialogTitle>
            <DialogDescription>
              El nombre visible aparecerá en origen y destino. Los alias permiten encontrar
              este mismo punto con otros nombres. El pin real nunca se modifica aquí.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id ?? 'location'}-catalog-name`}>Nombre visible</Label>
              <Input
                id={`${id ?? 'location'}-catalog-name`}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                placeholder="Ej: Custodia G5N"
                disabled={updateFavoriteLocation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id ?? 'location'}-catalog-aliases`}>
                Alias de búsqueda
              </Label>
              <Textarea
                id={`${id ?? 'location'}-catalog-aliases`}
                value={editingAliases}
                onChange={(event) => setEditingAliases(event.target.value)}
                placeholder={'Un alias por línea\nEj: Base G5N\nInstalaciones G5N'}
                rows={4}
                disabled={updateFavoriteLocation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Puedes ingresar uno por línea o separarlos con comas.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info-text">
                  <Route className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Acceso vial</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Úsalo cuando el proveedor de rutas desconozca un retorno, portería o
                    camino interno. El cliente seguirá viendo el pin real del lugar.
                  </p>
                </div>
              </div>

              {editingRoutingAccess ? (
                <div className="mt-4 space-y-3">
                  <OriginPinMap
                    lat={editingRoutingAccess.lat}
                    lng={editingRoutingAccess.lng}
                    onChange={(lat, lng) => setEditingRoutingAccess({ lat, lng })}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Arrastra el pin hasta el punto donde la grúa entra o sale de la red vial.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setEditingRoutingAccess(null)}
                      disabled={updateFavoriteLocation.isPending}
                    >
                      <Trash2 className="mr-1.5 size-3.5" />
                      Quitar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => {
                    if (
                      editingLocation.latitude != null &&
                      editingLocation.longitude != null
                    ) {
                      setEditingRoutingAccess({
                        lat: editingLocation.latitude,
                        lng: editingLocation.longitude,
                      });
                    }
                  }}
                  disabled={
                    updateFavoriteLocation.isPending ||
                    editingLocation.latitude == null ||
                    editingLocation.longitude == null
                  }
                >
                  <MapPin className="mr-2 size-4" />
                  Definir acceso vial
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingLocation(null)}
              disabled={updateFavoriteLocation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void saveCatalogEditor()}
              disabled={updateFavoriteLocation.isPending || !editingName.trim()}
            >
              {updateFavoriteLocation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
