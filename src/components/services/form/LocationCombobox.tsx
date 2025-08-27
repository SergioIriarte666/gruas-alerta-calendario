import React, { useState } from 'react';
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
}

export const LocationCombobox = ({
  value,
  onValueChange,
  placeholder,
  type,
  disabled = false
}: LocationComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { frequentOrigins, frequentDestinations, searchLocations } = useFrequentLocations();

  const frequentLocations = type === 'origin' ? frequentOrigins : frequentDestinations;

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setInputValue(search);
    onValueChange(search);
  };

  const displayedLocations = inputValue.length >= 2 
    ? searchLocations(inputValue, type)
    : frequentLocations.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Escribir o buscar ubicación..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-sm text-muted-foreground">
                {inputValue ? "Presiona Enter para usar esta ubicación" : "Escribir ubicación nueva"}
              </div>
            </CommandEmpty>
            {displayedLocations.length > 0 && (
              <CommandGroup heading="Ubicaciones frecuentes">
                {displayedLocations.map((item) => (
                  <CommandItem
                    key={item.location}
                    value={item.location}
                    onSelect={() => handleSelect(item.location)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};