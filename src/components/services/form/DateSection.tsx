
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateSectionProps {
  requestDate: Date;
  serviceDate: Date;
  onRequestDateChange: (date: Date) => void;
  onServiceDateChange: (date: Date) => void;
  disabled?: boolean;
}

export const DateSection = ({
  requestDate,
  serviceDate,
  onRequestDateChange,
  onServiceDateChange,
  disabled = false
}: DateSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Fecha de Solicitud */}
      <div className="space-y-2">
        <Label htmlFor="requestDate">Fecha de Solicitud</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !requestDate && "text-muted-foreground"
              )}
              title="Seleccionar fecha de solicitud"
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {requestDate ? format(requestDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={requestDate}
              onSelect={(date) => date && onRequestDateChange(date)}
              initialFocus
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Fecha de Servicio */}
      <div className="space-y-2">
        <Label htmlFor="serviceDate">Fecha de Servicio</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !serviceDate && "text-muted-foreground"
              )}
              title="Seleccionar fecha de servicio"
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {serviceDate ? format(serviceDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={serviceDate}
              onSelect={(date) => date && onServiceDateChange(date)}
              initialFocus
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
