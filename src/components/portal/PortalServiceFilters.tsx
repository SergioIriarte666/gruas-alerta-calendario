import { businessClock } from "@/utils/businessClock";
import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PortalServiceFiltersProps {
  dateFrom?: Date;
  dateTo?: Date;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
}

export const PortalServiceFilters: React.FC<PortalServiceFiltersProps> = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
}) => {
  const hasFilters = dateFrom || dateTo;
  const pickerBaseClassName =
    "h-11 w-44 justify-start rounded-xl border-input px-3 text-left font-normal shadow-sm transition-colors hover:bg-muted/70";

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">Filtros:</h3>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Desde:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  pickerBaseClassName,
                  dateFrom
                    ? "border-primary/30 bg-accent text-foreground"
                    : "bg-muted/40 text-foreground",
                  !dateFrom && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {dateFrom ? (
                  format(dateFrom, "dd/MM/yyyy", { locale: es })
                ) : (
                  <span>Seleccionar</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={onDateFromChange}
                disabled={(date) =>
                  date > businessClock.now() || (dateTo && date > dateTo)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hasta:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  pickerBaseClassName,
                  dateTo
                    ? "border-primary/30 bg-accent text-foreground"
                    : "bg-muted/40 text-foreground",
                  !dateTo && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {dateTo ? (
                  format(dateTo, "dd/MM/yyyy", { locale: es })
                ) : (
                  <span>Seleccionar</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={onDateToChange}
                disabled={(date) =>
                  date > businessClock.now() || (dateFrom && date < dateFrom)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-11 rounded-xl px-3 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            <X className="size-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
};
