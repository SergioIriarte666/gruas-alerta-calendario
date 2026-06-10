import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
    'h-11 w-[176px] justify-start rounded-xl border-[#d9dde7] px-3 text-left font-normal shadow-sm transition-colors hover:bg-[#f4f7fb]';

  return (
    <div className="mb-6 rounded-[10px] border border-[#e2e8f0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <h3 className="text-sm font-medium text-[#64748b]">Filtros:</h3>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#94a3b8]">Desde:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  pickerBaseClassName,
                  dateFrom
                    ? 'border-[#d8c8f6] bg-[#f3ecff] text-[#2f3f56]'
                    : 'bg-[#f8fafc] text-[#0f172a]',
                  !dateFrom && 'text-[#94a3b8]'
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
                  date > new Date() || (dateTo && date > dateTo)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#94a3b8]">Hasta:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  pickerBaseClassName,
                  dateTo
                    ? 'border-[#d8c8f6] bg-[#f3ecff] text-[#2f3f56]'
                    : 'bg-[#f8fafc] text-[#0f172a]',
                  !dateTo && 'text-[#94a3b8]'
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
                  date > new Date() || (dateFrom && date < dateFrom)
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
            className="h-11 rounded-xl px-3 text-[#64748b] hover:bg-slate-50 hover:text-[#334155]"
          >
            <X className="size-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
};
