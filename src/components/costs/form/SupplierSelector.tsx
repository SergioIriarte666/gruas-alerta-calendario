import React, { useMemo, useState } from 'react';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { UseFormReturn } from 'react-hook-form';
import { useSuppliers } from '@/hooks/useSuppliers';
import { QuickSupplierModal } from '@/components/suppliers/QuickSupplierModal';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Supplier } from '@/types/suppliers';

interface SupplierSelectorProps {
  form: UseFormReturn<any>;
  fieldName?: string;
  label?: string;
  placeholder?: string;
}

export interface SupplierComboboxProps {
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  noneLabel?: string;
  showNoneOption?: boolean;
  options?: Supplier[];
}

export const SupplierCombobox: React.FC<SupplierComboboxProps> = ({
  value,
  onValueChange,
  placeholder = 'Seleccionar proveedor',
  disabled = false,
  allowCreate = true,
  noneLabel = 'Sin proveedor',
  showNoneOption = true,
  options,
}) => {
  const { suppliers: suppliersFromHook, isLoading } = useSuppliers();
  const suppliers = options ?? suppliersFromHook;
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSupplierName = useMemo(() => {
    if (!value) return '';
    return suppliers.find((s) => s.id === value)?.name || suppliersFromHook.find((s) => s.id === value)?.name || '';
  }, [suppliers, suppliersFromHook, value]);

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 50);
    return suppliers.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const rut = (s.rut || '').toLowerCase();
      return name.includes(q) || rut.includes(q);
    });
  }, [query, suppliers]);

  const isDisabled = disabled || (!options && isLoading);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', !value ? 'text-muted-foreground' : '')}
            disabled={isDisabled}
          >
            <span className="truncate">{selectedSupplierName || placeholder}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
              className="p-0"
              align="start"
              style={{ width: 'var(--radix-popover-trigger-width)' }}
            >
          <Command>
            <CommandInput
              placeholder="Buscar proveedor por nombre o RUT..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-sm text-muted-foreground">
                  {query.trim() ? 'No se encontraron proveedores.' : 'Escribe para buscar proveedores.'}
                </div>
              </CommandEmpty>

              <CommandGroup>
                {showNoneOption && (
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onValueChange(null);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 size-4', !value ? 'opacity-100' : 'opacity-0')} />
                    {noneLabel}
                  </CommandItem>
                )}

                {filteredSuppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={`${supplier.name} ${supplier.rut || ''}`.trim()}
                    onSelect={() => {
                      onValueChange(supplier.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 size-4', value === supplier.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span className="font-medium">{supplier.name}</span>
                      {supplier.rut && (
                        <span className="text-xs text-muted-foreground">RUT: {supplier.rut}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}

                {allowCreate && (
                  <CommandItem
                    value="new_supplier"
                    onSelect={() => {
                      setOpen(false);
                      setShowQuickModal(true);
                    }}
                  >
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <Plus className="size-4" />
                      Crear nuevo proveedor...
                    </div>
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowCreate && (
        <QuickSupplierModal
          isOpen={showQuickModal}
          onClose={() => setShowQuickModal(false)}
          onSuccess={(supplierId) => {
            onValueChange(supplierId);
            setShowQuickModal(false);
          }}
        />
      )}
    </>
  );
};

export const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  form,
  fieldName = 'supplier_id',
  label = 'Proveedor',
  placeholder = 'Seleccionar proveedor',
}) => {
  return (
    <FormField
      name={fieldName}
      control={form.control}
      render={({ field }) => (
        <FormItem>
          <Label className="flex items-center gap-2 text-foreground">
            <Building2 className="size-4" />
            {label}
          </Label>
          <FormControl>
            <SupplierCombobox
              value={field.value ?? null}
              onValueChange={(v) => field.onChange(v)}
              placeholder={placeholder}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
