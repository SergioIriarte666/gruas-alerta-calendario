import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useMapboxRoute } from '@/hooks/transport/useMapboxRoute';
import { MapPin, Loader2 } from 'lucide-react';

interface MapboxPlaceInputProps {
  value: string;
  onChange: (value: string) => void;
  onCoordinatesChange?: (coords: [number, number] | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MapboxPlaceInput: React.FC<MapboxPlaceInputProps> = ({
  value,
  onChange,
  onCoordinatesChange,
  placeholder = 'Buscar ciudad...',
  disabled,
}) => {
  const { geocode, isLoading } = useMapboxRoute();
  const [suggestions, setSuggestions] = useState<Array<{ name: string; coordinates: [number, number] }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (text: string) => {
    onChange(text);
    onCoordinatesChange?.(null);

    if (debounceTimer) clearTimeout(debounceTimer);

    if (text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await geocode(text);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 400);
    setDebounceTimer(timer);
  };

  const handleSelect = (suggestion: { name: string; coordinates: [number, number] }) => {
    onChange(suggestion.name);
    onCoordinatesChange?.(suggestion.coordinates);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 pr-8"
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              onClick={() => handleSelect(s)}
            >
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
