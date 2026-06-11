
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DatePickerInputProps {
  value: string; // formato "yyyy-MM-dd"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const DatePickerInput = ({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
  id
}: DatePickerInputProps) => {
  // Convertir string "yyyy-MM-dd" a Date para el Calendar
  const dateValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Crear fecha local manteniendo día, mes y año exactos
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      onChange(format(localDate, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className="block min-w-0 truncate">
            {value ? format(dateValue!, "dd/MM/yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
          locale={es}
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePickerInput;
