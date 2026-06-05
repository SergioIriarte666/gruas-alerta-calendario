import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useFrequentLocations } from '@/hooks/services/useFrequentLocations';

interface LocationComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  type: 'origin' | 'destination';
  disabled?: boolean;
  className?: string;
}

export const LocationCombobox = ({
  value,
  onValueChange,
  placeholder,
  type,
  disabled = false,
  className = ''
}: LocationComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { frequentOrigins, frequentDestinations, searchLocations } = useFrequentLocations();

  const frequentLocations = type === 'origin' ? frequentOrigins : frequentDestinations;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setInputValue(search);
    onValueChange(search);
  };

  const displayedLocations =
    inputValue.trim().length >= 2
      ? searchLocations(inputValue, type)
      : frequentLocations.slice(0, 5);

  const trimmedInput = inputValue.trim();
  const hasExactMatch = displayedLocations.some(
    (item) => item.location.toLowerCase() === trimmedInput.toLowerCase()
  );
  const showFreeText = trimmedInput.length > 0 && !hasExactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
            className="p-0"
            align="start"
            style={{ width: 'var(--radix-popover-trigger-width)' }}
          >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Escribir o buscar ubicación..."
            value={inputValue}
            onValueChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmedInput.length > 0) {
                e.preventDefault();
                handleSelect(trimmedInput);
              }
            }}
          />
          <CommandList>
            {displayedLocations.length === 0 && !showFreeText && (
              <CommandEmpty>
                <div className="p-2 text-sm text-muted-foreground">
                  Escribir ubicación nueva
                </div>
              </CommandEmpty>
            )}
            {displayedLocations.length > 0 && (
              <CommandGroup heading={trimmedInput.length >= 2 ? 'Coincidencias del historial' : 'Ubicaciones frecuentes'}>
                {displayedLocations.map((item) => (
                  <CommandItem
                    key={item.location}
                    value={item.location}
                    onSelect={() => handleSelect(item.location)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === item.location ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{item.location}</div>
                      <div className="text-xs text-muted-foreground">
                        Usado {item.count} {item.count === 1 ? 'vez' : 'veces'}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showFreeText && (
              <CommandGroup heading="Nueva ubicación">
                <CommandItem
                  key={`__use_${trimmedInput}`}
                  value={`__use_${trimmedInput}`}
                  onSelect={() => handleSelect(trimmedInput)}
                >
                  <Check className="mr-2 size-4 opacity-0" />
                  <div className="flex-1">
                    <div className="font-medium">Usar "{trimmedInput}"</div>
                    <div className="text-xs text-muted-foreground">
                      Guardar como ubicación nueva
                    </div>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};