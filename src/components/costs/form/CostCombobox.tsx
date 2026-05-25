import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFrequentCostData } from '@/hooks/costs/useFrequentCostData';

interface CostComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  type: 'description' | 'supplier' | 'part_name' | 'subcategory';
  categoryId?: string;
  disabled?: boolean;
}

export const CostCombobox = ({ 
  value, 
  onValueChange, 
  placeholder,
  type,
  categoryId,
  disabled = false
}: CostComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const { frequentDescriptions, frequentSuppliers, frequentPartNames, frequentSubcategories, searchData } = useFrequentCostData(categoryId);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onValueChange(newValue);
  };

  const frequentData = type === 'description' 
    ? frequentDescriptions 
    : type === 'supplier' 
    ? frequentSuppliers 
    : type === 'part_name'
    ? frequentPartNames
    : frequentSubcategories;

  const searchResults = inputValue.length >= 2 ? searchData(inputValue, type) : frequentData;

  React.useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn(
            "truncate",
            !inputValue && "text-muted-foreground"
          )}>
            {inputValue || placeholder}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] max-w-[400px] p-0 bg-popover border-border" align="start">
        <Command className="bg-popover">
          <CommandInput 
            placeholder={`Buscar o escribir nuevo...`}
            value={inputValue}
            onValueChange={handleInputChange}
            className="border-none focus:ring-0"
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground">No se encontraron coincidencias</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Presiona Enter para usar: <span className="font-medium text-foreground">"{inputValue}"</span>
                </p>
              </div>
            </CommandEmpty>
            {searchResults.length > 0 && (
              <CommandGroup heading={inputValue.length >= 2 ? "Coincidencias" : "Más frecuentes"}>
                {searchResults.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    onSelect={() => handleSelect(item.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{item.value}</span>
                    <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {item.count}x
                    </span>
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
