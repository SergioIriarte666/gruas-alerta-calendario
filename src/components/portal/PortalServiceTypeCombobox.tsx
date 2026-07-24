import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PortalServiceTypeOption {
  id: string;
  name: string;
  description?: string | null;
}

interface PortalServiceTypeComboboxProps {
  serviceTypes: PortalServiceTypeOption[];
  value?: string;
  onValueChange: (value: string) => void;
  loading?: boolean;
}

export const PortalServiceTypeCombobox = ({
  serviceTypes,
  value,
  onValueChange,
  loading = false,
}: PortalServiceTypeComboboxProps) => {
  const [open, setOpen] = useState(false);
  const selectedServiceType = useMemo(
    () => serviceTypes.find((serviceType) => serviceType.id === value),
    [serviceTypes, value],
  );

  const handleSelect = (serviceTypeId: string) => {
    onValueChange(serviceTypeId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="service_type_id"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Buscar y seleccionar tipo de servicio"
          disabled={loading}
          className="portal-service-type-combobox"
        >
          <span
            className={cn(
              "truncate text-left",
              !selectedServiceType && "text-muted-foreground",
            )}
          >
            {loading
              ? "Cargando servicios..."
              : selectedServiceType?.name || "Busca o selecciona un servicio"}
          </span>
          {loading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ChevronsUpDown />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="portal-service-type-popover p-0"
      >
        <Command>
          <CommandInput placeholder="Buscar servicio por nombre..." />
          <CommandList>
            <CommandEmpty>
              No encontramos un servicio con ese nombre.
            </CommandEmpty>
            <CommandGroup
              heading={`${serviceTypes.length} servicios disponibles`}
            >
              {serviceTypes.map((serviceType) => (
                <CommandItem
                  key={serviceType.id}
                  value={`${serviceType.name} ${serviceType.description || ""}`}
                  onSelect={() => handleSelect(serviceType.id)}
                  className="portal-service-type-option"
                >
                  <Check
                    className={cn(
                      "shrink-0",
                      value === serviceType.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{serviceType.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
