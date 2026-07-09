import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export interface ProductComboboxItem {
  id: string;
  name: string;
  sku?: string | null;
  current_stock: number;
  unit_of_measure: string;
}

interface ProductComboboxProps {
  products: ProductComboboxItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hideOutOfStock?: boolean;
}

const UNIT_ABBREVIATIONS: Record<string, string> = {
  unidad: 'un.',
  litro: 'L',
  kilogramo: 'kg',
  metro: 'm',
  caja: 'cja.',
  paquete: 'paq.',
};

const abbreviateUnit = (unit: string) => UNIT_ABBREVIATIONS[unit] ?? unit;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const ProductCombobox = ({
  products,
  value,
  onChange,
  disabled = false,
  placeholder = 'Seleccionar producto',
  hideOutOfStock = false,
}: ProductComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hideOutOfStockState, setHideOutOfStockState] = useState(hideOutOfStock);
  const isMobile = useIsMobile();

  const selected = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const matches = products.filter((product) => {
      if (hideOutOfStockState && product.current_stock === 0) return false;
      if (!term) return true;
      const haystack = normalize(`${product.name} ${product.sku ?? ''}`);
      return haystack.includes(term);
    });

    return matches.sort((a, b) => {
      const aOut = a.current_stock === 0 ? 1 : 0;
      const bOut = b.current_stock === 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return a.name.localeCompare(b.name);
    });
  }, [products, search, hideOutOfStockState]);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setOpen(false);
    setSearch('');
  };

  const renderStockBadge = (product: ProductComboboxItem) => (
    <Badge
      variant={product.current_stock === 0 ? 'destructive' : 'success'}
      className="shrink-0 whitespace-nowrap text-[11px]"
    >
      {product.current_stock === 0
        ? 'Sin stock'
        : `${product.current_stock} ${abbreviateUnit(product.unit_of_measure)}`}
    </Badge>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className={cn('min-w-0 truncate text-left', !selected && 'text-muted-foreground')}>
              {selected ? selected.name : placeholder}
            </span>
            {selected && renderStockBadge(selected)}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border',
          isMobile ? 'min-w-[calc(100vw-2rem)]' : 'min-w-[360px]'
        )}
        align="start"
      >
        <Command shouldFilter={false} className="bg-popover">
          <CommandInput
            placeholder="Buscar producto..."
            value={search}
            onValueChange={setSearch}
            className="border-none focus:ring-0"
          />
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Checkbox
              id="product-combobox-hide-out-of-stock"
              checked={hideOutOfStockState}
              onCheckedChange={(checked) => setHideOutOfStockState(checked === true)}
            />
            <Label
              htmlFor="product-combobox-hide-out-of-stock"
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Ocultar sin stock
            </Label>
          </div>
          <CommandList className="max-h-72">
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {filtered.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.id}::${product.name} ${product.sku ?? ''}`}
                  disabled={product.current_stock === 0}
                  onSelect={() => handleSelect(product.id)}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <Check
                    className={cn('size-4 shrink-0', value === product.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{product.name}</span>
                    {product.sku && (
                      <span className="truncate text-xs text-muted-foreground">{product.sku}</span>
                    )}
                  </div>
                  {renderStockBadge(product)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
