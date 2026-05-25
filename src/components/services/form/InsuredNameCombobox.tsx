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
import { useFrequentInsuredNames } from '@/hooks/services/useFrequentInsuredNames';

interface InsuredNameComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const InsuredNameCombobox = ({
  value,
  onValueChange,
  disabled = false,
  className = ''
}: InsuredNameComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { frequentInsuredNames, searchInsuredNames } = useFrequentInsuredNames();

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setInputValue(search);
    onValueChange(search);
  };

  const displayedNames = inputValue.length >= 2 
    ? searchInsuredNames(inputValue)
    : frequentInsuredNames.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className="truncate text-left">
            {value || <span className="text-muted-foreground">Nombre del asegurado</span>}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Escribir o buscar asegurado..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-sm text-muted-foreground">
                {inputValue ? "Presiona Enter para usar este nombre" : "Escribir nombre nuevo"}
              </div>
            </CommandEmpty>
            {displayedNames.length > 0 && (
              <CommandGroup heading="Asegurados frecuentes">
                {displayedNames.map((item) => (
                  <CommandItem
                    key={item.name}
                    value={item.name}
                    onSelect={() => handleSelect(item.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === item.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
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
